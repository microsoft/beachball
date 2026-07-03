# Plan: migrate CLI option parsing from yargs-parser to commander@14

> **This is a temporary planning document.** It should be deleted as part of the final cleanup
> (step 7 below), once the migration is complete (or moved into a permanent doc/issue if we want to
> keep it).

## Goal and scope

Replace `yargs-parser` with `commander@14` for CLI option parsing in
`packages/beachball/src/options/getCliOptions.ts`.

Constraints for this migration (per the task):

- For now, **all options are defined on a single command**. A later change will split up which
  options apply to which commands.
- Commander is used **only for option parsing**, not for command dispatch/execution. The existing
  `cli.ts` dispatch (switch on `cliOptions.command`) stays as-is.
- The public shape of `getCliOptions` (returns `ParsedOptions['cliOptions']`, including `command`,
  `path`, and `_extraPositionalArgs`) must not change.

The behaviors we must preserve are documented by
`src/__functional__/options/getCliOptions.test.ts`. That test file explicitly notes it exists to
catch "undocumented breaking changes ... likely to commander". This plan maps each behavior to a
commander approach or a workaround.

## Why this is not a drop-in replacement

`yargs-parser` is a permissive, schema-light parser: it infers types, expands camelCase, splits
greedy arrays, and accepts arbitrary unknown flags. `commander` is a schema-first parser: every
option is declared up front, and anything not declared is either an error or passed through
untyped. The gaps are all in yargs' permissive behaviors.

## Behavior mapping (today's yargs behavior -> commander)

Legend: ✅ native, ⚙️ needs a workaround, ❌ not feasible / propose dropping.

| # | Behavior (from `getCliOptions.test.ts`) | Example | Commander support |
|---|------------------------------------------|---------|-------------------|
| 1 | Command as first positional (default `change`) | `beachball check` | ✅ `.argument('[command]')` |
| 2 | String option, separate & `=` forms | `--type patch`, `--access=public` | ✅ `--type <value>` |
| 3 | Number option + reject non-numeric | `--depth 1`, `--depth foo` throws | ✅ via `.argParser` coercion |
| 4 | Boolean flag | `--fetch` | ✅ `--fetch` |
| 5 | Negated boolean | `--no-fetch` | ✅ define `--no-fetch` alongside `--fetch` |
| 6 | Array: greedy multiple values | `--scope foo bar` | ✅ variadic `<values...>` |
| 7 | Array: repeated flag | `--scope foo --scope bar` | ⚙️ variadic + collector fn |
| 8 | Array: single value via `=` becomes array | `--scope=foo` -> `['foo']` | ⚙️ collector fn |
| 9 | Commas NOT split | `--scope a,b` -> `['a,b']` | ✅ (commander never splits) |
| 10 | Boolean value as separate token | `--yes false`, `-y false` | ⚙️ argv preprocessing (see below) |
| 11 | Boolean value via `=` | `--fetch=false`, `--fetch=true` | ⚙️ argv preprocessing (see below) |
| 12 | Throw if non-array option repeated | `--tag a --tag b` throws | ⚙️ collector-style detector fn |
| 13 | camelCase accepted for dashed option | `--gitTags`, `--dependentChangeType` | ⚙️ argv normalization pass |
| 14 | dashed accepted for camelCase option | `--git-tags` | ✅ (declare dashed as canonical) |
| 15 | Negated camelCase | `--no-git-tags` (option `gitTags`) | ✅ declare `--no-git-tags` |
| 16 | Short aliases | `-t`, `-r`, `-y`, `-a`, `-b`, `-m`, `-p`, `-n`, `-v`, `-h` | ✅ in flags string |
| 17 | Extra long aliases | `--config`, `--force`, `--since` | ⚙️ argv normalization or dup options |
| 18 | Arbitrary unknown string option | `--foo bar`, `--foo=bar` | ⚙️ custom leftover parser |
| 19 | Arbitrary unknown boolean flag | `--foo`, `--no-bar` | ⚙️ custom leftover parser |
| 20 | Unknown value type inference | `--foo true` -> bool, `--foo 1` -> number | ⚙️ custom leftover parser |
| 21 | Unknown repeated -> array | `--foo bar --foo baz` -> `['bar','baz']` | ⚙️ custom leftover parser |
| 22 | `-?` alias for help | `-?` | ❌ commander rejects `?` as a short flag; drop or normalize |
| 23 | `config get <name>` subcommand args | `config get branch` | ✅ variadic `[extraArgs...]` |
| 24 | canary tag override, `NPM_TOKEN`, branch resolution | (post-parse) | ✅ unchanged post-parse logic |

## Proposed workarounds

The cleanest strategy is a small **argv normalization pass** run before `program.parse(...)`, plus
a couple of coercion functions and a **leftover unknown-option parser** run after. This keeps the
commander option declarations clean and localizes the yargs-compatibility shims.

### A. Array options (#7, #8) — collector function

Declare array options as variadic (`--scope <values...>`) and attach an `argParser` collector that
appends to the previous array. Variadic handles greedy multiple values; the collector handles
repeated flags and makes a single `=` value into a one-element array. (Implemented in step 1.)

### B. Non-array "specified multiple times" error (#12)

Attach an `argParser` to each string/number option that throws if it receives a value when one was
already set (commander calls the parser with the previous value as the second argument). This
reproduces yargs' "Option X only accepts a single value" error.

### C. Boolean values as tokens or `=` (#10, #11)

Commander boolean flags don't accept values (`--fetch=false` / `--yes false` don't work natively;
optional-value `[value]` options don't reliably consume a following token either). Proposed
workaround: an **argv normalization pass** that, for known boolean options, rewrites:

- `--fetch=false` / `--fetch=true` -> drop the `=value`, emit `--fetch` or `--no-fetch`.
- `--yes false` / `-y false` (value in the next token, only when the next token is literally
  `true`/`false`) -> collapse to `--yes` / `--no-yes` and consume that token.

Only the literal strings `true`/`false` are treated as boolean values (matching today's behavior);
anything else is left for normal positional handling.

### D. camelCase flag acceptance (#13) and extra long aliases (#17)

Add an argv normalization pass that maps recognized alternate flag spellings to the canonical
dashed form before parsing:

- camelCase -> dashed: `--gitTags` -> `--git-tags`, `--dependentChangeType` -> `--dependent-change-type`.
  Build the lookup from the known option lists (we already generate the dashed form from the
  camelCase name).
- long aliases -> canonical: `--config` -> `--config-path`, `--force` -> `--force-versions`,
  `--since` -> `--from-ref`. Maintain a small alias map. (Commander only allows one long flag per
  option, so aliases must be normalized rather than declared.)

Handle both `--flag value` and `--flag=value` shapes in the normalizer.

### E. Arbitrary unknown options (#18–#21)

Today yargs collects any unknown `--foo`/`--foo=bar` into `cliOptions` with type inference (boolean
for bare flags and `true`/`false`, number for numeric strings, string otherwise, array when
repeated). Commander with `.allowUnknownOption()` just passes unknown tokens through as raw args —
it does not key/value-parse them, and their presence disrupts positional (command) detection.

Proposed workaround: run a **small dedicated mini-parser over the leftover unknown tokens**
(`program.parseOptions(...)` exposes `unknown`, or we diff declared flags from argv). For each
unknown token, reproduce yargs' inference rules:

- `--foo` (no value / next token is another flag) -> `true`; `--no-bar` -> `bar: false`.
- `--foo=bar` or `--foo bar` -> string `bar`; `true`/`false` -> boolean; numeric -> number.
- repeated unknown -> array.

Keep this logic small and well-tested; it is the largest single behavioral gap. Note the existing
test at line 240 already documents that `--foo bar baz` treats `baz` as the command (greedy arrays
are not applied to unknown options), so the mini-parser should mirror that.

### F. Positional / command detection (#1, #23)

Declare `[command]` and `[extraArgs...]` positional arguments. Keep the existing validation that
only `config` may have extra positional args, and keep populating `_extraPositionalArgs`. Because
unknown-option handling (E) can interfere with positional detection, run the normalizer (D) and the
boolean fixups (C) first, then let commander parse known options + positionals, then run the
leftover unknown parser (E) on what remains.

### G. Error / exit behavior

Call `program.exitOverride()` and silence `configureOutput` so commander throws instead of calling
`process.exit()` / writing to stderr. This respects the repo rule that `process.exit()` only
belongs in `cli.ts`, and lets tests assert on thrown errors. (Implemented in step 1.)

## Items proposed to drop or change (need sign-off)

- **`-?` as a help alias (#22):** commander does not accept `?` as a short-flag character. Options:
  (a) drop `-?` (recommended — `-h`/`--help` remain), or (b) rewrite `-?` to `--help` in the
  normalizer. This is a minor, arguably-intentional breaking change; call it out in the change file
  since `main` targets beachball v3 where breaking changes are allowed.
- **Greedy arrays for unknown options:** not supported today either (test #240), so no change.

## Implementation steps

1. **(this PR) Basic commander definitions + parsing, dashed forms only.**
   - Add `commander@^14.0.3` dependency.
   - Rewrite `getCliOptions.ts` to build a single commander `Command` with every option declared in
     its canonical dashed form (string `<value>`, number w/ numeric coercion, boolean w/ `--no-`
     negation, array variadic + collector), short aliases included, plus `[command]`/`[extraArgs...]`
     positionals. Keep all post-parse logic (branch resolution, canary tag, `NPM_TOKEN`, delete
     undefined, `_extraPositionalArgs`, project-root lookup).
   - Tests are expected to partially fail at this step (the permissive-syntax cases): camelCase
     flags, extra long aliases, boolean values as tokens/`=`, "repeated non-array throws", and
     arbitrary unknown-option inference. No change file yet.
2. **Non-array repeat detection (B)** and confirm array collector (A) matches all array tests.
3. **camelCase + long-alias normalization pass (D).**
4. **Boolean-value normalization (C)** and resolve the `-?` decision (G/#22).
5. **Unknown-option mini-parser (E)** to restore arbitrary-option inference and fix positional
   interaction (F).
6. **Cleanup:** remove `yargs-parser` and `@types/yargs-parser` from `packages/beachball/package.json`,
   remove the now-obsolete `parserOptions`/`allKeysOfType` machinery, run `yarn lint` (dep check),
   `yarn build`, `yarn test`, `yarn format`.
7. **Docs + change file:** update any option docs/help text if behavior changed (e.g. `-?`), add a
   Beachball change file via `/beachball-change-file`, and delete this planning document.

## Testing strategy

- `getCliOptions.test.ts` is the primary contract; drive the migration to green against it, only
  editing tests where we deliberately change behavior (e.g. `-?`), with each such change justified
  in the change file.
- Add focused unit tests for the new helpers (argv normalizer, boolean fixup, unknown mini-parser).
- Run the full `beachball` suite (`yarn test:all`) since option parsing feeds every command.
