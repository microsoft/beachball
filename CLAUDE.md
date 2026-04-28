# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Beachball is a CLI tool for automating semantic version bumping, changelog generation, and npm publishing in monorepos and single-package repos.

## Monorepo structure

- `packages/beachball`: `beachball` package
- `scripts`: repo-internal scripts (`@microsoft/beachball-scripts`)

## Commands

Beachball currently uses Node 14. Before running tests, you may need to activate `nvm`: on Mac or Linux, `source ~/.nvm/nvm.sh && nvm use`.

### Top-level

These commands work at the top level of the monorepo.

DO NOT run `jest` or `tsc` directly from the top level!

| Task                                | Command                 |
| ----------------------------------- | ----------------------- |
| Build                               | `yarn build`            |
| Run all tests (NOT a specific test) | `yarn test`             |
| Lint (code + deps)                  | `yarn lint`             |
| Lint code only                      | `yarn lint:code`        |
| Format                              | `yarn format`           |
| Update snapshots                    | `yarn update-snapshots` |

### Commands

These commands work in an individual package (`cd packages/<name>`).

| Task                                     | Command                         |
| ---------------------------------------- | ------------------------------- |
| Build                                    | `yarn build`                    |
| Test (packages other than `beachball`)   | `yarn test`                     |
| Single test file (wraps jest)            | `yarn test <test path or name>` |
| (`beachball`) All tests in correct order | `yarn test:all`                 |
| (`beachball`) Unit tests only            | `yarn test:unit`                |
| (`beachball`) Functional tests only      | `yarn test:func`                |
| (`beachball`) E2E tests only             | `yarn test:e2e`                 |
| Lint                                     | `yarn lint`                     |
| Update snapshots                         | `yarn update-snapshots`         |

## Architecture

All these paths refer to the `beachball` package under `packages/beachball`.

**Entry point:** `src/cli.ts` dispatches to commands: `check`, `change`, `bump`, `publish`, `canary`, `sync`, `init`, `config`.

**Key modules:**

- `src/commands/` - Command implementations
- `src/bump/` - Version bump calculation (`bumpInMemory` is the core algorithm)
- `src/changefile/` - Reading/writing/prompting for change files (JSON in `change/` dir)
- `src/changelog/` - Changelog generation (markdown and JSON)
- `src/monorepo/` - Package discovery via workspace-tools, dependency graph, package groups
- `src/publish/` - npm publish orchestration, git tagging, dependency-ordered publishing
- `src/git/` - Git operation wrappers using execa
- `src/options/` - CLI arg parsing (yargs-parser) + config loading (cosmiconfig)
- `src/validation/` - Pre-command validation (change file presence, dependency checks)
- `src/types/` - TypeScript interfaces (`BeachballOptions` is the central config type)

**Option resolution:** CLI args > `beachball.config.js` (via cosmiconfig) > defaults. `getParsedOptions()` returns both raw `cliOptions` and merged `options`.

## Coding standards

### Style and conventions

**No global state:** `process.cwd()`, `process.chdir()`, and `process.exit()` are banned via ESLint. All operations take an explicit `cwd` parameter. `process.exit()` should only be called in `cli.ts`.

**Imports:** Use `import "fs/promises"` directly, not `fs.promises` (enables Jest mocking). Use `import type` for type-only imports (enforced).

**Naming:** Variables use camelCase or PascalCase. Unused parameters prefixed with `_`.

**Test rules:** Tests must import Jest APIs from `@jest/globals` (don't use implicit jest globals).

**Style:** Prettier with single quotes, 120 char width, trailing commas (ES5)

### Documentation

- You must update the documentation site when adding a new option or command
- Also consider whether documentation site updates are needed for other new features or behavior changes
- All headings in the documentation site and other markdown files must use sentence case

### Required before each commit

- `yarn build`
- `yarn test`
- `yarn lint`
- `yarn format`

### Required before creating a PR

- Use `/beachball-change-files` to generate a Beachball change file.
- Check whether any documentation site or help text updates are needed for the change.

## Testing

### Test structure

`packages/beachball` has three Jest projects:

- **Unit** (`src/__tests__/`): Unit tests for individual functions (no filesystem)
- **Functional** (`src/__functional__/`): Single-function tests with realistic setups, or unit-like tests which must run against the actual filesystem
- **E2E** (`src/__e2e__/`): E2E tests covering major scenarios and entire commands

Test helpers in `src/__fixtures__/` provide mock factories for repos, logs, package infos, and change files.

### Test writing standards

- Avoid manually creating complex object structures (such as `PackageInfos`, `ChangeInfo`, `BumpInfo`, or `BeachballOptions`). Consider one of the following approaches instead:
  - call the real function for generating the structure if possible
  - check if there's a helper under `__fixtures__`
  - check for a common pattern for creating/mocking this object in other tests
- When testing a function with complex parameters, consider creating a wrapper function in the test which fills in common defaults.
- Any test of a function which writes to the console should call `initMockLogs()` to mock and capture output.
- Beachball's logs are its UI. Often, tests should include complete inline snapshots of output (especially if it's only a few lines).
- Where reasonable, prefer complete tests of values: `expect(someObj).toEqual({...})` rather than `expect(someObj.foo).toEqual(...)` or `expect(someObj).toMatchObject({...})`, or `expect(someArray).toEqual([...])` rather than `expect(someArray).toContain(...)`

## Documentation site

The doc site uses Vuepress and is located under `/docs`. It uses a separate yarn installation with Node 22 + Yarn 4 to get rid of very outdated deps while keeping beachball v2 on Node 14.

### Editing and validating docs

- If running in a standalone agent environment, you must run `cd docs && yarn` to install dependencies first
- Doc changes can be validated with `cd docs && yarn docs:build`
- If adding a new page, you MUST add it to the sidebar in `docs/.vuepress/config.ts`.
