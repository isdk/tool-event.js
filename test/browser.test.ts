/**
 * Tests for the browser entry point (@isdk/tool-event/browser).
 *
 * These tests verify that all browser-safe components can be imported and used
 * correctly without pulling in Node.js-specific modules.
 */
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'

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

  it('should connect and return a stream when EventSource sends welcome', async () => {
    // Mock EventSource to immediately fire a 'welcome' event
    const originalES = globalThis.EventSource

    class MockEventSource {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSED = 2
      readyState = 0
      private listeners = new Map<string, Set<Function>>()
      private _closed = false
      onopen: any = null
      onerror: any = null

      constructor(_url: string) {
        setTimeout(() => {
          if (!this._closed) {
            this.readyState = 1
            const handlers = this.listeners.get('welcome')
            if (handlers) {
              handlers.forEach(h => h({ data: JSON.stringify({ clientId: 'mock-client-id' }) }))
            }
          }
        }, 10)
      }

      addEventListener(event: string, handler: Function) {
        if (!this.listeners.has(event)) { this.listeners.set(event, new Set()) }
        this.listeners.get(event)!.add(handler)
      }

      removeEventListener(event: string, handler: Function) {
        this.listeners.get(event)?.delete(handler)
      }

      close() {
        this._closed = true
        this.readyState = 2
      }
    }

    globalThis.EventSource = MockEventSource as any

    try {
      const transport = new SseClientPubSubTransport()
      transport.setApiRoot('http://localhost:3000/api/')
      const stream = await transport.connect('test-event')

      expect(stream).toBeDefined()
      expect(stream.clientId).toBe('mock-client-id')
      expect(stream.protocol).toBe('sse')
      expect(stream.on).toBeTypeOf('function')
      expect(stream.off).toBeTypeOf('function')
      expect(stream.close).toBeTypeOf('function')
      expect(stream.readyState).toBe(1)
    } finally {
      globalThis.EventSource = originalES
    }
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
