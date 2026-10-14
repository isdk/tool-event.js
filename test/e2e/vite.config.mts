import { createLogger, defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
// __dirname = test/e2e/
const eventPkgDir = path.resolve(__dirname, '../..')                  // packages/tool-event/
const packagesDir = path.resolve(eventPkgDir, '..')                // packages/

// Resolve util-ex root dynamically — works locally and in CI regardless of pnpm store layout
const req = createRequire(import.meta.url)
function findPackageRoot(startPath: string): string {
  let dir = path.dirname(startPath)
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    dir = path.dirname(dir)
  }
  return path.resolve(startPath, '../..')
}
const utilExRoot = findPackageRoot(req.resolve('util-ex'))
// abstract-error ships a CJS entry whose exports are assigned dynamically
// (AbstractError.createErrorClass = ...), so Vite's dep analyzer cannot see them
// and the browser fails to link @isdk/common-error. Point the bare specifier at
// the package's real ESM entry instead.
const abstractErrorRoot = findPackageRoot(req.resolve('abstract-error'))

// `custom-ability` resolves entries with `import(name)` on a computed specifier,
// which Vite cannot statically analyze. That call lives in the package's
// generated output (esbuild's `__async` helper in `lib/index.mjs`), not in
// editable source, so `@vite-ignore` cannot be added upstream. Drop only its
// "cannot be analyzed" warning and keep every other Vite warning visible.
const IGNORED_WARNINGS = ['The above dynamic import cannot be analyzed by Vite.']
const isIgnored = (msg: string) => IGNORED_WARNINGS.some((text) => msg.includes(text))
type LogOptions = { clear?: boolean; timestamp?: boolean; environment?: string }
const keepOtherWarnings =
  (log: (msg: string, options?: LogOptions) => void) =>
  (msg: string, options?: LogOptions) => {
    if (!isIgnored(msg)) log(msg, options)
  }
const baseLogger = createLogger()

const RPC_PORT = Number(process.env.RPC_PORT || Number(process.env.SSE_PORT || 3099) + 1)

export default defineConfig({
  customLogger: {
    ...baseLogger,
    warn: keepOtherWarnings(baseLogger.warn),
    warnOnce: keepOtherWarnings(baseLogger.warnOnce),
  },
  resolve: {
    conditions: ['browser', 'import', 'module'],
    alias: {
      // Force util-ex to use ESM source instead of CJS lib: custom-ability imports
      // from 'util-ex/lib/extend' and CJS -> ESM conversion loses the default export
      'util-ex/lib': path.resolve(utilExRoot, 'src'),
      'abstract-error': path.resolve(abstractErrorRoot, 'lib/abstract-error.mjs'),
    },
  },
  optimizeDeps: {
    exclude: [
      '@isdk/tool-rpc',
      '@isdk/tool-func',
      '@isdk/common-error',
      '@isdk/hash',
      'custom-ability',
      'events-ex',
      'lodash-es',
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [packagesDir, utilExRoot, abstractErrorRoot],
    },
    // The RPC control plane runs on its own port (sse-server.mjs). tool-rpc's HTTP
    // server sends no CORS headers, so the page reaches it through this proxy and
    // stays same-origin.
    proxy: {
      '/api/rpc': `http://localhost:${RPC_PORT}`,
      // The no-identity mount (sse-server.mjs) runs on the port above the RPC plane, so
      // the page can ask it for a stream and read the refusal without tripping CORS.
      '/api/anon': `http://localhost:${RPC_PORT + 1}`,
      // The close-signal mount (sse-server.mjs) runs one port above that, so the page
      // can open a stream there and have its session closed with a `$close` frame.
      '/api/closebox': `http://localhost:${RPC_PORT + 2}`,
    },
  },
})
