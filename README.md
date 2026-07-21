# [beachball](https://microsoft.github.io/beachball/) monorepo

the sunniest version bumping tool - see [`packages/beachball`](./packages/beachball) for details

## `main` is currently the development branch for beachball v3 (alpha)

The code for beachball v2 (`latest`) is in the `v2` branch. If you're making a PR with a non-breaking change, it should target the `v2` branch.

Try it out with `beachball@next`, and see the [migration guide](./docs/overview/v3-migration.md) for more details.

## Other tools in this repo

A few other dependency-management-related tools are also hosted in this repo for easier maintenance.

### [`beachball-change-file` skill](./skills/beachball-change-file/SKILL.md)

AI agents can't use interactive prompts, so this skill walks them through generating a change file. See [AI integration docs](https://microsoft.github.io/beachball/concepts/ai-integration) for details.

### [`proper-changelog`](./packages/proper-changelog)

GitHub releases are useful in some ways, but they're horrible as changelogs if you need to look at changes across multiple versions or figure out when a specific change was introduced. This tool reads GitHub releases and generates a single markdown changelog.

### Packages

- [`p-graph`](./packages/p-graph) - promise graph used by beachball
- [`@microsoft/esrp-npm-release`](./packages/esrp-npm-release) - for Microsoft teams using ESRP Release

### GitHub actions

- [`microsoft/beachball/actions/check-for-modified-files`](./actions/check-for-modified-files) - checks for modified files in a PR and fails if any are found
- [`microsoft/beachball/actions/install-beachball`](./actions/install-beachball) - install the correct version of beachball for a standalone "check change files" workflow
- [`microsoft/beachball/actions/should-release`](./actions/should-release) - determines whether a release workflow run is needed based on presence of change files or other files

### [Renovate presets](./renovate)

These Renovate presets (moved from [microsoft/m365-renovate-config](https://github.com/microsoft/m365-renovate-config)) predate some of Dependabot's expanded capabilities and are still used by some repos.
