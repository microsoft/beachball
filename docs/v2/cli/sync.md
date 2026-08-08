---
tags:
  - cli
category: doc
---

# `sync`

Synchronizes the local version number of each package to the current version of the given `dist-tag` in the npm registry. This is useful for helping get a repo back into a valid state after publishing fails partway through.

By default, the local version will only be updated if it's **older** than the version the specified `dist-tag` points to. Use `--force` to override this behavior.

After syncing, be sure to commit and push the changes.

### Options

In addition to the options below, certain [common options](./options) also apply.

Most options can also be specified in the [configuration file](../overview/configuration), which is generally preferable as it's easier to read and maintain.

<!-- prettier-ignore -->
| Option | Alias | Default | Description |
| ------ | ----- | ------- | ----------- |
| `--force` | | `false` | Skip the version comparison and use the version from the registry as-is. |
| `--registry` | `-r` | `'https://registry.npmjs.org'` | Custom/private registry to use. You may also need to [configure authentication](../concepts/ci-integration#npm-authentication) using options shared with the `publish` command. |
| `--tag` | `-t` | `tag` from repo, group, or package level beachball configs if present, falling back to `'latest'` | Sync with the version this `dist-tag` points to. |
