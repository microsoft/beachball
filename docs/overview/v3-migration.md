---
tags:
  - overview
category: doc
---

# V3 migration guide

This page describes how to migrate from beachball v2 to v3.

## Running the migrate command

beachball v3 includes a `migrate` command that **checks your config and logs any updates needed** for v3:

```bash
beachball migrate
```

If your config is already compatible, you will see:

```
No config updates are needed for v3.
```

Otherwise, the command will list specific config updates that are needed. The command does NOT attempt to make updates directly due to the variety of locations and file types where the config can be specified.

## Breaking changes

For the full list of changes between v2 and v3, see the [beachball CHANGELOG.md](https://github.com/microsoft/beachball/blob/main/packages/beachball/CHANGELOG.md).

<!-- TODO: go over full list of major changes before release -->

### Fix group `exclude` negation behavior

Remove the requirement for `groups[*].exclude` and `changelog.groups[*].exclude` patterns to be negated (leading `!`).

To migrate, simply remove the leading `!` from all `exclude` patterns.

### Rename `changelog.groups[*].masterPackageName` to `mainPackageName`

To migrate, find and replace `masterPackageName` to `mainPackageName`.

### `shouldPublish` behavior change

> Note: **you should almost never need this option** - in most scenarios, just set `private: true` in `package.json` instead.

In v2, the `beachball.shouldPublish: false` package option was handled inconsistently: packages didn't get change files or direct version bumps, but if a `shouldPublish: false` package was a dependent of a bumped package, it was silently bumped _and published_ anyway.

In v3, `shouldPublish: false` packages are full participants in all steps of the workflow _except_ `npm publish`:

- Change files **are** generated and required
- Version bumps, git tags, and changelogs **are** produced (same as published packages)
- The final `npm publish` (or `pack`) step is **skipped**
- If a published package has a `shouldPublish: false` package in its production dependencies, Beachball will exit with an error (same as with `private: true` deps)
- Since `shouldPublish: false` is redundant with `private: true`, `beachball migrate` reports this as an error
