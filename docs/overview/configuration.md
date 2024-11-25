---
tags:
  - overview
category: doc
---

# Configuration

For most uses you probably do not need any specific configuration on each package within your repository. But there are a few options to customize `beachball`'s behavior.

There are two types of configurations:

1. repository config
2. package config

## Repository config

`beachball` uses [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig) to read its configuration, so you can specify configuration in several ways (in addition to CLI arguments).

- `"beachball"` key inside `package.json`
- `.beachballrc`
- `.beachballrc.json`
- `beachball.config.js` (CJS or ESM depending on your project setup; explicit `.cjs` or `.mjs` is also supported)

It's most common to use a JavaScript file for the repo-level config, since it's the most flexible and allows comments. Usually this file is at the repo root.

The `beachball.config.js` example below uses JSDoc type annotations to enable intellisense in some editors (these are optional).

```js
// @ts-check
/** @type {import('beachball').BeachallConfig} */
const config = {
  disallowedChangeTypes: ['major'],
  changehint: 'Run "yarn change" to generate a change file',
  groupChanges: true,
};
module.exports = config;
```

## Package config

Package-level configuration is currently only supported under the `beachball` key in `package.json`.

For example, suppose the repo config above is at `beachball.config.js` at the repo root, and there are these other files:

```
packages/
  foo/
    package.json
  bar/
    package.json
beachball.config.js
package.json
```

To change the `disallowedChangeTypes` for package `foo`, you could add the following to `packages/foo/package.json`:

```json
{
  "name": "foo",
  "version": "1.0.0",
  "beachball": {
    "disallowedChangeTypes": null
  }
}
```

## Options

For the latest full list of supported options, see `RepoOptions` [in this file](https://github.com/microsoft/beachball/blob/master/src/types/BeachballOptions.ts).

"Applies to" indicates where the settings can be specified: repo-level config or package-level config.

| Option                  | Type                           | Default        | Applies to    | Description                                                                                     |
| ----------------------- | ------------------------------ | -------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `access`                | `'public'` or `'restricted'`   | `'restricted'` | repo          | publish access level for scoped package names (e.g. `@foo/bar`)                                 |
| `branch`                | `string`                       | [see notes][5] | repo          | target branch; [see notes][5]                                                                   |
| `bumpDeps`              | `boolean`                      | `true`         | repo          | bump dependent packages during publish (if B is bumped, and A depends on B, also bump A)        |
| `changeFilePrompt`      | [`ChangeFilePromptOptions`][1] |                | repo          | customize the prompt for change files (can be used to add custom fields)                        |
| `changehint`            | `string`                       |                | repo          | hint message for when change files are not detected but required                                |
| `changeDir`             | `string`                       | `change`       | repo          | directory where change files are stored (relative to repo root)                                 |
| `changelog`             | [`ChangelogOptions`][2]        |                | repo          | changelog rendering and grouping options                                                        |
| `defaultNpmTag`         | `string`                       | `'latest'`     | repo, package | the default dist-tag used for NPM publish                                                       |
| `disallowedChangeTypes` | `string[]`                     |                | repo, package | what change types are disallowed                                                                |
| `fetch`                 | `boolean`                      | `true`         | repo          | fetch from remote before doing diff comparisons                                                 |
| `generateChangelog`     | `boolean \| 'md' \| 'json'`    | `true`         | repo          | whether to generate `CHANGELOG.md/json` (`'md'` or `'json'` to generate only that type)         |
| `gitTags`               | `boolean`                      | `true`         | repo, package | whether to create git tags for published packages (eg: foo_v1.0.1)                              |
| `groups`                | [`VersionGroupOptions[]`][3]   |                | repo          | bump these packages together ([see details][3])                                                 |
| `groupChanges`          | `boolean`                      | `false`        | repo          | write multiple changes to a single changefile                                                   |
| `hooks`                 | [`HooksOptions`][4]            |                | repo          | hooks for custom pre/post publish actions                                                       |
| `ignorePatterns`        | `string[]`                     |                | repo          | ignore changes in files matching these glob patterns ([see notes][6])                           |
| `package`               | `string`                       |                | repo          | specifies which package the command relates to (overrides change detection based on `git diff`) |
| `prereleasePrefix`      | `string`                       |                | repo          | prerelease prefix for packages that are specified to receive a prerelease bump                  |
| `publish`               | `boolean`                      | `true`         | repo          | whether to publish to npm registry                                                              |
| `push`                  | `boolean`                      | `true`         | repo          | whether to push to the remote git branch                                                        |
| `registry`              | `string`                       |                | repo          | target NPM registry to publish                                                                  |
| `retries`               | `number`                       | `3`            | repo          | number of retries for a package publish before failing                                          |
| `scope`                 | `string[]`                     |                | repo          | only consider package paths matching these patterns ([see details](#scoping))                   |
| `shouldPublish`         | `false \| undefined`           |                | package       | manually disable publishing of a package by beachball (does not work to force publishing)       |
| `tag`                   | `string`                       | `'latest'`     | repo, package | dist-tag for npm when published                                                                 |
| `transform`             | [`TransformOptions`][4]        |                | repo          | transformations for change files                                                                |

[1]: https://github.com/microsoft/beachball/blob/master/src/types/ChangeFilePrompt.ts
[2]: https://github.com/microsoft/beachball/blob/master/src/types/ChangelogOptions.ts
[3]: ../concepts/groups#version-groups
[4]: https://github.com/microsoft/beachball/blob/master/src/types/BeachballOptions.ts
[5]: #determining-the-target-branch-and-remote
[6]: #glob-matching

### Glob matching

Glob matching is implemented using [`picomatch`](https://www.npmjs.com/package/picomatch), which supports most glob syntax.

All glob patterns are relative to the repo or monorepo root and must use **forward slashes only**.

Unless otherwise noted (such as for `scope`), using gitignore-style negated patterns to modify previous matches is not supported.

### Scoping

The `scope` option allows limiting which packages are considered. You can set it in the config file if it should always apply, or on the command line for a specific operation.

This option takes a list of patterns which are matched against package paths. Patterns are relative to the monorepo root and must use forward slashes. Negations are supported, similar to how gitignore works.

Example: with this config, `beachball` will only consider packages under `packages/foo` (excluding `packages/foo/bar`).

```json
{
  "scope": ["packages/foo/*", "!packages/foo/bar"]
}
```

On the command line, this could be specified as `--scope 'packages/foo/*' --scope '!packages/foo/bar'` (don't forget the quotes!).

> Note: if you have multiple sets of packages in the repo with different scopes, `groupChanges` is not supported.

### Determining the target branch and remote

The `branch` option is the official target branch to compare against when determining changes. Usually it should be a name only, though you can also include a remote. The default is the system default branch name (`main` or `master`) and the official remote.

To let `beachball` reliably determine the official remote, it's recommended to specify `repository` in the repo root `package.json`. This allows matching via URL regardless of what the user decided to call the remote.

If `repository` isn't specified and `branch` doesn't include a remote, the fallback is `upstream` if defined, `origin` if defined, or the first defined remote.
