/**
 * Unit tests for SSEChannel: history replay and session identity.
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
 * Session identity is decided by tool-rpc's `RpcIdentityPolicy`, once per request, in the
 * transport pipeline — never by the channel. These tests stand in for that pipeline with
 * `resolveSSEIdentity` and hand the result to `connect`, which pins the division: the
 * policy vouches for the credential, the channel's resume window decides whether the
 * session behind it is still alive.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { RPC_HEADERS, RpcSessionIdentityPolicy } from '@isdk/tool-rpc';
import { SSEChannel } from '../src/utils/sse-channel';
import { resolveSSEIdentity } from '../src/utils/sse-identity';
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
    ch.connect(makeReq(), firstRes, ['keep'], { id: 's1' })

    // The welcome frame is published through the same path, so it is id 1.
    const welcomeId = ch.messages[0].id
    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'skip')

    // Reconnect reporting the welcome id: both publishes are replay candidates.
    const replayRes = makeRes()
    ch.connect(makeReq(welcomeId), replayRes, ['keep'], { id: 's2' })
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
    ch.connect(makeReq(), makeRes(), ['keep'], { id: 's1' })
    ch.publish({ n: 1 }, 'keep')

    // messages[0] is the welcome frame; the publish below is the next record.
    expect(ch.messages[1].eventName, 'the replay filter reads `eventName`, not `_eventName`').toBe('keep')
  })

  it('replays the whole history to a client with no subscription list', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    ch.connect(makeReq(), firstRes, undefined, { id: 's1' })
    const welcomeId = ch.messages[0].id
    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'skip')

    const replayRes = makeRes()
    ch.connect(makeReq(welcomeId), replayRes, undefined, { id: 's2' })
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

  /**
   * What the RPC transport does per request: resolve the identity once, then open the
   * stream with it. `url` carries the resume credential the way EventSource must.
   */
  const openWith = async (policy: RpcSessionIdentityPolicy, ch: SSEChannel, url: string, res = makeRes(), events?: string[]) => {
    const req = makeReq(url)
    const identity = await resolveSSEIdentity(policy, { req })
    return { client: ch.connect(req, res, events, identity), identity }
  }

  it('issues the session id from the server and hands back a resume credential', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const { client } = await openWith(policy, ch, '/stream', res, ['keep'])
    const welcome = readWelcome(res)

    expect(welcome.clientId).toBe(client.clientId)
    expect(typeof welcome.sessionToken, 'the welcome frame carries the credential the client presents on reconnect').toBe('string')
  })

  it('refuses to open a stream it has no identity for', () => {
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    // The channel must not fall back to minting an id of its own: that would put a second
    // identity decision on a request the RPC transport already decided.
    expect(() => ch.connect(makeReq(), makeRes(), ['keep'])).toThrow(/requires a resolved identity/)
    expect(ch.clients.size).toBe(0)
  })

  it('resumes the same session on reconnect, keeping subscriptions added after the first connect', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken

    // Subscribed after the stream URL was frozen, so the reconnect URL cannot carry it.
    ch.subscribe(first.clientId, ['late'])
    ch.disconnect(first) // the connection drops

    const replayRes = makeRes()
    const { client: second } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, replayRes, ['keep'])

    expect(second.clientId, 'a drop must not change the session id').toBe(first.clientId)
    expect(eventNames(ch.getClient(second.clientId)?.events), 'the list from the reconnect URL is merged, not a replacement').toEqual(['keep', 'late'])
  })

  it('does not resurrect an event the client unsubscribed', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', firstRes, ['keep', 'gone'])
    const token = readWelcome(firstRes).sessionToken

    ch.unsubscribe(first.clientId, ['gone'])
    ch.disconnect(first)

    // The reconnect URL still lists 'gone' — it is frozen at the first connect.
    const { client: second } = await openWith(policy, ch, `/stream?events=keep,gone&session_token=${token}`, makeRes(), ['keep', 'gone'])
    expect(eventNames(ch.getClient(second.clientId)?.events)).toEqual(['keep'])
  })

  it('keeps a session with no subscription list subscribed to nothing', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', res)
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    const { client: second } = await openWith(policy, ch, `/stream?session_token=${token}`)
    expect(second.clientId).toBe(first.clientId)
    expect(ch.getClient(second.clientId)?.events, 'a session subscribed to nothing must not gain the URL list').toBeUndefined()
  })

  it('resumes the same session across several drops within the window', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', res, ['keep'])
    const token = readWelcome(res).sessionToken

    let current = first
    for (let drop = 0; drop < 3; drop++) {
      ch.disconnect(current)
      current = (await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, makeRes(), ['keep'])).client
      expect(current.clientId, `drop ${drop + 1} must resume the same session`).toBe(first.clientId)
    }
  })

  it('reports a session it knows nothing about as not resumable', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    expect(ch.isResumable('never-connected')).toBe(false)
    const { client } = await openWith(policy, ch, '/stream', makeRes(), ['keep'])
    expect(ch.isResumable(client.clientId)).toBe(true)
  })

  it('replays from the last event id a resumed stream reports in the URL', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken
    const welcomeId = ch.messages[0].id

    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'other')
    ch.disconnect(first)

    // A resumed stream is a new EventSource and cannot set the `last-event-id` header.
    const replayRes = makeRes()
    await openWith(policy, ch, `/stream?events=keep&session_token=${token}&last_event_id=${welcomeId}`, replayRes, ['keep'])
    const body = replayRes.chunks.join('')

    expect(body).toContain('"n":1')
    expect(body).not.toContain('"n":2')
  })

  it('prefers the last-event-id header over the URL form', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken
    const welcomeId = ch.messages[0].id

    ch.publish({ n: 1 }, 'keep')
    ch.publish({ n: 2 }, 'keep')
    ch.disconnect(first)

    // Header says "replay from the welcome", URL claims a id past the end of history.
    const replayRes = makeRes()
    const req = makeReq(`/stream?events=keep&session_token=${token}&last_event_id=9999`)
    req.headers['last-event-id'] = String(welcomeId)
    const identity = await resolveSSEIdentity(policy, { req })
    ch.connect(req, replayRes, ['keep'], identity)
    const body = replayRes.chunks.join('')

    expect(body).toContain('"n":1')
    expect(body).toContain('"n":2')
  })

  it('never lets a forged credential select a session', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', firstRes, ['keep'])
    ch.disconnect(first)

    // The policy vouches for credentials it issued; a forged one resolves to a new
    // identity, so the channel has no session to resume.
    const { client: second } = await openWith(policy, ch, '/stream?events=keep&session_token=FORGED', makeRes(), ['keep'])
    expect(second.clientId).not.toBe(first.clientId)
  })

  it('closes the resume window, after which a reconnect keeps the id but not the session state', async () => {
    // The credential is still good (the policy's ttl is the default 30s): it is the
    // channel's resume window that expired. The id belongs to the policy, so it does not
    // change — what the window closes is the resume itself: the subscription list the
    // session died with, and the replay from it.
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, resumeWindow: 20 })
    channel = ch
    const res = makeRes()
    const { client: first, identity } = await openWith(policy, ch, '/stream', res, ['keep'])
    ch.disconnect(first)

    await sleep(30)
    const second = ch.connect(makeReq('/stream?events=fresh'), makeRes(), ['fresh'], identity)
    expect(second.clientId, 'the id is the policy\'s; the window cannot change it').toBe(first.clientId)
    expect(eventNames(ch.getClient(second.clientId)?.events), 'the window closed, so the URL list is the list').toEqual(['fresh'])
  })

  it('honours the credential expiry of the policy', async () => {
    const policy = new RpcSessionIdentityPolicy({ ttlMs: 15 })
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', res, ['keep'])
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    await sleep(25)
    const { client: expired } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, makeRes(), ['keep'])
    expect(expired.clientId, 'a credential presented after its ttl vouches for nothing').not.toBe(first.clientId)
  })

  it('lets a policy that issues no credential open a stream with nothing to resume', async () => {
    const policy = {
      name: 'fixed',
      match: () => undefined,
      assign: () => ({ id: 'fixed-session-id' }),
    }
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const req = makeReq('/stream')
    const client = ch.connect(req, res, ['keep'], await resolveSSEIdentity(policy, { req }))

    expect(client.clientId).toBe('fixed-session-id')
    expect(readWelcome(res).sessionToken, 'a policy without credentials issues none').toBeUndefined()
  })

  it('revokes every credential when the channel is reset', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, revoke: (id: string) => policy.revoke(id) })
    channel = ch
    const res = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', res, ['keep'])
    const token = readWelcome(res).sessionToken
    ch.disconnect(first)

    ch.active = false // resets the channel, clearing clients and resumable sessions
    ch.active = true
    const { client: second } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, makeRes(), ['keep'])
    expect(second.clientId, 'a reset channel must not be resumable').not.toBe(first.clientId)
  })

  it('gives a session one live stream: a second connection carrying the credential takes it over', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const firstRes = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', firstRes, ['keep'])
    const token = readWelcome(firstRes).sessionToken

    const closed: string[] = []
    firstRes.end = () => { closed.push('first') }

    const secondRes = makeRes()
    const { client: second } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, secondRes, ['keep'])

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

  it('mints a new session once the credential has used up its allowed presentations', async () => {
    // The use limit counts *presentations* (the issuing connect mints, it does not
    // present), so it bounds how far one credential can carry a session across drops.
    const policy = new RpcSessionIdentityPolicy({ maxUses: 1 })
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0 })
    channel = ch
    const res = makeRes()
    const { client: first } = await openWith(policy, ch, '/stream', res, ['keep'])
    const token = readWelcome(res).sessionToken

    const { client: second } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, makeRes(), ['keep'])
    expect(second.clientId, 'within the limit the credential resumes its session').toBe(first.clientId)

    const { client: third } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, makeRes(), ['keep'])
    expect(third.clientId, 'past the limit the credential vouches for nothing').not.toBe(first.clientId)
    expect(ch.clients.size, 'the exhausted credential opened a second live session, it did not take the first over').toBe(2)
    expect([...ch.clients.keys()].sort(), 'both sessions are live under their own id').toEqual([first.clientId, third.clientId].sort())
  })

  it('ends the stream at maxStreamDuration and leaves the session resumable', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const ch = new SSEChannel({ pingInterval: 0, rewind: 0, maxStreamDuration: 30, resumeWindow: 5000 })
    channel = ch
    const res = makeRes()
    let ended = false
    res.end = () => { ended = true; res.writableEnded = true }
    const { client: first } = await openWith(policy, ch, '/stream', res, ['keep'])
    const token = readWelcome(res).sessionToken

    await waitFor(() => ended, { timeout: 2000, label: 'the stream time limit ended the stream' })
    expect(ch.getClient(first.clientId), 'the timed-out stream is no longer live').toBeUndefined()

    const { client: second } = await openWith(policy, ch, `/stream?events=keep&session_token=${token}`, makeRes(), ['keep'])
    expect(second.clientId, 'a stream ended by the time limit resumes the same session').toBe(first.clientId)
  })
})

describe('SseServerPubSubTransport session takeover', () => {
  it('keeps the live session when the stream it replaced reports close', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const transport = new SseServerPubSubTransport({ channelOptions: { pingInterval: 0, rewind: 0 } })
    const req1 = makeReq('/api/rpc/event')
    const res1 = makeRes()
    const first = transport.connect({
      req: req1, res: res1, events: ['keep'],
      identity: await resolveSSEIdentity(policy, { req: req1 }),
    })
    const token = readWelcome(res1).sessionToken

    const disconnected: string[] = []
    transport.onDisconnect(s => disconnected.push(String(s.clientId)))

    const req2 = makeReq(`/api/rpc/event?session_token=${token}`)
    const res2 = makeRes()
    const second = transport.connect({
      req: req2, res: res2, events: ['keep'],
      identity: await resolveSSEIdentity(policy, { req: req2 }),
    })

    expect(second.clientId).toBe(first.clientId)

    // The replaced stream reports close *after* the takeover; that must not release
    // the session the live stream owns, or `$sub` would find no session to subscribe.
    req1.fire('close')
    expect(disconnected, 'a stale close must not fire the disconnect callback').toEqual([])
    expect(transport.getSessionFromIdentity(second.clientId)).toBe(second)

    req2.fire('close')
    expect(disconnected).toEqual([second.clientId])
    expect(transport.getSessionFromIdentity(second.clientId)).toBeUndefined()
  })

  it('keys the session on the resolved identity, never on a client-supplied id', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const transport = new SseServerPubSubTransport({ channelOptions: { pingInterval: 0, rewind: 0 } })
    const req = makeReq('/api/rpc/event')
    const identity = await resolveSSEIdentity(policy, { req })

    const session = transport.connect({ req, res: makeRes(), events: ['keep'], identity, clientId: 'client-chosen-id' })

    expect(session.clientId, 'the id a `$sub`/`$publish` call is matched on is not client-selectable').toBe(identity.id)
    expect(session.identity, 'the session carries the identity it was resolved to').toEqual(identity)
    expect(transport.getSessionFromIdentity('client-chosen-id')).toBeUndefined()
  })

  it('refuses a stream request the transport resolved no identity for', () => {
    const transport = new SseServerPubSubTransport({ channelOptions: { pingInterval: 0, rewind: 0 } })
    expect(() => transport.connect({ req: makeReq('/api/rpc/event'), res: makeRes(), events: ['keep'] }))
      .toThrow(/requires an identity policy/)
  })

  it('looks a session up by the identity id, and still honours the deprecated header read', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const transport = new SseServerPubSubTransport({ channelOptions: { pingInterval: 0, rewind: 0 } })
    const req = makeReq('/api/rpc/event')
    const identity = await resolveSSEIdentity(policy, { req })
    const session = transport.connect({ req, res: makeRes(), events: ['keep'], identity })

    expect(transport.getSessionFromIdentity(identity.id)).toBe(session)
    expect(transport.getSessionFromIdentity(undefined), 'no identity, no session').toBeUndefined()

    // Deprecated, and kept working on purpose: a caller that has not migrated to
    // `ctx.identity` still resolves, it just resolves through the header the identity
    // policy exists to stop trusting.
    const caller = makeReq('/api/rpc/event')
    caller.headers[RPC_HEADERS.CLIENT_ID] = session.clientId
    expect(transport.getSessionFromReq(caller)).toBe(session)
    expect(transport.getSessionFromReq(makeReq('/api/rpc/event')), 'a call that names no id matches nothing').toBeUndefined()
  })

  it('passes the revoke option to the channel, so a reset drops the credentials it issued', async () => {
    const policy = new RpcSessionIdentityPolicy()
    const revoked: string[] = []
    const transport = new SseServerPubSubTransport({
      channelOptions: { pingInterval: 0, rewind: 0 },
      revoke: (id) => { revoked.push(id); policy.revoke(id) },
    })
    const req = makeReq('/api/rpc/event')
    const res = makeRes()
    const session = transport.connect({ req, res, events: ['keep'], identity: await resolveSSEIdentity(policy, { req }) })
    const token = readWelcome(res).sessionToken

    // The channel is the transport's private business; the reset is exactly what the
    // option is for, so this test reaches for it rather than widening the public surface.
    const channel = (transport as any).channel
    channel.active = false
    expect(revoked, 'a reset channel revokes every credential it handed out').toEqual([session.clientId])
    channel.active = true

    // With the credential revoked, the reconnect vouches for nothing and gets its own
    // session — the reset channel is not resumable.
    const req2 = makeReq(`/api/rpc/event?session_token=${token}`)
    const second = transport.connect({ req: req2, res: makeRes(), events: ['keep'], identity: await resolveSSEIdentity(policy, { req: req2 }) })
    expect(second.clientId).not.toBe(session.clientId)
  })
})
