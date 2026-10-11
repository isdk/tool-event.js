# Contributing

Please feel free to file GitHub Issues or propose Pull Requests. We're always happy to discuss improvements to this library!

## Code Style

```shell
pnpm run style       # prettier --check + eslint
pnpm run style:fix   # prettier --write + eslint --fix
pnpm run typecheck   # tsc -p tsconfig.json (src + test)
```

Linting uses ESLint 9's flat config in [`eslint.config.mjs`](./eslint.config.mjs), built on [`@antfu/eslint-config`](https://github.com/antfu/eslint-config) with the stylistic and opinionated layers switched off: ESLint only guards correctness, and TypeScript formatting is deliberately not enforced. Mark intentional violations with an inline `eslint-disable` and a `--` reason rather than mass-editing sources; when a new rule floods the log, disable that layer in `eslint.config.mjs` (with a comment).

Prettier covers JSON and YAML only (`pnpm run format` checks, `pnpm run format:fix` rewrites). Markdown is deliberately out of scope: prettier reflows the ASCII diagrams in `pubsub.md`/`AGENT*.md` and, with `semi: false`, strips semicolons from the `ts` samples inside the docs — the resulting diff is unreadable. Keep TypeScript style out of prettier's reach for the same reason; the codebase is formatted by hand.

Two TypeScript configs, one job each: [`tsconfig.json`](./tsconfig.json) is for editors and `pnpm run typecheck` — it keeps `test/**` in the program and loads `vitest/globals`, and never emits. [`tsconfig.release.json`](./tsconfig.release.json) is for publishing: `tsup --dts` and typedoc use it, and it excludes test files. Add new compiler options to `tsconfig.json` so both inherit them.

## Testing

```shell
pnpm test         # Unit tests (vitest, 94 tests)
pnpm test:repeat   # Unit tests, 3 repeats (vitest --repeats) — flakiness check
pnpm test:e2e     # Browser E2E tests (Playwright, 59 tests)
pnpm test:examples # Browser example app (examples/browser-e2e, 47 checks)
pnpm test:all     # All tests (unit + E2E)
```

## Releasing

Releases are supposed to be done from master, version bumping is automated through [`standard-version`](https://github.com/absolute-version/commit-and-tag-version):

```shell
pnpm run release -- --dry-run  # verify output manually
pnpm run release               # follow the instructions from the output of this command
```
