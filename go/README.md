# Beachball (Go)

A Go re-implementation of beachball's `check` and `change` commands.

## Prerequisites

- Go 1.23+
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

```
beachball check [flags]
beachball change [flags]

Flags:
  -b, --branch string       Target branch (default: origin/master)
      --path string          Path to the repository
  -t, --type string          Change type: patch, minor, major, none, etc.
  -m, --message string       Change description
      --all                  Include all packages
      --verbose              Verbose output
      --config-path string   Path to beachball config
```

## What's Implemented

- CLI parsing (cobra)
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
cmd/beachball/
  main.go                        # CLI entry point (cobra)
internal/
  types/
    change_info.go               # ChangeType, ChangeFileInfo, ChangeSet
    package_info.go              # PackageJson, PackageInfo, PackageGroups
    options.go                   # BeachballOptions, CliOptions
  options/
    get_options.go               # Option merging
    repo_options.go              # Config file loading
  git/
    commands.go                  # Git operations (shell out to git)
    helpers.go                   # File/workspace helpers
    ensure_shared_history.go     # Fetch/deepen for shallow clones
  monorepo/
    package_infos.go             # Package discovery
    scoped_packages.go           # Scope filtering
    package_groups.go            # Version group resolution
    filter_ignored.go            # Ignore pattern matching
  changefile/
    changed_packages.go          # Changed package detection
    changed_packages_test.go     # 11 tests
    read_change_files.go         # Read change files from disk
    write_change_files.go        # Write change files
    change_types.go              # Disallowed type resolution
  validation/
    validate.go                  # Main validation logic
    validate_test.go             # 3 tests
    validators.go                # Type/auth validators
    are_change_files_deleted.go  # Deleted change file detection
  commands/
    check.go                     # Check command
    change.go                    # Change command
    change_test.go               # 2 tests
  logging/
    logging.go                   # Output helpers
  testutil/
    repository.go                # Test git repo wrapper
    repository_factory.go        # Bare repo + clone factory
    fixtures.go                  # Fixture setup helpers
    change_files.go              # Test change file helpers
```
