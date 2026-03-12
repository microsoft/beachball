# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beachball is a semantic version bumping tool for JS repos and monorepos. It manages change files, calculates version bumps, generates changelogs, and publishes packages to npm registries.

## Common Commands

### Building

```bash
yarn build              # Compile TypeScript to lib/
```

### Testing

```bash
yarn test:all           # Run all tests in order: unit, functional, then e2e
yarn test:unit          # Unit tests only (__tests__ directories)
yarn test:func          # Functional tests only (__functional__ directories)
yarn test:e2e           # E2E tests only (__e2e__ directories)
yarn update-snapshots   # Update all test snapshots
```

To run a single test file:

```bash
yarn jest path/to/test.test.ts
```

To run a single test within a file:

```bash
yarn jest path/to/test.test.ts -t "test name pattern"
```

### Linting

```bash
yarn lint               # Run all linting (deps + code)
yarn lint:code          # ESLint only
yarn lint:deps          # Depcheck only
yarn format             # Format with Prettier
```

### Final steps before PR

```bash
yarn change --type minor|patch --message "message" # Create a change file
```

## Architecture Overview

### Core Processing Flow

Beachball's bump process follows a **two-phase architecture** (calculate in-memory, then apply to disk):

1. **Configuration Layer** (`src/options/`) - Merges CLI args, repo config (beachball.config.js), and defaults into `BeachballOptions`
2. **Discovery Layer** (`src/monorepo/`) - Discovers packages, builds dependency graphs, applies scoping
3. **Validation Layer** (`src/validation/`) - Validates setup, reads change files, pre-calculates bump info
4. **Calculation Phase** (`bumpInMemory()`) - Computes all version changes without side effects
5. **Application Phase** (`performBump()`) - Writes package.json, changelogs, deletes change files
6. **Publishing Layer** (`src/publish/`) - Registry operations and git push with retries

### Key Components

**Entry Point:** `src/cli.ts`

- Single async IIFE that validates git repo, parses options, routes to commands

**Commands** (`src/commands/`):

- `change` - Interactive prompts to create change files
- `check` - Validates change files exist when needed
- `bump` - Calculates and applies version bumps (no publish/push)
- `publish` - Full workflow: bump → publish to registry → git push with tags
- `canary` - Canary/prerelease publishing
- `sync` - Synchronizes versions from registry
- `init` - Repository initialization

**Bump Logic** (`src/bump/bumpInMemory.ts`):
Multi-pass algorithm that calculates version bumps. See comments in file.

**Change Files** (`src/changefile/`):

- Change files stored in `change/` directory track intended version changes
- See `src/types/ChangeInfo.ts` `ChangeFileInfo` for the info stored in each change file. For grouped change files (config has `groupChanges: true`), the type will be `ChangeInfoMultiple`.
- Folder contains helper to read, write, and unlink change files

**Publishing** (`src/publish/`):

- `publishToRegistry()` - Validates, applies publishConfig, runs hooks, publishes (respects dependency order)
- `bumpAndPush()` - Git operations: creates temp `publish_*` branch, fetches, merges, bumps, commits, tags, pushes
- Pre/post hooks available (see `HooksOptions` in `src/types/BeachballOptions.ts`)

**Context Passing:**
`CommandContext` aggregates reusable data (packages, version groups, change files, and more) to avoid repeated calculations. See source in `src/types/CommandContext.ts`.

### Important Patterns

**Immutable-First Design:**

- `bumpInMemory` makes a copy of its input objects before making changes in memory
- Separate calculation (`bumpInMemory`) from on-disk application (`performBump`)

**Validation-First:**

- `validate()` runs before most commands to validate config and repo state
- Pre-calculates expensive operations when needed

**Package Groups:**

- Multiple packages can be versioned together (synchronized versions)
- All packages in a group receive the maximum change type
- Configured via `groups` option in beachball.config.js

**Dependent Versioning:**

- When package A changes, dependents of A can be auto-bumped
- Controlled by `dependentChangeType` in change files and `bumpDeps` option
- Propagation respects package groups

**Change Type Hierarchy:**

- Defined in `src/changefile/changeTypes.ts` `SortedChangeTypes`
- Packages, groups, and the repo config can specify `disallowedChangeTypes`

**Scoping:**

- Filters which packages participate in operations
- Based on git changes, explicit inclusion/exclusion, or package patterns
- Affects change file validation, bumping, and publishing

**Git Operations:**

- All git commands use `gitAsync()` wrapper with logging
- Push retries 5 times with fetch/merge between attempts
- Temporary branches ensure safety during publish

**Testing Structure:**

- Fixtures and helpers: `__fixtures__/` directory
- Unit tests: `__tests__/` directory
- Functional tests: `__functional__/` directory
- E2E tests: `__e2e__/` directory
- Uses Jest projects to separate test types
- Verdaccio (local npm registry) used for e2e testing
- Many of the tests cover log output since the logs are Beachball's UI, so we need to verify its correctness and readability

## TypeScript Configuration

- Current target: ES2020 (Node 14+ compatible)
- Strict mode enabled with `noUnusedLocals`

## Important Notes

- Change files (not git commits) are the source of truth for version bumps
- Beachball is not intended to have a public API (only the CLI and configuration options are supported). However, some of the command functions and `gatherBumpInfo` have been used directly by other teams, so we try to maintain compatibility with old signatures.
- Package/workspace manager is auto-detected (supports npm, yarn, pnpm, rush, lerna)

## Experimental: Rust and Go Implementations

The `rust/` and `go/` directories contain experimental parallel re-implementations. See the `go-impl` and `rust-impl` custom skills as relevant.
