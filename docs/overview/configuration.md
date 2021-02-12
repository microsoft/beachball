---
tags: overview
category: doc
---

# Configuration

For most uses you probably do not need any specific configuration on each package within your repository. But there are a few options to customize `beachball`'s behavior.

There are two types of configurations:

1. repository config
2. package config

## Configuration Files

Each type of configuration can be specified one of several ways. The configuration of beachball is provided by [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig), therefore, you can specify configuration in different kinds of files (and even as CLI arguments).

- `beachball` key inside `package.json`
- .beachballrc
- .beachballrc.json
- beachball.config.js

> Be consistent! We encourage you to use the same convention within the same monorepo! When in doubt, just use `beachball.config.js`.

### `beachball.config.js`

By far the most flexible of these is, of course, the type of configuration written in JavaScript (exposed as a CommonJS module). We'll concentrate on this type of configuration.

```js
module.exports = {
  key: value,
  key2: value2
  key3: value3
}
```

You can place these in either the root of a repo or within a package like so (package config overrides the repo configuration where applicable). For example:

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

## Options

| Option                | Type                                      | Alias | Default                     | Option Type          | Description                                                                                     |
| --------------------- | ----------------------------------------- | ----- | --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| branch                | string                                    |       | origin/master               |                      | The target branch (with remote)                                                                 |
| path                  | string                                    |       | (cwd)                       |                      | The directory to run beachball                                                                  |
| registry              | string                                    | r     | https://registry.npmjs.org/ |                      | Target NPM registry to publish                                                                  |
| tag                   | string                                    |       | latest                      |                      | tag for git and dist-tag for npm when published                                                 |
| token                 | string                                    | n     |                             |                      | auth token for publishing to private NPM registry                                               |
| push                  | bool                                      |       | true                        |                      | whether to push to the remote git branch (no-push to skip)                                      |
| publish               | bool                                      |       | true                        |                      | whether to publish to npm registyr (no-publish to skip)                                         |
| bumpDeps              | bool                                      |       | true                        |                      | bump dependent packages during publish (bump A if A depends on B)                               |
| fetch                 | bool                                      |       | true                        |                      | fetch from remote before doing diff comparisons                                                 |
| yes                   | bool                                      | y     | true                        |                      | non-interactively confirm publish command                                                       |
| defaultNpmTag         | string                                    |       |                             | package              | the default dist-tag used for NPM publish                                                       |
| disallowedChangeTypes | string[]                                  |       |                             | repo, group, package | what change types are disallowed                                                                |
| shouldPublish         | bool                                      |       |                             | package              | to manually handle whether or not a package should be published with beachball                  |
| access                | 'public' \| 'restricted'                  |       |                             | repo                 | publishes private packages access level                                                         |
| package               | string                                    |       |                             | repo                 | specifies which package the command relates to (overrides change detection based on `git diff`) |
| changehint            | string                                    |       |                             | repo                 | customizable hint message for when change files are not detected but required                   |
| groups                | `VersionGroupOptions[]` [(see groups)][1] |       |                             | repo                 | specifies groups of packages that need to be version bumped at the same time                    |
| gitTags               | boolean                                   |       | true                        | repo                 | whether to create git tags for published packages (eg: foo_v1.0.1)                              |

[1]: (../concepts/groups)
