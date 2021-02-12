---
tags: cli
category: doc
---

# `publish`

Publishing automates all the bumping and synchronizing of package versions in git remotes as well as the npm registry. The steps taken by the publish command are designed to be run so that it minimizes the chances of failure by doing validation upfront.

By publishing, it'll perform the following tasks:

1. Validate that there are no local changes
2. Validate that the versions to be bumped are in fact available in the npm registry
3. Bumps the package versions
4. Generate package changelog files
5. Revert all these changes
6. Fetch latest git changes on the remote target branch
7. Perform the exact same thing in steps 3 & 4
8. Push these changes back to the remote target branch

It might be surprising that `beachball publish` does so many steps, especially the step about reverting changes! In most version bumping systems that automates git repo version with npm registry, they assume that the source code is fresh by the time they push the changes back to the git repository. This is almost never the case when the build takes more than a few minutes! So, `beachball` fetches latest before we push back to the target branch. In large systems, it has been observed that without the git fetch, it becomes a source of conflict.

All the options for publish are documented in the CLI [options](./options) page
