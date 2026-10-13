/**
 * Unit tests for the credential `EventClient` puts on its RPC calls.
 *
 * The stream and the control plane are two different requests. The server decides the
 * session identity once, on the stream request, and hands the client a resume credential
 * in the `welcome` frame. `EventClient` has to carry that credential on every `$sub` /
 * `$unsub` / `$publish` that follows, because that — not the self-reported
 * `rpc-client-id` header — is what makes the server resolve the control-plane call to the
 * same session the stream owns.
 *
 * Two properties are pinned here:
 *  - the credential (and the live stream's id) reaches the wire;
 *  - writing it never mutates an object another client of the class shares, and a stream
 *    that hands back no credential does not strip one that was already set.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { HttpClientToolTransport, RpcTransportManager } from '@isdk/tool-rpc';
import { EventClient } from '../src/event-client';
import { SSE_SESSION_TOKEN_HEADER } from '../src/utils';
import type { IPubSubClientTransport, PubSubClientStream } from '../src/transports/pubsub';

class FakeStream implements PubSubClientStream {
  protocol = 'sse'
  readyState = 1
  private listeners = new Map<string, Set<(data: any) => void>>()

  constructor(public clientId: string, public sessionToken?: string) {}

  on(event: string, listener: (data: any) => void) {
    (this.listeners.get(event) ?? this.listeners.set(event, new Set()).get(event)!).add(listener)
  }

  off(event: string, listener: (data: any) => void) {
    this.listeners.get(event)?.delete(listener)
  }

  close() { this.readyState = 2 }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(l => l(data))
  }
}

/** Hands out streams with the ids and credentials the server would have issued. */
class FakeTransport implements IPubSubClientTransport {
  queue: Array<{ clientId: string; sessionToken?: string }> = []
  connected: FakeStream[] = []

  connect(_url: string, _params?: any): PubSubClientStream {
    const spec = this.queue.shift() ?? { clientId: `stream-${this.connected.length}` }
    const stream = new FakeStream(spec.clientId, spec.sessionToken)
    this.connected.push(stream)
    return stream
  }
}

function makeClient(name: string) {
  return new EventClient(name)
}

let transport: FakeTransport

afterEach(() => {
  EventClient.setPubSubTransport(undefined)
  delete (EventClient as any).fetchOptions
  delete EventClient.apiUrl
  vi.unstubAllGlobals()
})

describe('EventClient carries the stream credential on the control plane', () => {
  it('puts the welcome credential and the server-assigned id on fetchOptions', async () => {
    transport = new FakeTransport()
    transport.queue = [{ clientId: 'sess-1', sessionToken: 'tok-1' }]
    EventClient.setPubSubTransport(transport)
    const client = makeClient('cred-1')

    await client.initEventStream()

    expect(client.fetchOptions?.headers?.[SSE_SESSION_TOKEN_HEADER], 'the credential rides every RPC call').toBe('tok-1')
    expect(client.fetchOptions?.clientId, 'the RPC id follows the id the server issued').toBe('sess-1')
  })

  it('follows the live stream: a new session replaces both id and credential', async () => {
    transport = new FakeTransport()
    transport.queue = [
      { clientId: 'sess-1', sessionToken: 'tok-1' },
      { clientId: 'sess-2', sessionToken: 'tok-2' },
    ]
    EventClient.setPubSubTransport(transport)
    const client = makeClient('cred-2')

    await client.initEventStream()
    client.close()
    await client.initEventStream()

    expect(client.fetchOptions?.clientId, 'the id of a session that no longer exists is dropped').toBe('sess-2')
    expect(client.fetchOptions?.headers?.[SSE_SESSION_TOKEN_HEADER]).toBe('tok-2')
  })

  it('drops the credential when the new stream was issued none, and keeps unrelated headers', async () => {
    transport = new FakeTransport()
    EventClient.setPubSubTransport(transport)
    const client = makeClient('cred-3')
    client.fetchOptions = { headers: { 'x-tenant': 'acme', [SSE_SESSION_TOKEN_HEADER]: 'stale' } }

    await client.initEventStream()

    const headers = client.fetchOptions?.headers ?? {}
    expect(headers[SSE_SESSION_TOKEN_HEADER], 'a policy that issues no credentials leaves nothing to present').toBeUndefined()
    expect(headers['x-tenant'], 'unrelated headers survive').toBe('acme')
  })

  it('writes a copy, never the object the class shares', async () => {
    // `ClientTools.fetch` deep-merges the class-level `fetchOptions` into every call, so
    // an in-place write here would leak one client's session credential into every other
    // client of the class — including clients that have no stream at all.
    const shared = { headers: { authorization: 'Bearer shared' } }
    EventClient.fetchOptions = shared

    transport = new FakeTransport()
    transport.queue = [{ clientId: 'sess-a', sessionToken: 'tok-a' }]
    EventClient.setPubSubTransport(transport)
    const client = makeClient('cred-4')

    await client.initEventStream()

    expect(shared.headers, 'the shared object is not the one written to').not.toBe(client.fetchOptions.headers)
    expect(shared.headers, 'no credential leaks into the class defaults').not.toHaveProperty(SSE_SESSION_TOKEN_HEADER)
    expect(shared.headers, 'no clientId leaks into the class defaults either').not.toHaveProperty('clientId')
    expect(client.fetchOptions.headers[SSE_SESSION_TOKEN_HEADER]).toBe('tok-a')
    // The class default is not copied into the instance — it merges at call time, which
    // is what the wire test below checks. What matters here is that the copy left the
    // shared object alone, so the merge still has something to merge.
    expect(client.fetchOptions.headers, 'the copy starts from the instance headers only').not.toHaveProperty('authorization')
  })

  it('reaches the wire: $sub carries rpc-session-token next to rpc-client-id', async () => {
    // The header pair is the whole point of the migration: the server resolves the call
    // from the credential, and the self-reported id is only ever a fallback.
    RpcTransportManager.bindScheme('http', HttpClientToolTransport)
    EventClient.apiUrl = 'http://127.0.0.1:1/api/'
    const shared = { headers: { authorization: 'Bearer class-default' } }
    EventClient.fetchOptions = shared

    transport = new FakeTransport()
    transport.queue = [{ clientId: 'sess-wire', sessionToken: 'tok-wire' }]
    EventClient.setPubSubTransport(transport)
    const client = makeClient('cred-5')
    ;(client as any).assignMethods(['$sub'])
    await client.initEventStream()

    const seen: Array<Record<string, string>> = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(init.headers ?? {})) headers[k.toLowerCase()] = String(v)
      seen.push(headers)
      return new Response(JSON.stringify({ subscribed: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }))

    const result = await (client as any).sub({ event: 'ctrl' })

    expect(result).toEqual({ subscribed: true })
    expect(seen).toHaveLength(1)
    expect(seen[0][SSE_SESSION_TOKEN_HEADER], 'the credential identifies the session to the policy').toBe('tok-wire')
    expect(seen[0]['rpc-client-id'], 'the id the stream was opened with still travels, as a fallback only').toBe('sess-wire')
    expect(seen[0].authorization, 'the class-level header still merges in, credential or not').toBe('Bearer class-default')
    expect(shared.headers, 'the call did not write the session credential into the class defaults either').not.toHaveProperty(SSE_SESSION_TOKEN_HEADER)
  })
})
