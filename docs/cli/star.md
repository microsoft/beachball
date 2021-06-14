---
tags: cli
category: doc
---

# `star`

Depending on how CI is set up in a repo, it's possible that when beachball is in the process of bumping versions against main branch that is also used by developers, beachball could tag an incorrect commit and/or developers could get merge conflicts due to changed package.json.

One possible solution is to set up separate branches so that developers work against a "dev" branch and CI would run beachball against a "main" branch. On "dev" branch, use `star` command to update all workspace dependencies in package.json files and reference them by `*` instead of an actual version. When CI runs, use `sync` command with `--replace-stars` to ensure dependencies versions are restored from "dev" branch.
