/// <reference types="vite/client" />

/**
 * E2E test for @isdk/tool-event/browser entry.
 *
 * Uses Vite to resolve bare module specifiers so we can import
 * the browser entry as a normal npm package, exactly like real
 * browser applications would.
 */

import {
  EventClient,
  EventServer,
  SseClientPubSubTransport,
  EventToolFunc,
  event,
  genUrlParamsStr,
  EventSource,
  backendEventable,
  EventName,
  EventBusName,
  ClientEventPrefix,
} from '@isdk/tool-event/browser'

import type {
  IPubSubServerTransport,
} from '@isdk/tool-event/browser'

// Import from the transports/pubsub/browser subpath to verify it resolves correctly
// in the browser and exports the expected transport-layer types
import {
  SseClientPubSubTransport as PubSubSseClient,
} from '@isdk/tool-event/transports/pubsub/browser'

// The control plane of the documented flow lives in tool-rpc: discovery pulls the
// server's tool list, and EventClient's subscribe/publish are RPC calls. The dev
// server proxies /api/rpc to the RPC port (see vite.config.mts).
import {
  ClientTools,
  HttpClientToolTransport,
  RpcTransportManager,
} from '@isdk/tool-rpc'

// ── Test framework ──────────────────────────────────────────────
const RESULTS: Array<{name: string; passed: boolean; detail: string}> = []
const TEST_TIMEOUT = 8000
const SSE_URL = 'http://localhost:3099'

function report(name: string, passed: boolean, detail = '') {
  RESULTS.push({ name, passed, detail })
  renderTest(name, passed, detail)
  updateSummary()
}

function renderTest(name: string, passed: boolean, detail: string) {
  const div = document.createElement('div')
  div.className = `test ${passed ? 'pass' : 'fail'}`
  div.innerHTML = `<span class="${passed ? 'pass' : 'fail'}">${passed ? '✓' : '✗'}</span> ${escapeHtml(name)} <span class="info">${escapeHtml(detail)}</span>`
  document.getElementById('results')!.appendChild(div)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function updateSummary() {
  const pass = RESULTS.filter(r => r.passed).length
  const fail = RESULTS.filter(r => !r.passed).length
  document.getElementById('passCount')!.textContent = String(pass)
  document.getElementById('failCount')!.textContent = String(fail)
  document.getElementById('totalCount')!.textContent = String(RESULTS.length)
}

function setStatus(msg: string, ok?: boolean) {
  const el = document.getElementById('status')!
  el.textContent = msg
  el.style.color = ok === undefined ? '#888' : ok ? '#4ecca3' : '#e94560'
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Poll `condition` until it holds, so the suite pays only what the browser
 * actually needs on a fast runner and keeps its full budget on a loaded one.
 */
async function waitFor(
  condition: () => boolean,
  { timeout = TEST_TIMEOUT, interval = 25, label = 'condition' }: { timeout?: number; interval?: number; label?: string } = {},
): Promise<void> {
  const deadline = Date.now() + timeout
  for (;;) {
    if (condition()) return
    if (Date.now() >= deadline) throw new Error(`waitFor timed out after ${timeout}ms: ${label}`)
    await sleep(interval)
  }
}

/** Poll until `condition`, then keep observing for `settle` ms (proves exact counts). */
async function waitForSettled(
  condition: () => boolean,
  { settle = 300, timeout, interval, label }: { settle?: number; timeout?: number; interval?: number; label?: string } = {},
): Promise<void> {
  await waitFor(condition, { timeout, interval, label })
  await sleep(settle)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)
    ),
  ])
}

// ── Run tests ───────────────────────────────────────────────────
async function runTests() {
  setStatus('🔄 Running tests...')

  try {
    // 1. Module imports
    report('EventClient class exists', typeof EventClient === 'function', '')
    report('EventServer class exists', typeof EventServer === 'function', '')
    report('SseClientPubSubTransport class exists', typeof SseClientPubSubTransport === 'function', '')
    report('EventToolFunc class exists', typeof EventToolFunc === 'function', '')
    report('genUrlParamsStr exists', typeof genUrlParamsStr === 'function', '')
    report('backendEventable exists', typeof backendEventable === 'function', '')
    report('EventName constant', EventName === 'event', EventName)
    report('EventBusName constant', EventBusName === 'event-bus', EventBusName)
    report('ClientEventPrefix constant', ClientEventPrefix === 'client:', ClientEventPrefix)

    // 2. Event bus works
    const emitter = event.runSync()
    let fired = false
    emitter.on('e2e-unit', () => { fired = true })
    emitter.emit('e2e-unit')
    report('Event bus emit/listen', fired, '')

    // 3. genUrlParamsStr
    const qs = genUrlParamsStr({ msg: 'hi' })
    report('genUrlParamsStr', qs === '?p=' + encodeURIComponent('{"msg":"hi"}'), qs)

    // 3.5 EventSource: `eventsource` is a peer dependency and is
    // environment-agnostic, so there is nothing to install on the global — the
    // transport imports it directly and every SSE test below runs that same
    // implementation (single connection, retry: + Last-Event-ID reconnection).
    report('EventSource class exists', typeof EventSource === 'function', '')

    // 4. SseClientPubSubTransport setup
    const transport = new SseClientPubSubTransport()
    transport.setApiRoot(SSE_URL + '/api/')
    report('Transport created and configured', true, `apiRoot: ${SSE_URL}/api/`)

    // 5. Connect to SSE
    setStatus('📡 Connecting to SSE server...')
    const stream = await withTimeout(
      transport.connect('event'),
      TEST_TIMEOUT,
      'SSE connection'
    )
    const hasClientId = !!stream.clientId
    report('SSE connection established', hasClientId, `clientId: ${stream.clientId}`)
    report('Stream protocol is sse', stream.protocol === 'sse', stream.protocol)

    // 6. Receive server event
    setStatus('📩 Waiting for server event...')
    const subPromise = new Promise<any>(resolve => {
      stream.on('e2e-message', (data: any) => resolve(data))
    })

    // Trigger server event via REST
    const triggerRes1 = await fetch(SSE_URL + '/api/trigger?event=e2e-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello from server', ts: Date.now() }),
    })
    if (!triggerRes1.ok) throw new Error(`Trigger failed: ${triggerRes1.status}`)

    const subData = await withTimeout(subPromise, TEST_TIMEOUT, 'e2e-message event')
    report('Subscribe and receive event',
      subData && subData.text === 'hello from server',
      JSON.stringify(subData)
    )

    // 7. Multiple event subscriptions
    setStatus('📩 Testing multiple subscriptions...')
    const received: string[] = []
    const evts = ['ev-a', 'ev-b', 'ev-c']
    const multiPromises = evts.map(evt => {
      return new Promise<string>(resolve => {
        stream.on(evt, () => { received.push(evt); resolve(evt) })
      })
    })

    for (const evt of evts) {
      await fetch(SSE_URL + `/api/trigger?event=${evt}`, {
        method: 'POST',
        body: JSON.stringify({ n: evt }),
      })
    }

    await withTimeout(Promise.all(multiPromises), TEST_TIMEOUT, 'multiple events')
    report('Multiple event subscriptions',
      evts.every(e => received.includes(e)),
      `received: ${received.join(', ')}`
    )

    // 8. EventClient integration
    setStatus('👤 Testing EventClient...')
    EventClient.setPubSubTransport(transport)
    const client = new EventClient('e2e-user')
    // Wire EventClient's event handling directly to the SSE stream: this data-plane
    // endpoint (/api/event) has no RPC counterpart, so `on`/`off` are patched. The
    // RPC-backed path is exercised in section 19 against the control-plane port.
    const clientProxy = client as any
    clientProxy.on = (evt: string, handler: Function) => { stream.on(evt, handler as any); return clientProxy }
    clientProxy.off = (evt: string, handler: Function) => { stream.off(evt, handler as any); return clientProxy }
    clientProxy.emit = (evt: string, data: any) => { (emitter as any).emit(evt, data); return clientProxy }

    const clientPromise = new Promise<any>(resolve => {
      client.on('e2e-client', (data: any) => resolve(data))
    })

    await fetch(SSE_URL + '/api/trigger?event=e2e-client', {
      method: 'POST',
      body: JSON.stringify({ from: 'EventClient' }),
    })

    const clientData = await withTimeout(clientPromise, TEST_TIMEOUT, 'EventClient event')
    report('EventClient receives server event',
      clientData && clientData.from === 'EventClient',
      JSON.stringify(clientData)
    )

    client.close()

    // 9. Bidirectional communication (echo)
    setStatus('🔄 Testing bidirectional echo...')
    const echoPromise = new Promise<any>(resolve => {
      stream.on('e2e-echo', (data: any) => resolve(data))
    })
    await fetch(SSE_URL + '/api/echo?event=e2e-echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: 'ping', n: 42 }),
    })
    const echoData = await withTimeout(echoPromise, TEST_TIMEOUT, 'e2e-echo event')
    report('Bidirectional echo (client POST -> server SSE)',
      echoData && echoData._echoed === true && echoData.msg === 'ping' && echoData.n === 42,
      JSON.stringify(echoData)
    )

    // 10. Concurrent events in quick succession
    setStatus('📨 Testing concurrent events...')
    const CONCURRENT_COUNT = 5
    const concurrentReceived: number[] = []
    const concurrentPromises: Promise<number>[] = []
    for (let i = 0; i < CONCURRENT_COUNT; i++) {
      const idx = i
      concurrentPromises.push(new Promise<number>(resolve => {
        stream.on('e2e-concurrent-' + idx, () => {
          concurrentReceived.push(idx)
          resolve(idx)
        })
      }))
    }
    // Fire all events simultaneously
    const firePromises: Promise<Response>[] = []
    for (let i = 0; i < CONCURRENT_COUNT; i++) {
      firePromises.push(
        fetch(SSE_URL + `/api/trigger?event=e2e-concurrent-${i}`, {
          method: 'POST',
          body: JSON.stringify({ n: i }),
        })
      )
    }
    await Promise.all(firePromises)
    await withTimeout(Promise.all(concurrentPromises), TEST_TIMEOUT, 'concurrent events')
    report('Concurrent events all received',
      concurrentReceived.length === CONCURRENT_COUNT,
      `received ${concurrentReceived.length}/${CONCURRENT_COUNT}`
    )

    // 11. Multiple data types via SSE
    setStatus('📦 Testing different data types...')
    // Object data
    const objP = new Promise<any>(resolve => stream.on('e2e-type-obj', (d: any) => resolve(d)))
    await fetch(SSE_URL + '/api/trigger?event=e2e-type-obj', {
      method: 'POST', body: JSON.stringify({ a: 1, b: 'two', c: true }),
    })
    const objData = await withTimeout(objP, TEST_TIMEOUT, 'object data')
    report('Event with object data',
      objData && objData.a === 1 && objData.b === 'two' && objData.c === true,
      JSON.stringify(objData)
    )

    // Array data
    const arrP = new Promise<any>(resolve => stream.on('e2e-type-arr', (d: any) => resolve(d)))
    await fetch(SSE_URL + '/api/trigger?event=e2e-type-arr', {
      method: 'POST', body: JSON.stringify([1, 'two', true]),
    })
    const arrData = await withTimeout(arrP, TEST_TIMEOUT, 'array data')
    report('Event with array data',
      Array.isArray(arrData) && arrData[0] === 1 && arrData[1] === 'two',
      JSON.stringify(arrData)
    )

    // String data
    const strP = new Promise<any>(resolve => stream.on('e2e-type-str', (d: any) => resolve(d)))
    await fetch(SSE_URL + '/api/trigger?event=e2e-type-str', {
      method: 'POST', body: JSON.stringify('hello-string'),
    })
    const strData = await withTimeout(strP, TEST_TIMEOUT, 'string data')
    report('Event with string data', strData === 'hello-string', JSON.stringify(strData))

    // 12. Cleanup: no events after close
    setStatus('🧹 Testing close cleanup...')
    stream.close()
    report('Stream closed', true, '')
    let lateEventReceived = false
    const lateHandler = () => { lateEventReceived = true }
    stream.on('e2e-after-close', lateHandler)
    await fetch(SSE_URL + '/api/trigger?event=e2e-after-close', {
      method: 'POST', body: '{}',
    })
    // Give it a moment to arrive (negative window: nothing should arrive)
    await sleep(300)
    stream.off('e2e-after-close', lateHandler)
    report('No events after stream close', !lateEventReceived, '')

    // 13. Reconnection: create new transport, connect, verify new events arrive
    setStatus('🔄 Testing reconnection...')
    const transport2 = new SseClientPubSubTransport()
    transport2.setApiRoot(SSE_URL + '/api/')
    const stream2 = await withTimeout(
      transport2.connect('event'),
      TEST_TIMEOUT,
      'SSE reconnection'
    )
    report('Reconnection established', !!stream2.clientId, `clientId2: ${stream2.clientId}`)

    const reconnP = new Promise<any>(resolve => {
      stream2.on('e2e-reconnect-test', (data: any) => resolve(data))
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-reconnect-test', {
      method: 'POST', body: JSON.stringify({ reconnected: true }),
    })
    const reconnData = await withTimeout(reconnP, TEST_TIMEOUT, 'reconnect event')
    report('Receive events after reconnection',
      reconnData && reconnData.reconnected === true,
      JSON.stringify(reconnData)
    )
    stream2.close()
    report('Second stream closed', true, '')

    // 14. Last-Event-ID reconnection: server drops connection, EventSource reconnects
    //     with Last-Event-ID header, server replays missed events from history
    setStatus('🔄 Testing Last-Event-ID reconnection...')
    const transport3 = new SseClientPubSubTransport()
    transport3.setApiRoot(SSE_URL + '/api/')
    const stream3 = await withTimeout(
      transport3.connect('event'),
      TEST_TIMEOUT,
      'SSE Last-Event-ID connection'
    )
    report('Last-Event-ID connection established', !!stream3.clientId, 'clientId3: ' + stream3.clientId)

    // Collect all events on this stream
    const lidEvents: number[] = []
    stream3.on('e2e-lid', (data: any) => { lidEvents.push(data.seq) })

    // Fire event 1 (received normally via SSE, stored in server history)
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 1 }),
    })
    await waitForSettled(() => lidEvents.includes(1), { settle: 100, label: 'event 1 received before the drop' })

    // Tell server to drop ALL SSE connections
    await fetch(SSE_URL + '/api/disconnect', { method: 'POST' })

    // Wait a tiny bit for disconnect to propagate, then fire events 2 & 3
    // These will be stored in server history but NOT received (no connection)
    await sleep(100)
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 2 }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 3 }),
    })

    // Wait for EventSource to auto-reconnect (retry: 1000ms) and receive replay
    // EventSource sends Last-Event-ID header, server replays events 2 & 3 from history
    await waitFor(() => lidEvents.includes(2) && lidEvents.includes(3), {
      label: 'missed events replayed after reconnect',
    })
    // Also verify event 4 arrives after reconnect
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 4 }),
    })
    await waitForSettled(() => lidEvents.includes(4), { settle: 200, label: 'event 4 received after the replay' })

    // Verify: should have unique seqs 1,2,3,4
    // Use Set to deduplicate in case EventSource delivers events more than once
    const uniqueSeqs = [...new Set(lidEvents)].sort((a, b) => a - b).join(',')
    report('Last-Event-ID: missed events replayed after reconnect',
      uniqueSeqs === '1,2,3,4',
      'unique seqs: ' + uniqueSeqs + ' (expected: 1,2,3,4, raw: ' + lidEvents.join(',') + ')'
    )

    // stream3 was disconnected by the server, no need to close it

    // 15. @isdk/tool-event/transports/pubsub/browser subpath tests
    setStatus('📦 Testing transports/pubsub/browser subpath...')

    // Verify the subpath exports SseClientPubSubTransport
    report('pubsub/browser: SseClientPubSubTransport class exists',
      typeof PubSubSseClient === 'function', '')

    // PubSubSseClient is the same class as SseClientPubSubTransport from the main browser entry
    // Verify they're the same (the subpath re-exports from sse-client.ts)
    report('pubsub/browser: SseClientPubSubTransport matches main export',
      PubSubSseClient === SseClientPubSubTransport, '')

    // Verify we can create and use the transport from the subpath import
    const pubsubTransport = new PubSubSseClient()
    pubsubTransport.setApiRoot(SSE_URL + '/api/')
    report('pubsub/browser: Transport created and configured from subpath import', true, '')

    // Connect using the subpath-imported transport
    const pubsubStream = await withTimeout(
      pubsubTransport.connect('event'),
      TEST_TIMEOUT,
      'pubsub/browser SSE connection'
    )
    report('pubsub/browser: SSE connection established',
      !!pubsubStream.clientId, 'clientId: ' + pubsubStream.clientId)
    report('pubsub/browser: Stream protocol is sse',
      pubsubStream.protocol === 'sse', pubsubStream.protocol)

    // Subscribe and receive an event via the subpath transport
    const pubsubMsgP = new Promise<any>(resolve => {
      pubsubStream.on('e2e-pubsub-msg', (data: any) => resolve(data))
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-pubsub-msg', {
      method: 'POST', body: JSON.stringify({ from: 'pubsub-browser', ts: Date.now() }),
    })
    const pubsubData = await withTimeout(pubsubMsgP, TEST_TIMEOUT, 'pubsub/browser event')
    report('pubsub/browser: Subscribe and receive event',
      pubsubData && pubsubData.from === 'pubsub-browser', JSON.stringify(pubsubData)
    )

    // Clean up
    pubsubStream.close()
    report('pubsub/browser: Stream closed', true, '')

    // 16. EventServer bidirectional communication via HTTP bridge
    setStatus('📣 Testing EventServer bidirectional communication...')

    // Create a fresh SSE connection (the original stream was killed in test 14)
    const esTransport = new SseClientPubSubTransport()
    esTransport.setApiRoot(SSE_URL + '/api/')
    const esStream = await withTimeout(
      esTransport.connect('event'),
      TEST_TIMEOUT,
      'EventServer SSE connection'
    )
    report('EventServer: SSE connection established', !!esStream.clientId, 'esClientId: ' + esStream.clientId)

    // Create an EventServer instance
    const esInstance = new EventServer('e2e-es-test')
    report('EventServer: Instance created', esInstance instanceof EventServer, '')

    // Create a mock IPubSubServerTransport that publishes via HTTP to the test server
    // This bridges EventServer's server-side publish to our SSE server
    const httpBridgeTransport: IPubSubServerTransport = {
      name: 'e2e-http-bridge',
      protocol: 'sse',
      connect: (opts?: any) => ({ id: 'bridge', protocol: 'sse', send: () => {}, close: () => {} }),
      subscribe: () => {},
      unsubscribe: () => {},
      publish: (eventName: string, data: any) => {
        // EventServer.forward() wraps data in array via ebListener's rest params
        // Flatten single-element arrays for consistent SSE broadcast
        const payload = Array.isArray(data) && data.length === 1 ? data[0] : data
        fetch(SSE_URL + '/api/trigger?event=' + eventName, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      },
      onConnection: () => {},
      onDisconnect: () => {},
    }

    // Set the transport on EventServer
    EventServer.setPubSubTransport(httpBridgeTransport)
    report('EventServer: HTTP bridge transport set', true, '')

    // Test 1: EventServer.publish via HTTP bridge -> SSE server -> client receives
    const esPublishP = new Promise<any>(resolve => {
      esStream.on('e2e-es-pub', (data: any) => resolve(data))
    })
    EventServer.publish('e2e-es-pub', { from: 'EventServer', via: 'http-bridge' })
    const esPubData = await withTimeout(esPublishP, TEST_TIMEOUT, 'EventServer publish')
    report('EventServer.publish: event received via SSE',
      esPubData && esPubData.from === 'EventServer' && esPubData.via === 'http-bridge',
      JSON.stringify(esPubData)
    )

    // Test 2: EventServer instance's publishServerEvent
    const esInstP = new Promise<any>(resolve => {
      esStream.on('e2e-es-inst', (data: any) => resolve(data))
    })
    esInstance.publishServerEvent('e2e-es-inst', { seq: 1, method: 'publishServerEvent' })
    const esInstData = await withTimeout(esInstP, TEST_TIMEOUT, 'publishServerEvent')
    report('EventServer.publishServerEvent: instance method works',
      esInstData && esInstData.seq === 1 && esInstData.method === 'publishServerEvent',
      JSON.stringify(esInstData)
    )

    // Test 3: EventServer.forward() on local event bus -> published via transport -> SSE client
    // Forward the e2e-local-fwd event from the event bus to the transport
    esInstance.forward('e2e-local-fwd')
    report('EventServer.forward: registered forwarding', true, '')

    const esFwdP = new Promise<any>(resolve => {
      esStream.on('e2e-local-fwd', (data: any) => resolve(data))
    })

    // Emit on the local event bus (the event bus from the browser's event bus)
    const eventBus = event.runSync()
    eventBus.emit('e2e-local-fwd', { triggered: 'via-event-bus', ts: Date.now() })
    const esFwdData = await withTimeout(esFwdP, TEST_TIMEOUT, 'EventServer forward')
    report('EventServer.forward: event bus events forwarded to SSE',
      esFwdData && esFwdData.triggered === 'via-event-bus',
      JSON.stringify(esFwdData)
    )

    // Clean up EventServer forwarding and SSE connection
    esInstance.unforward('e2e-local-fwd')
    EventServer.setPubSubTransport(undefined)
    esStream.close()
    report('EventServer: cleanup done', true, '')

    // ──────────── 17. Regex pattern event subscription ────────────
    setStatus('🔤 Testing regex pattern subscriptions...')

    // The polyfill installed at the start of the run is what makes these
    // regex subscriptions observable: it hands every message to the
    // transport's dispatchEvent, where regex patterns are matched.
    // Create a fresh transport+stream for regex tests
    const regexTransport = new SseClientPubSubTransport()
    regexTransport.setApiRoot(SSE_URL + '/api/')
    const regexStream = await withTimeout(
      regexTransport.connect('event'),
      TEST_TIMEOUT,
      'regex SSE connection'
    )
    report('Regex tests: SSE connection established', !!regexStream.clientId, 'clientId: ' + regexStream.clientId)

    // 17a. String-form regex: /^e2e-regex-.*/
    const regexStringReceived: string[] = []
    regexStream.addRegExEventListener!('/^e2e-regex-.*/', (data: any) => {
      regexStringReceived.push(data.n)
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-regex-one', {
      method: 'POST', body: JSON.stringify({ n: 'one' }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-regex-two', {
      method: 'POST', body: JSON.stringify({ n: 'two' }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-other', {
      method: 'POST', body: JSON.stringify({ n: 'other' }),
    })
    await waitForSettled(
      () => regexStringReceived.includes('one') && regexStringReceived.includes('two'),
      { settle: 300, label: 'string-form regex matched both events' },
    )
    const regexStrOk = regexStringReceived.includes('one') && regexStringReceived.includes('two') && !regexStringReceived.includes('other')
    report('addRegExEventListener with string-form regex /^e2e-regex-.*/',
      regexStrOk,
      'received: ' + regexStringReceived.join(',')
    )

    // 17b. RegExp object: /^e2e-regex-obj-.*/
    const regexObjReceived: string[] = []
    regexStream.addRegExEventListener!(/^e2e-regex-obj-.*/, (data: any) => {
      regexObjReceived.push(data.n)
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-regex-obj-alpha', {
      method: 'POST', body: JSON.stringify({ n: 'alpha' }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-regex-obj-beta', {
      method: 'POST', body: JSON.stringify({ n: 'beta' }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-nomatch', {
      method: 'POST', body: JSON.stringify({ n: 'no-match' }),
    })
    await waitForSettled(
      () => regexObjReceived.includes('alpha') && regexObjReceived.includes('beta'),
      { settle: 300, label: 'RegExp-object subscription matched both events' },
    )
    const regexObjOk = regexObjReceived.includes('alpha') && regexObjReceived.includes('beta') && !regexObjReceived.includes('no-match')
    report('addRegExEventListener with RegExp object /^e2e-regex-obj-.*/',
      regexObjOk,
      'received: ' + regexObjReceived.join(',')
    )

    // 17c. Mixed exact + regex: both fire for same event
    let mixedExactCount = 0
    let mixedRegexCount = 0
    const mixedP = new Promise<void>(resolve => {
      const check = () => { if (mixedExactCount >= 1 && mixedRegexCount >= 1) resolve() }
      regexStream.on('e2e-mixed-event', () => { mixedExactCount++; check() })
      regexStream.addRegExEventListener!('/^e2e-mixed-.*/', () => { mixedRegexCount++; check() })
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-mixed-event', {
      method: 'POST', body: JSON.stringify({}),
    })
    await withTimeout(mixedP, TEST_TIMEOUT, 'mixed exact+regex')
    const mixedOk = mixedExactCount === 1 && mixedRegexCount === 1
    report('Mixed: on() and addRegExEventListener() both receive matching event',
      mixedOk,
      'exact:' + mixedExactCount + ' regex:' + mixedRegexCount
    )

    // 17d. Remove regex listener
    let removedCalled = false
    const removedHandler = () => { removedCalled = true }
    regexStream.addRegExEventListener!('/^e2e-removed-.*/', removedHandler)
    regexStream.removeRegExEventListener!('/^e2e-removed-.*/', removedHandler)
    await fetch(SSE_URL + '/api/trigger?event=e2e-removed-test', {
      method: 'POST', body: JSON.stringify({}),
    })
    await sleep(300) // negative window: the removed listener must stay silent
    report('removeRegExEventListener: listener removed before event fires',
      !removedCalled,
      'called=' + removedCalled
    )

    // 17e. Multiple regex patterns
    const multiPatternReceived: string[] = []
    regexStream.addRegExEventListener!('/^e2e-multi-a-.*/', (data: any) => {
      multiPatternReceived.push('a:' + data.n)
    })
    regexStream.addRegExEventListener!('/^e2e-multi-b-.*/', (data: any) => {
      multiPatternReceived.push('b:' + data.n)
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-multi-a-1', {
      method: 'POST', body: JSON.stringify({ n: '1' }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-multi-b-2', {
      method: 'POST', body: JSON.stringify({ n: '2' }),
    })
    await waitForSettled(
      () => multiPatternReceived.includes('a:1') && multiPatternReceived.includes('b:2'),
      { settle: 200, label: 'both regex patterns matched their own events' },
    )
    const multiOk = multiPatternReceived.includes('a:1') && multiPatternReceived.includes('b:2')
    report('Multiple addRegExEventListener patterns each match correctly',
      multiOk,
      'received: ' + multiPatternReceived.join(',')
    )

    // Clean up
    regexStream.close()
    report('Regex tests: cleanup done', true, '')

    // ──────────── 18. Regression: defects found in code review ────────────
    // Each of these failed before the fixes; they are the browser-side
    // counterparts of the unit tests in test/browser.test.ts and
    // test/event-server.test.ts, exercised over a real SSE connection.
    setStatus('🛡️ Testing P0 regressions...')

    const regTransport = new SseClientPubSubTransport()
    regTransport.setApiRoot(SSE_URL + '/api/')
    const regStream = await withTimeout(
      regTransport.connect('event'),
      TEST_TIMEOUT,
      'regression SSE connection'
    )
    report('Regression: SSE connection established', !!regStream.clientId, 'clientId: ' + regStream.clientId)

    // 18a. A frame whose payload is not JSON must be delivered as the raw string
    //      and must not tear the stream down (it used to kill every listener).
    const rawReceived: string[] = []
    regStream.addRegExEventListener!('/^e2e-raw-.*/', (data: any) => {
      rawReceived.push(typeof data === 'string' ? data : JSON.stringify(data))
    })
    await fetch(SSE_URL + '/api/raw?event=e2e-raw-text', {
      method: 'POST',
      body: 'plain text not json',
    })
    await waitForSettled(() => rawReceived.includes('plain text not json'), {
      settle: 100,
      label: 'non-JSON frame delivered as a raw string',
    })
    const readyAfterRaw = regStream.readyState
    const afterRawP = new Promise<any>(resolve => regStream.on('e2e-raw-after', (d: any) => resolve(d)))
    await fetch(SSE_URL + '/api/trigger?event=e2e-raw-after', {
      method: 'POST', body: JSON.stringify({ n: 'after-raw' }),
    })
    const afterRawData = await withTimeout(afterRawP, TEST_TIMEOUT, 'event after non-JSON frame')
    report('P0: non-JSON payload delivered as raw string, stream survives',
      rawReceived.includes('plain text not json') && readyAfterRaw === 1 && afterRawData?.n === 'after-raw',
      `payload=${JSON.stringify(rawReceived[0])} readyState=${readyAfterRaw} next=${JSON.stringify(afterRawData)}`
    )

    // 18b. A regex listener that throws must not end the connection.
    const throwP = new Promise<void>(resolve => {
      regStream.addRegExEventListener!('/^e2e-throw-.*/', () => {
        resolve()
        throw new Error('listener exploded')
      })
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-throw-boom', {
      method: 'POST', body: JSON.stringify({ n: 'boom' }),
    })
    await withTimeout(throwP, TEST_TIMEOUT, 'throwing regex listener')
    const afterThrowP = new Promise<any>(resolve => regStream.on('e2e-throw-after', (d: any) => resolve(d)))
    await fetch(SSE_URL + '/api/trigger?event=e2e-throw-after', {
      method: 'POST', body: JSON.stringify({ n: 'after-throw' }),
    })
    const afterThrowData = await withTimeout(afterThrowP, TEST_TIMEOUT, 'event after throwing listener')
    report('P0: throwing regex listener does not tear down the stream',
      afterThrowData?.n === 'after-throw' && regStream.readyState === 1,
      `readyState=${regStream.readyState} next=${JSON.stringify(afterThrowData)}`
    )

    // 18c. A global-flag regex must match every event, not every other one.
    const gflagReceived: string[] = []
    regStream.addRegExEventListener!('/^e2e-gflag-.*/g', (data: any) => {
      gflagReceived.push(data.n)
    })
    for (const n of ['one', 'two', 'three', 'four']) {
      await fetch(SSE_URL + '/api/trigger?event=e2e-gflag-' + n, {
        method: 'POST', body: JSON.stringify({ n }),
      })
    }
    await waitForSettled(() => gflagReceived.length >= 4, {
      settle: 200,
      label: 'global-flag regex matched every event',
    })
    report('P0: global-flag regex /^e2e-gflag-.*/g delivers every matching event',
      gflagReceived.length === 4,
      'received: ' + gflagReceived.join(',')
    )

    // 18d/18e. Dedup across *separate* subscribe calls, in both orders. The
    // transport control calls (sub/unsub) are stubbed: the data-plane endpoint these
    // tests use has no RPC counterpart (the control plane runs on its own port, see
    // section 19). The dedup logic under test is EventClient's own listener
    // bookkeeping.
    // The client's own listener bookkeeping is observed at the transport
    // boundary: after both subscriptions the stream must carry exactly one
    // installed listener for the event (the covering regex), and the event must
    // arrive once. `on`/`off` on an EventClient instance are RPC-backed, so the
    // stream is the observable interface here. The spy wraps `connect`, so it
    // survives the reconnect `subscribe` triggers.
    const makeDedupClient = () => {
      const c: any = new EventClient('event')
      c.sub = async (p: any) => ({ ok: true, event: p.event })
      c.unsub = async (p: any) => ({ ok: true, event: p.event })
      return c
    }

    const makeDedupSpy = (eventName: string, counter: () => void) => {
      const counts = { exact: 0, regex: 0 }
      const transport = new SseClientPubSubTransport()
      transport.setApiRoot(SSE_URL + '/api/')
      const connect0 = transport.connect.bind(transport)
      transport.connect = async (url: string, params?: any) => {
        const s: any = await connect0(url, params)
        const on0 = s.on.bind(s)
        const off0 = s.off.bind(s)
        const add0 = s.addRegExEventListener!.bind(s)
        // The test's own delivery counter is excluded from the counts by listener
        // identity: it is not one of the client's subscriptions.
        s.on = (e: string, l: any) => { if (e === eventName && l !== counter) counts.exact++; return on0(e, l) }
        s.off = (e: string, l: any) => { if (e === eventName && l !== counter) counts.exact--; return off0(e, l) }
        s.addRegExEventListener = (p: any, l: any) => { counts.regex++; return add0(p, l) }
        s.on(eventName, counter)
        return s
      }
      return { transport, counts }
    }

    // 18d. exact first, covering regex in a separate subscribe() call
    let exactFirstDeliveries = 0
    const exactFirstSpy = makeDedupSpy('e2e-twostep-exact', () => { exactFirstDeliveries++ })
    EventClient.setPubSubTransport(exactFirstSpy.transport)
    const exactFirst: any = makeDedupClient()
    await exactFirst.subscribe('e2e-twostep-exact')
    await exactFirst.subscribe('/^e2e-twostep-.*/')
    await fetch(SSE_URL + '/api/trigger?event=e2e-twostep-exact', {
      method: 'POST', body: JSON.stringify({ n: 'once' }),
    })
    await waitForSettled(() => exactFirstDeliveries >= 1, {
      settle: 300,
      label: 'event delivered to the dedup client',
    })
    report('P0: exact subscribed before covering regex (separate calls) delivers once',
      exactFirstSpy.counts.exact === 0 && exactFirstSpy.counts.regex === 1 && exactFirstDeliveries === 1,
      `installed exact=${exactFirstSpy.counts.exact} regex=${exactFirstSpy.counts.regex} deliveries=${exactFirstDeliveries}`
    )
    exactFirst.close()

    // 18e. covering regex first, exact in a separate subscribe() call
    let regexFirstDeliveries = 0
    const regexFirstSpy = makeDedupSpy('e2e-reverse-exact', () => { regexFirstDeliveries++ })
    EventClient.setPubSubTransport(regexFirstSpy.transport)
    const regexFirst: any = makeDedupClient()
    await regexFirst.subscribe('/^e2e-reverse-.*/')
    await regexFirst.subscribe('e2e-reverse-exact')
    await fetch(SSE_URL + '/api/trigger?event=e2e-reverse-exact', {
      method: 'POST', body: JSON.stringify({ n: 'once' }),
    })
    await waitForSettled(() => regexFirstDeliveries >= 1, {
      settle: 300,
      label: 'event delivered to the dedup client',
    })
    report('P0: covering regex subscribed before exact (separate calls) delivers once',
      regexFirstSpy.counts.exact === 0 && regexFirstSpy.counts.regex === 1 && regexFirstDeliveries === 1,
      `installed exact=${regexFirstSpy.counts.exact} regex=${regexFirstSpy.counts.regex} deliveries=${regexFirstDeliveries}`
    )
    regexFirst.close()

    regStream.close()
    report('P0 regressions: cleanup done', true, '')

    // 19. Control plane over RPC: discovery -> EventClient over RPC -> SSE stream
    //     served by EventServer.list -> $sub/$unsub/$publish against a real session.
    //     The data-plane tests above talk to a hand-rolled SSE channel that broadcasts
    //     to every connection; this section is the real control path the README
    //     documents, and until now nothing in the browser suite exercised it.
    setStatus('🛰 Testing RPC control plane...')
    const RPC_ROOT = window.location.origin + '/api/rpc/'

    RpcTransportManager.bindScheme('http', HttpClientToolTransport)
    // `backendEventable` resolves the bus through the registry, so the event-bus tool
    // has to be registered before it is used.
    event.register()
    backendEventable(EventClient)

    // Register the client tool locally first: discovery merges the server's metadata
    // into this instance, which is what keeps it an EventClient.
    const rpcEvent = new EventClient('event')
    rpcEvent.register()

    ClientTools.apiUrl = RPC_ROOT
    await withTimeout(ClientTools.loadFrom(), TEST_TIMEOUT, 'RPC discovery')
    const discovered = ClientTools.get('event') as EventClient
    report('RPC: discovery reached the server and merged the event tool',
      discovered === rpcEvent, `apiUrl: ${RPC_ROOT}`)
    report('RPC: discovery installed the control methods on the client',
      typeof (rpcEvent as any).sub === 'function' &&
      typeof (rpcEvent as any).unsub === 'function' &&
      typeof (rpcEvent as any).publish === 'function',
      'sub/unsub/publish')

    // The transport picks up the static apiUrl when installed, so the EventSource URL
    // the client builds is RPC_ROOT + 'event' — the stream EventServer.list serves.
    EventClient.setPubSubTransport(new SseClientPubSubTransport())

    await withTimeout(rpcEvent.init(['ctrl-a']), TEST_TIMEOUT, 'EventClient.init over RPC')
    report('RPC: EventClient opened its SSE stream on the RPC endpoint',
      !!rpcEvent.clientId && rpcEvent.active, `clientId: ${rpcEvent.clientId}`)

    // $sub against a live session: the server reports the per-session subscription and
    // the clientId *it* assigned. A client-supplied clientId in the payload must not
    // become the identity the server records.
    const forged = 'forged-' + Math.random().toString(36).slice(2, 8)
    const subResult: any = await withTimeout(
      (rpcEvent as any).sub({ event: 'ctrl-a', clientId: forged }),
      TEST_TIMEOUT, '$sub')
    report('RPC: $sub reports the session subscription',
      subResult?.forward === true && subResult?.subscribed === true,
      JSON.stringify(subResult))
    report('RPC: the server ignores a client-supplied clientId',
      subResult?.clientId === rpcEvent.clientId && subResult?.clientId !== forged,
      `server ${subResult?.clientId} vs forged ${forged}`)

    let ctrlHits = 0
    const ctrlP = new Promise<any>(resolve => rpcEvent.on('ctrl-a', (name: string, data: any) => {
      ctrlHits++
      resolve(data)
    }))
    const pubResult: any = await withTimeout(
      rpcEvent.publish({ event: 'ctrl-a', data: { from: 'rpc', n: 1 } }),
      TEST_TIMEOUT, 'RPC publish')
    const ctrlData = await withTimeout(ctrlP, TEST_TIMEOUT, 'ctrl-a delivered on SSE')
    report('RPC: publish round-trips through the server and returns on SSE',
      ctrlData && ctrlData.from === 'rpc' && ctrlData.n === 1, JSON.stringify(ctrlData))
    report('RPC: $publish returns the server-assigned sender id, not the forged one',
      pubResult?.senderId === rpcEvent.clientId && pubResult?.senderId !== forged,
      `senderId: ${pubResult?.senderId}`)

    // Unsubscribing must stop delivery: the server drops the session subscription and
    // the client removes the transport listener.
    await withTimeout(rpcEvent.unsubscribe('ctrl-a'), TEST_TIMEOUT, 'RPC unsubscribe')
    const hitsBeforeUnsub = ctrlHits
    await rpcEvent.publish({ event: 'ctrl-a', data: { from: 'rpc', n: 2 } })
    await sleep(300)
    report('RPC: unsubscribe stops delivery',
      ctrlHits === hitsBeforeUnsub,
      `ctrl-a delivered ${ctrlHits} time(s), was ${hitsBeforeUnsub} before unsubscribe`)

    // Per-session subscriptions: a stream that subscribed to 'ctrl-sub' receives that
    // event and not 'ctrl-other'. This is the server-side subscription filter, not the
    // client's listener bookkeeping.
    const subStream = await withTimeout(
      (async () => {
        const t = new SseClientPubSubTransport()
        t.setApiRoot(RPC_ROOT)
        return await t.connect('event', { event: ['ctrl-sub'] })
      })(),
      TEST_TIMEOUT, 'subscribed stream')
    const subHits: string[] = []
    subStream.on('ctrl-sub', () => subHits.push('ctrl-sub'))
    subStream.on('ctrl-other', () => subHits.push('ctrl-other'))
    await fetch(SSE_URL + '/api/ctrl/publish?event=ctrl-sub', { method: 'POST', body: JSON.stringify({ n: 1 }) })
    await fetch(SSE_URL + '/api/ctrl/publish?event=ctrl-other', { method: 'POST', body: JSON.stringify({ n: 1 }) })
    await waitForSettled(() => subHits.length >= 1, { settle: 300, label: 'subscribed event delivered' })
    report('RPC: a session receives only the events it subscribed to',
      subHits.length === 1 && subHits[0] === 'ctrl-sub',
      'received: ' + subHits.join(','))

    // Targeted publish: with a target clientId the transport delivers to that session
    // alone. The broadcast that follows is the positive control — the second stream
    // does receive the same event when nothing targets it, so the 0 above is about
    // targeting, not about a listener that never fires.
    const plainStream = await withTimeout(
      (async () => {
        const t = new SseClientPubSubTransport()
        t.setApiRoot(RPC_ROOT)
        return await t.connect('event')
      })(),
      TEST_TIMEOUT, 'plain stream')
    // Both streams listen to the same event name; only deliveries carrying this
    // marker are counted, so the subscription test above does not leak into these.
    const targetHits: number[] = []
    const otherHits: number[] = []
    plainStream.on('ctrl-sub', (d: any) => { if (d?.t === 'tgt') targetHits.push(d.n) })
    subStream.on('ctrl-sub', (d: any) => { if (d?.t === 'tgt') otherHits.push(d.n) })
    await fetch(SSE_URL + `/api/ctrl/publish?event=ctrl-sub&clientId=${plainStream.clientId}`,
      { method: 'POST', body: JSON.stringify({ t: 'tgt', n: 1 }) })
    await waitForSettled(() => targetHits.length >= 1, { settle: 300, label: 'targeted publish reaches the target' })
    report('RPC: publish with a target clientId reaches only that session',
      targetHits.length === 1 && otherHits.length === 0,
      `target=${targetHits.length} other=${otherHits.length}`)
    // Positive control: the same event untargeted. The plain stream has no
    // subscription list (the transport delivers everything to an unsubscribed
    // session) and the other one subscribed to exactly this name, so both must
    // receive it — the 0 above is about targeting, not about a dead listener.
    await fetch(SSE_URL + '/api/ctrl/publish?event=ctrl-sub', { method: 'POST', body: JSON.stringify({ t: 'tgt', n: 2 }) })
    await waitForSettled(() => otherHits.length >= 1, { settle: 300, label: 'untargeted publish reaches the other session' })
    report('RPC: publish without a target reaches every session subscribed to it',
      targetHits.length === 2 && otherHits.length === 1,
      `target=${targetHits.length} other=${otherHits.length}`)

    subStream.close()
    plainStream.close()

    // Degraded path: with no stream there is no session, so $sub/$unsub fall back to
    // class-level forwarding and report no per-session fields.
    rpcEvent.close()
    const degraded: any = await withTimeout((rpcEvent as any).sub({ event: 'ctrl-degraded' }), TEST_TIMEOUT, '$sub with no session')
    report('RPC: $sub without a session degrades to class-level forwarding',
      degraded?.forward === true && degraded?.subscribed === undefined && degraded?.event === 'ctrl-degraded',
      JSON.stringify(degraded))

    report('RPC: stream closed', !rpcEvent.active, '')

    // 20. Control-plane stream resilience: the server ends the response, the
    //     EventSource reconnects after the `retry:` interval carrying Last-Event-ID,
    //     and the channel replays what was published during the outage.
    //     The data-plane suite has reconnection coverage against its hand-rolled
    //     channel; the real SSEChannel behind the RPC endpoint had none.
    setStatus('🔌 Testing control-plane reconnect...')
    const rcTransport = new SseClientPubSubTransport()
    rcTransport.setApiRoot(RPC_ROOT)
    const rcStream = await withTimeout(
      rcTransport.connect('event', { event: ['ctrl-rc'] }),
      TEST_TIMEOUT, 'reconnect stream')
    const rcIds: string[] = []
    const rcHits: number[] = []
    // The id the stream was opened with. `stream.clientId` must follow the server-assigned
    // id of whichever connection is live, so `$sub`/`$publish` target the right session.
    const firstStreamId = rcStream.clientId
    // Registered after connect resolved, so this listener only ever sees the welcome
    // the *reconnected* connection carries — the first one was consumed by the
    // transport's own handshake.
    rcStream.on('welcome', (d: any) => { if (d?.clientId) rcIds.push(d.clientId) })
    rcStream.on('ctrl-rc', (d: any) => { if (d?.t === 'rc') rcHits.push(d.n) })

    await fetch(SSE_URL + '/api/ctrl/publish?event=ctrl-rc', { method: 'POST', body: JSON.stringify({ t: 'rc', n: 0 }) })
    await waitForSettled(() => rcHits.length >= 1, { settle: 250, label: 'event delivered before the drop' })
    report('Reconnect: control-plane stream delivers before the drop',
      rcHits.length === 1 && rcIds.length === 0,
      `delivered=${rcHits.join(',')} welcomes=${rcIds.length}`)

    const dropRes = await fetch(SSE_URL + '/api/ctrl/disconnect', { method: 'POST' })
    const dropInfo: any = await dropRes.json()
    // Published while the stream is down: these can only arrive through replay.
    for (const n of [1, 2, 3]) {
      await fetch(SSE_URL + '/api/ctrl/publish?event=ctrl-rc', { method: 'POST', body: JSON.stringify({ t: 'rc', n }) })
    }
    await waitForSettled(() => rcHits.length >= 4, { settle: 500, label: 'replayed events delivered after reconnect' })
    report('Reconnect: the stream reconnects and replays the events published during the outage',
      rcHits.length === 4 && rcHits.join(',') === '0,1,2,3',
      `dropped=${dropInfo.disconnected} delivered=${rcHits.join(',')}`)
    // The server issued a resume credential in the welcome frame, so the dropped
    // connection resumes the session it had: same server-assigned id, same subscriptions.
    report('Reconnect: the drop resumes the same server-assigned session',
      rcIds.length === 1 && rcIds[0] === firstStreamId && rcStream.clientId === firstStreamId,
      `resumed ${rcIds[0]} (first ${firstStreamId}, stream now ${rcStream.clientId})`)

    // Live delivery resumes on the subscription the reconnect re-established (the
    // stream URL carries its event list, so EventServer.list re-subscribes it).
    await fetch(SSE_URL + '/api/ctrl/publish?event=ctrl-rc', { method: 'POST', body: JSON.stringify({ t: 'rc', n: 4 }) })
    await waitForSettled(() => rcHits.length >= 5, { settle: 300, label: 'live delivery after reconnect' })
    report('Reconnect: live delivery resumes on the re-established subscription',
      rcHits.length === 5 && rcHits[4] === 4,
      `delivered=${rcHits.join(',')}`)

    rcStream.close()
    report('Reconnect: stream closed after recovery', rcStream.readyState === 2, `readyState=${rcStream.readyState}`)

    // All done
    const passed = RESULTS.filter(r => r.passed).length
    const total = RESULTS.length
    const allPassed = passed === total
    setStatus(allPassed ? '✅ All tests completed! 🎉' : '❌ Some tests failed', allPassed)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    report('TEST SUITE ERROR', false, msg)
    setStatus('❌ Test error: ' + msg, false)
    console.error('E2E Error:', err)
  }
}

runTests()
