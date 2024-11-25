---
title: 'Common options'
tags:
  - cli
category: doc
---

# Beachball CLI options

For the latest full list of supported options, see `CliOptions` [in this file](https://github.com/microsoft/beachball/blob/master/src/types/BeachballOptions.ts).

**Most options can also be specified in the [configuration file](../overview/configuration)**, which is generally preferable as it's easier to read and maintain.

## General options

The options below apply to most CLI commands.

| Option          | Alias | Default                   | Description                                                                                  |
| --------------- | ----- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `--branch, -b`  | `-b`  |                           | target branch; see [config docs][1] for details                                              |
| `--config-path` | `-c`  | [cosmiconfig][2] defaults | custom beachball config path                                                                 |
| `--no-fetch`    |       |                           | skip fetching from the remote                                                                |
| `--change-dir`  |       | `'change'`                | name of the directory to store change files                                                  |
| `--scope`       |       |                           | only consider matching package paths (can be specified multiple times); see [config docs][3] |
| `--since`       |       |                           | only consider changes or change files since this git ref (branch name, commit SHA)           |
| `--verbose`     |       |                           | prints additional information to the console                                                 |

[1]: ../overview/configuration#determining-the-target-branch-and-remote
[2]: https://www.npmjs.com/package/cosmiconfig
[3]: ../overview/configuration#scoping
