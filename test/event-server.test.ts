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
});
