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

### Options

[General options](./options) also apply for this command.

| Option                            | Default                                            | Description                                                               |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| `--changehint`                    | `'Run "beachball change" to create a change file'` | Hint message if the developer forgot to add a change file.                |
| `--disallow-deleted-change-files` | `false`                                            | verifies that no change files were deleted between head and target branch |

### Where should `check` be run?

#### As a step in the PR review gate

See the [change files page](../concepts/change-files#validating-change-files) for how to set this up.

#### Not recommended: as a git hook

While running `beachball check` as a pre-push hook may seem appealing, it has some downsides: it will substantially slow down running `git push` and could be annoying when pushing work-in-progress changes to remote branches. Our experience with repos enabling this hook is that it will quickly be removed due to developer feedback.

If you want to try this, take a look at [this documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks) about git hooks.
