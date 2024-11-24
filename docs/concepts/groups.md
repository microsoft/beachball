---
tags:
  - groups
  - lock step
category: doc
---

# Groups

`beachball` supports different ways of grouping packages together or limiting the packages considered.

- [**Version groups**](#version-groups) allow bumping packages together.
- [**Grouped changelogs**](#grouped-changelogs) allow grouping changelog entries for multiple packages into a single file.

You can also use [**scoping**](../overview/configuration#scoping) to limit which packages are considered, either for a specific operation or at all.

## Version groups

By default, all packages in the repository are only bumped based on the changes specified in their own [change files](./change-files) (or if their in-repo dependencies are bumped and `bumpDeps` is enabled). Developers are expected to create change files specifying the bump type for each package as they go.

For cases where it's necessary to bump packages together, `beachball` also provides a concept of version groups. Whenever one package in a group is bumped, the versions of all packages in the group will be updated with the **same bump type**.

> Note: this is slightly different from lock step versioning (where all packages use the exact same version): `beachball` only applies the same bump _type_ to each package's current version. There's an open [feature request](https://github.com/microsoft/beachball/issues/214) discussing full lock step versioning.

> Note: a package cannot belong to multiple groups - `beachball` will not allow its commands to work with that configuration

### Configuring version groups

Groups can be added to the [configuration file](../overview/configuration). See the [`VersionGroupOptions` source](https://github.com/microsoft/beachball/blob/master/src/types/ChangelogOptions.ts) for full details.

| Name                    | Type                         | Description                                                                                                                              |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | `string`                     | Name of the version group                                                                                                                |
| `include`               | `string \| string[] \| true` | glob pattern(s) for package paths to include (see [notes on globs][1]). If `true`, include all packages except those matching `exclude`. |
| `exclude`               | `string \| string[]`         | glob pattern(s) for package paths to exclude (see [notes on globs][1]).                                                                  |
| `disallowedChangeTypes` | `ChangeType[] \| null`       | Disallow these change types for the group.                                                                                               |

Example:

```json
{
  "groups": [
    {
      "name": "group name",
      "include": ["packages/groupfoo/*"],
      "exclude": ["packages/groupfoo/bar"],
      "disallowedChangeTypes": ["major"]
    }
  ]
}
```

Note that if you want [grouped changelogs](#grouped-changelogs) for your version groups, this must be configured separately as explained below.

If you only want to publish or record changes for certain packages, you should use [scoping](../overview/configuration#scoping) instead.

## Grouped changelogs

To show changes for multiple packages in one change file, use the `changelog.groups` option. See the [`ChangelogGroupOptions` source](https://github.com/microsoft/beachball/blob/master/src/types/ChangelogOptions.ts) for full details.

| Name                | Type                         | Description                                                                                                                              |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `masterPackageName` | `string`                     | The main package which a group of changes bubbles up to.                                                                                 |
| `include`           | `string \| string[] \| true` | glob pattern(s) for package paths to include (see [notes on globs][1]). If `true`, include all packages except those matching `exclude`. |
| `exclude`           | `string \| string[]`         | glob pattern(s) for package paths to exclude (see [notes on globs][1]).                                                                  |
| `changelogPath`     | `string`                     | Put the grouped changelog file under this directory. Can be relative to the root, or absolute.                                           |

In this example, changelogs for all packages under `packages/*` (except `packages/baz`) are written to a `CHANGELOG.md` at the repo root (`.`), with `foo` as the master package. (To replace `foo`'s usual changelog with a grouped one, you'd specify `changelogPath` as the path to `foo` instead, e.g. `packages/foo`.)

```json
{
  "changelog": {
    "groups": [
      {
        "masterPackageName": "foo",
        "changelogPath": ".",
        "include": ["packages/*"],
        "exclude": ["packages/baz"]
      }
    ]
  }
}
```

The result looks something like this:

```md
# Change Log - foo

## 1.1.0

Tue, 19 Nov 2024 08:03:08 GMT

### Minor changes

- `foo`
  - some change (example@example.com)
  - other change (example@example.com)
- `bar`
  - bar change (example@example.com)
```

[1]: ../overview/configuration#glob-matching
