import { defineConfig } from 'vite'
import path from 'node:path'
import { createRequire } from 'node:module'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
// __dirname = test/e2e/vite-app/
const eventPkgDir = path.resolve(__dirname, '../../..')            // packages/tool-event/
const packagesDir = path.resolve(eventPkgDir, '..')                // packages/

// Resolve util-ex path dynamically — works locally and in CI regardless of pnpm store layout
const req = createRequire(import.meta.url)
const utilExRoot = path.dirname(req.resolve('util-ex/package.json'))

export default defineConfig({
  resolve: {
    conditions: ['browser', 'import', 'module'],
    alias: {
      // Force @isdk/tool-rpc to use its browser build to avoid the missing Funcs export issue
      '@isdk/tool-rpc': path.resolve(packagesDir, 'tool-rpc/dist/browser.mjs'),
      // Force util-ex to use ESM source instead of CJS lib: custom-ability imports
      // from 'util-ex/lib/extend' and CJS -> ESM conversion loses the default export
      'util-ex/lib': path.resolve(utilExRoot, 'src'),
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
      allow: [packagesDir, utilExRoot],
    },
  },
})
