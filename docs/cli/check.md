---
tags: cli
category: doc
---

# `check`

It is useful to enforce that [change files](./change-files) are checked in for each PR before they enter the target branch. In this way, all changes are captured and would affect semver appropriately. To check to make sure all changes are captured in change files, simply run:

```bash
$ beachball check
```

This command also checks for various types of misconfigurations that would result in problems when attempting to publish.

### Where Should Check Be Run?

#### As a step in the PR review gate

For example, in Travis CI:

```yaml
language: node_js
node_js:
  - '10'
script:
  - yarn
  # where 'check' is defined in package.json as 'beachball check'
  - yarn check
  - yarn build
  - yarn test
```

#### As git hook (optional)

For a reference of git hooks, take a look at [this documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks). It is recommended to place this hook as a pre-push.
