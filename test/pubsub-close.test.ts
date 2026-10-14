/**
 * The shared close contract and the SSE `closeSignal` switch.
 *
 * A server-ended session used to be invisible on SSE: `session.close()` ended the
 * HTTP response, and the client answered by resuming the very session that had just
 * been closed. The contract now lives in `transports/pubsub/close` so every
 * transport shares the names, the reasons and the "close every stream at once"
 * behaviour; SSE carries the notice as a `$close` frame, opt-in on both ends.
 *
 * What these tests pin down:
 *   - the contract's names and the stream registry (idempotent, notify-peer flag)
 *   - default off ⇒ no frame at all, byte-identical to the previous behaviour
 *   - the frame never enters the replay history (a stale close replayed to a
 *     reconnecting client would stop it reconnecting)
 *   - drops (socket close, maxStreamDuration, takeover) never announce
 *   - `server+reset` announces a channel reset too
 *   - end to end: opted in ⇒ the stream goes CLOSED and stops reconnecting;
 *     opted out ⇒ the old reconnect-and-resume behaviour is untouched
 */
import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { SSEChannel } from '../src/utils/sse-channel';
import {
  PubSubCloseEvent,
  PubSubStreamRegistry,
  PubSubWelcomeEvent,
  SSE_CLOSE_EVENT,
  SSE_CONTROL_EVENT_PREFIX,
} from '../src/transports/pubsub/close';
import { SseServerPubSubTransport } from '../src/transports/pubsub/sse-server';
import { SseClientPubSubTransport } from '../src/transports/pubsub/sse-client';
import { sleep, waitFor } from './utils/wait';

function makeRes() {
  const chunks: string[] = []
  const handlers: Record<string, Function[]> = {}
  return {
    chunks,
    writeHead() {},
    write(s: string) { chunks.push(s) },
    end() {},
    on(event: string, cb: Function) { (handlers[event] ??= []).push(cb) },
    /** Fire a recorded handler, e.g. `fire('close')` to simulate the stream dropping. */
    fire(event: string) { (handlers[event] ?? []).slice().forEach(cb => cb()) },
    writableEnded: false,
  } as any
}

function makeReq(url = '/stream') {
  const handlers: Record<string, Function[]> = {}
  return {
    url,
    headers: {},
    socket: { setNoDelay() {} },
    on(event: string, cb: Function) { (handlers[event] ??= []).push(cb) },
    fire(event: string) { (handlers[event] ?? []).slice().forEach(cb => cb()) },
  } as any
}

const closeFrames = (res: ReturnType<typeof makeRes>) =>
  res.chunks.join('').split('\n\n').filter(f => f.includes(`event: ${SSE_CLOSE_EVENT}`))

const closeReasonOf = (frame: string) => {
  const dataLine = frame.split('\n').find(l => l.startsWith('data: '))
  if (!dataLine) throw new Error('close frame has no data line')
  return JSON.parse(dataLine.slice('data: '.length)) as { reason: string }
}

describe('PubSub close contract', () => {
  it('names the handshake and the close notice once, for every transport', () => {
    expect(PubSubWelcomeEvent).toBe('welcome')
    expect(PubSubCloseEvent).toBe('close')
    // SSE has no channel of its own, so its frame needs the control-plane prefix
    // that $sub/$unsub/$publish already use; Electron uses the bare name as a
    // channel suffix (`pubsub-close:{ns}`), where the namespace isolates it.
    expect(SSE_CONTROL_EVENT_PREFIX).toBe('$')
    expect(SSE_CLOSE_EVENT).toBe(`${SSE_CONTROL_EVENT_PREFIX}${PubSubCloseEvent}`)
  })

  it('closes every tracked stream at once, and only once', () => {
    const registry = new PubSubStreamRegistry()
    const calls: boolean[][] = []
    let open = 0

    const add = () => {
      let closed = false
      open++
      const off = registry.register((notifyPeer) => {
        if (closed) return
        closed = true
        open--
        calls.push([notifyPeer])
      })
      return off
    }

    add()
    add()
    const offThird = add()
    offThird() // a stream that closed on its own stops being tracked
    expect(registry.size).toBe(2)

    registry.closeAll(false)
    expect(calls).toEqual([[false], [false]])
    expect(registry.size).toBe(0)
    expect(open).toBe(1) // the unregistered stream was never closed by the registry

    // A later `stream.close()` reaches the teardown again; the guard keeps it a
    // no-op rather than a second notice to the peer.
    registry.closeAll(true)
    expect(calls.length).toBe(2)
  })
})

describe('SSEChannel closeSignal', () => {
  let channel: SSEChannel | undefined

  afterEach(() => {
    if (channel) channel.active = false
    channel = undefined
  })

  it('sends nothing by default, so the stream is byte-identical to before', () => {
    const ch = new SSEChannel({ pingInterval: 0 })
    channel = ch
    const res = makeRes()
    const client = ch.connect(makeReq(), res, ['keep'], { id: 's1' })

    ch.closeSession(client, 'server')

    expect(closeFrames(res)).toEqual([])
    // The session is still resumable: a client that did not opt in behaves as before.
    expect(ch.isResumable('s1')).toBe(true)
  })

  it('announces a server-ended session, outside the replay history', () => {
    const ch = new SSEChannel({ pingInterval: 0, closeSignal: 'server' })
    channel = ch
    const res = makeRes()
    const client = ch.connect(makeReq(), res, ['keep'], { id: 's1' })

    ch.closeSession(client, 'server')

    const frames = closeFrames(res)
    expect(frames).toHaveLength(1)
    expect(closeReasonOf(frames[0])).toEqual({ reason: 'server' })
    // Not part of the replayable sequence: a reconnect must not be handed a stale
    // close and stop reconnecting.
    expect(ch.messages.some(m => m.output.includes(`event: ${SSE_CLOSE_EVENT}`))).toBe(false)
  })

  it('never announces a drop, only a decision', async () => {
    const ch = new SSEChannel({ pingInterval: 0, closeSignal: 'server+reset', maxStreamDuration: 30 })
    channel = ch

    const dropped = makeRes()
    ch.connect(makeReq(), dropped, ['keep'], { id: 's1' })
    dropped.fire('close') // the stream died
    expect(closeFrames(dropped)).toEqual([])
    expect(ch.isResumable('s1')).toBe(true)

    const timedOut = makeRes()
    ch.connect(makeReq(), timedOut, ['keep'], { id: 's2' })
    // maxStreamDuration (30ms here) ends the stream on a timer: a drop, resumable,
    // and it must not be announced as a close.
    await waitFor(() => ch.isResumable('s2'), { label: 'maxStreamDuration drop' })
    await sleep(60)
    expect(closeFrames(timedOut)).toEqual([])

    // A resume takeover replaces the stream but keeps the session: no notice either.
    const taken = makeRes()
    const live = makeRes()
    ch.connect(makeReq(), taken, ['keep'], { id: 's3' })
    ch.connect(makeReq(), live, ['keep'], { id: 's3' })
    expect(closeFrames(taken)).toEqual([])
  })

  it('announces a channel reset only when asked to', () => {
    const silent = new SSEChannel({ pingInterval: 0, closeSignal: 'server' })
    channel = silent
    const silentRes = makeRes()
    silent.connect(makeReq(), silentRes, ['keep'], { id: 's1' })
    silent.active = false
    expect(closeFrames(silentRes)).toEqual([])
    channel = undefined

    const loud = new SSEChannel({ pingInterval: 0, closeSignal: 'server+reset' })
    channel = loud
    const res = makeRes()
    loud.connect(makeReq(), res, ['keep'], { id: 's1' })
    loud.active = false
    const frames = closeFrames(res)
    expect(frames).toHaveLength(1)
    expect(closeReasonOf(frames[0])).toEqual({ reason: 'transport-cleanup' })
  })

  it('routes session.close() through the announcement', () => {
    const transport = new SseServerPubSubTransport({ closeSignal: 'server' })
    const res = makeRes()
    const session = transport.connect({ req: makeReq(), res, identity: { id: 's1' } })

    session.close()

    const frames = closeFrames(res)
    expect(frames).toHaveLength(1)
    expect(closeReasonOf(frames[0])).toEqual({ reason: 'server' })
  })
})

describe('SSE close notice end to end', () => {
  let server: http.Server | undefined
  let channel: SSEChannel | undefined

  afterEach(async () => {
    if (channel) channel.active = false
    channel = undefined
    if (server) {
      await new Promise<void>(resolve => server!.close(() => resolve()))
      server = undefined
    }
  })

  /** Serve one SSE stream per request through `channel`, recording each connect. */
  async function serve(ch: SSEChannel) {
    const connects: Array<{ id: string; res: http.ServerResponse }> = []
    const srv = http.createServer((req, res) => {
      const client = ch.connect(req, res, ['keep'], { id: 'session-1' })
      connects.push({ id: client.clientId, res })
    })
    await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve))
    server = srv
    channel = ch
    const port = (srv.address() as AddressInfo).port
    return { apiRoot: `http://127.0.0.1:${port}/`, connects }
  }

  it('an opted-in client goes CLOSED and stops reconnecting', async () => {
    const ch = new SSEChannel({ pingInterval: 0, closeSignal: 'server', clientRetryInterval: 50 })
    const { apiRoot, connects } = await serve(ch)

    const transport = new SseClientPubSubTransport({ closeSignal: true })
    transport.setApiRoot(apiRoot)
    const stream = await transport.connect('stream')
    expect(stream.readyState).toBe(1)
    expect(stream.clientId).toBe('session-1')

    const client = ch.getClient('session-1')!
    ch.closeSession(client, 'server')

    await waitFor(() => stream.readyState === 2, { label: 'stream closed by the server' })
    expect(stream.closeReason).toBe('server')

    // The retry interval is 50ms: give it plenty of time, then check the server
    // was never asked for the session again.
    await sleep(400)
    expect(connects).toHaveLength(1)
    expect(stream.readyState).toBe(2)
  })

  it('a client that did not opt in keeps resuming, as before', async () => {
    const ch = new SSEChannel({ pingInterval: 0, closeSignal: 'server', clientRetryInterval: 50 })
    const { apiRoot, connects } = await serve(ch)

    const transport = new SseClientPubSubTransport()
    transport.setApiRoot(apiRoot)
    const stream = await transport.connect('stream')

    const client = ch.getClient('session-1')!
    ch.closeSession(client, 'server')

    // The frame is on the wire but nobody listens: the connection comes back.
    await waitFor(() => connects.length > 1, { label: 'client reconnected', timeout: 4000 })
    expect(stream.readyState).not.toBe(2)
    expect(stream.closeReason).toBeUndefined()
  })

  it('a server that did not opt in sends no frame, opted-in client or not', async () => {
    const ch = new SSEChannel({ pingInterval: 0, clientRetryInterval: 50 })
    const { apiRoot, connects } = await serve(ch)

    const transport = new SseClientPubSubTransport({ closeSignal: true })
    transport.setApiRoot(apiRoot)
    const stream = await transport.connect('stream')

    const client = ch.getClient('session-1')!
    ch.closeSession(client, 'server')

    // Nothing was announced, so the client treats the ended response as a drop and
    // comes back — the behaviour an application that never opted in relies on.
    await waitFor(() => connects.length > 1, { label: 'client reconnected', timeout: 4000 })
    expect(stream.readyState).not.toBe(2)
    expect(stream.closeReason).toBeUndefined()
  })
})
