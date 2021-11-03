---
title: 'Common Options'
tags: cli
category: doc
---

# Beachball CLI Options

For the latest full list of supported options, see `CliOptions` [in this file](https://github.com/microsoft/beachball/blob/master/src/types/BeachballOptions.ts).

## General options

These apply to most CLI commands.

| Option     | Alias      | Default           | Description               |
| ---------- | ---------- | ----------------- | ------------------------- |
| `--branch` | `-b`       | `'origin/master'` | target branch from origin |
| `--help`   | `-?`, `-h` |                   | show help message         |

## Change options

These options are applicable to the `change` command.

| Option      | Alias | Default              | Description                                                    |
| ----------- | ----- | -------------------- | -------------------------------------------------------------- |
| `--message` | `-m`  | (interactive prompt) | Description for all change files                               |
| `--type`    |       | (interactive prompt) | Type for all the change files (must be valid for each package) |

## Bumping and publishing options

These options are applicable for the `publish` command, as well as `bump` and/or `canary` in some cases.

| Option                        | Alias | Default                        | Description                                                                                                                                |
| ----------------------------- | ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `--authType`                  | `-a`  | `'authtoken'`                  | type of token argument, affecting how it is applied to npm commands.                                                                       |
| `--message`                   | `-m`  | `'applying package updates'`   | custom message for the checkin                                                                                                             |
| `--git-tags`, `--no-git-tags` |       | `true` (`--git-tags`)          | whether to create git tags for published packages                                                                                          |
| `--publish`, `--no-publish`   |       | `true` (`--publish`)           | whether to publish to the npm registry                                                                                                     |
| `--push`, `--no-push`         |       | `true` (`--push`)              | whether to push changes back to git remote origin                                                                                          |
| `--prerelease-prefix`         |       |                                | prerelease prefix for packages that are specified to receive a prerelease bump (`--prerelease-prefix beta` makes the `x.y.z-beta` version) |
| `--registry`                  | `-r`  | `'https://registry.npmjs.org'` | npm registry for publishing                                                                                                                |
| `--retries`                   |       | `3`                            | number of retries for a package publish before failing                                                                                     |
| `--tag`                       | `-t`  | `'latest'`                     | dist-tag for npm publishes                                                                                                                 |
| `--token`                     | `-n`  |                                | credential to use with npm commands. its type is specified with the `--authType` argument                                                  |
| `--verbose`                   |       | `false`                        | prints additional information to the console                                                                                               |
| `--yes`                       | `-y`  |                                | skips the prompts for publish                                                                                                              |
