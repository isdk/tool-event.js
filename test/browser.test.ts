/**
 * Tests for the browser entry point (@isdk/tool-event/browser).
 *
 * These tests verify that all browser-safe components can be imported and used
 * correctly without pulling in Node.js-specific modules.
 */
import http from 'node:http' // drives the SSE server below

import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { waitForSettled } from './utils/wait'

// ---------------------------------------------------------------------------
// 1. Verify all exports from the browser entry are accessible
// ---------------------------------------------------------------------------
import {
  // event bus utilities
  EventEmitter,
  eventable,
  EventStates,
  wrapEventEmitter,
  EventName,
  EventBusName,
  backendEventable,

  // event bus singleton
  EventToolFunc,
  event as eventBus,

  // event client
  EventClient,
  eventClient,
  EventClientFuncParams,

  // event server (abstract)
  EventServer,
  eventServer,
  EventServerFuncParams,
  ClientEventPrefix,

  // SSE client transport
  SseClientPubSubTransport,

  // URL param utility
  genUrlParamsStr,

  // Event pattern utilities
  normalizeEventPattern,
} from '../src/browser'

// Type-only exports cannot be tested at runtime, but we verify they are defined
// by importing from the module (TypeScript compilation check).

describe('browser entry - named exports', () => {

  it('should export event bus utilities', () => {
    expect(EventEmitter).toBeDefined()
    expect(eventable).toBeDefined()
    expect(EventStates).toBeDefined()
    expect(wrapEventEmitter).toBeDefined()
    expect(EventName).toBe('event')
    expect(EventBusName).toBe('event-bus')
    expect(backendEventable).toBeTypeOf('function')
  })

  it('should export EventToolFunc and event singleton', () => {
    expect(EventToolFunc).toBeDefined()
    expect(eventBus).toBeDefined()
    expect(eventBus).toBeInstanceOf(EventToolFunc)
    expect(eventBus.description).toBe('Return event bus')
    expect(eventBus.result).toBe('event')
  })

  it('should export EventClient and eventClient singleton', () => {
    expect(EventClient).toBeDefined()
    expect(eventClient).toBeDefined()
    expect(eventClient).toBeInstanceOf(EventClient)
  })

  it('should export EventServer (abstract) and eventServer singleton', () => {
    expect(EventServer).toBeDefined()
    expect(eventServer).toBeDefined()
    expect(eventServer).toBeInstanceOf(EventServer)
    expect(ClientEventPrefix).toBe('client:')
  })

  it('should export SseClientPubSubTransport', () => {
    expect(SseClientPubSubTransport).toBeDefined()
  })

  it('should export genUrlParamsStr', () => {
    expect(genUrlParamsStr).toBeTypeOf('function')
    expect(genUrlParamsStr({ key: 'val' })).toBe('?p=' + encodeURIComponent('{"key":"val"}'))
    expect(genUrlParamsStr({ key: 'val' }, true)).toBe('p=' + encodeURIComponent('{"key":"val"}'))
    expect(genUrlParamsStr({})).toBe('')
  })

  it('should export normalizeEventPattern', () => {
    expect(normalizeEventPattern).toBeTypeOf('function')
    expect(normalizeEventPattern('/group:.*/')).toBeInstanceOf(RegExp)
    expect(normalizeEventPattern('group:one')).toBe('group:one')
  })
})

// ---------------------------------------------------------------------------
// 2. EventToolFunc behavior
// ---------------------------------------------------------------------------
describe('EventToolFunc (browser)', () => {
  it('should return an emitter from runSync', () => {
    const emitter = eventBus.runSync()
    expect(emitter).toBeDefined()
    expect(emitter.on).toBeTypeOf('function')
    expect(emitter.off).toBeTypeOf('function')
    expect(emitter.emit).toBeTypeOf('function')
    expect(emitter.emitAsync).toBeTypeOf('function')
  })

  it('should be able to emit and listen to events', () => {
    const emitter = eventBus.runSync()
    const listener = vi.fn()
    emitter.on('test-event', listener)
    emitter.emit('test-event', 1, 2, 3)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(1, 2, 3)
    emitter.off('test-event', listener)
  })
})

// ---------------------------------------------------------------------------
// 3. EventClient construction and methods
// ---------------------------------------------------------------------------
describe('EventClient (browser)', () => {
  it('should create a new EventClient instance', () => {
    const client = new EventClient('my-events')
    expect(client).toBeInstanceOf(EventClient)
    expect(client.name).toBe('my-events')
  })

  it('should have the expected event methods', () => {
    const client = new EventClient('test-client')
    // Direct methods on EventClient
    expect(client.subscribe).toBeTypeOf('function')
    expect(client.unsubscribe).toBeTypeOf('function')
    expect(client.close).toBeTypeOf('function')
    expect(client.init).toBeTypeOf('function')
    expect(client.initEventStream).toBeTypeOf('function')
    expect(client.getEvtSource).toBeTypeOf('function')
    expect(client.forwardEvent).toBeTypeOf('function')
    expect(client.unforwardEvent).toBeTypeOf('function')
    expect(client.setActive).toBeTypeOf('function')
    // Note: `publish` is an RPC method inherited from ResClientTools,
    // not a directly defined method on EventClient.
  })

  it('should have active property defaulting to false (no transport)', () => {
    const client = new EventClient('inactive-client')
    expect(client.active).toBe(false)
  })

  it('should support setPubSubTransport statically', () => {
    // Save original
    const originalTransport = EventClient._pubSubTransport
    try {
      const transport = new SseClientPubSubTransport()
      EventClient.setPubSubTransport(transport)
      expect(EventClient._pubSubTransport).toBe(transport)
    } finally {
      // Restore
      EventClient.setPubSubTransport(originalTransport)
    }
  })

  it('should throw when accessing pubSubTransport without setting it', () => {
    const savedTransport = EventClient._pubSubTransport
    EventClient._pubSubTransport = undefined as any
    try {
      expect(() => EventClient.pubSubTransport).toThrow('EventClient pubSubTransport not set')
    } finally {
      EventClient._pubSubTransport = savedTransport
    }
  })
})

// ---------------------------------------------------------------------------
// 4. EventServer (abstract) construction and methods
// ---------------------------------------------------------------------------
describe('EventServer (browser - abstract)', () => {
  it('should create a new EventServer instance', () => {
    const server = new EventServer('my-server')
    expect(server).toBeInstanceOf(EventServer)
    expect(server.name).toBe('my-server')
  })

  it('should have the expected server methods', () => {
    const server = new EventServer('test-server')
    expect(server.forward).toBeTypeOf('function')
    expect(server.unforward).toBeTypeOf('function')
    expect(server.publishServerEvent).toBeTypeOf('function')
    expect(server.isStream).toBeTypeOf('function')
    // RPC methods
    expect(server.list).toBeTypeOf('function')
    // $ methods (RPC handlers)
    expect((server as any).$sub).toBeTypeOf('function')
    expect((server as any).$unsub).toBeTypeOf('function')
    expect((server as any).$publish).toBeTypeOf('function')
  })

  it('should set autoInjectToLocalBus static property', () => {
    // Default is false
    expect(EventServer.autoInjectToLocalBus).toBe(false)
    // Toggle and verify
    EventServer.autoInjectToLocalBus = true
    expect(EventServer.autoInjectToLocalBus).toBe(true)
    // Reset
    EventServer.autoInjectToLocalBus = false
  })

  it('should handle missing transport gracefully (warning)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const originalTransport = EventServer._pubSubTransport
    EventServer._pubSubTransport = undefined as any
    try {
      // Accessing pubSubTransport without setting it should warn but not throw
      const transport = EventServer.pubSubTransport
      expect(transport).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith('EventServer pubSubTransport not set')
    } finally {
      EventServer._pubSubTransport = originalTransport
      warnSpy.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// 5. SseClientPubSubTransport
// ---------------------------------------------------------------------------
describe('SseClientPubSubTransport (browser)', () => {
  it('should create a new instance', () => {
    const transport = new SseClientPubSubTransport()
    expect(transport).toBeDefined()
    expect(transport.setApiRoot).toBeTypeOf('function')
    expect(transport.connect).toBeTypeOf('function')
    expect(transport.disconnect).toBeTypeOf('function')
  })

  it('should support setApiRoot', () => {
    const transport = new SseClientPubSubTransport()
    transport.setApiRoot('http://localhost:3000/api/')
    // connect with a relative path should not throw about apiRoot
    // but will fail connecting since no server is running - that's expected
  })

  it('should throw when connecting without apiRoot and without full URL', async () => {
    const transport = new SseClientPubSubTransport()
    await expect(transport.connect('relative/path')).rejects.toThrow(
      'SseClientPubSubTransport requires apiRoot to be set or a full URL to be provided.'
    )
  })

  // The transport imports `EventSource` from the `eventsource` peer dependency,
  // so there is no global to swap for a mock: these cases run the real class
  // against a `node:http` server that emits a fixed script of SSE frames. The
  // first frame is the `welcome` handshake (written as soon as the request
  // arrives); the rest are spaced out so a test can register listeners before
  // they are delivered. The response is never ended, so the connection stays
  // open while the test asserts on it.
  const withSseServer = async (frames: { event: string; data: any }[], run: (apiRoot: string) => Promise<void>) => {
    const srv = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive' })
      let i = 0
      const write = () => {
        const f = frames[i++]
        res.write(`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`)
        if (i < frames.length) setTimeout(write, 200)
      }
      write()
    })
    const port = await new Promise<number>((resolve) => {
      srv.listen(0)
      srv.once('listening', () => resolve(srv.address().port))
    })
    try {
      await run(`http://localhost:${port}/api/`)
    } finally {
      srv.close()
    }
  }
  // Raw-frame variant: the frames are written verbatim, so a test can emit a
  // payload that is not valid JSON — the transport must not let that tear down
  // the connection.
  const withRawSseServer = async (rawFrames: string[], run: (apiRoot: string) => Promise<void>) => {
    const srv = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive' })
      let i = 0
      const write = () => {
        const f = rawFrames[i++]
        if (f !== undefined) res.write(f)
        if (i < rawFrames.length) setTimeout(write, 200)
      }
      write()
    })
    srv.on('error', () => {})
    const port = await new Promise<number>((resolve) => {
      srv.listen(0)
      srv.once('listening', () => resolve((srv.address() as any).port))
    })
    try {
      await run(`http://localhost:${port}/api/`)
    } finally {
      srv.close()
    }
  }

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  it('should connect and return a stream when EventSource sends welcome', async () => {
    await withSseServer(
      [{ event: 'welcome', data: { clientId: 'real-client-id' } }],
      async (apiRoot) => {
        const transport = new SseClientPubSubTransport()
        transport.setApiRoot(apiRoot)
        const stream = await transport.connect('test-event')

        expect(stream.clientId).toBe('real-client-id')
        expect(stream.protocol).toBe('sse')
        expect(stream.on).toBeTypeOf('function')
        expect(stream.off).toBeTypeOf('function')
        expect(stream.addRegExEventListener).toBeTypeOf('function')
        expect(stream.removeRegExEventListener).toBeTypeOf('function')
        expect(stream.close).toBeTypeOf('function')
        // Still connected: OPEN.
        expect(stream.readyState).toBe(1)
        stream.close()
        expect(stream.readyState).toBe(2)
      }
    )
  })

  it('should dispatch events via addRegExEventListener with string-form regex', async () => {
    await withSseServer(
      [
        { event: 'welcome', data: { clientId: 'real-regex-id' } },
        { event: 'group:one', data: { value: 1 } },
        { event: 'group:two', data: { value: 2 } },
        { event: 'other', data: { value: 3 } },
        { event: 'group:three', data: { value: 4 } },
      ],
      async (apiRoot) => {
        const transport = new SseClientPubSubTransport()
        transport.setApiRoot(apiRoot)
        const stream = await transport.connect('test-event')

        const received: any[] = []
        const handler = (data: any, ctx: any) => {
          received.push([data, ctx.event])
        }
        stream.addRegExEventListener!('/^group:.*/', handler)

        // Frames arrive 200ms apart: group:one, group:two, other, group:three.
        await waitForSettled(() => received.length >= 2, {
          settle: 250,
          label: 'both regex-matching frames delivered',
        })
        expect(received).toStrictEqual([[{ value: 1 }, 'group:one'], [{ value: 2 }, 'group:two']])

        stream.removeRegExEventListener!('/^group:.*/', handler)
        await sleep(400) // negative window: covers the trailing group:three frame
        // `group:three` arrives after the listener was removed.
        expect(received).toHaveLength(2)
        stream.close()
      }
    )
  })

  it('should dispatch events via addRegExEventListener with RegExp object', async () => {
    await withSseServer(
      [
        { event: 'welcome', data: { clientId: 'real-regex-obj-id' } },
        { event: 'error:disk-full', data: { severity: 'high' } },
        { event: 'warning:memory', data: { severity: 'medium' } },
        { event: 'info:startup', data: { severity: 'low' } },
      ],
      async (apiRoot) => {
        const transport = new SseClientPubSubTransport()
        transport.setApiRoot(apiRoot)
        const stream = await transport.connect('test-event')

        const received: any[] = []
        const handler = (data: any, ctx: any) => {
          received.push([data, ctx.event])
        }
        stream.addRegExEventListener!(/(error|warning):.*/, handler)

        await waitForSettled(() => received.length >= 2, {
          settle: 250,
          label: 'both regex-matching frames delivered',
        })
        expect(received).toStrictEqual([
          [{ severity: 'high' }, 'error:disk-full'],
          [{ severity: 'medium' }, 'warning:memory'],
        ])
        stream.close()
      }
    )
  })

  it('should deliver every matching event to a global-flag regex listener', async () => {
    // `test()` on a /g/ regex is stateful (it advances `lastIndex`), so matching
    // with the flags as given delivers every other event. The transport must
    // match with a stateless copy.
    await withSseServer(
      [
        { event: 'welcome', data: { clientId: 'g-flag-id' } },
        { event: 'g-one', data: { n: 1 } },
        { event: 'g-two', data: { n: 2 } },
        { event: 'g-three', data: { n: 3 } },
        { event: 'g-four', data: { n: 4 } },
      ],
      async (apiRoot) => {
        const transport = new SseClientPubSubTransport()
        transport.setApiRoot(apiRoot)
        const stream = await transport.connect('test-event')

        const received: string[] = []
        stream.addRegExEventListener!('/^g-.*/g', (_data: any, ctx: any) => { received.push(ctx.event) })

        await waitForSettled(() => received.length >= 4, {
          settle: 150,
          label: 'every matching event delivered to the /g/ listener',
        })
        expect(received).toEqual(['g-one', 'g-two', 'g-three', 'g-four'])
        expect(stream.readyState).toBe(1)
        stream.close()
      }
    )
  })

  it('should keep the stream alive when a payload is not valid JSON', async () => {
    // A frame whose `data:` is plain text used to throw out of the transport's
    // `dispatchEvent` hook, which the EventSource implementation reports as a
    // failed connection: every listener on the stream lost the rest of the run.
    await withRawSseServer(
      [
        'event: welcome\ndata: {"clientId":"raw-id"}\n\n',
        'event: plain-one\ndata: plain text not json\n\n',
        'event: plain-two\ndata: {"n":2}\n\n',
      ],
      async (apiRoot) => {
        const transport = new SseClientPubSubTransport()
        transport.setApiRoot(apiRoot)
        const stream = await transport.connect('test-event')

        const regexGot: any[] = []
        stream.addRegExEventListener!('/^plain-.*/', (data: any, ctx: any) => { regexGot.push([data, ctx.event]) })
        const exactGot: any[] = []
        stream.on('plain-two', (data: any, ctx: any) => { exactGot.push([data, ctx.event]) })

        await waitForSettled(() => regexGot.length >= 2, {
          settle: 150,
          label: 'frames after the non-JSON payload still delivered',
        })
        // The unparseable payload is handed over verbatim rather than throwing.
        expect(regexGot).toEqual([
          ['plain text not json', 'plain-one'],
          [{ n: 2 }, 'plain-two'],
        ])
        expect(exactGot).toEqual([[{ n: 2 }, 'plain-two']])
        expect(stream.readyState).toBe(1)
        stream.close()
      }
    )
  })

  it('should not tear down the stream when a regex listener throws', async () => {
    // The listener is consumer code; its exception must not be reported as a
    // connection failure to the EventSource implementation.
    await withSseServer(
      [
        { event: 'welcome', data: { clientId: 'throw-id' } },
        { event: 'boom-one', data: { n: 1 } },
        { event: 'boom-two', data: { n: 2 } },
      ],
      async (apiRoot) => {
        const transport = new SseClientPubSubTransport()
        transport.setApiRoot(apiRoot)
        const stream = await transport.connect('test-event')

        let seen = 0
        stream.addRegExEventListener!('/^boom-.*/', () => {
          seen++
          throw new Error('listener exploded')
        })
        const exactGot: number[] = []
        stream.on('boom-two', (data: any) => { exactGot.push(data.n) })

        await waitForSettled(() => seen >= 2, {
          settle: 150,
          label: 'stream survived the throwing listener and delivered the rest',
        })
        expect(seen).toBe(2)
        expect(exactGot).toEqual([2])
        expect(stream.readyState).toBe(1)
        stream.close()
      }
    )
  })

})

// ---------------------------------------------------------------------------
// 6. backendEventable integration
// ---------------------------------------------------------------------------
describe('backendEventable (browser)', () => {
  it('should make a class eventable', () => {
    // Create a simple class and apply backendEventable
    class MyService {
      name = 'my-service'
    }
    backendEventable(MyService)
    const instance = new MyService()
    expect((instance as any).on).toBeTypeOf('function')
    expect((instance as any).off).toBeTypeOf('function')
    expect((instance as any).emit).toBeTypeOf('function')
    expect((instance as any).once).toBeTypeOf('function')
  })
})

// ---------------------------------------------------------------------------
// 7. Verify no Node.js modules are imported
// ---------------------------------------------------------------------------
describe('browser entry - Node.js isolation', () => {
  it('should not import Node.js http module', () => {
    // We can't directly check module internals, but we can verify that
    // the EventServer class doesn't reference HTTP transport by default
    expect((EventServer as any).SSEChannel).toBeUndefined()
    expect((EventServer as any).SseServerPubSubTransport).toBeUndefined()
  })

  it('should not expose SseServerPubSubTransport in the named exports', () => {
    // This is a compile-time guarantee - the TypeScript checks ensure this.
    // SseServerPubSubTransport and SSEChannel are imported from:
    //   - 'src/transports/pubsub/sse-server' (which imports http)
    //   - 'src/utils/sse-channel' (which imports http)
    // Since src/browser.ts does not re-export from these modules,
    // they should not be accessible from the browser entry at runtime.
    expect((globalThis as any).SseServerPubSubTransport).toBeUndefined()
  })
})
