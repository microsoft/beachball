# [beachball](https://github.com/microsoft/beachball/blob/main/docs/overview/getting-started.md)

the sunniest version bumping tool

> **NOTE:** microsoft.github.io/beachball still references beachball v2. See the [doc source](https://github.com/microsoft/beachball/blob/main/docs/overview/getting-started.md) for v3.

## Prerequisites

A git repo with a remote

## Usage

```
beachball [command] [options]
```

## Commands

### [change](https://github.com/microsoft/beachball/blob/main/docs/cli/change.md) (default)

a tool to help create change files in the change/ folder

### [check](https://github.com/microsoft/beachball/blob/main/docs/cli/check.md)

checks whether a change file is needed for this branch

### [bump](https://github.com/microsoft/beachball/blob/main/docs/cli/bump.md)

bumps versions as well as generating changelogs

### [publish](https://github.com/microsoft/beachball/blob/main/docs/cli/publish.md)

bumps, publishes to npm registry, and pushes changelogs back into the target branch

### [sync](https://github.com/microsoft/beachball/blob/main/docs/cli/sync.md)

synchronizes published versions of packages from a registry, makes local package.json changes to match what is published

### [config](https://github.com/microsoft/beachball/blob/main/docs/cli/config.md)

inspect the effective beachball configuration for the repo or a specific package

## Options

Some of the most common options are summarized below. **For all options, see the pages for [CLI options](https://github.com/microsoft/beachball/blob/main/docs/cli/options.md) and [config file options](https://github.com/microsoft/beachball/blob/main/docs/overview/configuration.md).**

### `--config`, `-c`

Explicit configuration file to use instead of the configuration automatically detected by cosmicconfig.

### `--registry`, `-r` (config: `registry`)

registry, defaults to https://registry.npmjs.org

### `--tag`, `-t` (config: `tag`)

- for the `publish` command: dist-tag for npm publishes
- for the `sync` command: will use specified tag to set the version

### `--branch`, `-b` (config: `branch`)

target branch from remote (default: as configured in `git config init.defaultBranch`)

### `--message`, `-m`

- for the `publish` command: message for the checkin (default: "applying package updates")
- for the `change` command: change file comment for all changed packages

### `--type`

for the `change` command: [change type](https://github.com/microsoft/beachball/blob/main/docs/concepts/change-types.md) for all changed packages

### `--package`

for the `change` command: specific package(s) to create a change file for

### `--no-push` (config: `push`)

skip pushing changes back to git remote origin

### `--no-publish` (config: `publish`)

skip publishing to the npm registry

### `--help`, `-?`, `-h`

show help message

### `--yes`, `-y`

skips the prompts for publish

## Examples

```sh
# check for change files
beachball check

# interactively create change files
beachball change

# non-interactively create change files
beachball change --type patch --message "awesome changes"

# publish changes
beachball publish -r http://localhost:4873 -t beta
```

## Notes

### Overriding concurrency

In large monorepos, the process of fetching versions for sync or before publishing can be time-consuming due to the high number of packages. To optimize performance, you can override the concurrency for fetching from the registry by setting `options.npmReadConcurrency` (default: 5). You can also increase concurrency for hook calls and publish operations via `options.concurrency` (default: 1; respects topological order).

### Optimizing for large monorepos

If you have a large to very large monorepo, there are several configuration options and strategies that can help improve Beachball's performance. For details, see the [large repos guide](https://github.com/microsoft/beachball/blob/main/docs/concepts/large-repos.md).

### API surface

Beachball **does not** have a public API beyond the provided [options](https://github.com/microsoft/beachball/blob/main/docs/overview/configuration.md). Usage of private APIs is not supported and may break at any time.

If you need to customize something beyond what's currently supported in the options, please open a feature request or talk with the maintainers.

### AI integration

Normally, Beachball uses an interactive CLI prompt for generating change files. Since this doesn't work for AI agents, we provide a **change file skill** that guides AI agents through creating properly formatted change files. See the [AI integration](https://github.com/microsoft/beachball/blob/main/docs/concepts/ai-integration.md) docs for setup instructions.
