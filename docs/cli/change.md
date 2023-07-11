---
tags:
  - cli
category: doc
---

# `change`

This command walks you through a couple of questions and will generate the appropriate [change file](../concepts/change-files) in the `/change` directory. The generated file will be committed automatically.

One of the niceties of using this utility to generate change files is that it will [check](./check) whether or not you even need a change file. Also, it will load recent commit messages to ease change file generation.

```bash
$ beachball change
```

### Options

Some [general options](./options) including `--branch` also apply for this command.

| Option        | Alias | Default              | Description                                                                       |
| ------------- | ----- | -------------------- | --------------------------------------------------------------------------------- |
| `--all`       |       | false                | Generate change files for all packages                                            |
| `--message`   | `-m`  | (interactive prompt) | Description for all change files                                                  |
| `--no-commit` |       | false                | Stage the change file rather than committing                                      |
| `--package`   |       | (changed packages)   | Generate change files for these packages (option can be specified multiple times) |
| `--type`      |       | (interactive prompt) | Type for all the change files (must be valid for each package)                    |

### Walkthrough

If you have changes that are not committed yet (i.e. `git status` reports changes), then `beachball change` will warn you about these:

```
$ beachball change
Defaults to "origin/master"
There are uncommitted changes in your repository. Please commit these files first:
- a-new-file
```

Make sure to commit _all_ changes before proceeding with the `change` command.

After committing, run `beachball change`:

```
$ beachball change

Validating options and change files...
Checking for changes against "origin/main"
Found changes in the following packages:
  some-pkg
```

For each package, the prompt will start by asking for a **change type**. If this change has no impact on the published package (e.g. fixing a typo in a comment or updating a test), choose "none."

```
Please describe the changes for: some-pkg
? Change type › - Use arrow-keys. Return to submit.
❯ Patch - bug fixes; no backwards incompatible changes.
  Minor - small feature; backwards compatible changes.
  None - this change does not affect the published package in any way.
  Major - major feature; breaking changes.
```

Next, it asks for a **description** of the change. You can type any text or choose from a list of recent commit messages.

> Tip: These descriptions will be collated into a changelog when the change is published by `beachball publish`, so think about how to describe your change in a way that's helpful and relevant for consumers of the package.

```
Please describe the changes for: some-pkg
? Describe changes (type or choose one) ›
adding a new file
```
