# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Beachball is a CLI tool for automating semantic version bumping, changelog generation, and npm publishing in monorepos and single-package repos. It is a single-package TypeScript project (not a monorepo itself).

## Commands

| Task                          | Command                         |
| ----------------------------- | ------------------------------- |
| Build                         | `yarn build`                    |
| Watch mode                    | `yarn start`                    |
| All tests in correct order    | `yarn test:all`                 |
| Unit tests only               | `yarn test:unit`                |
| Functional tests only         | `yarn test:func`                |
| E2E tests only                | `yarn test:e2e`                 |
| Single test file (wraps jest) | `yarn test <test path or name>` |
| Lint (code + deps)            | `yarn lint`                     |
| Lint code only                | `yarn lint:code`                |
| Format                        | `yarn format`                   |
| Update snapshots              | `yarn update-snapshots`         |

### Required before each commit

- `yarn build`
- `yarn test`
- `yarn lint`
- `yarn format`

### Required before creating a PR

Use `/beachball-change-files` to generate a Beachball change file. Use `yarn change` for `beachball change` and `yarn checkchange` for `beachball check`.

## Architecture

**Entry point:** `src/cli.ts` dispatches to commands: `check`, `change`, `bump`, `publish`, `canary`, `sync`, `init`.

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

## Code Conventions

**No global state:** `process.cwd()`, `process.chdir()`, and `process.exit()` are banned via ESLint. All operations take an explicit `cwd` parameter. `process.exit()` should only be called in `cli.ts`.

**Imports:** Use `import "fs/promises"` directly, not `fs.promises` (enables Jest mocking). Use `import type` for type-only imports (enforced).

**Naming:** Variables use camelCase or PascalCase. Unused parameters prefixed with `_`.

**Test rules:** Tests must import Jest APIs from `@jest/globals` (don't use implicit jest globals).

**Style:** Prettier with single quotes, 120 char width, trailing commas (ES5)

## Test Structure

Three Jest projects:

- **Unit** (`src/__tests__/`): Unit tests for individual functions (no filesystem)
- **Functional** (`src/__functional__/`): Single-function tests with realistic setups, or unit-like tests which must run against the actual filesystem
- **E2E** (`src/__e2e__/`): E2E tests covering major scenarios and entire commands

Test helpers in `src/__fixtures__/` provide mock factories for repos, logs, package infos, and change files.
