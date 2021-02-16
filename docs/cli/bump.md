---
tags: cli
category: doc
---

# `bump`

Bumps versions locally without publishing to the remote git repo or npm registry. This command will also generate changelogs.

This is the same logic that is used by the publish command, so it is a good practice to bump things locally to see what kind of changes are going to be done before those changes are published to the npm registry and the remote git repo. Since this affects files locally only, it is up to you to synchronize the package versions in the remote git repo as well as the npm registry.

```bash
$ beachball bump
```
