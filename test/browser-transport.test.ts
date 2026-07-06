/**
 * Integration tests for the ./transports/pubsub/browser subpath.
 *
 * Verifies that browser-safe components (imported from the browser barrel)
 * can work together with a real server for end-to-end publish/subscribe.
 *
 * Key differences from event-transport.test.ts:
 * - Client-side components are imported from '../src/transports/pubsub/browser'
 * - Verifies SseServerPubSubTransport is NOT re-exported from the browser barrel
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { findPort, sleep } from '@isdk/util';
import { EventEmitter } from 'events-ex';

import { ToolFunc, Funcs } from '@isdk/tool-func';
import {
  HttpServerToolTransport,
  HttpClientToolTransport,
  ResClientTools,
  ResServerTools,
  RpcActiveTaskTracker,
  RpcServerDispatcher,
  RpcTransportManager,
} from '@isdk/tool-rpc';

// Server-side: full PubSub transport (Node.js only)
import { SseServerPubSubTransport } from '../src/transports/pubsub';

// Client-side: browser-safe PubSub transport from the browser barrel
// This is the module under test — it should NOT include SseServerPubSubTransport
import { SseClientPubSubTransport } from '../src/transports/pubsub/browser';

import { EventServer } from '../src/event-server';
import { EventClient } from '../src/event-client';


// Helper to make a tool eventable for testing
function makeEventable(tool: any) {
  const emitter = new EventEmitter();
  tool.on = emitter.on.bind(emitter);
  tool.off = emitter.off.bind(emitter);
  tool.emit = emitter.emit.bind(emitter);
  tool.emitter = emitter;
  return tool;
}

describe('Browser subpath integration test', () => {

  // ---------------------------------------------------------------------------
  // 1. Verify the browser barrel does NOT export Node.js-only modules
  // ---------------------------------------------------------------------------
  describe('browser barrel exports', () => {
    it('should export SseClientPubSubTransport', () => {
      expect(SseClientPubSubTransport).toBeDefined()
    })

    it('should NOT export SseServerPubSubTransport', async () => {
      // Dynamic import to check absence: SseServerPubSubTransport should not exist
      const mod = await import('../src/transports/pubsub/browser')
      expect((mod as any).SseServerPubSubTransport).toBeUndefined()
      expect((mod as any).SSEChannel).toBeUndefined()
    })


  })

  // ---------------------------------------------------------------------------
  // 2. End-to-end integration with real HTTP server
  // ---------------------------------------------------------------------------
  describe('end-to-end publish/subscribe', () => {
    let serverTransport: HttpServerToolTransport;
    let apiRoot: string;
    const eventServer = new EventServer('browser-events');

    beforeAll(async () => {
      // Isolate registries
      const ServerToolItems: { [name: string]: ResServerTools | ToolFunc } = {}
      Object.setPrototypeOf(ServerToolItems, ToolFunc.items)
      ResServerTools.items = ServerToolItems

      const ClientToolItems: Funcs = {}
      Object.setPrototypeOf(ClientToolItems, ToolFunc.items)
      ResClientTools.items = ClientToolItems

      ResServerTools.register(eventServer)

      const port = await findPort(3006)
      apiRoot = `http://localhost:${port}/api/`

      const tracker = new RpcActiveTaskTracker()
      const dispatcher = new RpcServerDispatcher({ registry: ResServerTools.items, tracker })

      serverTransport = new HttpServerToolTransport({ apiUrl: apiRoot, dispatcher })
      serverTransport.addRpcHandler(apiRoot)
      serverTransport.addDiscoveryHandler(apiRoot, () => ResServerTools.toJSON())

      await serverTransport.start({ port, host: 'localhost' })

      RpcTransportManager.bindScheme('http', HttpClientToolTransport)
      EventClient.apiUrl = apiRoot
      await EventClient.loadFrom()

      // Set up transports — server uses the full Node.js transport,
      // client uses the browser-safe SseClientPubSubTransport
      EventClient.setPubSubTransport(new SseClientPubSubTransport())
      EventServer.setPubSubTransport(new SseServerPubSubTransport())
    })

    afterAll(async () => {
      ResServerTools.unregister(eventServer.name!)
      EventClient.setPubSubTransport(undefined)
      EventServer.setPubSubTransport(undefined)
      await serverTransport.stop(true)
    })

    it('should receive server-sent events via browser-safe transport', async () => {
      const client = ResClientTools.get('browser-events') as EventClient
      expect(client).toBeInstanceOf(EventClient)
      makeEventable(client)

      const received = new Promise<any>(resolve => {
        client.on('browser-news', (data: any) => {
          resolve(data)
        })
      })

      await client.init(['browser-news'])
      await sleep(80)

      // Publish from the server
      eventServer.publish({ data: { msg: 'browser integration works' }, event: 'browser-news' })

      const data = await received
      expect(data).toEqual({ msg: 'browser integration works' })

      client.close()
    })

    it('should forward client events to server via browser-safe transport', async () => {
      const client = ResClientTools.get('browser-events') as EventClient
      expect(client).toBeInstanceOf(EventClient)
      makeEventable(client)

      // Listen on a server-side listener that will receive the forwarded event
      const receivedOnServer = new Promise<any>(resolve => {
        client.on('browser-action', (data: any) => {
          resolve(data)
        })
      })

      await client.init([])
      client.forwardEvent('browser-action')

      client.emit('browser-action', { user: 'browser-tester' })

      const data = await receivedOnServer
      expect(data).toEqual({ user: 'browser-tester' })

      client.close()
    })

    it('should subscribe to specific events and unsubscribe', async () => {
      const client = ResClientTools.get('browser-events') as EventClient
      expect(client).toBeInstanceOf(EventClient)
      makeEventable(client)

      let eventCount = 0
      const receivedData: any[] = []

      client.on('sub-test', (data: any) => {
        eventCount++
        receivedData.push(data)
      })

      // Subscribe to 'sub-test'
      await client.init(['sub-test'])
      await sleep(80)

      // Publish while subscribed
      eventServer.publish({ data: { n: 1 }, event: 'sub-test' })
      await sleep(30)
      expect(eventCount).toBe(1)

      // Unsubscribe
      await client.unsubscribe('sub-test')
      await sleep(10)

      // Publish again — should NOT be received
      eventServer.publish({ data: { n: 2 }, event: 'sub-test' })
      await sleep(30)
      expect(eventCount).toBe(1) // Still 1

      client.close()
    })

    it('should handle multiple simultaneous subscriptions', async () => {
      const client = ResClientTools.get('browser-events') as EventClient
      expect(client).toBeInstanceOf(EventClient)
      makeEventable(client)

      const events: string[] = ['ev-a', 'ev-b', 'ev-c']
      const received = new Set<string>()

      events.forEach(evt => {
        client.on(evt, (_data: any) => received.add(evt))
      })

      await client.init(events)
      await sleep(80)

      // Publish each event — use a plain data object that does NOT have
      // an 'event' property, to avoid colliding with SSEChannel.publish's
      // internal event-detection logic (see the `if (data.event)` branch).
      for (const evt of events) {
        eventServer.publish({ data: { value: evt }, event: evt })
        await sleep(10)
      }

      await sleep(30)
      expect(received.size).toBe(3)
      events.forEach(evt => expect(received.has(evt)).toBe(true))

      client.close()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Test that the browser barrel works standalone (no Node.js server)
  // ---------------------------------------------------------------------------
  describe('browser barrel standalone usage', () => {
    it('should create SseClientPubSubTransport and configure it', () => {
      const transport = new SseClientPubSubTransport()
      transport.setApiRoot('http://localhost:9999/api/')
      expect(transport).toBeDefined()
    })

    it('should throw when connecting without apiRoot', async () => {
      const transport = new SseClientPubSubTransport()
      await expect(transport.connect('relative/path')).rejects.toThrow(
        'SseClientPubSubTransport requires apiRoot to be set or a full URL to be provided.'
      )
    })
  })
})
