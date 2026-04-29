---
tags:
  - overview
category: doc
---

# Optimizing performance in large repos

Beachball has several options that can help improve performance in large to very large monorepos.

All the code snippets below reference `beachball.config.js`. The snippets omit some boilerplate for brevity, but the full config should look something like this (the separate typed declaration provides intellisense):

```js
/** @type {Partial<import('beachball').RepoOptions>} */
const config = {
  // your options
};
module.exports = config;
```

## Specifying the remote branch

If no `branch` option is specified, or it doesn't include a remote (recommended for GitHub due to forks), Beachball has to determine the correct remote for comparison using git operations and potentially `package.json` `"repository"`. You can reduce git operations by [providing certain settings](../overview/configuration#specifying-the-target-branch-and-remote). This most noticeably improves the perf of `beachball change` and `beachball check`.

## Concurrency

### Publish and hooks

**`concurrency`** (default: `1`) controls the maximum number of concurrent write operations during publish, including hook calls and `npm publish`. The default of `1` is conservative — if you don't use hooks, or your hooks are safe to run in parallel, increasing this can speed up publishing:

```js
const config = {
  concurrency: 5,
};
```

Note that beachball respects topological order (package dependency order) regardless of this setting, so packages that depend on each other will still be published sequentially.

### npm registry read

When syncing or publishing, beachball fetches version information from the npm registry for each package. In large monorepos with many packages, this can be slow.

**`npmReadConcurrency`** (default: `5`) controls how many registry reads happen at once. Increasing this can significantly speed up the fetch step:

```js
const config = {
  npmReadConcurrency: 10,
};
```

## Reducing git repository size

Beachball's changelogs and change files can have a [shockingly large impact](https://github.com/microsoft/beachball/issues/978) on git repository size. Some of the related issues have been improved directly in git and/or Azure DevOps, but it's still highly recommended to enable some of these settings in a large repo.

### Disable `CHANGELOG.json` if not using

If you don't have a workflow that uses `CHANGELOG.json` (most common), set **`generateChangelog: 'md'`** to only generate `CHANGELOG.md`.
After enabling, you must **manually** delete existing `CHANGELOG.json` files.

```js
const config = {
  generateChangelog: 'md',
};
```

It's also possible to disable changelog generation entirely with `generateChangelog: false`, though this defeats one of the main points of the tool.

### Limit number of versions in changelog

Set **`changelog.maxVersions`** to limit how many versions are included in each package's changelog. This prevents the changelog's history from growing indefinitely. Older versions will still be available from git history, and a note will be added directing people to look there.

```js
const config = {
  // You can experiment with values
  changelog: { maxVersions: 100 },
};
```

### Add hash to changelog file names

Enable **`changelog.uniqueFilenames`** to add a unique suffix to changelog filenames, based on the hash of the package name: e.g. `CHANGELOG-d7d39c3f.md`/`.json`. [Increasing filename uniqueness](https://github.com/microsoft/beachball/pull/996) can improve git performance - this has been improved in Git itself, but still doesn't hurt to enable.

When this is initially enabled, any existing changelog files will be renamed. If the package name (and therefore the hash) changes, renaming the file should also be handled automatically.

```js
const config = {
  changelog: { uniqueFilenames: true },
};
```

## Skipping change commit hashes

By default, beachball records the git commit hash for each change in `CHANGELOG.json`, which adds overhead during bumping. You can disable this with **`changelog.includeCommitHashes`**:

```js
const config = {
  changelog: { includeCommitHashes: false },
};
```

## Selectively skipping remote fetch

By default, beachball fetches from the remote before comparing changes. If there's a specific situation where you're **certain** the local branch is already up to date or are willing to accept the tradeoff for performance, you can skip this with `--no-fetch` (or `fetch: false` conditionally in the config).
