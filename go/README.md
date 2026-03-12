# Beachball (Go)

A Go re-implementation of beachball's `check` and `change` commands.

<!-- See .claude/shared/rust-and-go.md for details of what's implemented or not -->

## Prerequisites

- Go 1.26+
- `git` on PATH

## Building

```bash
go build ./...
go build -o beachball ./cmd/beachball
```

## Formatting

```bash
gofmt -w .
```

To check without modifying (as CI does):

```bash
gofmt -l .
```

If any files are listed, they need formatting.

## Linting

```bash
go vet ./...
```

## Testing

```bash
go test ./...
```

Run a specific test:

```bash
go test ./internal/changefile/ -run TestExcludesPackagesWithExistingChangeFiles
```

Verbose output:

```bash
go test -v ./...
```

## Running

```bash
go run ./cmd/beachball check
go run ./cmd/beachball change --type patch --message "my change"
```

Or after building:

```bash
./beachball check
./beachball change -t minor -m "add feature"
```

## CLI Options

Currently the `check` command and non-interactive `change` command have been implemented. Options should be the same as JS Beachball.

## Project Structure

Tests (`*_test.go`) live alongside the corresponding files.

```
cmd/beachball/
  main.go       # CLI entry point (cobra)
internal/
  types/        # Basic types
  options/      # Option merging, config file loading
  git/          # Git operations (shell out to git)
  monorepo/     # Package discovery, groups, filtering
  changefile/   # Change file handling, changed package detection
  validation/   # Validation
  commands/     # Main commands
  logging/      # Output helpers
  testutil/     # Test helpers
```
