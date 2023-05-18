---
tags:
  - cli
category: doc
---

# `check`

It's recommended to enforce that [change files](../concepts/change-files) are included with each PR. This way, all changes are captured and affect semver appropriately.

To ensure that all changes are captured in change files, simply run:

```bash
$ beachball check
```

This command also checks for misconfigurations that would result in problems when attempting to publish.

### Options

See the [options page](./options).

### Where should `check` be run?

#### As a step in the PR review gate

See the [change files page](../concepts/change-files#validating-change-files) for how to set this up.

#### As git hook (optional)

For a reference about git hooks, take a look at [this documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks). This hook would typically be run pre-push.

While running `beachball check` before push may seem appealing, it has some downsides: it will substantially slow down running `git push` and could be annoying when pushing work-in-progress changes to remote branches. Our experience with repos enabling this hook is that it's often quickly removed due to developer feedback.
