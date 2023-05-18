---
tags:
  - overview
category: doc
---

# Installation

## CLI setup

The primary way to use `beachball` is by installing it as a `devDependency` and configuring wrapper scripts. (You can also run `beachball` via `npx`.)

> Note: In a monorepo, `beachball` should be installed at and run from the repo root only.

### Automatic setup

Run `npx beachball init` to automatically run the steps outlined below.

### Manual setup

To get started, install `beachball` as a `devDependency`:

```bash
npm install -D beachball
```

or for yarn users (add `-W` if in a monorepo):

```bash
yarn add -D beachball
```

After that, add some scripts to call `beachball` commands:

```json
{
  "scripts": {
    "change": "beachball change",
    "checkchange": "beachball check",
    "release": "beachball publish"
  }
}
```

You should also ensure that a [`repository`](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#repository) URL is set in your repo root `package.json` to help `beachball` figure out which remote to compare against when determining changes. For example:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org-name/your-repo-name.git"
  }
}
```

## Local development workflow

After making and committing changes in a branch, run `npm run change` or `yarn change` to generate change files. See the [change files page](../concepts/change-files) for more details.

## CI integration

There are two parts to CI integration with `beachball`:

1. [Add a PR build step](../concepts/change-files#validating-change-files) to call `beachball check` to validate that change files are included.
2. [Add a release build step](../concepts/ci-integration) to call `beachball publish` to publish to npm and push back to git.
