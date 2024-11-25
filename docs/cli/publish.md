---
tags:
  - cli
category: doc
---

# `publish`

Publishing automates all the bumping and synchronizing of package versions in the git remote as well as the npm registry.

### Options

[General options](./options) also apply for this command.

| Option                        | Alias | Default                        | Description                                                                      |
| ----------------------------- | ----- | ------------------------------ | -------------------------------------------------------------------------------- |
| `--auth-type`                 | `-a`  | `'authtoken'`                  | npm auth type: `'authtoken'` or `'password'`                                     |
| `--git-tags`, `--no-git-tags` |       | `true` (`--git-tags`)          | whether to create git tags for published package versions                        |
| `--keep-change-files`         |       |                                | don't delete the change files from disk after bumping                            |
| `--message`                   | `-m`  | `'applying package updates'`   | custom commit message                                                            |
| `--prerelease-prefix`         |       |                                | prerelease prefix (e.g. `beta`) for packages that will receive a prerelease bump |
| `--publish`, `--no-publish`   |       | `true` (`--publish`)           | whether to publish to the npm registry                                           |
| `--push`, `--no-push`         |       | `true` (`--push`)              | whether to commit changes and push them back to the git remote                   |
| `--registry`                  | `-r`  | `'https://registry.npmjs.org'` | npm registry for publishing                                                      |
| `--retries`                   |       | `3`                            | number of retries for a package publish before failing                           |
| `--tag`                       | `-t`  | `'latest'`                     | dist-tag for npm publishes                                                       |
| `--token`                     | `-n`  |                                | credential to use with npm commands (type specified by `--auth-type`)            |
| `--verbose`                   |       | `false`                        | prints additional information to the console                                     |
| `--yes`                       | `-y`  | if CI detected, `true`         | skips the prompts for publish                                                    |

### Algorithm

The `publish` command is designed to run steps in an order that minimizes the chances of mid-publish failure by doing validation upfront.

`beachball publish` performs the following steps:

1. Validate that options and change files are valid
2. Bump and publish to npm (unless disabled):
   1. Bump the package versions locally
   2. Generate the changelog files (unless disabled)
   3. Delete change files locally (unless disabled)
   4. Validate that nothing to be published depends on a private package
   5. Publish packages to npm in topological order based on the dependency graph (to reduce the chances that if there's a failure partway through, a published package might require unpublished versions)
3. Bump and push to git (unless bumping or pushing is disabled):
   1. Revert any previous changes (from the publish step)
   2. Merge the latest changes from the remote branch to avoid merge conflicts (unless fetching is disabled)
   3. Bump the versions locally
   4. Generate the changelog files (unless disabled)
   5. Delete change files locally (unless disabled)
   6. Commit the changes
   7. Create git tags for new package versions (unless disabled)
   8. Push the changes and tags

It might be surprising that `beachball publish` does so many steps, especially the step about reverting changes! In most version bumping systems that automate syncing the git repo and npm registry, they assume that the source code is still fresh once it's time to push changes back to the git repository. This is rarely the case for large repos with many developers. So, `beachball` fetches the latest changes before pushing back to the target branch to avoid merge conflicts.

### Example CI workflow

See the [CI integration page](../concepts/ci-integration) details and examples for how to run `beachball publish` in CI.

### Recovering from failed publish

If the `publish` command fails partway through, after some versions have been published to the registry, you'll need to run [`beachball sync`](./sync) and commit the changes.
