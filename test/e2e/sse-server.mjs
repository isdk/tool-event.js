/**
 * E2E SSE test server.
 *
 * Provides SSE and API endpoints for browser E2E tests.
 * The Vite dev server (started by run-e2e.mjs) serves the test page.
 *
 * Endpoints:
 * - GET  /api/event       SSE event stream
 * - POST /api/trigger     Publish event to all SSE clients
 * - POST /api/echo        Echo event back to SSE clients
 * - POST /api/disconnect  Drop all SSE connections (for reconnection tests)
 * - POST /api/ctrl/publish Server-initiated publish through the real EventServer
 * - GET  /api/status      Server status
 * - POST /api/e2e-result  Log test result (debugging)
 * - Static files from dist/
 *
 * The data plane above is a simple in-process SSE implementation: it broadcasts to
 * every connection and has no notion of subscriptions, which is what the data-plane
 * tests rely on. The control plane ($sub/$unsub/$publish, per-session subscriptions,
 * targeted publish) is the real thing: an EventServer from the built package with the
 * real SseServerPubSubTransport, served by tool-rpc on its own port (RPC_PORT,
 * default SSE_PORT+1) at /api/rpc/ — discovery, RPC calls, and the client's SSE
 * stream (GET /api/rpc/event) all from EventServer.list. The dev server proxies
 * /api/rpc there so the page stays same-origin.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Self-reference through the package name: Node resolves it via the package's own
// `exports`, which is the same entry a consumer would import.
import { EventServer, SseServerPubSubTransport } from '@isdk/tool-event'
import { ServerTools, HttpServerToolTransport } from '@isdk/tool-rpc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const distDir = path.resolve(projectRoot, 'dist')

// ── Simple SSE channel implementation (no dist deps) ──────────────
class SimpleSSEChannel {
  constructor() {
    this._clients = new Map()
    this._nextId = 1
    this._history = []        // event history for Last-Event-ID replay
    this._maxHistory = 100
  }

  /** Connect a client to the SSE stream */
  connect(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // Initial retry directive
    res.write('retry: 1000\n\n')

    // Generate a client ID
    const clientId = 'e2e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    const client = { id: clientId, res, events: null }

    // Check Last-Event-ID for history replay
    const lastEventId = req.headers['last-event-id']
    if (lastEventId) {
      const lastId = parseInt(lastEventId, 10)
      const missed = this._history.filter(e => e.id > lastId)
      for (const entry of missed) {
        this._sendRaw(res, entry.raw)
      }
    }

    this._clients.set(clientId, client)

    // Send welcome event
    this._send(client, 'welcome', { clientId })

    // Clean up on close
    req.on('close', () => {
      this._clients.delete(clientId)
    })

    return client
  }

  /** Publish an event to all connected clients */
  publish(data, eventName) {
    const id = this._nextId++
    let output = `id: ${id}\n`
    if (eventName) output += `event: ${eventName}\n`
    // Always JSON.stringify so SseClientPubSubTransport can JSON.parse consistently
    const dataStr = JSON.stringify(data)
    output += `data: ${dataStr}\n\n`

    // Store in history
    this._history.push({ id, raw: output })
    if (this._history.length > this._maxHistory) {
      this._history.shift()
    }

    for (const client of this._clients.values()) {
      try {
        client.res.write(output)
      } catch { /* ignore write errors */ }
    }
    return id
  }

  /**
   * Publish a frame whose `data:` payload is deliberately NOT JSON.
   *
   * Regression fixture: the client transport must decode it without throwing,
   * because an exception inside the dispatch hook used to tear down the whole
   * stream and drop every later event.
   */
  publishRaw(rawData, eventName) {
    const id = this._nextId++
    let output = `id: ${id}\n`
    if (eventName) output += `event: ${eventName}\n`
    output += `data: ${rawData}\n\n`

    this._history.push({ id, raw: output })
    if (this._history.length > this._maxHistory) {
      this._history.shift()
    }

    for (const client of this._clients.values()) {
      try {
        client.res.write(output)
      } catch { /* ignore write errors */ }
    }
    return id
  }

  /** Send a raw SSE string to a response */
  _sendRaw(res, raw) {
    try { res.write(raw) } catch { /* ignore */ }
  }

  _send(client, eventName, data) {
    const id = this._nextId++
    // Always JSON.stringify for consistent transport parsing
    const dataStr = JSON.stringify(data)
    const output = `id: ${id}\nevent: ${eventName}\ndata: ${dataStr}\n\n`
    // Store in history
    this._history.push({ id, raw: output })
    if (this._history.length > this._maxHistory) {
      this._history.shift()
    }
    try {
      client.res.write(output)
    } catch { /* ignore */ }
  }

  /** Disconnect all clients (for recovery testing) */
  disconnectAll() {
    const count = this._clients.size
    for (const client of this._clients.values()) {
      try {
        this._send(client, 'server-shutdown', { reason: 'e2e-test-disconnect' })
        client.res.end()
      } catch { /* ignore */ }
    }
    this._clients.clear()
    return count
  }

  get connectedCount() { return this._clients.size }
}

const channel = new SimpleSSEChannel()

// ── Control plane: real EventServer + tool-rpc ───────────────────
// Defined before the request handler so the control-plane routes below reference
// initialized objects.
//
// `EventServer.list` is a stream method, so GET /api/rpc/event is served as the
// client's EventSource stream and every $sub/$unsub/$publish is an RPC call.
const ctrlTransport = new SseServerPubSubTransport()
EventServer.setPubSubTransport(ctrlTransport)
const ctrlEventServer = new EventServer('event')
ctrlEventServer.register()

// Track the control-plane sessions so the test server can drop them on demand
// (`session.close()` ends the response, which is what triggers the client reconnect).
const ctrlSessions = new Set()
ctrlTransport.onConnection((s) => ctrlSessions.add(s))
ctrlTransport.onDisconnect((s) => ctrlSessions.delete(s))

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found: ' + path.basename(filePath))
      return
    }

    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Server Error: ' + err.message)
  }
}

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  // SSE endpoint
  if (pathname === '/api/event' && req.method === 'GET') {
    channel.connect(req, res)
    return
  }

  // Trigger endpoint: POST /api/trigger?event=xxx
  if (pathname === '/api/trigger' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const eventName = url.searchParams.get('event') || 'default'
      let data
      try { data = JSON.parse(body) } catch { data = body || 'triggered' }
      channel.publish(data, eventName)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, event: eventName, clients: channel.connectedCount }))
    })
    return
  }

  // Echo endpoint: POST /api/echo?event=xxx
  // Client posts data, server broadcasts it back to all SSE clients
  if (pathname === '/api/echo' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const eventName = url.searchParams.get('event') || 'echo'
      let data
      try { data = JSON.parse(body) } catch { data = body || '' }
      // Add echo marker so client can distinguish echo from direct trigger
      if (typeof data === 'object' && data !== null) {
        data._echoed = true
      }
      channel.publish(data, eventName)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, event: eventName, clients: channel.connectedCount }))
    })
    return
  }

  // Raw endpoint: POST /api/raw?event=xxx
  // Broadcasts a frame whose data payload is the request body verbatim (not JSON)
  if (pathname === '/api/raw' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const eventName = url.searchParams.get('event') || 'raw'
      channel.publishRaw(body || 'plain-text-payload', eventName)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, event: eventName, clients: channel.connectedCount }))
    })
    return
  }

  // Disconnect endpoint: POST /api/disconnect
  // Drops all SSE connections for error recovery testing
  if (pathname === '/api/disconnect' && req.method === 'POST') {
    const count = channel.disconnectAll()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, disconnected: count }))
    return
  }

  // Control-plane publish: POST /api/ctrl/publish?event=xxx[&clientId=yyy]
  // Server-initiated publish through the real EventServer. With clientId it targets
  // one session (the transport bypasses subscriptions for a target); without it the
  // event goes to every session subscribed to it.
  if (pathname === '/api/ctrl/publish' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const eventName = url.searchParams.get('event') || 'ctrl'
      const clientId = url.searchParams.get('clientId')
      let data
      try { data = JSON.parse(body) } catch { data = body || 'published' }
      try {
        // The static, not `ctrlEventServer.publish`: registration replaces the
        // instance method with the RPC wrapper for `$publish`, which takes a params
        // object and rejects a bare event name.
        EventServer.publish(eventName, data, clientId ? { clientId } : undefined)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, event: eventName, clientId: clientId || null }))
      } catch (err) {
        // An unhandled throw here would take the whole test server down.
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }))
      }
    })
    return
  }

  // Control-plane disconnect: POST /api/ctrl/disconnect
  // Ends every control-plane SSE response. The EventSource treats a completed stream
  // as a dropped connection and reconnects after the `retry:` interval, carrying
  // Last-Event-ID — which is what the replay test needs.
  if (pathname === '/api/ctrl/disconnect' && req.method === 'POST') {
    const count = ctrlSessions.size
    for (const session of [...ctrlSessions]) {
      try { session.close() } catch { /* already gone */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, disconnected: count }))
    return
  }

  // Status endpoint: GET /api/status
  // Returns current server state for test assertions
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      connected: channel.connectedCount,
      historySize: channel._history.length,
      nextId: channel._nextId,
    }))
    return
  }

  // Test results endpoint (for debugging)
  if (pathname === '/api/e2e-result' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const result = JSON.parse(body)
        const icon = result.passed ? '✓' : '✗'
        console.log(`[E2E] ${icon} ${result.name}${result.detail ? ' — ' + result.detail : ''}`)
      } catch { /* ignore */ }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
    return
  }

  // Health check / root endpoint (for E2E runner's waitForPort)
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('SSE Server Running')
    return
  }

  // Serve static files from dist/
  // URL /browser.mjs → <distDir>/browser.mjs
  // URL /transports/pubsub/browser.mjs → <distDir>/transports/pubsub/browser.mjs
  const relPath = pathname.replace(/^\//, '')
  const distPath = path.resolve(distDir, relPath)

  // Security: ensure the resolved path is within distDir
  if (!distPath.startsWith(distDir)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  serveStatic(res, distPath)
})

// Port is overridable so the runner can avoid clashing with a previous run.
const PORT = Number(process.env.SSE_PORT || 3099)
const RPC_PORT = Number(process.env.RPC_PORT || PORT + 1)
const RPC_API_ROOT = `http://localhost:${RPC_PORT}/api/rpc/`

const rpc = new HttpServerToolTransport()
rpc.addRpcHandler(RPC_API_ROOT)
rpc.addDiscoveryHandler(RPC_API_ROOT, () => ServerTools.toJSON())

server.listen(PORT, () => {
  console.log(`🚀 E2E test server running at http://localhost:${PORT}`)
  console.log(`   Test page: http://localhost:${PORT}/`)
  console.log(`   SSE endpoint: http://localhost:${PORT}/api/event`)
})

await rpc.start({ port: RPC_PORT })
console.log(`🛰 RPC control plane at ${RPC_API_ROOT}`)
console.log(`   discovery: GET  /api/rpc/   rpc: POST /api/rpc/<tool>`)
console.log(`   event stream: GET /api/rpc/event`)

function shutdown() {
  rpc.stop(true).finally(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGINT', shutdown)
