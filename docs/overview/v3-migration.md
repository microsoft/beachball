---
tags:
  - overview
category: doc
---

# V3 migration guide

This page describes how to migrate from beachball v2 to v3.

## Changelog

For the full list of changes between v2 and v3, see the [beachball CHANGELOG.md](https://github.com/microsoft/beachball/blob/main/packages/beachball/CHANGELOG.md).

## Running the migrate command

beachball v3 includes a `migrate` command that checks your config and logs any updates needed for v3:

```bash
beachball migrate
```

If your config is already compatible, you will see:

```
No config updates are needed for v3.
```

Otherwise, the command will list specific config updates that are needed. The command doesn't attempt to make updates directly due to the variety of locations and file types where the config can be specified.
