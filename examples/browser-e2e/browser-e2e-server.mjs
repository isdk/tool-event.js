/**
 * E2E test server for browser entry.
 *
 * Serves TWO planes, on two ports:
 *
 *   data plane  :3099  /api/event  /api/trigger  /api/echo  /api/raw  /api/disconnect
 *                    A hand-rolled SSE channel, so the raw-stream behaviours
 *                    (Last-Event-ID replay, forced disconnects, non-JSON frames)
 *                    stay testable without depending on the built package.
 *   control plane :3100 /api/rpc/  the documented flow — tool-rpc discovery,
 *                    RPC calls, and EventServer's SSE stream served by
 *                    SseServerPubSubTransport. This plane imports the BUILT
 *                    package (`dist`), which is the point: a breaking change in
 *                    the package's public API fails this example.
 *
 * The browser app reaches the control plane through Vite's dev-server proxy
 * (`/api/rpc` -> :3100), so it stays same-origin and needs no CORS.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The control plane imports this package **by name** (Node's self-reference via
// the `exports` map), which resolves to the built `dist` at runtime — the same
// entry a real consumer gets, and what makes this example a regression guard.
import { HttpServerToolTransport, RpcSessionIdentityPolicy } from '@isdk/tool-rpc'
import { EventServer, SseServerPubSubTransport, eventServer, sseCredentialReader } from '@isdk/tool-event'

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
   * Same fixture as the E2E test server: the client transport must decode it
   * without throwing, because an exception inside the dispatch hook used to tear
   * down the whole stream and drop every later event.
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

  // Serve the test HTML page
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.resolve(__dirname, 'browser-e2e.html')
    serveStatic(res, htmlPath)
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

// ── Control plane: tool-rpc + EventServer over the built package ───────
// Port is overridable so the runner can avoid clashing with a previous run.
const PORT = Number(process.env.SSE_PORT || 3099)
const RPC_PORT = Number(process.env.RPC_PORT || PORT + 1)
const RPC_API_ROOT = `http://localhost:${RPC_PORT}/api/rpc/`

// The server side of the documented flow: an EventServer registered as a server
// tool, with the SSE pubsub transport attached. `EventServer.list` is a stream
// method, so GET /api/rpc/event is served as the client's EventSource stream.
// One identity policy for both planes. The stream request is an ordinary RPC call, so
// the policy on the transport decides who the stream is and who its `$sub`/`$publish`
// calls come from; `sseCredentialReader` lets it read the resume credential the stream
// hands back in the URL, which is the only thing an EventSource can carry.
const identity = new RpcSessionIdentityPolicy()
EventServer.setPubSubTransport(new SseServerPubSubTransport({ revoke: (id) => identity.revoke(id) }))
eventServer.register()

const rpc = new HttpServerToolTransport({ identity, credentialReader: sseCredentialReader })
// Discovery is a built-in tool (`rpcApis`) served on the RPC prefix: no handler to add.
rpc.addRpcHandler(RPC_API_ROOT)

// The same tool mounted by a transport with **no identity policy** — the mistake the
// docs warn about. It gets its own port, because two transports cannot share one.
// The browser app asserts the refusal, so the example shows both mounts side by side.
const ANON_RPC_PORT = RPC_PORT + 1
const anonEventServer = new EventServer('anon')
anonEventServer.register()
const anonRpc = new HttpServerToolTransport()
anonRpc.addRpcHandler(`http://localhost:${ANON_RPC_PORT}/api/anon/`)

server.listen(PORT, () => {
  console.log(`🚀 E2E test server running at http://localhost:${PORT}`)
  console.log(`   Test page: http://localhost:${PORT}/`)
  console.log(`   SSE endpoint: http://localhost:${PORT}/api/event`)
})

await rpc.start({ port: RPC_PORT })
await anonRpc.start({ port: ANON_RPC_PORT })
console.log(`🛰 RPC control plane at ${RPC_API_ROOT}`)
console.log(`   discovery: GET  /api/rpc/   rpc: POST /api/rpc/<tool>`)
console.log(`   event stream: GET /api/rpc/event`)
console.log(`🚫 no-policy mount at http://localhost:${ANON_RPC_PORT}/api/anon/ (stream must be refused)`)

function shutdown() {
  Promise.all([rpc.stop(true), anonRpc.stop(true)]).finally(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
