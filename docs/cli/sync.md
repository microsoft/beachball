---
tags: cli
category: doc
---

# `sync`

Synchronizes the local version number of each package to the current version of the given `dist-tag` in the npm registry. This is useful for helping get a repo back into a valid state after publishing fails partway through.

By default, the local version will only be updated if it's **older** than the version the specified `dist-tag` points to. Use `--force` to override this behavior.

#### Options

In addition to the options below, certain [common options](./options) also apply.

##### `--force`

Force the sync command to skip the version comparison and use the version in the registry as is.

##### `--tag, -t`

Sync with the version this `dist-tag` points to. Defaults to the tag from repo, group, or package level beachball configs if present.

##### `--use-changelog-versions`

Sync package versions from changelogs (CHANGELOG.json) instead of registry.

##### `--replace-stars`

For dependencies that have `*` as versions in package.json, replace them with actual versions. See [star](./star) command for a typical flow.
