# `yarn-plugin-engines`

Recursively find non-dev dependencies of published packages within the repo, and verify that any `engines.node` requirements match the version from the root `package.json`'s `engines.node`. (Yarn v1 would verify this automatically, but [v2+ does not](https://github.com/yarnpkg/berry/issues/1177)...)

## Install

Usually you'll want the minified version of the plugin:

```
yarn plugin import https://raw.githubusercontent.com/microsoft/beachball/yarn-plugin-engines_v0.3.0/yarn-plugins/engines/dist/plugin.js
```

If you'd like a non-minified version for debugging:

```
yarn plugin import https://raw.githubusercontent.com/microsoft/beachball/yarn-plugin-engines_v0.3.0/yarn-plugins/engines/dist/plugin.dev.js
```

## Options

Optional configuration in `.yarnrc.yml`:

```yml
engines:
  # By default, local devDependencies and private packages are excluded.
  # Set this to include them.
  includeDevDependencies: true
  # Ignore these package names and their dependencies when checking engines
  ignorePackages:
    - pkg1
    - pkg2
  # If true, only validate that the minimum allowed Node version for the repo
  # satisfies the manifest requirements, instead of requiring the full ranges
  # to overlap. This is useful if e.g. the repo specifies >=20 but some manifest
  # specifies ^20 || >=22.
  loose: true
  # Include verbose warnings (such as for missing optional deps)
  verbose: true
```
