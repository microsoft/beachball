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
- `readChangeFiles()` - Loads and validates from disk
- `writeChangeFiles()` - Persists new change files
- `unlinkChangeFiles()` - Deletes after consumption during bump

**Publishing** (`src/publish/`):

- `publishToRegistry()` - Validates, applies publishConfig, runs hooks, publishes (respects dependency order)
- `bumpAndPush()` - Git operations: creates temp `publish_*` branch, fetches, merges, bumps, commits, tags, pushes
- Pre/post hooks available: `prebump`, `postbump`, `prepublish`, `postpublish`, `precommit`

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

- Fixtures: `__fixtures__` directory
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

The `rust/` and `go/` directories contain parallel re-implementations of beachball's `check` and `change` commands and the corresponding tests.

### Building and Testing

```bash
# Rust (from rust/ directory)
cargo build
cargo test

# Go (from go/ directory)
go build ./...
go test ./...
```

### Scope

Both implement:

- CLI args (as relevant for supported commands)
- JSON config loading (`.beachballrc.json` and `package.json` `"beachball"` field)
- workspaces detection (npm, yarn, pnpm, rush, lerna)
- `getChangedPackages` (git diff + file-to-package mapping + change file dedup)
- `validate()` (minus `bumpInMemory`/dependency validation)
- non-interactive `change` command (`--type` + `--message`)
- `check` command.

Not implemented:

- JS config files
- interactive prompts
- all bumping and publishing operations
- sync

### Implementation requirements

The behavior, log messages, and tests as specified in the TypeScript code MUST BE MATCHED in the Go/Rust code.

- Do not change behavior or logs or remove tests, unless it's exclusively related to features which you've been asked not to implement yet.
- If a different pattern would be more idiomatic in the target language, or it's not possible to implement the exact same behavior in the target language, ask the user before changing anything.
- Don't make assumptions about the implementation of functions from `workspace-tools`. Check the JS implementation in `node_modules` and exactly follow that.

When porting tests, add a comment by each Rust/Go test with the name of the corresponding TS test. If any TS tests have been omitted or combined, add a comment indicating which tests and why.

Use syntax and helpers from the newest version of the language where it makes sense. If a particular scenario is most commonly handled in this language by some external library, and the library would meaningfully simplify the code, ask the user about adding the library as a dependency.

Where possible, use the LSP instead of grep to understand the code. Also use the LSP to check for errors after making changes.

After making changes, run the commands to build, test, lint, and format.

### Structure

- **Rust**: `src/` with nested modules, integration tests in `tests/` with shared helpers in `tests/common/`
- **Go**: `cmd/beachball/` CLI entry, `internal/` packages, test helpers in `internal/testutil/`, tests alongside source (`_test.go`)

### Key Implementation Details

**Git commands**: Both shell out to `git` (matching the TS approach via workspace-tools). The git flags used should exactly match the workspace-tools code. Three-dot range (`branch...`) is used for diffs.

**Config loading**: Searches `.beachballrc.json` then `package.json` `"beachball"` field, walking up from cwd but stopping at git root.

**Glob matching**: Two modes matching the TS behavior — `matchBase` (patterns without `/` match basename) for `ignorePatterns`, full path matching for `scope`/`groups`.

### Known Gotchas

- **macOS `/tmp` symlink**: `/tmp` is a symlink to `/private/tmp`. `git rev-parse --show-toplevel` resolves symlinks but `tempfile`/`os.MkdirTemp` does not. Both implementations canonicalize paths (`std::fs::canonicalize` in Rust, `filepath.EvalSymlinks` in Go) when comparing git-returned paths with filesystem paths.
- **Default branch name**: Modern git defaults to `main`. Test fixtures use `--initial-branch=master` for bare repo init to match the `origin/master` refs used in tests.
