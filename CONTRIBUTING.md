# Contributing

Please feel free to file GitHub Issues or propose Pull Requests. We're always happy to discuss improvements to this library!

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
