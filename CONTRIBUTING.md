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

## Documentation

Docs ship in language pairs: `NAME.md` (English, the canonical copy) and `NAME.cn.md` (简体中文). `README`, `AGENT` and `pubsub` all follow it; a doc with no `.cn.md` sibling is a gap, not a convention.

Every pair carries a language-switch line on line 3, right under the title:

```markdown
> 【English|[中文](./NAME.cn.md)】   <!-- in NAME.md -->
> 【[English](./NAME.md)|中文】      <!-- in NAME.cn.md -->
```

The Chinese copy mirrors the English one section by section: same heading count and levels, same code blocks, same tables. Translate prose, code comments, table cells, Mermaid labels and ASCII-diagram labels; keep the code itself identical, so a sample can be pasted from either copy. String literals inside samples (`console.log('Received:', …)`) are the one exception — translating them is fine, the surrounding code is not.

Edit the English copy first, then port the change; a section that exists in only one language is a bug. Mirror the structure, not the length — Chinese is denser, so the 956-line `pubsub.md` mirrors as ~909 lines.

Anchors: a Chinese heading's anchor drops punctuation, so `### 模式（正则）订阅` is linked as `#模式正则订阅`. Cross-document links from `README.cn.md` point at `pubsub.cn.md`, not at the English copy.

Markdown is deliberately outside prettier (see Code Style), which is what keeps the ASCII diagrams intact — the price is that alignment is manual. In a Chinese box each CJK glyph is 2 columns, so pad to display width, not to character count.

References to code point at files and symbols, never at line numbers: write "`EventServer.publishServerEvent()` in `src/event-server.ts`", never that same path with a line number appended. A line number drifts the moment anything above it moves, and a stale one is worse than none — it sends the reader to the wrong code with an air of authority. `tool-rpc`'s hand-written docs accumulated 141 such references, sampled 5–94 lines off, and they were deleted wholesale; a test there (`test/docs-line-refs.test.ts`) now fails the suite on any new one. A claim that really is about one specific line belongs in a test, not in prose.

## Testing

```shell
pnpm test         # Unit tests (vitest)
pnpm test:repeat   # Unit tests, 3 repeats (vitest --repeats) — flakiness check
pnpm test:e2e     # Browser E2E tests (Playwright)
pnpm test:examples # Browser example app (examples/browser-e2e)
pnpm test:all     # All tests (unit + E2E)
```

## Releasing

Releases are supposed to be done from master, version bumping is automated through [`standard-version`](https://github.com/absolute-version/commit-and-tag-version):

```shell
pnpm run release -- --dry-run  # verify output manually
pnpm run release               # follow the instructions from the output of this command
```
