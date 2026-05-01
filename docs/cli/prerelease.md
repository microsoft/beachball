---
tags:
  - cli
category: doc
---

# `prerelease`

Publishes a prerelease version (such as a canary, beta, or per-PR release) for the current change set, **without committing changes back to git or deleting change files**.

```bash
$ beachball prerelease
```

This command is useful for sharing prereleases of in-progress work — for example, a per-PR build that consumers can install to test changes before merging.

## How it works

For each package that has a change file (or that becomes modified due to dependency bumps), `beachball prerelease`:

1. Looks up the change type from the change files (just like `bump` and `publish`).
2. Computes the **target release version** by applying the change type to the current `package.json` version, after stripping any existing prerelease component. (For example, `0.2.0-beta.0` with a `minor` change type produces a target of `0.3.0`.)
3. Queries the npm registry for existing published versions that match `<target>-<prereleasePrefix>.<n>`, finds the highest counter `N`, and publishes `<target>-<prereleasePrefix>.<N+1>`.
4. Publishes to npm under the dist-tag matching `prereleasePrefix` (e.g. `beta`).

If no matching prerelease versions have been published yet, the counter starts from [`identifierBase`](#options).

The change files and `package.json` versions are **not** committed back to git. This means subsequent prerelease runs from the same change set will produce incrementing prerelease versions — useful for iterating on a PR without polluting git history.

## Workflow example

| Step | Command                                                          | Result                                                              |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1    | A developer creates a change file for a `minor` change to `foo`. | `change/foo-….json` exists; `foo` is at version `1.2.3`.            |
| 2    | CI runs `beachball prerelease --prerelease-prefix pr30`.         | `foo@1.3.0-pr30.0` is published with dist-tag `pr30`.               |
| 3    | The developer pushes another commit to the PR; CI re-runs.       | `foo@1.3.0-pr30.1` is published.                                    |
| 4    | The PR is merged; main runs `beachball publish`.                 | `foo@1.3.0` is published with dist-tag `latest`, normal git commit. |

Step 4 above demonstrates the **prerelease-to-release promotion** behavior of `bump`/`publish`: when a package's current `package.json` version contains a prerelease component (such as if `prerelease` ran on the same branch as `publish` would later run), the prerelease component is stripped before applying the bump, so the user gets the intuitive target release version.

## Options

[General options](./options) also apply for this command.

<!-- prettier-ignore -->
| Option | Default | Description |
| ------ | ------- | ----------- |
| `--prerelease-prefix` | `'prerelease'` | Suffix used for the prerelease version, e.g. `"beta"` produces `1.2.3-beta.0`. The same value is used as the npm dist-tag. |
| `--identifier-base` | `'0'` | Starting counter for prereleases when no matching versions are published yet. `'0'` (default) starts at `.0`, `'1'` starts at `.1`, or `false` omits the numeric counter entirely (in which case re-running on the same target version will error). |

## Migrating from `beachball canary`

This command replaces the old `beachball canary` command. The previous `canaryName` option has been removed; use `prereleasePrefix` instead.

In addition, `bump` and `publish` no longer support producing prerelease versions directly. If you previously used `prereleasePrefix` with `bump`/`publish`, switch to `beachball prerelease` for prerelease publishing.
