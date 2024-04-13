---
tags:
  - cli
category: doc
---

# `publish`

Publishing automates all the bumping and synchronizing of package versions in the git remote as well as the npm registry.

### Options

See the [options page](./options).

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

### Dry run

If you'd like to do a dry run of publishing, the `--dry-run` option works as follows:

1. Makes all changes locally
2. Runs `npm publish --dry-run` (skipped if the `publish` option is disabled)
3. Commits the changes locally and merges them into the target branch, but does _not_ tag or push (skipped if the `bump` or `push` option is disabled)
4. Stays on the current branch (and doesn't delete the publish branch) so you can inspect changes

### Example CI workflow

See the [CI integration page](../concepts/ci-integration) details and examples for how to run `beachball publish` in CI.

### Recovering from failed publish

If the `publish` command fails partway through, after some versions have been published to the registry, you'll need to run [`beachball sync`](./sync) and commit the changes.
