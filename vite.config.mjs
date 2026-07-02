import wasm from "vite-plugin-wasm"

import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    wasm(),
  ],
  test: {
    testTimeout: 4000,
    globals: true,
    setupFiles: [
      "./setupVitest.mjs",
    ],
  },
})
