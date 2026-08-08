---
tags:
  - cli
category: doc
---

# `config`

Inspect the effective beachball configuration. This is mainly useful if you'd like to see all the config values and defaults, or for AI agents to determine the effective setting value for a specific package.

The `config` command has two subcommands: `get` and `list`. (There's no plan to add a `set` command since the config file is usually JS.)

## `config get <name>`

Get the value of a specific config setting. If the setting can be overridden per-package or per-group, any overrides are also shown.

```bash
$ beachball config get branch
# "origin/main"

$ beachball config get disallowedChangeTypes
# Main value: null

# Group overrides:
#   my-group:
#     disallowedChangeTypes: ["major"]
#     packageNames: ["pkg-a", "pkg-b"]
```

### Options

#### `--package, -p`

Get the effective value of the setting for specific package(s). For settings like `disallowedChangeTypes`, this accounts for group membership and package-level overrides.

Can be specified multiple times.

```bash
$ beachball config get disallowedChangeTypes --package pkg-a
# pkg-a: ["major"]

$ beachball config get tag --package pkg-a --package pkg-b
# pkg-a: "beta"
# pkg-b: "latest"
```

## `config list`

List all config settings (including defaults), plus any group and per-package overrides.

The formatting is similar to YAML, but is not currently intended to be parsed (keys are not quoted).

```bash
$ beachball config list
# Main options (including defaults):
#   access: "restricted"
#   branch: "origin/main"
#   bump: true
#   ...

# Group overrides:
#   my-group:
#     packageNames: ["pkg-a", "pkg-b"]
#     disallowedChangeTypes: ["major"]

# Package overrides:
#   pkg-c:
#     tag: "beta"
```

This subcommand has no additional options.
