/**
 * Unit tests for SSEChannel's Last-Event-ID history replay.
 *
 * A reconnecting EventSource reports the last id it saw in the `last-event-id`
 * header, and the channel replays the matching history before the stream goes live
 * again. The replay filter reads the history record's `eventName`, so a record that
 * only carried `_eventName` matched nothing: a client with a subscription list
 * silently lost every event published while it was down.
 *
 * The channel is driven with minimal req/res stand-ins — `connect` only needs
 * `headers`, `url`, `socket.setNoDelay`, `on('close')`, `writeHead`, `write` and `end`.
 *
 * The second suite covers session identity: who a connecting request belongs to is
 * decided by an injectable policy, and the default one issues a credential so a
 * dropped connection resumes the session it had — clientId and subscription list —
 * instead of landing on a brand-new one.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { SSEChannel } from '../src/utils/sse-channel';
import { createSSEIdentity, type SSEIdentityPolicy } from '../src/utils/sse-identity';
import { SseServerPubSubTransport } from '../src/transports/pubsub/sse-server';
import { sleep, waitFor } from './utils/wait';

function makeRes() {
  const chunks: string[] = []
  return {
    chunks,
    writeHead() {},
    write(s: string) { chunks.push(s) },
    end() {},
    on() {},
    writableEnded: false,
  } as any
}

function makeReq(lastEventIdOrUrl?: number | string) {
  const url = typeof lastEventIdOrUrl === 'string' ? lastEventIdOrUrl : '/stream'
  const lastEventId = typeof lastEventIdOrUrl === 'number' ? lastEventIdOrUrl : undefined
  const handlers: Record<string, Function[]> = {}
  return {
    url,
    headers: lastEventId === undefined ? {} : { 'last-event-id': String(lastEventId) },
    socket: { setNoDelay() {} },
    on(event: string, cb: Function) { (handlers[event] ??= []).push(cb) },
    /** Fire a recorded handler, e.g. `fire('close')` to simulate the socket dropping. */
    fire(event: string) { (handlers[event] ?? []).slice().forEach(cb => cb()) },
  } as any
}

/** The payload of the `welcome` frame a stream received. */
function readWelcome(res: ReturnType<typeof makeRes>) {
  const frame = res.chunks.join('').split('\n\n').find(f => f.includes('event: welcome'))
  if (!frame) throw new Error('no welcome frame was written')
  const dataLine = frame.split('\n').find(l => l.startsWith('data: '))
  if (!dataLine) throw new Error('welcome frame has no data line')
  return JSON.parse(dataLine.slice('data: '.length)) as { clientId: string; sessionToken?: string }
}

const eventNames = (events?: (string | RegExp)[]) => (events ?? []).map(e => e.toString())

describe('SSEChannel Last-Event-ID replay', () => {
  let channel: SSEChannel | undefined

  afterEach(() => {
    if (channel) channel.active = false
    channel = undefined
  })

  it('replays the events a reconnecting client is subscribed to, and only those', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    ch.connect(makeReq(), firstRes, ['keep'])

    // The welcome frame is published through the same path, so it is id 1.
    const welcomeId = ch.messages[0].id
    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'skip')

    // Reconnect reporting the welcome id: both publishes are replay candidates.
    const replayRes = makeRes()
    ch.connect(makeReq(welcomeId), replayRes, ['keep'])
    const body = replayRes.chunks.join('')

    expect(body).toContain('retry:')
    expect(body).toContain('event: keep')
    expect(body).toContain('"n":1')
    expect(body).not.toContain('event: skip')
    expect(body).not.toContain('"n":2')
  })

  it('records the event name on the history entry the replay filter reads', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    ch.connect(makeReq(), makeRes(), ['keep'])
    ch.publish({ n: 1 }, 'keep')

    // messages[0] is the welcome frame; the publish below is the next record.
    expect(ch.messages[1].eventName, 'the replay filter reads `eventName`, not `_eventName`').toBe('keep')
  })

  it('replays the whole history to a client with no subscription list', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    ch.connect(makeReq(), firstRes)
    const welcomeId = ch.messages[0].id
    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'skip')

    const replayRes = makeRes()
    ch.connect(makeReq(welcomeId), replayRes)
    const body = replayRes.chunks.join('')

    expect(body).toContain('event: keep')
    expect(body).toContain('event: skip')
  })
})

describe('SSEChannel session identity', () => {
  let channel: SSEChannel | undefined

  afterEach(() => {
    if (channel) channel.active = false
    channel = undefined
  })

  const open = (ch: SSEChannel, res = makeRes(), events?: string[], clientId?: string) =>
    ch.connect(makeReq('/stream'), res, events, clientId)

  it('issues the session id from the server and hands back a resume credential', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const client = open(ch, res, ['keep'])
    const welcome = readWelcome(res)

    expect(welcome.clientId).toBe(client.clientId)
    expect(typeof welcome.sessionToken, 'the welcome frame carries the credential the client presents on reconnect').toBe('string')
  })

  it('never adopts a clientId the client asks for', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    // The id a `$sub`/`$publish` call is matched on must not be client-selectable.
    const client = open(ch, makeRes(), ['keep'], 'client-chosen-id')
    expect(client.clientId).not.toBe('client-chosen-id')
  })

  it('resumes the same session on reconnect, keeping subscriptions added after the first connect', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const first = open(ch, firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken

    // Subscribed after the stream URL was frozen, so the reconnect URL cannot carry it.
    ch.subscribe(first.clientId, ['late'])
    ch.disconnect(first) // the connection drops

    const replayRes = makeRes()
    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), replayRes, ['keep'])

    expect(second.clientId, 'a drop must not change the session id').toBe(first.clientId)
    expect(eventNames(ch.getClient(second.clientId)?.events), 'the list from the reconnect URL is merged, not a replacement').toEqual(['keep', 'late'])
  })

  it('does not resurrect an event the client unsubscribed', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const first = open(ch, firstRes, ['keep', 'gone'])
    const token = readWelcome(firstRes).sessionToken

    ch.unsubscribe(first.clientId, ['gone'])
    ch.disconnect(first)

    // The reconnect URL still lists 'gone' — it is frozen at the first connect.
    const second = ch.connect(makeReq(`/stream?events=keep,gone&session_token=${token}`), makeRes(), ['keep', 'gone'])
    expect(eventNames(ch.getClient(second.clientId)?.events)).toEqual(['keep'])
  })

  it('keeps a session with no subscription list subscribed to nothing', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const first = open(ch, res)
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    const second = ch.connect(makeReq(`/stream?session_token=${token}`), makeRes())
    expect(second.clientId).toBe(first.clientId)
    expect(ch.getClient(second.clientId)?.events, 'a session subscribed to nothing must not gain the URL list').toBeUndefined()
  })

  it('resumes the same session across several drops within the window', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const first = open(ch, res, ['keep'])
    const token = readWelcome(res).sessionToken

    let current = first
    for (let drop = 0; drop < 3; drop++) {
      ch.disconnect(current)
      current = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
      expect(current.clientId, `drop ${drop + 1} must resume the same session`).toBe(first.clientId)
    }
  })

  it('reports a session it knows nothing about as not resumable', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    expect(ch.isResumable('never-connected')).toBe(false)
    const client = open(ch, makeRes(), ['keep'])
    expect(ch.isResumable(client.clientId)).toBe(true)
  })

  it('replays from the last event id a resumed stream reports in the URL', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const first = open(ch, firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken
    const welcomeId = ch.messages[0].id

    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'other')
    ch.disconnect(first)

    // A resumed stream is a new EventSource and cannot set the `last-event-id` header.
    const replayRes = makeRes()
    ch.connect(makeReq(`/stream?events=keep&session_token=${token}&last_event_id=${welcomeId}`), replayRes, ['keep'])
    const body = replayRes.chunks.join('')

    expect(body).toContain('"n":1')
    expect(body).not.toContain('"n":2')
  })

  it('prefers the last-event-id header over the URL form', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const first = open(ch, firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken
    const welcomeId = ch.messages[0].id

    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'keep')
    ch.disconnect(first)

    // Header says "replay from the welcome", URL claims a id past the end of history.
    const replayRes = makeRes()
    const req = makeReq(`/stream?events=keep&session_token=${token}&last_event_id=9999`)
    req.headers['last-event-id'] = String(welcomeId)
    ch.connect(req, replayRes, ['keep'])
    const body = replayRes.chunks.join('')

    expect(body).toContain('"n":1')
    expect(body).toContain('"n":2')
  })

  it('never lets a forged credential select a session', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const first = open(ch, firstRes, ['keep'])
    ch.disconnect(first)

    const second = ch.connect(makeReq('/stream?events=keep&session_token=FORGED'), makeRes(), ['keep'])
    expect(second.clientId).not.toBe(first.clientId)
  })

  it('closes the resume window, after which a reconnect starts a new session', async () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, resumeWindow: 20 })
    channel = ch
    const res = makeRes()
    const first = open(ch, res, ['keep'])
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    await sleep(30)
    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(second.clientId).not.toBe(first.clientId)
  })

  it('honours the credential expiry and use limit of the injected policy', async () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, identity: createSSEIdentity({ ttlMs: 15, maxUses: 1 }) })
    channel = ch
    const res = makeRes()
    const first = open(ch, res, ['keep'])
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    // The single allowed use resumes the session...
    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(second.clientId).toBe(first.clientId)
    ch.disconnect(second)

    // ...and the next presentation of the same credential does not.
    const third = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(third.clientId).not.toBe(first.clientId)

    // Expiry path: a fresh session, credential presented after its ttl.
    const liveRes = makeRes()
    const live = open(ch, liveRes, ['keep'])
    const liveToken = readWelcome(liveRes).sessionToken
    ch.disconnect(live)
    await sleep(25)
    const expired = ch.connect(makeReq(`/stream?events=keep&session_token=${liveToken}`), makeRes(), ['keep'])
    expect(expired.clientId).not.toBe(live.clientId)
  })

  it('lets an injected policy decide the identity, with no credential required', () => {
    const calls: string[] = []
    const identity: SSEIdentityPolicy = {
      name: 'fixed',
      resolve: () => { calls.push('resolve'); return undefined },
      issue: () => { calls.push('issue'); return 'fixed-session-id' },
    }
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, identity })
    channel = ch
    const res = makeRes()
    const client = open(ch, res, ['keep'])

    expect(client.clientId).toBe('fixed-session-id')
    expect(calls).toContain('issue')
    expect(readWelcome(res).sessionToken, 'a policy without credentials issues none').toBeUndefined()
  })

  it('revokes every credential when the channel is reset', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const first = open(ch, res, ['keep'])
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    ch.active = false // resets the channel, clearing clients and resumable sessions
    ch.active = true
    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(second.clientId, 'a reset channel must not be resumable').not.toBe(first.clientId)
  })

  it('gives a session one live stream: a second connection carrying the credential takes it over', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const first = open(ch, firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken

    const closed: string[] = []
    firstRes.end = () => { closed.push('first') }

    const secondRes = makeRes()
    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), secondRes, ['keep'])

    expect(second.clientId, 'the second connection resumes the same session').toBe(first.clientId)
    expect(closed, 'the stream that lost the takeover is closed').toEqual(['first'])
    expect([...ch.clients.keys()], 'the session has exactly one live stream').toEqual([first.clientId])

    // Delivery follows the takeover. Without the takeover rule the session would have two
    // live streams and every publish would be delivered twice under one clientId.
    const firstChunks = firstRes.chunks.length
    ch.publish({ n: 1 }, 'keep')
    expect(firstRes.chunks.length, 'the replaced stream receives nothing').toBe(firstChunks)
    expect(secondRes.chunks.join(''), 'the live stream receives the publish').toContain('"n":1')
  })

  it('mints a new session once the credential has used up its allowed presentations', () => {
    // The use limit counts *presentations* (the issuing connect mints, it does not
    // present), so it bounds how far one credential can carry a session across drops.
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, identity: createSSEIdentity({ maxUses: 1 }) })
    channel = ch
    const res = makeRes()
    const first = open(ch, res, ['keep'])
    const token = readWelcome(res).sessionToken

    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(second.clientId, 'within the limit the credential resumes its session').toBe(first.clientId)

    const third = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(third.clientId, 'past the limit the credential vouches for nothing').not.toBe(first.clientId)
    expect(ch.clients.size, 'the exhausted credential opened a second live session, it did not take the first over').toBe(2)
    expect([...ch.clients.keys()].sort(), 'both sessions are live under their own id').toEqual([first.clientId, third.clientId].sort())
  })

  it('ends the stream at maxStreamDuration and leaves the session resumable', async () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, maxStreamDuration: 30, resumeWindow: 5000 })
    channel = ch
    const res = makeRes()
    let ended = false
    res.end = () => { ended = true; res.writableEnded = true }
    const first = open(ch, res, ['keep'])
    const token = readWelcome(res).sessionToken

    await waitFor(() => ended, { timeout: 2000, label: 'the stream time limit ended the stream' })
    expect(ch.getClient(first.clientId), 'the timed-out stream is no longer live').toBeUndefined()

    const second = ch.connect(makeReq(`/stream?events=keep&session_token=${token}`), makeRes(), ['keep'])
    expect(second.clientId, 'a stream ended by the time limit resumes the same session').toBe(first.clientId)
  })
})

describe('SseServerPubSubTransport session takeover', () => {
  it('keeps the live session when the stream it replaced reports close', () => {
    const transport = new SseServerPubSubTransport({ channelOptions: { pingInterval: 0, rewind: 0 } })
    const req1 = makeReq('/api/rpc/event')
    const res1 = makeRes()
    const first = transport.connect({ req: req1, res: res1, events: ['keep'] })
    const token = readWelcome(res1).sessionToken

    const disconnected: string[] = []
    transport.onDisconnect(s => disconnected.push(String(s.clientId)))

    const req2 = makeReq(`/api/rpc/event?session_token=${token}`)
    const res2 = makeRes()
    const second = transport.connect({ req: req2, res: res2, events: ['keep'] })

    expect(second.clientId).toBe(first.clientId)

    // The replaced stream reports close *after* the takeover; that must not release
    // the session the live stream owns, or `$sub` would find no session to subscribe.
    req1.fire('close')
    expect(disconnected, 'a stale close must not fire the disconnect callback').toEqual([])
    expect(transport.getSessionFromReq({ headers: { 'rpc-client-id': String(second.clientId) } } as any)).toBe(second)

    req2.fire('close')
    expect(disconnected).toEqual([second.clientId])
    expect(transport.getSessionFromReq({ headers: { 'rpc-client-id': String(second.clientId) } } as any)).toBeUndefined()
  })
})
