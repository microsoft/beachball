---
title: 'check'
tags: cli
category: doc
---

It is useful to enforce that [change files](./change-files) are checked in for each PR before they enter the target branch. In this way, all changes are captured and would affect semver appropriately. To check to make sure all changes are captured in change files, simply run:

```bash
$ beachball check
```

#### Where Should Check Be Run?

###### As a step in the PR review gate

- Travis CI:

```yaml
language: node_js
node_js:
  - '10'
script:
  - yarn
  - yarn check
  - yarn build
  - yarn test
```

###### As git hook (optional, but good for dev experience)

For a reference of git hooks, take a look at this documentation
https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks. It is recommended to place this hook as a pre-push. There are ways to hook this up there,
