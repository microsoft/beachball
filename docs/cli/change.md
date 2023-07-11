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

Some [general options](./options) including `--branch` and `--scope` also apply for this command.

| Option        | Alias | Default              | Description                                                                       |
| ------------- | ----- | -------------------- | --------------------------------------------------------------------------------- |
| `--all`       |       | false                | Generate change files for all packages                                            |
| `--message`   | `-m`  | (interactive prompt) | Description for all change files                                                  |
| `--no-commit` |       | false                | Stage the change files rather than committing                                     |
| `--package`   |       | (changed packages)   | Generate change files for these packages (option can be specified multiple times) |
| `--type`      |       | (interactive prompt) | Type for all the change files (must be valid for each package)                    |

### Examples

Basic interactive prompt (see [walkthrough](#prompt-walkthrough) for details):

```
beachball change
```

Skip the interactive prompt by specifying a message and type for all changed packages:

```
beachball change --type patch --message 'some message'
```

Generate change file for specific package(s), regardless of changes, and even if a change file already exists for the package in this branch. Each package must be specified with a separate `--package` option. (You can also use the `--message` and `--type` options here.)

```
beachball change --package foo --package bar
```

Generate change files for all packages, regardless of changes. This would most often be used for build config updates which only touch a shared config file, but actually impact the output of all packages.

```
beachball change --all --type patch --message 'update build output settings'
```

### Prompt walkthrough

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

For each package, the prompt will start by asking for a change **type**. This should be chosen based on [semantic versioning rules](https://semver.org/) because it determines how to update the package version. If the change doesn't affect the published package at all (e.g. you just updated some comments), choose `none`.

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
