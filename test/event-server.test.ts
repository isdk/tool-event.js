// @vitest-environment node
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { findPort } from '@isdk/util'
import { sleep, waitFor, waitForSettled } from './utils/wait'
import { Funcs, ToolFunc } from '@isdk/tool-func'
import { ClientTools, HttpServerToolTransport, HttpClientToolTransport, ServerTools, RpcTransportManager } from '@isdk/tool-rpc'
import { EventServer, EventClient, event, EventToolFunc, ClientEventPrefix } from '../src'
import { EventName, backendEventable } from "../src/utils"
import { SseClientPubSubTransport, SseServerPubSubTransport } from "../src/transports/pubsub"
import { EventSource } from 'eventsource'

const EventBusClientName = 'event-bus-client'
const event4Client = new EventToolFunc(EventBusClientName)

describe('Event Server api', () => {
  let apiRoot: string // = 'http://localhost:3000/api'
  let server: any

  beforeAll(async () => {
    const ServerToolItems: {[name:string]: ServerTools|ToolFunc} = {}
    Object.setPrototypeOf(ServerToolItems, ToolFunc.items)
    ServerTools.items = ServerToolItems

    const ClientToolItems: Funcs = {}
    Object.setPrototypeOf(ClientToolItems, ToolFunc.items)
    ClientTools.items = ClientToolItems

    ClientTools.register(event4Client)

    backendEventable(EventClient, {eventBusName: EventBusClientName})
    backendEventable(EventServer)


    const params = { "a": "number", b: "any" }
    const eventServer = new EventServer('event')
    const eventClient = new EventClient('event')
    eventServer.register()
    eventClient.register()

    EventClient.register({
      name: 'test-post',
      params,
      func: function (this: any, { a, b }: { a: number, b: any }) {
        this.emit('before', a, b)
        return a > 15 ? b : a
      },
      result: 'number',
    })

    const port = await findPort(3002)
    apiRoot = `http://localhost:${port}/api/`

    // const tracker = new RpcActiveTaskTracker()
    // const dispatcher = new RpcServerDispatcher({ registry: ServerTools.items, tracker })

    server = new HttpServerToolTransport()
    server.addRpcHandler(apiRoot)
    server.addDiscoveryHandler(apiRoot, () => ServerTools.toJSON())

    await server.start({ port })

    RpcTransportManager.bindScheme('http', HttpClientToolTransport)
    ClientTools.apiUrl = apiRoot
    await ClientTools.loadFrom()

    EventClient.setPubSubTransport(new SseClientPubSubTransport())
    EventServer.setPubSubTransport(new SseServerPubSubTransport())
  })

  afterAll(async () => {
    const event = ClientTools.get('event') as EventClient
    event.close()
    EventClient.setPubSubTransport(undefined)
    EventServer.setPubSubTransport(undefined)
    await server.stop(true)
    delete (ClientTools as any).items
    delete (ServerTools as any).items
  })

  it('should subscribe/publish events through server forwarding', async () => {
    //  which means the local client events can be passed to another client.
    const event = ClientTools.get('event') as EventClient
    expect(event).toBeInstanceOf(EventClient)
    // init the EventSource to listen the t1 and t2 event only
    // await event.run({event: ['t1', 't2'], act: 'init'})
    await event.init(['t1', 't2'])
    const esUrl = (ClientTools.apiUrl || apiRoot)!.endsWith('/') ? (ClientTools.apiUrl || apiRoot) + 'event' : (ClientTools.apiUrl || apiRoot) + '/event';
    const es = new EventSource(esUrl)
    try {
      let t1 = 0
      let t2 = 0
      const t1Data: any[] = []
      const t2Data: any[] = []
      event.on('t1', function (name: string, ...data: any[]) {
        t1++
        t1Data.push(data)
        // expect(data).toStrictEqual([1, 2, 3])
      })

      // publish the t1 event to the server
      // await event.run({event: 't1', act: 'pub', data: [1, 2, 3]})
      await event.publish({ event: 't1', data: [1, 2, 3] })
      await waitForSettled(() => t1 >= 1, { label: 'published t1 delivered to the client listener' })
      expect(t1).toBe(1)
      expect(t1Data).toStrictEqual([[1,2,3]])

      event.on('t2', function (name: string, ...data: any[]) {
        t2++
        t2Data.push(data)
        // expect(data).toMatch(`[ 4, 5, 6, ]`)
      })

      let t2j = 0
      const t2jData:any = []
      let esOnMsg: boolean|undefined
      // listen all the events from server
      es.addEventListener('t2', function (e: MessageEvent) {
        t2j++
        // expect(e.data).toMatch(`[4,5,6]`)
        t2jData.push(e.data)
      })
      es.onmessage = function (e: any) {
        // it should not be here
        esOnMsg = true
      }
      await sleep(10)

      // forward the local t2 event to server
      event.forwardEvent('t2')
      // emit the t2 event
      event.emit('t2', 4, 5, 6)
      await waitForSettled(() => t2 >= 1 && t2j >= 1, { settle: 150, label: 'forwarded t2 reached the local bus and the EventSource' })
      expect(t1).toBe(1)
      expect(t2).toBe(1)
      expect(t2j).toBe(1)
      expect(t2jData).toStrictEqual(['[4,5,6]'])
      expect(esOnMsg).toBeUndefined()
      // await event.run({event: 't1', act: 'pub', data: [1, 2, 3]})
      await event.publish({ event: 't1', data: [1, 2, 3] })
      await waitForSettled(() => t1 >= 2, { settle: 100, label: 'second published t1 delivered' })
      expect(t1).toBe(2)
      // await event.run({event: ['t1', 't2'], act: 'unsub'})
      await event.unsubscribe(['t1', 't2'])
      // await event.run({event: 't1', act: 'pub', data: [1, 2, 3]})
      await event.publish({ event: 't1', data: [1, 2, 3] })
      await sleep(150) // negative window: nothing should arrive after unsubscribing
      expect(t1).toBe(2)
    } finally {
      await event.setActive(false)
      es.close()
    }
    // expect(await event.run({a: 10})).toStrictEqual(10)
    // expect(await event.run({a: 18, b: 'hi world'})).toStrictEqual('hi world')

    // const res = await fetch(apiRoot + '/test?as=1&toolId=6', {
    // });
    // console.log(await res.json())
  })
  it('should subscribe server events', async () => {
    const event = ClientTools.get('event') as EventClient
    const eventServer = ServerTools.get('event') as EventServer
    // subscribe the t1 and t2 event on the server
    // await event.run({event: ['t1', 't2'], act: 'sub'})
    let res = await event.subscribe('t1')
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' }) // the eventsource needs time to connect
    expect(res).toMatchObject({ event: 't1' })
    try {
      let t1 = 0
      let data: any
      event.on('t1', function (name: string, ...dat: any[]) {
        t1++
        data = dat
      })
      eventServer.emit('t1', 1, 2, 3)
      await waitForSettled(() => t1 >= 1, { settle: 150, label: 'server emit delivered to the client' })
      expect(t1).toBe(1)
      expect(data).toStrictEqual([EventName, 1, 2, 3])
      await event.publish({ event: 't1', data: [2, 3] })
      await waitForSettled(() => t1 >= 2, { settle: 50, label: 'client publish delivered' })
      expect(t1).toBe(2)
      expect(data).toStrictEqual([2, 3])
      eventServer.emit('t1', 'hi')
      await waitForSettled(() => t1 >= 3, { settle: 50, label: 'second server emit delivered' })
      expect(t1).toBe(3)
      expect(data).toStrictEqual([EventName, 'hi'])
      res = await event.unsubscribe('t1')
      eventServer.emit('t1', 'hi')
      await sleep(150) // negative window: nothing should arrive after unsubscribing
      expect(t1).toBe(3)
    } finally {
      await event.setActive(false)
    }
  })
  it('should publish event via static EventServer.publish', async () => {
    const event = ClientTools.get('event') as EventClient

    let t3 = 0
    let receivedData: any
    event.on('t3', (name: string, data: any) => {
      t3++
      receivedData = data
    })

    // With the new logic, subscribe should be sufficient
    await event.subscribe('t3')
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' })

    try {
      const eventData = { message: 'hello from static publish' }
      EventServer.publish('t3', eventData)
      await waitForSettled(() => t3 >= 1, { label: 'static publish delivered' })

      expect(t3).toBe(1)
      expect(receivedData).toEqual(eventData)
    } finally {
      await event.setActive(false)
    }
  })

  it('should control client event forwarding via autoInjectToLocalBus toggle', async () => {
    const eventClient = ClientTools.get('event') as EventClient;
    const eventBus = event.runSync();
    const serverListener = vi.fn();
    const eventName = 'test-forward-event';
    const prefixedEventName = ClientEventPrefix + eventName;

    eventBus.on(prefixedEventName, serverListener);
    await eventClient.setActive(true);

    // Ensure client is connected
    await eventClient.subscribe('init-conn');
    await waitFor(() => (eventClient as any)._stream?.readyState === 1, { label: 'client stream open' });

    try {
        // 1. Test with forwarding disabled (default)
        EventServer.autoInjectToLocalBus = false;
        await eventClient.publish({ event: eventName, data: { value: 1 } });
        await sleep(100); // negative window: forwarding is disabled
      expect(serverListener, 'Listener should not be called when forwarding is disabled').not.toHaveBeenCalled();

      // 2. Test with forwarding enabled
      EventServer.autoInjectToLocalBus = true;
        await eventClient.publish({ event: eventName, data: { value: 2 } });
        await waitForSettled(() => serverListener.mock.calls.length >= 1, { label: 'forwarded publish reached the server bus' });

        // Assert it was called
        expect(serverListener, 'Listener should be called once when forwarding is enabled').toHaveBeenCalledTimes(1);

      // Assert the content is correct
      const [data, meta] = serverListener.mock.calls[0];
      expect(data).toEqual({ value: 2 });
      expect(meta, 'Meta object should exist').toBeDefined();
      expect(meta.sender, 'Sender object in meta should exist').toBeDefined();
      expect(meta.sender.clientId, 'Trusted clientId should exist on sender object').toBeDefined();

    } finally {
      // Cleanup
      EventServer.autoInjectToLocalBus = false; // Reset for other tests
      eventBus.off(prefixedEventName, serverListener);
      eventClient.close();
    }
  });

  it('should emit forward events', async () => {
    const eventClient = ClientTools.get('event') as EventClient;
    const eventBus = event.runSync();
    const serverListener = vi.fn();
    const eventName = 'test-forward-event';
    const prefixedEventName = ClientEventPrefix + eventName;

    eventBus.on(prefixedEventName, serverListener);
    await eventClient.setActive(true);

    await waitFor(() => (eventClient as any)._stream?.readyState === 1, { label: 'client stream open' });

    try {
      EventServer.autoInjectToLocalBus = true;
      eventClient.forwardEvent(eventName);
      eventClient.emit(eventName, { value: 2 });
      // await eventClient.publish({ event: eventName, data: { value: 2 } });
      await waitForSettled(() => serverListener.mock.calls.length >= 1, { label: 'forwarded emit reached the server bus' });

      // Assert it was called
      expect(serverListener, 'Listener should be called once when forwarding is enabled').toHaveBeenCalledTimes(1);

      // Assert the content is correct
      const [data, meta] = serverListener.mock.calls[0];
      expect(data).toEqual({ value: 2 });
      expect(meta, 'Meta object should exist').toBeDefined();
      expect(meta.sender, 'Sender object in meta should exist').toBeDefined();
      expect(meta.sender.clientId, 'Trusted clientId should exist on sender object').toBeDefined();

    } finally {
      // Cleanup
      EventServer.autoInjectToLocalBus = false; // Reset for other tests
      eventBus.off(prefixedEventName, serverListener);
      eventClient.close();
    }
  });

  // ── Regex/wildcard event subscription tests ─────────────────────
  it('should subscribe with regex pattern and receive matching events', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;
    const regexPattern = '/^regex-test-.*/';

    // Subscribe with string-form regex
    const res = await event.subscribe(regexPattern);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });
    expect(res).toMatchObject({ event: regexPattern });

    let matchCount = 0
    let receivedArgs: any
    event.on('regex-test-match', (name: string, ...args: any[]) => {
      matchCount++
      receivedArgs = args
    });

    try {
      // Emit matching event from server - should be received by client
      eventServer.emit('regex-test-match', { value: 42 });
      await waitForSettled(() => matchCount >= 1, { settle: 150, label: 'regex-matching event delivered' })
      expect(matchCount).toBe(1);
      expect(receivedArgs).toStrictEqual([EventName, { value: 42 }]);

      // Emit another matching event - needs its own listener
      eventServer.emit('regex-test-another', { value: 99 });
      await sleep(50); // negative window: the exact listener must stay silent
      expect(matchCount).toBe(1);  // 'regex-test-match' listener not triggered by 'regex-test-another'

    } finally {
      await event.unsubscribe(regexPattern);
      await event.setActive(false);
    }
  });

  it('should NOT receive non-matching events when subscribed with regex', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;
    const regexPattern = '/^regex-allow-.*/';

    await event.subscribe(regexPattern);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let received = false
    event.on('regex-deny-event', () => { received = true });

    try {
      // Emit a non-matching event - should NOT be received
      eventServer.emit('regex-deny-event', { x: 1 });
      await sleep(300);
      expect(received).toBe(false);

    } finally {
      await event.unsubscribe(regexPattern);
      await event.setActive(false);
    }
  });

  it('should stop receiving events after regex unsubscribe', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;
    const regexPattern = '/^regex-unsub-.*/';

    await event.subscribe(regexPattern);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let beforeCount = 0
    let afterCount = 0
    event.on('regex-unsub-before', () => { beforeCount++ });
    event.on('regex-unsub-after', () => { afterCount++ });

    try {
      // Emit before unsubscribe - should be received
      eventServer.emit('regex-unsub-before', {});
      await waitForSettled(() => beforeCount >= 1, { settle: 150, label: 'event delivered before unsubscribe' })
      expect(beforeCount).toBe(1);

      // Unsubscribe
      await event.unsubscribe(regexPattern);
      await sleep(10); // let the unsubscribe settle before the next emit

      // Emit after unsubscribe - should NOT be received
      eventServer.emit('regex-unsub-after', {});
      await sleep(300);
      expect(afterCount).toBe(0);

    } finally {
      await event.setActive(false);
    }
  });

  it('should handle mixed regex and exact pattern subscriptions', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    // Subscribe with both regex and exact patterns (non-overlapping)
    await event.subscribe(['/^regex-mix-regex-.*/', 'regex-mix-exact-plain']);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let regexMatchCount = 0
    let exactMatchCount = 0
    event.on('regex-mix-regex-one', () => { regexMatchCount++ });
    event.on('regex-mix-exact-plain', () => { exactMatchCount++ });

    try {
      // Emit exact event - should be delivered via exact subscription only
      eventServer.emit('regex-mix-exact-plain', {});
      await waitForSettled(() => exactMatchCount >= 1, { settle: 150, label: 'exact subscription delivered' })
      expect(exactMatchCount).toBe(1);
      expect(regexMatchCount).toBe(0);

      // Emit regex-matching event - should be delivered via regex subscription only
      eventServer.emit('regex-mix-regex-one', {});
      await waitForSettled(() => regexMatchCount >= 1, { settle: 100, label: 'regex subscription delivered' })
      expect(regexMatchCount).toBe(1);
      expect(exactMatchCount).toBe(1);

    } finally {
      await event.unsubscribe(['/^regex-mix-regex-.*/', 'regex-mix-exact-plain']);
      await event.setActive(false);
    }
  });

  it('should deliver overlapping regex+exact subscriptions with expected double-delivery count', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    // Subscribe with overlapping patterns where the exact event name
    // is ALSO matched by the regex pattern.
    // Pattern: /^overlap-.*/ (regex) + 'overlap-both-match' (exact)
    // Note: 'overlap-both-match' matches /^overlap-.*/
    await event.subscribe(['/^overlap-.*/', 'overlap-both-match']);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let bothMatchCount = 0
    let regexOnlyCount = 0
    event.on('overlap-both-match', () => { bothMatchCount++ });
    event.on('overlap-regex-only', () => { regexOnlyCount++ });

    try {
      // ── Overlapping event ──────────────────────────────────────
      // Event 'overlap-both-match' matches BOTH patterns:
      //   - Regex /^overlap-.*/     ✓
      //   - Exact 'overlap-both-match'  ✓
      //
      // Server side: forward() now deduplicates — the regex pattern
      // /^overlap-.*/ is registered first, then 'overlap-both-match'
      // is detected as already covered (alreadyForward checks
      // _forwardedRegexPatterns) → only 1× SSE delivery.
      //
      // Client side (per SSE delivery):
      //   dispatchEvent interception: regex matches → delivers via esListener
      //   No exact evtSource.on() (client-side dedup skips it)
      //   → 1× delivery per SSE event
      //
      // Total: 1 × 1 = 1
      eventServer.emit('overlap-both-match', { n: 1 });
      await waitForSettled(() => bothMatchCount >= 1, { settle: 150, label: 'overlapping event delivered exactly once' })
      expect(bothMatchCount).toBe(1);

      // ── Non-overlapping event (regex only) ────────────────────
      // Event 'overlap-regex-only' matches ONLY the regex /^overlap-.*/
      // Server: 1 forward fires → 1× SSE delivery
      // Client: regex delivers → 1× delivery (no exact EventSource listener)
      eventServer.emit('overlap-regex-only', { n: 2 });
      await waitForSettled(() => regexOnlyCount >= 1, { settle: 100, label: 'regex-only event delivered' })
      expect(regexOnlyCount).toBe(1);
      expect(bothMatchCount).toBe(1);  // bothMatchCount unchanged after client-side dedup

    } finally {
      await event.unsubscribe(['/^overlap-.*/', 'overlap-both-match']);
      await event.setActive(false);
    }
  });

  it('should deduplicate even when exact pattern is subscribed BEFORE overlapping regex', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    // Reverse order: exact pattern first, regex second
    // 'reverse-exact-match' matches /^reverse-.*/
    await event.subscribe(['reverse-exact-match', '/^reverse-.*/']);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let exactCount = 0
    let regexOnlyCount = 0
    event.on('reverse-exact-match', () => { exactCount++ });
    event.on('reverse-regex-only', () => { regexOnlyCount++ });

    try {
      // Event matches both patterns
      // Server: exact is registered first (no regex yet).
      //   Then regex /^reverse-.*/ is registered → retroactively detects
      //   that 'reverse-exact-match' is covered → removes the exact forward.
      //   Only 1 forward remains → 1× SSE delivery.
      // Client per SSE: regex delivers only (exact evtSource.on() skipped)
      // Total: 1 × 1 = 1
      eventServer.emit('reverse-exact-match', { n: 1 });
      await waitForSettled(() => exactCount >= 1, { settle: 150, label: 'reverse-order overlap delivered exactly once' })
      expect(exactCount).toBe(1);

      // Regex-only event: 1× SSE → 1× delivery
      eventServer.emit('reverse-regex-only', { n: 2 });
      await waitForSettled(() => regexOnlyCount >= 1, { settle: 100, label: 'reverse-order regex-only event delivered' })
      expect(regexOnlyCount).toBe(1);
      expect(exactCount).toBe(1);  // unchanged

    } finally {
      await event.unsubscribe(['reverse-exact-match', '/^reverse-.*/']);
      await event.setActive(false);
    }
  });

  it('should restore exact subscriptions after unsubscribing an overlapping regex', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    // Subscribe regex first, then an exact event covered by that regex.
    // Unsubscribing the regex must not drop the separately-subscribed exact event.
    await event.subscribe(['/^restore-.*/', 'restore-exact-match']);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let exactCount = 0
    let regexOnlyCount = 0
    event.on('restore-exact-match', () => { exactCount++ });
    event.on('restore-regex-only', () => { regexOnlyCount++ });

    try {
      await event.unsubscribe('/^restore-.*/');
      await sleep(50); // let the unsubscribe settle before emitting

      eventServer.emit('restore-exact-match', { n: 1 });
      await waitForSettled(() => exactCount >= 1, { settle: 150, label: 'exact subscription restored after regex unsubscribe' })
      expect(exactCount).toBe(1);

      eventServer.emit('restore-regex-only', { n: 2 });
      await sleep(150); // negative window: the unsubscribed regex must not deliver
      expect(regexOnlyCount).toBe(0);

    } finally {
      await event.unsubscribe('restore-exact-match');
      await event.setActive(false);
    }
  });

  // ── Edge case tests ─────────────────────────────────────────────
  it('should treat pseudo-regex "/[/" as plain string pattern', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;
    // '/[/' looks like a regex (/pattern/) but isRegExpStr returns false
    // because the content '[' is not a valid standalone regex.
    // It should be treated as a plain string pattern.
    const pseudoRegex = '/[/';
    await event.subscribe(pseudoRegex);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let received = false
    event.on(pseudoRegex, () => { received = true });

    try {
      // Emit the exact pattern as event name
      eventServer.emit(pseudoRegex, { msg: 'pseudo-regex' });
      await waitForSettled(() => received, { settle: 150, label: 'pseudo-regex pattern delivered as a plain name' });
      expect(received).toBe(true);
    } finally {
      await event.unsubscribe(pseudoRegex);
      await event.setActive(false);
    }
  });

  it('should treat "//" as plain string (not a regex)', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;
    // '//' has length 2, isRegExpStr requires length > 2
    await event.subscribe('//');
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let received = false
    event.on('//', () => { received = true });

    try {
      eventServer.emit('//', { msg: 'double-slash' });
      await waitForSettled(() => received, { settle: 150, label: '"//" delivered as a plain name' });
      expect(received).toBe(true);
    } finally {
      await event.unsubscribe('//');
      await event.setActive(false);
    }
  });

  it('should subscribe with special-char pattern "$edge-test-💰"', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;
    const specialPattern = '$edge-test-💰';
    await event.subscribe(specialPattern);
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });

    let received = false
    event.on(specialPattern, () => { received = true });

    try {
      eventServer.emit(specialPattern, { val: 'special' });
      await waitForSettled(() => received, { settle: 150, label: 'special-char pattern delivered' });
      expect(received).toBe(true);
    } finally {
      await event.unsubscribe(specialPattern);
      await event.setActive(false);
    }
  });

  it('should reject empty string pattern with RPC error (event is required)', async () => {
    const event = ClientTools.get('event') as EventClient;
    // The server RPC $sub explicitly requires a non-empty event name.
    // subscribe('') sends an RPC call with '' as the event name.
    await expect(event.subscribe('')).rejects.toThrow(/event is required/i);
    // Clean up: close any partially established connection
    await event.setActive(false);
  });

  // ── Regression: dedup across SEPARATE subscribe calls ───────────
  // The overlapping-pattern tests above pass both patterns in one call, which
  // is the only order the dedup used to handle. Subscribing the exact name and
  // the covering regex in two calls left both registrations active, so the
  // event was forwarded twice by the server and delivered twice by the client.
  it('should deduplicate when an exact pattern is subscribed BEFORE the covering regex, in separate calls', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    await event.subscribe('split-exact-match');
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });
    await event.subscribe('/^split-.*/');
    await sleep(50); // let the retroactive dedup settle before emitting

    let count = 0
    event.on('split-exact-match', () => { count++ });

    try {
      eventServer.emit('split-exact-match', { n: 1 });
      await waitForSettled(() => count >= 1, { settle: 150, label: 'split-order overlap delivered exactly once' })
      expect(count).toBe(1);
    } finally {
      await event.unsubscribe(['split-exact-match', '/^split-.*/']);
      await event.setActive(false);
    }
  });

  it('should deduplicate when the covering regex is subscribed BEFORE the exact pattern, in separate calls', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    await event.subscribe('/^split2-.*/');
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });
    await event.subscribe('split2-exact-match');
    await sleep(50); // let the dedup settle before emitting

    let count = 0
    event.on('split2-exact-match', () => { count++ });

    try {
      eventServer.emit('split2-exact-match', { n: 1 });
      await waitForSettled(() => count >= 1, { settle: 150, label: 'split-order overlap delivered exactly once' })
      expect(count).toBe(1);
    } finally {
      await event.unsubscribe(['split2-exact-match', '/^split2-.*/']);
      await event.setActive(false);
    }
  });

  it('should restore the exact forward after unsubscribing the covering regex (separate calls)', async () => {
    const event = ClientTools.get('event') as EventClient;
    const eventServer = ServerTools.get('event') as EventServer;

    await event.subscribe('restore2-exact-match');
    await waitFor(() => (event as any)._stream?.readyState === 1, { label: 'EventSource stream open' });
    await event.subscribe('/^restore2-.*/');
    await sleep(50); // let the dedup settle before unsubscribing

    let count = 0
    event.on('restore2-exact-match', () => { count++ });

    try {
      // The exact forward was dropped in favour of the regex; dropping the
      // regex must bring it back, not leave the exact name unforwarded.
      await event.unsubscribe('/^restore2-.*/');
      await sleep(50); // let the forward restore settle before emitting

      eventServer.emit('restore2-exact-match', { n: 1 });
      await waitForSettled(() => count >= 1, { settle: 150, label: 'exact forward restored after regex unsubscribe' })
      expect(count).toBe(1);
    } finally {
      await event.unsubscribe('restore2-exact-match');
      await event.setActive(false);
    }
  });

  // ── Regression: EventServer subclasses ──────────────────────────
  // `forward()` installs the event-bus listener on the instance's own class
  // (`this.constructor`), so the sync step has to run on that same class: the
  // base class has no listener of its own, and syncing there registered nothing
  // at all — `forward()` silently did nothing for any subclass.
  it("should install the subclass's own bus listener when a subclass forwards", async () => {
    class SubServer extends EventServer {}
    const sub = new SubServer('sub-server')
    sub.register()
    await sleep(50)

    const bus = event.runSync()
    try {
      sub.forward('sub-fwd')
      // `forward()` installs the listener on `this.constructor`, so the sync step
      // has to register *that* listener. Registering the base class's listener
      // instead (or none at all) is what made subclass forwarding a no-op.
      const listeners = bus.listeners('sub-fwd')
      expect(listeners).toContain((SubServer as any)._boundEbListener)
      expect((SubServer as any)._boundEbListener).toBeDefined()

      const published: string[] = []
      const transport: any = (EventServer as any)._pubSubTransport
      const origPublish = transport.publish
      transport.publish = (e: string, d: any, t?: any) => { published.push(e); return origPublish.call(transport, e, d, t) }
      try {
        bus.emit('sub-fwd', { n: 1 })
        await waitForSettled(() => published.length >= 1, { settle: 150, label: 'subclass forward reached the transport' })
        expect(published).toEqual(['sub-fwd'])
      } finally {
        transport.publish = origPublish
      }
    } finally {
      sub.unforward('sub-fwd')
      expect(bus.listeners('sub-fwd')).toEqual([])
    }
  });

  it('should keep the forwarding registry per EventServer class (no cross-instance interference)', async () => {
    class SiblingServer extends EventServer {}
    const sibling = new SiblingServer('sibling-server')
    sibling.register()
    await sleep(50)

    const base = ServerTools.get('event') as EventServer
    const bus = event.runSync()

    try {
      base.forward('base-own-fwd')
      sibling.forward('sibling-own-fwd')
      expect(bus.listeners('base-own-fwd')).toContain((EventServer as any)._boundEbListener)
      expect(bus.listeners('sibling-own-fwd')).toContain((SiblingServer as any)._boundEbListener)

      // Unforwarding on the subclass must not unregister the base's listener.
      sibling.unforward('sibling-own-fwd')
      expect(bus.listeners('sibling-own-fwd')).toEqual([])
      expect(bus.listeners('base-own-fwd')).toContain((EventServer as any)._boundEbListener)

      const published: string[] = []
      const transport: any = (EventServer as any)._pubSubTransport
      const origPublish = transport.publish
      transport.publish = (e: string, d: any, t?: any) => { published.push(e); return origPublish.call(transport, e, d, t) }
      try {
        bus.emit('base-own-fwd', { n: 1 })
        bus.emit('sibling-own-fwd', { n: 2 })
        await waitForSettled(() => published.length >= 1, { settle: 150, label: 'base forward reached the transport, sibling did not' })
        expect(published).toEqual(['base-own-fwd'])
      } finally {
        transport.publish = origPublish
      }
    } finally {
      base.unforward('base-own-fwd')
    }
  });

  // ── Control plane: the session identity is server-assigned ──────────────
  // `$sub`/`$publish` resolve the sender through the transport session
  // (`getSessionFromReq`, keyed by the `rpc-client-id` header the client's stream
  // handshake produced), never through the params. A client that puts a `clientId`
  // in its payload is therefore ignored. Nothing asserted this before: the ids the
  // server reports are what pins the impersonation guard down.
  it('should ignore a client-supplied clientId and report the server-assigned session id', async () => {
    const eventClient = ClientTools.get('event') as EventClient
    const FORGED = 'forged-victim-client'

    await eventClient.subscribe('forge-identity')
    await waitFor(() => (eventClient as any)._stream?.readyState === 1, { label: 'EventSource stream open' })
    const assigned = eventClient.clientId
    expect(assigned, 'the server assigns a clientId when the stream connects').toBeTruthy()

    const eventBus = event.runSync()
    const serverListener = vi.fn()
    eventBus.on(ClientEventPrefix + 'forge-pub', serverListener)
    EventServer.autoInjectToLocalBus = true

    try {
      const subResult: any = await eventClient.sub({ event: 'forge-identity', clientId: FORGED })
      expect(subResult.clientId, '$sub reports the session id, not the clientId in the payload').toBe(assigned)

      const pubResult: any = await eventClient.publish({ event: 'forge-pub', data: { v: 1 }, clientId: FORGED })
      expect(pubResult.senderId, '$publish reports the session id, not the clientId in the payload').toBe(assigned)

      await waitForSettled(() => serverListener.mock.calls.length >= 1, { label: 'the forged publish reached the server bus' })
      const [, meta] = serverListener.mock.calls[0]
      expect(meta.sender.clientId, 'the sender the server records is the session id').toBe(assigned)
    } finally {
      EventServer.autoInjectToLocalBus = false
      eventBus.off(ClientEventPrefix + 'forge-pub', serverListener)
      await eventClient.unsubscribe('forge-identity')
      await eventClient.setActive(false)
    }
  });

  // A targeted publish must reach exactly the connection that owns that clientId.
  // Both connections subscribe the same event, so a broken target filter is
  // observable as a second delivery rather than as a silent miss.
  it('should publish to a single client when a target clientId is given', async () => {
    const server2 = new EventServer('targeted-server')
    server2.register()
    // Register the client tool locally, then re-run discovery: the RPC methods
    // (`sub`/`unsub`/`publish`) are assigned from the server's exported `methods`
    // during discovery, so a client that never went through `loadFrom` cannot make
    // a control-plane call.
    const client2 = new EventClient('targeted-server')
    client2.register()
    await ClientTools.loadFrom()
    expect(ClientTools.get('targeted-server'), 'discovery merged into the local instance').toBe(client2)

    const client1 = ClientTools.get('event') as EventClient

    await client1.subscribe('targeted-msg')
    await client2.init(['targeted-msg'])
    await waitFor(
      () => (client1 as any)._stream?.readyState === 1 && (client2 as any)._stream?.readyState === 1,
      { label: 'both EventSource streams open' },
    )

    const targetId = client2.clientId
    expect(targetId, 'the second connection got its own clientId').toBeTruthy()
    expect(targetId !== client1.clientId, 'two connections do not share a clientId').toBe(true)

    // Counted at the stream, not on the client event bus: `backendEventable` binds
    // every EventClient instance to the SAME bus, so a bus listener also fires for
    // events another connection received. The stream is the per-connection wire,
    // which is what "only the target got it" is actually about.
    const stream1: any = (client1 as any)._stream
    const stream2: any = (client2 as any)._stream
    expect(stream1 && stream2, 'both connections have their own stream').toBeTruthy()

    let targetHits = 0
    let otherHits = 0
    stream2.on('targeted-msg', () => { targetHits++ })
    stream1.on('targeted-msg', () => { otherHits++ })

    try {
      EventServer.publish('targeted-msg', { to: 'targeted-server' }, { clientId: targetId })
      await waitForSettled(() => targetHits >= 1, { settle: 300, label: 'the targeted client received the event' })
      expect(targetHits).toBe(1)
      expect(otherHits, 'a targeted publish must not reach the other connection').toBe(0)

      // Positive control: the same publish WITHOUT a target reaches both, which is
      // what makes the zero above a statement about targeting rather than about a
      // listener that never fires.
      EventServer.publish('targeted-msg', { to: 'everyone' })
      await waitForSettled(() => targetHits >= 2 && otherHits >= 1, {
        settle: 200,
        label: 'the untargeted publish reached both connections',
      })
      expect(targetHits).toBe(2)
      expect(otherHits).toBe(1)
    } finally {
      client2.close()
      await client1.unsubscribe('targeted-msg')
      await client1.setActive(false)
      ServerTools.unregister('targeted-server')
      ClientTools.unregister('targeted-server')
    }
  });

  // `forwardEvent` was only ever checked for existence. The uplink is the pair of
  // that call, so unforwarding has to be observable both in the bus bookkeeping
  // and end to end (the server must stop receiving).
  it('should stop forwarding local events after unforwardEvent', async () => {
    const eventClient = ClientTools.get('event') as EventClient
    const eventBus = event.runSync()
    const clientBus = event4Client.emitter
    const serverListener = vi.fn()
    const eventName = 'test-unforward-event'
    const prefixedEventName = ClientEventPrefix + eventName

    eventBus.on(prefixedEventName, serverListener)
    await eventClient.setActive(true)
    await waitFor(() => (eventClient as any)._stream?.readyState === 1, { label: 'client stream open' })
    EventServer.autoInjectToLocalBus = true

    try {
      // 1. forwardEvent: a local emit goes up over RPC and lands on the server bus.
      eventClient.forwardEvent(eventName)
      expect(clientBus.listeners(eventName), 'forwardEvent installs the bus listener').toContain(eventClient.ebListener)
      eventClient.emit(eventName, { value: 1 })
      await waitForSettled(() => serverListener.mock.calls.length >= 1, { label: 'forwarded emit reached the server bus' })
      expect(serverListener, 'forwarded emit reaches the server exactly once').toHaveBeenCalledTimes(1)

      // 2. unforwardEvent: the listener is removed, and the same local emit stops
      //    reaching the server. The stream is known live (step 1 delivered over it),
      //    so the silence here is the forwarding path being closed, not a dead
      //    connection.
      eventClient.unforwardEvent(eventName)
      expect(clientBus.listeners(eventName), 'unforwardEvent removes the bus listener').not.toContain(eventClient.ebListener)
      eventClient.emit(eventName, { value: 2 })
      await sleep(200)
      expect(serverListener, 'an unforwarded local emit must not reach the server').toHaveBeenCalledTimes(1)

      // 3. Re-forwarding reinstalls the listener (unforward is not a one-way door).
      eventClient.forwardEvent(eventName)
      eventClient.emit(eventName, { value: 3 })
      await waitForSettled(() => serverListener.mock.calls.length >= 2, { label: 'forwarding works again after re-forwarding' })
      expect(serverListener, 're-forwarded emit reaches the server').toHaveBeenCalledTimes(2)
    } finally {
      EventServer.autoInjectToLocalBus = false
      eventClient.unforwardEvent(eventName)
      eventBus.off(prefixedEventName, serverListener)
      eventClient.close()
    }
  });

  // ── Control plane: no session -> degraded $sub/$unsub ───────────────
  // The session is resolved from the `rpc-client-id` header, and the client only
  // sends that header once its SSE stream has handed it a clientId (tool-rpc sets it
  // from `fetchOptions.clientId`). A tool that never opened a stream therefore lands
  // in the "No session found" branch: the call still succeeds, class-level
  // forwarding is installed, and the reply carries no per-session fields. That
  // branch is what a client sees when it calls before its stream is up, and nothing
  // asserted it.
  it('should degrade $sub/$unsub to class-level forwarding when no session exists', async () => {
    const server3 = new EventServer('no-session-server')
    server3.register()
    const client3 = new EventClient('no-session-server')
    client3.register()
    await ClientTools.loadFrom()

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const published: string[] = []
    const transport: any = (EventServer as any)._pubSubTransport
    const origPublish = transport.publish
    transport.publish = (e: string, d: any, t?: any) => {
      if (e === 'no-session-fwd') published.push(e)
      return origPublish.call(transport, e, d, t)
    }

    try {
      expect(client3.clientId, 'a tool with no stream has no clientId').toBeUndefined()

      const subResult: any = await client3.sub({ event: 'no-session-fwd' })
      expect(subResult, '$sub without a session reports no per-session subscription').toEqual({ forward: true, event: 'no-session-fwd' })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('$sub: No session found for request'))

      // Forwarding is class-level, and the degraded $sub installed it anyway.
      server3.emit('no-session-fwd', { n: 1 })
      await waitForSettled(() => published.length >= 1, { settle: 150, label: 'the forward installed by the degraded $sub reaches the transport' })

      const unsubResult: any = await client3.unsub({ event: 'no-session-fwd' })
      expect(unsubResult, '$unsub without a session reports no per-session subscription').toEqual({ forward: false, event: 'no-session-fwd' })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('$unsub: No session found for request'))

      // The forward is uninstalled, so the bus event stops reaching the transport.
      const before = published.length
      server3.emit('no-session-fwd', { n: 2 })
      await sleep(200)
      expect(published.length, 'the degraded $unsub removed the forward').toBe(before)
    } finally {
      transport.publish = origPublish
      warnSpy.mockRestore()
      ServerTools.unregister('no-session-server')
      ClientTools.unregister('no-session-server')
    }
  });

  // ── Resume: the Node control/data plane across a dropped stream ──────────
  // The channel and the identity policy are unit-tested in isolation; this suite runs
  // the real stack (EventServer + EventClient + the HTTP/RPC transport + the
  // eventsource implementation) and drops a live session *from the server side*,
  // which is what a network outage looks like to a client. The properties asserted
  // here are the ones only the integration has: the RPC header follows the resumed
  // session, the subscription list (including entries added through $sub after the
  // stream opened) survives, and delivery across the drop neither loses nor
  // duplicates events.
  describe('SSE session resume (Node control/data plane)', () => {
    // The server-side session registry, peeked at through the transport: dropping a
    // session from the server is the only way to simulate an outage that the client
    // cannot cause from its own side.
    type ServerSession = { clientId?: string; close: () => void }

    type Pair = {
      client: EventClient
      server: EventServer
      stream: any
      id: string
      received: Record<string, any[]>
      watch: (event: string) => void
      welcomes: () => number
      /** Publish through *this pair's* server class: a tuned pair runs on its own
       *  transport, and the static `EventServer.publish` reaches the shared one. */
      publish: (event: string, data: any) => unknown
      /** The server-side session of this pair's transport (a tuned pair has its own). */
      session: (clientId?: string) => ServerSession | undefined
      drop: () => void
      resume: () => Promise<void>
      /** Releases a tuned transport's channel (its ping timer); a no-op for the shared one. */
      release: () => void
    }

    /**
     * Open a client/server pair over the shared transport, or over a transport tuned
     * with the given channel options. A tuned pair runs on its own EventServer /
     * EventClient subclasses, because the stream time limit and the resume window are
     * class-level transport settings: retuning the shared one would change the stream
     * every other test in this file is running on.
     */
    async function openPair(serverName: string, events: string[], channelOptions?: Record<string, any>): Promise<Pair> {
      const tuned = channelOptions !== undefined
      let release = () => {}
      let server: EventServer
      let client: EventClient

      if (tuned) {
        // A tuned pair runs on subclasses: `setPubSubTransport` is class-level, so a
        // subclass gets its own stream limits without retuning the transport every
        // other test in this file runs on.
        class TunedServer extends EventServer {}
        class TunedClient extends EventClient {}
        const tunedTransport = new SseServerPubSubTransport({ channelOptions: { pingInterval: 0, ...channelOptions } })
        TunedServer.setPubSubTransport(tunedTransport)
        TunedClient.setPubSubTransport(new SseClientPubSubTransport())
        release = () => { (tunedTransport as any).channel.active = false }
        server = new TunedServer(serverName)
        client = new TunedClient(serverName)
      } else {
        server = new EventServer(serverName)
        client = new EventClient(serverName)
      }

      server.register()
      client.register()
      await ClientTools.loadFrom()

      const c = ClientTools.get(serverName) as EventClient
      expect(c, 'the registered instance is the one discovery hands back').toBe(client)
      for (const event of events) await c.subscribe(event)
      await c.setActive(true)
      await waitFor(() => (c as any)._stream?.readyState === 1, { timeout: 8000, label: `${serverName} stream open` })

      const stream: any = (c as any)._stream
      const received: Record<string, any[]> = {}
      // Counted at the stream, not on the client event bus: `backendEventable` binds
      // every EventClient instance to the SAME bus, so a bus listener also fires for
      // events another connection received.
      const watch = (event: string) => {
        received[event] = []
        stream.on(event, (data: any) => { received[event]!.push(data?.n) })
      }
      for (const event of events) watch(event)
      // Registered after the first welcome, so this counts re-welcomes only.
      let welcomes = 0
      stream.on('welcome', () => { welcomes++ })

      const id = c.clientId!
      expect(id, 'the server assigns a clientId when the stream connects').toBeTruthy()
      // The session registry belongs to the transport this pair runs on, which for a
      // tuned pair is its own, not the shared one.
      const session = (clientId?: string): ServerSession | undefined =>
        (clientId ? ((server.constructor as any).pubSubTransport as { sessions: Map<string, ServerSession> }).sessions.get(clientId) : undefined)
      expect(session(id), 'the server keeps a live session for the clientId').toBeTruthy()

      const drop = () => {
        const live = session(id)
        expect(live, 'the server has a live session to drop').toBeTruthy()
        live!.close()
      }

      return {
        client: c,
        server,
        stream,
        id,
        received,
        watch,
        welcomes: () => welcomes,
        publish: (event: string, data: any) => (server.constructor as typeof EventServer).publish(event, data),
        session,
        drop,
        resume: async () => {
          await waitFor(() => welcomes >= 1 && (c as any)._stream?.readyState === 1, {
            timeout: 10000,
            interval: 50,
            label: `${serverName} stream reconnected`,
          })
        },
        release,
      }
    }

    function closePair(pair: Pair, serverName: string) {
      pair.client.close()
      pair.release()
      ServerTools.unregister(serverName)
      ClientTools.unregister(serverName)
    }

    it('resumes the same session, keeping subscriptions added after the stream opened', async () => {
      const pair = await openPair('resume-main', ['rs-a'])
      const sessionBefore = pair.session(pair.id)
      // Control plane: this subscription is added over RPC *after* the stream is up,
      // so it is not in the URL list the stream was opened with. A reconnect that
      // rebuilt the list from the URL would lose it.
      pair.watch('rs-b')
      const subResult: any = await pair.client.sub({ event: 'rs-b' })
      expect(subResult.clientId, '$sub reports the live session id').toBe(pair.id)

      pair.drop()
      await pair.resume()

      expect(pair.client.clientId, 'the dropped stream resumes the same clientId').toBe(pair.id)
      const sessionAfter = pair.session(pair.id)
      expect(sessionAfter, 'the resumed clientId has a live session').toBeTruthy()
      expect(sessionAfter!.clientId, 'the session registered under the id is the resumed one').toBe(pair.id)
      expect(sessionAfter, 'the dropped session is replaced, not left alongside as a second live session').not.toBe(sessionBefore)

      // Data plane: both subscriptions deliver after the resume, and an event nobody
      // subscribed to does not — which is what makes the two above statements about
      // the resumed subscription list rather than about an unfiltered stream. The
      // listener is installed on the stream without subscribing, so the silence is
      // the server's filter, not a missing listener.
      pair.watch('rs-none')
      EventServer.publish('rs-a', { n: 1 })
      EventServer.publish('rs-b', { n: 2 })
      EventServer.publish('rs-none', { n: 3 })
      await waitForSettled(() => pair.received['rs-a']!.length >= 1 && pair.received['rs-b']!.length >= 1, {
        settle: 300,
        label: 'both subscriptions deliver after the resume',
      })
      expect(pair.received['rs-a']).toEqual([1])
      expect(pair.received['rs-b'], 'the subscription added after connect survived the drop').toEqual([2])
      expect(pair.received['rs-none'], 'an unsubscribed event must not be delivered').toEqual([])

      closePair(pair, 'resume-main')
    });

    it('keeps the control plane bound to the resumed session', async () => {
      const pair = await openPair('resume-cp', ['rs-c'])

      pair.drop()
      await pair.resume()
      expect(pair.client.clientId).toBe(pair.id)

      // The RPC header must point at the resumed session: $sub resolves the sender
      // through it, and a stale id lands on a dead session (degraded, class-level).
      pair.watch('rs-c2')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const subResult: any = await pair.client.sub({ event: 'rs-c2' })
        expect(subResult.clientId, '$sub after the resume resolves the resumed session').toBe(pair.id)
        expect(warnSpy, 'no degraded $sub: the session was found').not.toHaveBeenCalled()

        EventServer.publish('rs-c2', { n: 7 })
        await waitForSettled(() => (pair.received['rs-c2'] ?? []).length >= 1, {
          settle: 200,
          label: 'the subscription added after the resume delivers',
        })
      } finally {
        warnSpy.mockRestore()
        closePair(pair, 'resume-cp')
      }
    });

    it('keeps an unsubscribe across the drop', async () => {
      const pair = await openPair('resume-unsub', ['rs-d'])

      // Subscribe over RPC, then unsubscribe over RPC: the resumed session must carry
      // the removal, not the list the stream was originally opened with.
      pair.watch('rs-d2')
      await pair.client.sub({ event: 'rs-d2' })
      EventServer.publish('rs-d2', { n: 1 })
      await waitForSettled(() => (pair.received['rs-d2'] ?? []).length >= 1, { label: 'subscribed event delivers' })

      await pair.client.unsub({ event: 'rs-d2' })
      pair.drop()
      await pair.resume()
      expect(pair.client.clientId).toBe(pair.id)

      EventServer.publish('rs-d2', { n: 2 })
      EventServer.publish('rs-d', { n: 3 })
      await waitForSettled(() => (pair.received['rs-d'] ?? []).length >= 1, {
        settle: 300,
        label: 'the original subscription still delivers',
      })
      expect(pair.received['rs-d2'], 'an $unsubscribed event must not come back after a resume').toEqual([1])

      closePair(pair, 'resume-unsub')
    });

    it('delivers every event published around the drop exactly once', async () => {
      const pair = await openPair('rs-loss', ['rs-e'])

      // Publish, then drop in the same tick: the events are in the session's history
      // and the client's Last-Event-ID is wherever it had reached when the socket
      // closed. The resume must fill the gap without replaying what was already seen.
      for (let n = 1; n <= 5; n++) EventServer.publish('rs-e', { n })
      pair.drop()
      await pair.resume()

      // Published on the resumed session: the accounting covers both sides of the drop,
      // so a replay that re-sent what the client had already seen would show up here as
      // a duplicate, and a lost subscription as a missing 6.
      EventServer.publish('rs-e', { n: 6 })
      await waitForSettled(() => pair.received['rs-e']!.length >= 6, { settle: 400, label: 'all 6 events delivered' })
      expect(pair.received['rs-e'].slice().sort((a, b) => a - b), 'no loss, no duplicates across the drop').toEqual([1, 2, 3, 4, 5, 6])

      closePair(pair, 'rs-loss')
    });

    it('delivers the events published while the stream is down', async () => {
      const pair = await openPair('resume-gap', ['rs-g'])

      EventServer.publish('rs-g', { n: 0 })
      await waitForSettled(() => pair.received['rs-g']!.length >= 1, { label: 'delivered before the drop' })

      pair.drop()
      // Published during the outage. The channel keeps every message in its history, and
      // the resumed stream replays from the id the client acknowledged — so these arrive
      // exactly once, not as a live delivery to a session that is not connected.
      for (const n of [1, 2, 3]) EventServer.publish('rs-g', { n })
      await pair.resume()

      await waitForSettled(() => pair.received['rs-g']!.length >= 4, {
        settle: 500,
        label: 'the events published during the outage are replayed',
      })
      expect(pair.received['rs-g'].slice().sort((a, b) => a - b), 'no loss, no duplicates across the outage').toEqual([0, 1, 2, 3])

      closePair(pair, 'resume-gap')
    });

    it('does not disturb another client\'s session when one stream is dropped', async () => {
      const a = await openPair('resume-iso-a', ['rs-iso'])
      const b = await openPair('resume-iso-b', ['rs-iso'])
      const bSession = b.session(b.id)

      a.drop()
      await a.resume()

      expect(a.client.clientId, 'the dropped client resumed its own session').toBe(a.id)
      expect(b.client.clientId, 'the other client keeps its own clientId').toBe(b.id)
      expect(b.session(b.id), 'the other client keeps its own session object').toBe(bSession)
      expect(b.welcomes(), 'the other client was never re-welcomed').toBe(0)

      EventServer.publish('rs-iso', { n: 9 })
      await waitForSettled(
        () => a.received['rs-iso']!.length >= 1 && b.received['rs-iso']!.length >= 1,
        { settle: 300, label: 'both connections receive the broadcast' },
      )
      expect(a.received['rs-iso']).toEqual([9])
      expect(b.received['rs-iso']).toEqual([9])

      closePair(a, 'resume-iso-a')
      closePair(b, 'resume-iso-b')
    });

    it('resumes the same session when the server ends the stream at its time limit', async () => {
      // `maxStreamDuration` is the server's own cap on how long one stream may live: it
      // ends the response on a timer, which is a drop the client never asked for and
      // cannot distinguish from a network outage. The resume window starts at that drop,
      // so the session must survive it.
      const pair = await openPair('resume-timed', ['rs-t'], {
        maxStreamDuration: 400,
        clientRetryInterval: 100,
        resumeWindow: 5000,
      })
      pair.watch('rs-t2')
      await pair.client.sub({ event: 'rs-t2' })

      await pair.resume()
      expect(pair.client.clientId, 'a stream ended by the server time limit resumes the same session').toBe(pair.id)

      // The control plane is intact on the resumed session, and delivery continues.
      pair.publish('rs-t2', { n: 1 })
      await waitForSettled(() => pair.received['rs-t2']!.length >= 1, {
        settle: 300,
        label: 'delivery continues after the timed drop',
      })
      expect(pair.received['rs-t2']).toEqual([1])

      closePair(pair, 'resume-timed')
    });

    it('starts a new session when the reconnect arrives after the resume window closed', async () => {
      // The window, not the credential, is what bounds a resume: a valid credential
      // presented to a session outside its window must not resurrect it — the client
      // lands on a new session. `resumeWindow: 0` closes the window at the drop, which
      // is the deterministic form of the expiry the channel suite covers on a timer.
      const pair = await openPair('resume-expired', ['rs-x'], {
        maxStreamDuration: 0,
        clientRetryInterval: 100,
        resumeWindow: 0,
      })
      pair.drop()
      await pair.resume()

      expect(pair.client.clientId, 'a credential presented after the window closed must not resume the session').not.toBe(pair.id)
      expect(pair.session(pair.client.clientId), 'the new session is live under the new id').toBeTruthy()

      // The new stream is a working session: the subscriptions its URL carries are installed.
      pair.publish('rs-x', { n: 1 })
      await waitForSettled(() => pair.received['rs-x']!.length >= 1, {
        settle: 300,
        label: 'the new session delivers its URL subscriptions',
      })
      expect(pair.received['rs-x']).toEqual([1])

      closePair(pair, 'resume-expired')
    });
  });
});
