# Beachball (Rust)

A Rust re-implementation of beachball's `check` and `change` commands.

<!-- See .claude/shared/rust-and-go.md for details of what's implemented or not -->

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

To fix (`--allow-dirty` to allow fixes with uncommitted changes):

```bash
cargo clippy --all-targets --fix --allow-dirty -- -D warnings
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

Currently the `check` command and non-interactive `change` command have been implemented. Options should be the same as JS Beachball.

## Project Structure

```
src/
  main.rs         # CLI entry point
  lib.rs          # Module re-exports
  types/          # Basic types
  options/        # CLI parsing, config loading, option merging
  git/            # Git operations (shell out to git)
  monorepo/       # Package discovery, scoping, groups, filtering
  changefile/     # Change file read/write, changed package detection
  validation/     # Validation logic
  commands/       # check and change commands
  logging.rs      # Output helpers
tests/
  common/         # Shared test helpers (repository, fixtures)
  *_test.rs       # Test files
```
