/**
 * E2E test server for browser entry.
 *
 * Serves:
 * 1. Static files from dist/ (the built browser module)
 * 2. The test HTML page at /
 * 3. SSE endpoint at /api/event (uses SSEChannel from dist)
 * 4. POST /api/trigger to publish server events
 *
 * Note: Uses a simple in-process SSE implementation to avoid
 * dependencies on the built dist ESM chain for the server itself.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const PORT = 3099
server.listen(PORT, () => {
  console.log(`🚀 E2E test server running at http://localhost:${PORT}`)
  console.log(`   Test page: http://localhost:${PORT}/`)
  console.log(`   SSE endpoint: http://localhost:${PORT}/api/event`)
})
