---
tags: cli
category: doc
---

# `change`

This command walks you through a couple of questions and will generate the appropriate [change file](./change-files) in the `/change` directory. The generated file will be checked into the repo automatically for you. One of the niceties of using this utility to generate change files is that it will [check](./check) whether or not you even need a change file or not. Also, it will try to pull in recent commit messages to speed up change file generation.

```bash
$ beachball change
```

### Uncommitted Files

When you have changes that are not committed yet (i.e. `git status` reports changes), then `beachball change` will warn you about these:

```bash
$ beachball change
Defaults to "origin/master"
There are uncommitted changes in your repository. Please commit these files first:
- a-new-file
```

Make sure to commit _all_ changes before proceeding with the `change` command

### Walking Through the Form

Let's move on. We will commit the changes we made and re-run `beachball change` again:

```bash
$ beachball change
Defaults to "origin/master"
Checking for changes against "origin/master"

Please describe the changes for: single
? Describe changes (type or choose one) ›
adding a new file
```

It'll ask for a description of the change. This can be any text, but it is also very convenient that `beachball` will look for recent commit messages for you to choose as the description. These descriptions will be collated into a changelog when the change is published by `beachball publish`.

```bash
? Change type › - Use arrow-keys. Return to submit.
❯  Patch - bug fixes; no backwards incompatible changes.
   Minor - small feature; backwards compatible changes.
   None - this change does not affect the published package in any way.
   Major - major feature; breaking changes.
```

The form will ask you about a change type. This is the answer that will ultimately determine whether to update the version of the package by major, minor or patch. You can even pick "none" if you don't intend for this change to affect the version of the package (e.g. fixing a README.md typo).
