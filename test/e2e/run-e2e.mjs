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
const e2eAppDir = path.resolve(__dirname, 'vite-app')
const sseServerPath = path.resolve(__dirname, 'browser-e2e-server.mjs')

const VITE_PORT = 5173
const SSE_PORT = 3099
const E2E_TIMEOUT = 60000

// ── Utility ─────────────────────────────────────────────────────

function startProcess(cmd, args, cwd = projectRoot, label = 'process') {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: true })
    let resolved = false
    proc.stdout.on('data', () => {
      if (!resolved) { resolved = true; resolve({ proc }) }
    })
    proc.stderr.on('data', () => {
      if (!resolved) { resolved = true; resolve({ proc }) }
    })
    // Fallback timeout in case the server starts silently
    const fallbackTimer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ proc }) }
    }, 3000)
    proc.on('error', (err) => { if (!resolved) { resolved = true; clearTimeout(fallbackTimer); reject(new Error(label + ' failed: ' + err.message)) } })
    proc.on('exit', (code) => {
      clearTimeout(fallbackTimer)
      if (!resolved && code !== 0 && code !== null) {
        resolved = true
        reject(new Error(label + ' exited with code ' + code))
      }
    })
  })
}

async function waitForPort(url, timeoutMs = 15000, label = 'service') {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(url)
      if (resp.ok || resp.status === 404) return true
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(label + ' not ready at ' + url + ' after ' + timeoutMs + 'ms')
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('@isdk/tool-event Browser E2E Test Runner')
  console.log('='.repeat(50) + '\n')

  // 1. Build the project
  console.log('Building project...')
  await startProcess('pnpm', ['run', 'build-fast'], projectRoot, 'tsup build')
  console.log('   Build complete\n')

  // 2. Start SSE test server
  console.log('Starting SSE server on port ' + SSE_PORT + '...')
  const sseResult = await startProcess('node', [sseServerPath], projectRoot, 'SSE server')
  await waitForPort('http://localhost:' + SSE_PORT + '/', 10000, 'SSE server')
  console.log('   SSE server ready\n')

  // 3. Start Vite dev server
  console.log('Starting Vite dev server on port ' + VITE_PORT + '...')
  const viteConfig = path.resolve(e2eAppDir, 'vite.config.ts')
  const viteResult = await startProcess(
    'pnpm',
    ['exec', 'vite', e2eAppDir, '--config', viteConfig, '--port', String(VITE_PORT), '--strictPort'],
    projectRoot,
    'Vite server'
  )
  await waitForPort('http://localhost:' + VITE_PORT + '/', 20000, 'Vite server')
  console.log('   Vite server ready\n')

  // 4. Launch browser and run tests
  console.log('Launching headless Chromium...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

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

  // 5. Clean up
  console.log('Cleaning up...')
  if (viteResult && viteResult.proc) viteResult.proc.kill()
  if (sseResult && sseResult.proc) sseResult.proc.kill()
  await sleep(500)
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

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
