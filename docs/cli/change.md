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

See the [options page](./options).

### Walkthrough

If you have changes that are not committed yet (i.e. `git status` reports changes), then `beachball change` will warn you about these:

```
$ beachball change
Defaults to "origin/master"
There are uncommitted changes in your repository. Please commit these files first:
- a-new-file
```

Make sure to commit _all_ changes before proceeding with the `change` command.

Now we'll commit the changes we made and run `beachball change` again:

```
$ beachball change
Defaults to "origin/master"
Checking for changes against "origin/master"

Please describe the changes for: single
? Describe changes (type or choose one) ›
adding a new file
```

First, it will ask for a **description** of the change. You can enter any text, but `beachball` will also provide a list of recent commit messages to choose from.

> Tip: These descriptions will be collated into a changelog when the change is published by `beachball publish`, so think about how to describe your change in a way that's helpful and relevant for consumers of the package.

Next, the form will ask for a change **type**. This should be chosen based on [semantic versioning rules](https://semver.org/) because it determines how to update the package version. If the change doesn't affect the published package at all (e.g. you just updated some comments), choose `none`.

```bash
? Change type › - Use arrow-keys. Return to submit.
❯  Patch - bug fixes; no backwards incompatible changes.
   Minor - small feature; backwards compatible changes.
   None - this change does not affect the published package in any way.
   Major - major feature; breaking changes.
```
