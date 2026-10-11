# Browser example (SSE)

A minimal real-world consumer of `@isdk/tool-event/browser`: a Vite app that
imports the browser entry through bare module specifiers, exactly as a browser
application would, and talks to a small SSE server.

| File | Role |
|---|---|
| `vite-app/main.ts` | The app: connects over SSE, subscribes (names and regex patterns), publishes, reconnects |
| `vite-app/index.html` | Page + result panel the harness reads |
| `vite-app/vite.config.mts` | Resolves the workspace packages for the browser build; filters the one `custom-ability` dynamic-import warning that cannot be fixed upstream |
| `browser-e2e-server.mjs` | SSE + trigger/echo/disconnect endpoints on port 3099 |

`main.ts` waits on conditions with a timeout via the shared helpers in
`test/utils/wait.ts` (the same ones the unit and E2E suites use) instead of fixed
sleeps; the dev server serves that file through the existing `server.fs.allow`
entry, so the app still imports nothing beyond the package and those helpers.

## Verify it

From the package root (`packages/tool-event`):

```bash
pnpm test:examples
```

That builds the package, starts `browser-e2e-server.mjs` and Vite, drives the
page in headless Chromium, and exits non-zero if any check fails. It is the same
harness as the E2E suite, pointed at this app:

```bash
node test/e2e/run-e2e.mjs \
  --app examples/browser-e2e/vite-app \
  --config examples/browser-e2e/vite-app/vite.config.mts \
  --server examples/browser-e2e/browser-e2e-server.mjs \
  --vite-port 5174
```

CI runs it on every push/PR touching the package (`.github/workflows/e2e.yml`),
so the example cannot drift from the package's current API unnoticed.

## Run it by hand

```bash
pnpm run build-fast                                  # dist/
node examples/browser-e2e/browser-e2e-server.mjs &   # SSE server, :3099
pnpm exec vite examples/browser-e2e/vite-app \
  --config examples/browser-e2e/vite-app/vite.config.mts --port 5174
# open http://localhost:5174/
```
