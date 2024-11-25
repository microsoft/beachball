---
tags:
  - cli
category: doc
---

# `bump`

Bumps versions locally without publishing to the remote git repo or npm registry. This command will also generate changelogs.

This is the same logic that is used by the `publish` command, so it's a good practice to bump things locally to see what kind of changes will be made before those changes are published to the npm registry and the remote git repo.

Since this affects files locally only, it's up to you to synchronize the package versions in the remote git repo as well as the npm registry after running this command. (Or if you were using it for testing, simply revert the local changes and run `beachball publish`.)

```bash
$ beachball bump
```

### Options

[General options](./options) also apply for this command.

| Option                | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `--keep-change-files` | don't delete the change files from disk after bumping                            |
| `--prerelease-prefix` | prerelease prefix (e.g. `beta`) for packages that will receive a prerelease bump |
