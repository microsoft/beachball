# Beachball (Rust)

A Rust re-implementation of beachball's `check` and `change` commands.

## Prerequisites

- Rust 1.85+ (edition 2024 required by dependencies)
- `git` on PATH

## Building

```bash
cargo build
cargo build --release
```

## Formatting

```bash
cargo fmt
```

To check without modifying (as CI does):

```bash
cargo fmt --check
```

## Linting

```bash
cargo clippy --all-targets
```

To treat warnings as errors (as CI does):

```bash
cargo clippy --all-targets -- -D warnings
```

**Note:** If VS Code shows stale warnings after fixing lint issues, run "Rust Analyzer: Restart Server" from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

## Testing

```bash
cargo test
```

Run a specific test:

```bash
cargo test excludes_packages_with_existing_change_files
```

## Running

```bash
cargo run -- check
cargo run -- change --type patch --message "my change"
```

Or after building:

```bash
./target/debug/beachball check
./target/debug/beachball change -t minor -m "add feature"
```

## CLI Options

```
beachball check [OPTIONS]
beachball change [OPTIONS]

Options:
  -b, --branch <BRANCH>    Target branch (default: origin/master)
  -p, --path <PATH>        Path to the repository
  -t, --type <TYPE>        Change type: patch, minor, major, none, etc.
  -m, --message <MESSAGE>  Change description
      --all                Include all packages
      --verbose            Verbose output
      --no-commit          Don't commit change files
      --no-fetch           Don't fetch remote branch
```

## What's Implemented

- CLI parsing (clap)
- JSON config loading (`.beachballrc.json`, `package.json` `"beachball"` field)
- Workspace detection (npm/yarn `workspaces` field)
- `getChangedPackages` (git diff + file-to-package mapping + change file dedup)
- `validate()` (minus `bumpInMemory`/dependency validation)
- Non-interactive `change` command (`--type` + `--message`)
- `check` command

## What's Not Implemented

- JS config files (`beachball.config.js`)
- Interactive prompts
- `bumpInMemory` / dependency validation
- `publish`, `bump`, `canary`, `sync` commands
- Changelog generation
- pnpm/rush/lerna workspace detection

## Project Structure

```
src/
  main.rs                     # CLI entry point
  lib.rs                      # Module re-exports
  types/                      # ChangeType, PackageInfo, BeachballOptions
  options/                    # CLI parsing, config loading, option merging
  git/                        # Git operations (shell out to git)
  monorepo/                   # Package discovery, scoping, groups, filtering
  changefile/                 # Change file read/write, changed package detection
  validation/                 # Validation logic
  commands/                   # check and change commands
  logging.rs                  # Output helpers
tests/
  common/                     # Shared test helpers (repository, fixtures)
  changed_packages_test.rs    # 11 tests
  change_test.rs              # 2 tests
  validate_test.rs            # 3 tests
```
