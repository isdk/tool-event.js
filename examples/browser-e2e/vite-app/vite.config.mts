import { createLogger, defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
// __dirname = examples/browser-e2e/vite-app/
const eventPkgDir = path.resolve(__dirname, '../../..')            // packages/tool-event/
const packagesDir = path.resolve(eventPkgDir, '..')                // packages/

const req = createRequire(import.meta.url)
// Resolve a dependency's package root by walking up from its entry file.
// `req.resolve('util-ex/package.json')` is not usable: the package's "exports"
// map does not expose package.json, so it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
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

export default defineConfig({
  customLogger: {
    ...baseLogger,
    warn: keepOtherWarnings(baseLogger.warn),
    warnOnce: keepOtherWarnings(baseLogger.warnOnce),
  },
  resolve: {
    conditions: ['browser', 'import', 'module'],
    alias: {
      // Force @isdk/tool-rpc to use its browser build to avoid the missing Funcs export issue
      '@isdk/tool-rpc': path.resolve(packagesDir, 'tool-rpc/dist/browser.mjs'),
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
  },
})
