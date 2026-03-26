---
name: beachball-change-file
description: How to create a Beachball change file. ONLY use this skill when the user asks to generate change files, before pushing a branch, or before creating a PR.
metadata:
  version: 1.0.0
  source: https://github.com/microsoft/beachball/blob/main/.claude/skills/beachball-change-file/SKILL.md
---

[Beachball](https://microsoft.github.io/beachball/) is a tool used for managing versioning and changelogs for JS/TS codebases. Every pull request must include a Beachball change file. Change files include the list of changed packages in a branch, with the description and semver change type for each package. After the PR is checked in and a release is run, the change files are used to determine version bumps and update changelogs.

Beachball normally uses a CLI with an interactive prompt to create change files, but they can also be created using CLI arguments, or manually using the standardized JSON format detailed below.

## Prerequisites

- Determine the package manager for the repo (`npm`, `yarn`, `pnpm`). The example commands below assume `yarn`, but substitute the appropriate command runner syntax for a different package manager.
- Check the root `package.json` `scripts` for scripts that run `beachball change` and `beachball check`.
  - The examples below assume `scripts` called `change` and `checkchange` respectively, but substitute the appropriate script names if found.
  - Using `scripts` if defined is preferred since they may add extra arguments, but it's possible to run the commands directly: `yarn beachball change` and `yarn beachball check` (substituting appropriate command runner)
- Check for the following settings in the beachball config (usually `beachball.config.js` or located in the root `package.json` `beachball` key):
  - `disallowedChangeTypes`: modifies the allowed `type` values in the change file
  - `changeDir`: the default is `"change"`
  - `branch`: target branch (usually `main` or `master` if not specified)

## Creating a change file

### Option 1: Using the CLI (preferred for single-package repo)

If there's only one package in the repo, the best way to create a change file is using the `beachball change` command with CLI arguments (see "Change entry" values below for how to determine the type and message/comment):

```
yarn change --type <type> --message "Description of changes" --no-commit
```

The `--no-commit` option means that the change file will be staged for the user to review rather than immediately committed.

(This CLI command can also be used to create change files in a monorepo for multiple changed packages, but the same type and message will be used for each package, which isn't usually desirable.)

### Option 2: Creating a change file manually (preferred for multi-package monorepo)

1. Get the list of files with unstaged/untracked changes: `git ls-files -m` and `git ls-files -o --exclude-standard`. (Do not check the the diff contents at this step.)
2. If there are any files from step 1, ask the user whether they would like to stage all files or continue without staging. If they choose to stage, run `git add .` before proceeding.
3. Run `yarn checkchange --verbose` to get the list of changed packages and files detected by `beachball` (it may be configured to ignore certain files or packages).
   - The list of changed packages is under "Found changes in the following packages"
   - The list of changed files is under "changed files in current branch". Ignore any files with `~~` strikethrough formatting.
   - DO NOT use git commands to get the list of changed files, since this doesn't respect beachball settings. (You may use `git diff` later to view diffs for specific files.)
4. Generate a random GUID for the change file name: `node -e "console.log(crypto.randomUUID())"`
5. Create a single change file under `<changeDir>/change-<guid>.json` with a `changes` entry for each package. See below for the grouped change file format.
6. `git add` the new change file, then re-run `yarn checkchange` to verify.

## Change file format

### Location and structure

There are two possible structures for change files: grouped format with one change file with all changed packages, or multiple change files with one package per file. Typically, multi-package monorepos will use the grouped format. A single-package repo will typically use the single-package format.

#### Single-package format

Each single-package change file is located under `<changeDir>/<packageName>-<guid>.json`. It has the following format:

```json
{
  "packageName": "",
  "type": "",
  "dependentChangeType": "",
  "comment": "",
  "email": ""
}
```

#### Grouped format

Each grouped change file is located under `<changeDir>/change-<guid>.json`. It has the following format, with a `changes` entry for each changed package:

```json
{
  "changes": [
    {
      "packageName": "",
      "type": "",
      "dependentChangeType": "",
      "comment": "",
      "email": ""
    }
  ]
}
```

### Change entry values

Each package's entry has the following values:

- `packageName`: The name of the changed package, e.g. `just-task`
- `type`: The semantic versioning change type for the package, determined based on the diff content of changed files in that package. There are different options depending on whether the package's current version contains a prerelease suffix or not:
  - If the package's current version does NOT have a prerelease suffix, choose `<patch|minor|major|none>` (omit any options banned by the beachball config's `disallowedChangeTypes` setting):
    - **`"patch"`**: Bug fixes or other changes that don't impact exported API signatures.
    - **`"minor"`**: New exported APIs, non-breaking signature changes to exported APIs, or more significant changes to internal logic. (If the package has a `<package path>/etc/*.api.md` file, checking its diff is the easiest way to see exported API changes.)
    - **`"major"`**: Breaking changes to exported APIs (removals or breaking signature changes), critical dependency updates, or behavior changes that might be breaking for the consumer. You MUST confirm with the user before choosing `"major"`.
    - **`"none"`**: None of the changes will impact consumers of the package (e.g. the changes are only to non-exported test-specific files or documentation). If you're not certain, prefer `"patch"`.
  - ONLY if the package's current version includes a prerelease suffix, choose `<prerelease|none>`:
    - **`"prerelease"`**: Any changes that impact consumers of the package
    - **`"none"`**: None of the changes will impact consumers of the package (e.g. the changes are only to non-exported test-specific files or documentation). If you're not certain, prefer `"prerelease"`.
  - If not certain about the change type, ask the user to choose one of the options above based on the diff content.
- `dependentChangeType`: Change type for packages that depend on this package. If `type` is `"none"`, this should be `"none"`. Otherwise, this should be `"patch"` (beachball internally handles this for the special case of prerelease packages).
- `comment` (`--message` CLI arg): A concise description of the changes made to the package. This will go in the changelog, so it should focus on user-facing changes rather than implementation details. This field accepts markdown formatting.
- `email`: User's email from `git config user.email`, or `"email not defined"` if not available. Do NOT invent an email.
