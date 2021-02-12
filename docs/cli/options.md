---
title: 'Common Options'
tags: cli
category: doc
---

# All Beachball CLI Options

This is a listing of all the options available. Not every option applies to all the commands.

###### `--registry, -r`

registry, defaults to https://registry.npmjs.org

###### `--tag, -t`

dist-tag for npm publishes

###### `--no-git-tags`

don't create git tags for published packages

###### `--branch, -b`

target branch from origin (default: origin/master)

###### `--message, -m`

custom message for the checkin (default: "applying package updates")

###### `--no-push`

skip pushing changes back to git remote origin

###### `--no-publish`

skip publishing to the npm registry

###### `--help, -?, -h`

show help message

###### `--yes, -y`

skips the prompts for publish

###### `--prerelease-prefix`

sets a prerelease prefix for packages that are expected to receive a prerelease bump (for example, --prerelease-prefix "beta" will produce the "x.y.z-beta.prerelease" version)
