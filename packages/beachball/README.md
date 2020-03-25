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

## Options

### --registry, -r

registry, defaults to https://registry.npmjs.org

### --tag, -t

dist-tag for npm publishes

### --branch, -b

target branch from origin (default: master)

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
