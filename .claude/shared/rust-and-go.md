<!-- This is referenced from the rust and go skills -->

## Rust and Go Implementation Guidelines

The `rust/` and `go/` directories contain parallel re-implementations of beachball's `check` and `change` commands and the corresponding tests.

### Scope

Implemented:

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

After making changes, run the commands to build, test, lint, and format.

### Key Implementation Details

**Git commands**: Both shell out to `git` (matching the TS approach via workspace-tools). The git flags used should exactly match the workspace-tools code. Three-dot range (`branch...`) is used for diffs.

**Config loading**: Searches `.beachballrc.json` then `package.json` `"beachball"` field, walking up from cwd but stopping at git root.

**Glob matching**: Two modes matching the TS behavior — `matchBase` (patterns without `/` match basename) for `ignorePatterns`, full path matching for `scope`/`groups`.

### Known Gotchas

- **macOS `/tmp` symlink**: `/tmp` is a symlink to `/private/tmp`. `git rev-parse --show-toplevel` resolves symlinks but `tempfile`/`os.MkdirTemp` does not. Both implementations canonicalize paths (`std::fs::canonicalize` in Rust, `filepath.EvalSymlinks` in Go) when comparing git-returned paths with filesystem paths.
- **Default branch name**: Modern git defaults to `main`. Test fixtures use `--initial-branch=master` for bare repo init to match the `origin/master` refs used in tests.
