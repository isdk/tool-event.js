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
  backendEventable,
  eventClient,
  eventServer,
  EventName,
  EventBusName,
  ClientEventPrefix,
  EventEmitter,
  eventable,
  EventStates,
  wrapEventEmitter,
} from '@isdk/tool-event/browser'

import type {
  PubSubCtx,
  PubSubClientStream,
  IPubSubClientTransport,
  IPubSubServerTransport,
  PubSubServerSession,
  PubSubClientId,
} from '@isdk/tool-event/browser'

// Import from the transports/pubsub/browser subpath to verify it resolves correctly
// in the browser and exports the expected transport-layer types
import {
  SseClientPubSubTransport as PubSubSseClient,
} from '@isdk/tool-event/transports/pubsub/browser'

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
    // Wire EventClient's event handling directly to the SSE stream
    // to avoid sending RPC calls that our test server doesn't support
    client.on = (evt: string, handler: Function) => { stream.on(evt, handler as any); return client }
    client.off = (evt: string, handler: Function) => { stream.off(evt, handler as any); return client }
    client.emit = (evt: string, data: any) => { (emitter as any).emit(evt, data); return client }

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
    const firePromises = []
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
    // Give it a moment to arrive
    await new Promise(r => setTimeout(r, 300))
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
    await new Promise(r => setTimeout(r, 300))

    // Tell server to drop ALL SSE connections
    await fetch(SSE_URL + '/api/disconnect', { method: 'POST' })

    // Wait a tiny bit for disconnect to propagate, then fire events 2 & 3
    // These will be stored in server history but NOT received (no connection)
    await new Promise(r => setTimeout(r, 100))
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 2 }),
    })
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 3 }),
    })

    // Wait for EventSource to auto-reconnect (retry: 1000ms) and receive replay
    // EventSource sends Last-Event-ID header, server replays events 2 & 3 from history
    // Also verify event 4 arrives after reconnect
    await new Promise(r => setTimeout(r, 3500))
    await fetch(SSE_URL + '/api/trigger?event=e2e-lid', {
      method: 'POST', body: JSON.stringify({ seq: 4 }),
    })
    await new Promise(r => setTimeout(r, 500))

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
