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

## Configuration files

`beachball` uses [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig) to read its configuration, so you can specify configuration in several ways (in addition to CLI arguments).

- `"beachball"` key inside `package.json`
- `.beachballrc`
- `.beachballrc.json`
- `beachball.config.js`

### `beachball.config.js`

In many cases, you'll want to use a JavaScript config file (written as a CommonJS module), since this is the most flexible and allows comments.

```js
module.exports = {
  key: value,
  key2: value2
  key3: value3
}
```

Config files can be placed in either the root of a repo and/or within individual packages (package config overrides the repo config where applicable). For example:

```
packages/
  foo/
    src/
    package.json
    beachball.config.js
  bar/
    src/
    package.json
package.json
beachball.config.js
```

It's also common to have a repo-level `beachball.config.js` and any individual package overrides (if they're simple) in the `"beachball"` key in the package's `package.json`.

## Options

For the latest full list of supported options, see `RepoOptions` [in this file](https://github.com/microsoft/beachball/blob/master/src/types/BeachballOptions.ts).

| Option                  | Type                                     | Default           | Option Type          | Description                                                                                     |
| ----------------------- | ---------------------------------------- | ----------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `access`                | `'public'` or `'restricted'`             | `'restricted'`    | repo                 | publishes private packages access level                                                         |
| `branch`                | string                                   | `'origin/master'` | repo                 | the target branch (with remote)                                                                 |
| `bumpDeps`              | bool                                     | `true`            | repo                 | bump dependent packages during publish (bump A if A depends on B)                               |
| `changeFilePrompt`      | `ChangeFilePromptOptions` ([details][1]) |                   | repo                 | customize the prompt for change files (can be used to add custom fields)                        |
| `changehint`            | string                                   |                   | repo                 | hint message for when change files are not detected but required                                |
| `changelog`             | `ChangelogOptions` ([details][2])        |                   | repo                 | changelog rendering and grouping options                                                        |
| `defaultNpmTag`         | string                                   | `'latest'`        | package              | the default dist-tag used for NPM publish                                                       |
| `disallowedChangeTypes` | string[]                                 |                   | repo, group, package | what change types are disallowed                                                                |
| `fetch`                 | bool                                     | `true`            | repo                 | fetch from remote before doing diff comparisons                                                 |
| `generateChangelog`     | bool                                     | `true`            | repo                 | whether to generate changelog files                                                             |
| `gitTags`               | bool                                     | `true`            | repo, package        | whether to create git tags for published packages (eg: foo_v1.0.1)                              |
| `groups`                | `VersionGroupOptions[]` ([details][3])   |                   | repo                 | specifies groups of packages that need to be version bumped at the same time                    |
| `groupChanges`          | bool                                     | `false`           | repo                 | will write multiple changes to a single changefile                                              |
| `hooks`                 | `HooksOptions` ([details][4])            |                   | repo                 | hooks for custom pre/post publish actions                                                       |
| `ignorePatterns`        | string[]                                 |                   | repo                 | ignore changes in these files (minimatch patterns; negations not supported)                     |
| `package`               | string                                   |                   | repo                 | specifies which package the command relates to (overrides change detection based on `git diff`) |
| `prereleasePrefix`      | string                                   |                   | repo                 | prerelease prefix for packages that are specified to receive a prerelease bump                  |
| `publish`               | bool                                     | `true`            | repo                 | whether to publish to npm registry                                                              |
| `push`                  | bool                                     | `true`            | repo                 | whether to push to the remote git branch                                                        |
| `registry`              | string                                   |                   | repo                 | target NPM registry to publish                                                                  |
| `retries`               | number                                   | `3`               | repo                 | number of retries for a package publish before failing                                          |
| `shouldPublish`         | false \| undefined                       |                   | package              | manually disable publishing of a package by beachball (does not work to force publishing)       |
| `tag`                   | string                                   | `'latest'`        | repo, package        | dist-tag for npm when published                                                                 |
| `transform`             | `TransformOptions` ([details][4])        |                   | repo                 | transformations for change files                                                                |
| `indentation`           | number                                   | 2                 | repo                 | a custom indentendation for the beachball generated files |

[1]: https://github.com/microsoft/beachball/blob/master/src/types/ChangeFilePrompt.ts
[2]: https://github.com/microsoft/beachball/blob/master/src/types/ChangelogOptions.ts
[3]: ../concepts/groups
[4]: https://github.com/microsoft/beachball/blob/master/src/types/BeachballOptions.ts
