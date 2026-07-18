# Beachball copilot instructions

Trust these instructions. Only search the codebase if information here is incomplete or found to be in error (notify the user if an error is found). Following these steps will minimize failed commands and CI rejections.

## What this repo is

Beachball is a CLI tool for automating semantic version bumping, changelog generation, and npm publishing in monorepos and single-package repos. This repo is a **Yarn 4 monorepo** of ~2,000 files. The main deliverable is the `beachball` npm package.

- **Runtime:** Node.js `>=22.18.0` (repo developed on Node 22; CI also runs Node 24). TypeScript files can be run directly with `node` (no extra flags).
- **Language:** TypeScript `~6.0`. The `beachball` and `p-graph` package output is CommonJS (other packages use ESM).
- **Package manager:** Yarn 4 (Berry), `nodeLinker: node-modules`. Some dependency versions are shared via Yarn catalogs (`catalogs` in [.yarnrc.yml](./.yarnrc.yml)). Never use `npm install`.
- **Task runner:** [lage](https://microsoft.github.io/lage/) orchestrates `build`, `test`, `lint` across workspaces (config: [lage.config.js](./lage.config.js)).
- **Testing:** Jest 30 via Babel.
- **Linting/formatting:** ESLint 9 flat config + Prettier.
- **Dependency consistency:** syncpack + depcheck.

## Branches

- `main` (default): development for beachball v3 (alpha). Breaking changes allowed.
- `v2`: current stable release. Non-breaking changes should target `v2`.

## Build and validate — always run in this order

**Always run `yarn --immutable` first** if dependencies may be out of date. Then, from the repo root:

| Step             | Command                 | Notes / timing (validated)                           |
| ---------------- | ----------------------- | ---------------------------------------------------- |
| Install          | `yarn --immutable`      | Required before any build/test/lint.                 |
| Build            | `yarn build`            | ~8s. Runs `lage build bundle` across all workspaces. |
| Format (fix)     | `yarn format`           | Auto-fixes formatting.                               |
| Lint             | `yarn lint`             | ~10s. Runs eslint + depcheck + syncpack via lage.    |
| Test (all)       | `yarn test`             | Runs all workspace tests via lage.                   |
| Update snapshots | `yarn update-snapshots` | Use after intentional output changes.                |

**Do NOT run `jest` or `tsc` directly from the repo root.** `yarn build` and `yarn lint` must succeed with zero warnings; lint uses `--max-warnings=0`.

### Required before each commit

Run all of: `yarn build`, `yarn test`, `yarn lint`, `yarn format`.

### Required before creating a PR

- Use the `/beachball-change-file` skill to generate a Beachball change file if needed. Sometimes it's not needed, but verify by running `yarn checkchange` (CI also runs this).
- Check whether documentation site or CLI help text updates are needed.

## Package-level commands (`cd packages/<name>`)

Prefer scripts over running binaries directly. If you must run a binary such as `jest`, use `yarn run -T <binary>`.

| Task                                   | Command                                |
| -------------------------------------- | -------------------------------------- |
| Build a single package                 | `yarn build`                           |
| Test (packages other than `beachball`) | `yarn test`                            |
| Single test file/name (wraps jest)     | `yarn test <path or name>`             |
| (`beachball`) All tests, correct order | `yarn test:all`                        |
| (`beachball`) Unit tests only          | `yarn test:unit` (~3s)                 |
| (`beachball`) Functional tests only    | `yarn test:func`                       |
| (`beachball`) E2E tests only           | `yarn test:e2e` (slow; uses verdaccio) |
| Update snapshots                       | `yarn update-snapshots`                |

## Repo layout

- `packages/beachball` — main package (see architecture below).
- `packages/p-graph` — promise graph runner, used by `beachball`.
- `packages/proper-changelog` — changelog/release notes helper.
- `packages/esrp-npm-release` — helper for the Microsoft release process.
- `scripts` — repo-internal scripts (`@microsoft/beachball-scripts`); shared build/test/eslint config lives in [scripts/config](./scripts/config).
- `actions/*` — GitHub Action definitions (`check-for-modified-files`, `install-beachball`, `should-release`); their `dist/` is committed and must be rebuilt via `yarn build` if `src` changes.
- `docs/` — Vuepress documentation site with its own separate Yarn install.
- `change/` — pending Beachball change files (JSON).
- Root config: [beachball.config.js](./beachball.config.js), [lage.config.js](./lage.config.js), [syncpack.config.js](./syncpack.config.js), [.prettierrc.json5](./.prettierrc.json5), [.yarnrc.yml](./.yarnrc.yml). Per-package: `tsconfig.json`, `jest.config.js`, `eslint.config.mjs`.

### `beachball` package architecture (paths under `packages/beachball`)

- **Entry point:** `src/cli.ts` dispatches commands: `check`, `change`, `bump`, `publish`, `canary`, `sync`, `init`, `config`.
- `src/commands/` — command implementations.
- `src/bump/` — version bump calculation (`bumpInMemory` is the core algorithm).
- `src/changefile/` — reading/writing/prompting for change files.
- `src/changelog/` — changelog generation (markdown + JSON).
- `src/monorepo/` — package discovery (workspace-tools), dependency graph, package groups.
- `src/publish/` — npm publish orchestration, git tagging, dependency-ordered publishing.
- `src/git/` — git operation wrappers using execa.
- `src/options/` — CLI arg parsing + config loading (cosmiconfig).
- `src/validation/` — pre-command validation.
- `src/types/` — TypeScript interfaces (`BeachballOptions` is the central config type).
- **Option resolution:** CLI args > `beachball.config.js` (cosmiconfig) > defaults. `getOptions()` returns both raw `cliOptions` and merged `options`.

## Coding standards

- **No global state:** `process.cwd()`, `process.chdir()`, and `process.exit()` are banned via ESLint. Pass an explicit `cwd`. `process.exit()` may only be used in `cli.ts`.
- **Imports:** use `import "fs/promises"` directly (not `fs.promises`) to enable Jest mocking. Use `import type` for type-only imports (enforced).
- **Naming:** camelCase or PascalCase; unused parameters prefixed with `_`.
- **Style:** Prettier — single quotes, 120 char width, ES5 trailing commas.
- **Markdown:** use sentence case for headings. NEVER manually wrap lines in `.md` files (except within code blocks).

## Testing standards

`packages/beachball` has three Jest projects: **unit** (`src/__tests__/`, no filesystem), **functional** (`src/__functional__/`, realistic setups / real filesystem), **e2e** (`src/__e2e__/`, full commands, uses verdaccio). Fixtures/mock factories are in `src/__fixtures__/`.

- Import Jest APIs from `@jest/globals` (no implicit globals).
- Prefer real generator functions or `__fixtures__` helpers over hand-building complex objects (`PackageInfos`, `ChangeInfo`, `BumpInfo`, `BeachballOptions`).
- When testing a function with complex parameters, consider creating a wrapper function in the test which fills in common defaults.
- Any test that writes to the console must call `initMockLogs()`.
- Beachball's logs are its UI. Often, tests should include complete inline snapshots of output (especially if it's only a few lines).
- Prefer complete value assertions (`toEqual({...})`, `toEqual([...])`) over partial matchers.

## Documentation site

Vuepress site under `docs/` with a **separate** Yarn install. To edit/validate:

1. `cd docs && yarn --immutable` (install docs deps first).
2. `yarn docs:build` to validate.
3. When adding a new page, you MUST add it to the sidebar in `docs/.vuepress/config.ts`.

You must update the doc site when adding a new option or command.

## CI checks (must pass before merge)

Defined in [.github/workflows/pr.yml](.github/workflows/pr.yml). Replicate locally with the commands above.

- **build job** (ubuntu + windows, node 22/npm 10 and node 24/npm 11): `yarn --immutable`, `yarn build --verbose`, `yarn checkchange --verbose`, `yarn format:check` and `yarn lint --verbose` (ubuntu/node22 only), `yarn test --verbose`, plus extra Windows-bash tests.
- **actions job:** builds, then runs `check-for-modified-files` — if action `dist/` changed, run `yarn build` and commit the updated `dist` files.
- **docs job:** `cd docs && yarn --immutable && yarn docs:build`.
