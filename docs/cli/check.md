---
tags:
  - cli
category: doc
---

# `check`

It is useful to enforce that [change files](./concepts/change-files) are checked in for each PR before they enter the target branch. In this way, all changes are captured and would affect semver appropriately. To check to make sure all changes are captured in change files, simply run:

```bash
$ beachball check
```

This command also checks for various types of misconfigurations that would result in problems when attempting to publish.

### Where Should Check Be Run?

#### As a step in the PR review gate

Add a step `yarn checkchange` in your PR validation build, where `checkchange` is defined in `package.json` as `beachball check` (with any appropriate options).

Note that in GitHub action workflows, you **must** specify `fetch-depth: 0` in the `checkout` option. You can see a full example in [beachball's own PR workflow](https://github.com/microsoft/beachball/blob/master/.github/workflows/pr.yml).

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - name: Use Node.js 12
        uses: actions/setup-node@v1
        with:
          node-version: 12
      - yarn
      - yarn checkchange
      # build/test steps as appropriate
```

Another example, for Travis CI:

```yaml
language: node_js
node_js:
  - '12'
script:
  - yarn
  - yarn checkchange
  # build/test steps as appropriate
```

#### As git hook (optional)

For a reference of git hooks, take a look at [this documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks). It is recommended to place this hook as a pre-push.
