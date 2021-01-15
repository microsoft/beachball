<!--
If making changes, don't forget to update the version under packages/beachball/README.md too!
-->

# beachball

the sunniest version bumping tool

## Prerequisites

git and a remote named "origin"

## Usage

```
beachball [command] [options]
```

## Commands

### change (default)

a tool to help create change files in the change/ folder

### check

checks whether a change file is needed for this branch

### changelog

based on change files, create changelogs and then unlinks the change files

### bump

bumps versions as well as generating changelogs

### publish

bumps, publishes to npm registry (optionally does dist-tags), and pushes changelogs back into master

### sync

synchronizes published versions of packages from a registry, makes local package.json changes to match what is published

## Options

### --registry, -r

registry, defaults to https://registry.npmjs.org

### --tag, -t

- for the publish command: dist-tag for npm publishes
- for the sync command: will use specified tag to set the version

### --branch, -b

target branch from origin (default: master)

### --message, -m

- for the publish command: custom message for the checkin (default: applying package updates)
- for the change command: uses the given changelog msessage instead of prompting

### --no-push

skip pushing changes back to git remote origin

### --no-publish

skip publishing to the npm registry

### --help, -?, -h

show help message

### --yes, -y

skips the prompts for publish

### --type
Allows specifying a default type for the "change" command to avoid prompting. Multiple types may be
specified in order of preference, where the first allowed by a package is picked.

## Examples

```
  $ beachball

  $ beachball check

  $ beachball publish -r http://localhost:4873 -t beta
```

<!--
If making changes, don't forget to update the version under packages/beachball/README.md too!
-->
