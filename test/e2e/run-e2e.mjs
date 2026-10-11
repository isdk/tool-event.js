/**
 * E2E test runner for @isdk/tool-event browser entry.
 *
 * Orchestrates:
 * 1. Build the project (tsup)
 * 2. Start the SSE test server
 * 3. Start Vite dev server
 * 4. Launch headless Chromium via Playwright
 * 5. Extract test results from the DOM
 * 6. Report pass/fail and exit with appropriate code
 *
 * Usage: node test/e2e/run-e2e.mjs
 * Environment variable CI=true for headless mode
 */

import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

// The runner is parameterized so the same harness can drive the E2E suite
// (test/e2e) and the browser example app (examples/browser-e2e/vite-app).
// Defaults are the E2E suite, so `pnpm test:e2e` needs no arguments.
const argv = process.argv.slice(2)
function argValue(flag, fallback) {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const appDir = path.resolve(projectRoot, argValue('--app', __dirname))
const viteConfigPath = path.resolve(projectRoot, argValue('--config', path.resolve(__dirname, 'vite.config.mts')))
const sseServerPath = path.resolve(projectRoot, argValue('--server', path.resolve(__dirname, 'sse-server.mjs')))

const VITE_PORT = Number(argValue('--vite-port', 5173))
const SSE_PORT = Number(argValue('--sse-port', 3099))
const E2E_TIMEOUT = 60000
// Dev-server startup includes Vite's dependency pre-scanning, which can take well
// over 20s on a cold cache. Allow overriding from CI if needed.
const START_TIMEOUT = Number(process.env.E2E_START_TIMEOUT_MS || 90000)

// ── Utility ─────────────────────────────────────────────────────

function runProcess(cmd, args, cwd = projectRoot, label = 'process') {
  return new Promise((resolve, reject) => {
    // No shell: the direct child is the real process, so cleanup can signal it
    // (a shell wrapper leaves the dev/SSE servers orphaned behind it).
    const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    proc.stdout.on('data', (d) => process.stdout.write(d))
    proc.stderr.on('data', (d) => process.stderr.write(d))
    proc.on('error', (err) => reject(new Error(label + ' failed: ' + err.message)))
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(label + ' exited with code ' + code))
    })
  })
}

function startProcess(cmd, args, cwd = projectRoot, label = 'process', env = {}) {
  return new Promise((resolve, reject) => {
    const proc = trackProcess(spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } }))
    proc.hasExited = false
    proc.exitCode = null
    let resolved = false
    // Keep child output visible: a failing dev server is otherwise silent and only
    // shows up as a waitForPort timeout.
    const onFirstByte = () => { if (!resolved) { resolved = true; resolve({ proc }) } }
    proc.stdout.on('data', (d) => { onFirstByte(); process.stdout.write('[' + label + '] ' + d) })
    proc.stderr.on('data', (d) => { onFirstByte(); process.stderr.write('[' + label + '] ' + d) })
    // Fallback timeout in case the server starts silently
    const fallbackTimer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ proc }) }
    }, 3000)
    proc.on('error', (err) => { if (!resolved) { resolved = true; clearTimeout(fallbackTimer); reject(new Error(label + ' failed: ' + err.message)) } })
    proc.on('exit', (code) => {
      clearTimeout(fallbackTimer)
      proc.hasExited = true
      proc.exitCode = code
      if (!resolved && code !== 0 && code !== null) {
        resolved = true
        reject(new Error(label + ' exited with code ' + code))
      }
    })
  })
}

async function waitForPort(url, timeoutMs = 15000, label = 'service', proc) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    // Fail as soon as the child dies: its output has already been echoed above.
    if (proc && proc.hasExited) {
      throw new Error(label + ' exited (code ' + proc.exitCode + ') before serving ' + url)
    }
    try {
      const resp = await fetch(url)
      if (resp.ok || resp.status === 404) return true
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(label + ' not ready at ' + url + ' after ' + timeoutMs + 'ms')
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ── Child-process bookkeeping ───────────────────────────────────
// Every long-lived child is tracked so that *any* exit path — a failed startup,
// a Playwright error, a signal — releases the ports. Otherwise an orphaned dev
// server makes the next run fail with EADDRINUSE.
const spawned = new Set()

function trackProcess(proc) {
  spawned.add(proc)
  proc.on('exit', () => spawned.delete(proc))
  return proc
}

async function cleanupSpawned() {
  const procs = [...spawned]
  for (const p of procs) {
    try { p.kill() } catch { /* already gone */ }
  }
  await sleep(500)
  for (const p of procs) {
    if (!p.hasExited) {
      console.log('  force-killing ' + p.pid)
      try { p.kill('SIGKILL') } catch { /* already gone */ }
    }
  }
  spawned.clear()
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log('\nInterrupted (' + sig + '), cleaning up...')
    await cleanupSpawned()
    process.exit(1)
  })
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('@isdk/tool-event Browser E2E Test Runner')
  console.log('='.repeat(50) + '\n')

  // 1. Build the project
  console.log('Building project...')
  await runProcess('pnpm', ['run', 'build-fast'], projectRoot, 'tsup build')
  console.log('   Build complete\n')

  // 2. Start SSE test server
  console.log('Starting SSE server on port ' + SSE_PORT + '...')
  console.log('   app: ' + appDir)
  console.log('   server: ' + sseServerPath)
  const sseResult = await startProcess('node', [sseServerPath], projectRoot, 'SSE server', { SSE_PORT: String(SSE_PORT) })
  await waitForPort('http://localhost:' + SSE_PORT + '/', START_TIMEOUT, 'SSE server', sseResult.proc)
  console.log('   SSE server ready\n')

  // 3. Start Vite dev server
  console.log('Starting Vite dev server on port ' + VITE_PORT + '...')
  const viteResult = await startProcess(
    'pnpm',
    ['exec', 'vite', appDir, '--config', viteConfigPath, '--port', String(VITE_PORT), '--strictPort'],
    projectRoot,
    'Vite server'
  )
  await waitForPort('http://localhost:' + VITE_PORT + '/', START_TIMEOUT, 'Vite server', viteResult.proc)
  console.log('   Vite server ready\n')

  // 4. Launch browser and run tests
  console.log('Launching headless Chromium...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  // Surface page console output so browser-side failures are diagnosable.
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') console.log('[browser] ' + msg.text())
  })
  page.on('pageError', (err) => console.log('[browser pageError] ' + err.message))

  let passed = 0
  let failed = 0
  let total = 0
  let suiteError = null

  try {
    await page.goto('http://localhost:' + VITE_PORT + '/', { waitUntil: 'networkidle', timeout: 15000 })

    console.log('Waiting for tests to complete...')
    await page.waitForFunction(
      () => {
        const status = document.getElementById('status')
        if (!status) return false
        const text = status.textContent || ''
        return text.includes('completed') || text.includes('error') || text.includes('failed')
      },
      { timeout: E2E_TIMEOUT }
    )

    const results = await page.evaluate(() => {
      const passEl = document.getElementById('passCount')
      const failEl = document.getElementById('failCount')
      const totalEl = document.getElementById('totalCount')
      const statusEl = document.getElementById('status')
      const testEls = document.querySelectorAll('#results .test')
      const tests = Array.from(testEls).map((el) => ({
        name: el.textContent?.trim() || '',
        className: el.className,
      }))
      return {
        passed: passEl ? parseInt(passEl.textContent || '0', 10) : 0,
        failed: failEl ? parseInt(failEl.textContent || '0', 10) : 0,
        total: totalEl ? parseInt(totalEl.textContent || '0', 10) : 0,
        status: statusEl?.textContent || 'unknown',
        tests,
      }
    })

    passed = results.passed
    failed = results.failed
    total = results.total

    console.log('\nTest Results:')
    console.log('  Status: ' + results.status)
    console.log('  Passed: ' + passed)
    console.log('  Failed: ' + failed)
    console.log('  Total:  ' + total + '\n')

    const failedTests = results.tests.filter((t) => t.className.includes('fail'))
    if (failedTests.length > 0) {
      console.log('Failed Tests:')
      for (const t of failedTests) console.log('  X ' + t.name)
      console.log('')
    }

    if (results.status.toLowerCase().includes('error')) suiteError = results.status
  } catch (err) {
    console.error('\nE2E test error: ' + err.message)
    suiteError = err.message
    try {
      const statusText = await page.evaluate(() => {
        const el = document.getElementById('status')
        return el ? el.textContent : 'no status element'
      })
      console.error('  Page status: ' + statusText)
    } catch { /* ignore */ }
  } finally {
    await browser.close()
  }

  // 5. Clean up — otherwise the next run hits EADDRINUSE on the fixed ports.
  console.log('Cleaning up...')
  await cleanupSpawned()
  console.log('  Done\n')

  // 6. Report
  const allPassed = suiteError === null && failed === 0 && passed === total && total > 0
  if (allPassed) {
    console.log('All ' + total + ' E2E tests passed!')
    process.exit(0)
  } else {
    console.log('E2E tests failed: ' + (suiteError || failed + ' test(s) failed out of ' + total))
    process.exit(1)
  }
}

main()
  .catch(async (err) => {
    console.error('Fatal:', err)
    await cleanupSpawned()
    process.exit(1)
  })
