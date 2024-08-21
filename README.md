<!--
If making changes, don't forget to update the version under packages/beachball/README.md too!
-->

# [beachball](https://microsoft.github.io/beachball/)

the sunniest version bumping tool

## Prerequisites

git and a remote named "origin"

## Usage

```
beachball [command] [options]
```

## Commands

### [change](https://microsoft.github.io/beachball/cli/change.html) (default)

a tool to help create change files in the change/ folder

### [check](https://microsoft.github.io/beachball/cli/check.html)

checks whether a change file is needed for this branch

### [bump](https://microsoft.github.io/beachball/cli/bump.html)

bumps versions as well as generating changelogs

### [publish](https://microsoft.github.io/beachball/cli/publish.html)

bumps, publishes to npm registry (optionally does dist-tags), and pushes changelogs back into the default branch

### [sync](https://microsoft.github.io/beachball/cli/sync.html)

synchronizes published versions of packages from a registry, makes local package.json changes to match what is published

## Options

Some of the most common options are summarized below. For details, see the pages for [CLI options](https://microsoft.github.io/beachball/cli/options.html) and [config file options](https://microsoft.github.io/beachball/overview/configuration.html).

### --config, -c

Explicit configuration file to use instead of the configuration automatically detected by cosmicconfig.

### --registry, -r

registry, defaults to https://registry.npmjs.org

### --tag, -t

- for the publish command: dist-tag for npm publishes
- for the sync command: will use specified tag to set the version

### --branch, -b

target branch from origin (default: as configured in 'git config init.defaultBranch')

### --message, -m

custom message for the checkin (default: applying package updates)

### --no-push

skip pushing changes back to git remote origin

### --no-publish

skip publishing to the npm registry

### --help, -?, -h

show help message

### --yes, -y

skips the prompts for publish

## Examples

```
  $ beachball

  $ beachball check

  $ beachball publish -r http://localhost:4873 -t beta
```

<!--
If making changes, don't forget to update the version under packages/beachball/README.md too!
-->
