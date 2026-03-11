# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beachball is a semantic version bumping tool for monorepos. It manages change files, calculates version bumps, generates changelogs, and publishes packages to npm registries.

## Common Commands

### Building

```bash
yarn build              # Compile TypeScript to lib/
yarn start              # Watch mode with preserveWatchOutput
```

### Testing

```bash
yarn test:all           # Run all tests in order: unit, functional, then e2e
yarn test:unit          # Unit tests only (__tests__ directories)
yarn test:func          # Functional tests only (__functional__ directories)
yarn test:e2e           # E2E tests only (__e2e__ directories)
yarn test:watch         # Watch mode
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

### Development Workflow

```bash
yarn change --type minor|patch --message "message" # Create a change file
yarn checkchange        # Verify change files exist for modified packages
```

## Architecture Overview

### Core Processing Flow

Beachball follows a **two-phase architecture** (calculate in-memory, then apply to disk):

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
Five-pass algorithm that calculates version changes:

1. Initialize change types from change files
2. Apply package group rules (synchronized versioning)
3. Propagate changes to dependents (if `bumpDeps: true`)
4. Bump package versions in memory
5. Update dependency version ranges

**Change Files** (`src/changefile/`):

- Change files stored in `change/` directory track intended version changes
- `readChangeFiles()` - Loads and validates from disk
- `writeChangeFiles()` - Persists new change files
- `unlinkChangeFiles()` - Deletes after consumption during bump
- Each file specifies: package name, change type (patch/minor/major), description, dependent change type

**Publishing** (`src/publish/`):

- `publishToRegistry()` - Validates, applies publishConfig, runs hooks, publishes concurrently (respects dependency order)
- `bumpAndPush()` - Git operations: creates temp branch, fetches, merges, bumps, commits, tags, pushes (5 retries)
- Uses temporary `publish_*` branches for safety

**Context Passing:**
`CommandContext` aggregates reusable data to avoid repeated calculations:

- `originalPackageInfos` - Discovered packages
- `packageGroups` - Version groups (packages versioned together)
- `scopedPackages` - Filtered set after scoping
- `changeSet` - Validated change files
- `bumpInfo` - Calculated version changes (only if pre-calculated)

### Important Patterns

**Immutable-First Design:**

- In-memory calculations return new objects, don't mutate inputs
- `cloneObject()` creates defensive copies
- Separate calculation (`bumpInMemory`) from application (`performBump`)

**Validation-First:**

- `validate()` runs before most commands
- Provides early failure and context for execution
- Pre-calculates expensive operations when needed

**Package Groups:**

- Multiple packages can be versioned together (synchronized versions)
- All packages in a group receive the maximum change type
- Configured via `groups` option in beachball.config.js

**Dependent Versioning:**

- When package A changes, dependents of A can be auto-bumped
- Controlled by `dependentChangeType` in change files and `bumpDeps` option
- Propagation respects package groups

### Critical Implementation Details

**Change Type Hierarchy:**

- `none` < `patch` < `minor` < `major`
- Groups can specify `disallowedChangeTypes` (this repo disallows `major`)

**Scoping:**

- Filters which packages participate in operations
- Based on git changes, explicit inclusion/exclusion, or package patterns
- Affects change file validation, bumping, and publishing

**Lock File Handling:**

- Automatically regenerated after version bumps
- Uses workspace-tools to detect package manager (npm/yarn/pnpm)

**Git Operations:**

- All git commands use `gitAsync()` wrapper with logging
- Push retries 5 times with fetch/merge between attempts
- Temporary branches ensure safety during publish

**Testing Structure:**

- Unit tests: `__tests__/` or `__fixtures__/` directories
- Functional tests: `__functional__/` directories
- E2E tests: `__e2e__/` directories
- Uses Jest projects to separate test types
- Verdaccio (local npm registry) used for e2e testing
- Many of the tests cover log output since the logs are Beachball's UI, so we need to verify its correctness and readability

## Configuration

The repo uses `beachball.config.js` with:

- `disallowedChangeTypes: ['major']` - No major version bumps allowed
- `ignorePatterns` - Files/paths that don't require change files (docs, config, tests, yarn.lock)

## TypeScript Configuration

- Target: ES2020 (Node 14+ compatible)
- Output: `lib/` directory (compiled JS + declarations)
- Strict mode enabled with `noUnusedLocals`
- Source maps and declaration maps generated
- Checks both TS and JS files (`allowJs`, `checkJs`)

## Important Notes

- Beachball has **no public API** - only the CLI and configuration options are supported
- Change files are the source of truth for version bumps (not git commits)
- The `publish` command can run bump, registry publish, and git push independently via flags (`--no-bump`, `--no-publish`, `--no-push`)
- Package manager is auto-detected (supports npm, yarn, pnpm)
- Pre/post hooks available: `prebump`, `postbump`, `prepublish`, `postpublish`, `precommit`

## Experimental: Rust and Go Implementations

The `rust/` and `go/` directories contain parallel re-implementations of beachball's `check` and `change` commands. Both pass 16 tests covering changed package detection, validation, and change file creation.

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

Both implement: CLI parsing, JSON config loading (`.beachballrc.json` and `package.json` `"beachball"` field — no JS configs), workspace detection (`workspaces` field), `getChangedPackages` (git diff + file-to-package mapping + change file dedup), `validate()` (minus `bumpInMemory`/dependency validation), non-interactive `change` command (`--type` + `--message`), and `check` command.

Not implemented: JS config files, interactive prompts, `bumpInMemory`, publish/bump/changelog, pnpm/rush/lerna workspaces.

### Implementation instructions

The behavior, log messages, and tests as specified in the TypeScript code must be matched exactly in the Go/Rust code. Do not change behavior or logs or remove tests, unless it's exclusively related to features which you've been asked not to implement yet. If a different pattern would be more idiomatic in the target language, or it's not possible to implement the exact same behavior in the target language, ask the user before changing anything.

When porting tests, add a comment by each Rust/Go test with the name of the corresponding TS test. If any TS tests have been omitted or combined, add a comment indicating which tests and why.

Use syntax and helpers from the newest version of the language where it makes sense. If a particular scenario is most commonly handled in this language by some external library, and the library would meaningfully simplify the code, ask the user about adding the library as a dependency.

### Structure

- **Rust**: `src/` with nested modules (`types/`, `options/`, `git/`, `monorepo/`, `changefile/`, `validation/`, `commands/`), integration tests in `tests/` with shared helpers in `tests/common/`
- **Go**: `cmd/beachball/` CLI entry, `internal/` packages (`types`, `options`, `git`, `monorepo`, `changefile`, `validation`, `commands`, `logging`), test helpers in `internal/testutil/`, tests alongside source (`_test.go`)

### Key Implementation Details

**Git commands**: Both shell out to `git` (matching the TS approach via workspace-tools). Critical flags from workspace-tools: `--no-pager`, `--relative`, `--no-renames`. The `--relative` flag makes diff output relative to cwd (not repo root). Three-dot range (`branch...`) is used for diffs.

**Config loading**: Searches `.beachballrc.json` then `package.json` `"beachball"` field, walking up from cwd but stopping at git root.

**Glob matching**: Two modes matching the TS behavior — `matchBase` (patterns without `/` match basename) for `ignorePatterns`, full path matching for `scope`/`groups`.

**Change file format**: Identical JSON to TS: `{ "type", "comment", "packageName", "email", "dependentChangeType" }`, named `{pkg}-{uuid}.json`.

### Known Gotchas

- **macOS `/tmp` symlink**: `/tmp` is a symlink to `/private/tmp`. `git rev-parse --show-toplevel` resolves symlinks but `tempfile`/`os.MkdirTemp` does not. Both implementations canonicalize paths (`std::fs::canonicalize` in Rust, `filepath.EvalSymlinks` in Go) when comparing git-returned paths with filesystem paths.
- **Default branch name**: Modern git defaults to `main`. Test fixtures use `--initial-branch=master` for bare repo init to match the `origin/master` refs used in tests.

### Dependencies

- **Rust**: clap (CLI), serde/serde_json (JSON), globset/glob (matching), uuid, anyhow, tempfile
- **Go**: cobra (CLI), doublestar (glob), google/uuid, standard library for the rest
