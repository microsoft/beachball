---
tags:
  - overview
category: doc
---

# AI integration

Normally, Beachball uses an interactive CLI prompt for generating change files. Since this doesn't work for AI agents, we provide a **change file skill** that guides AI agents through creating change files. The skill should be used automatically when you ask to generate a change file.

## Installation

### GitHub CLI

Install the skill using the [Agent Skills](https://agentskills.io/) format supported by the GitHub CLI:

```sh
gh skill install microsoft/beachball beachball-change-file
```

This installs the skill for any compatible AI agent (GitHub Copilot, Claude Code, etc.).

Note that the skill does not have dedicated tags, so if you want to pin the version, it's best to use a SHA:

```sh
gh skill install microsoft/beachball beachball-change-file --pin abc123
```

To update:

```sh
gh skill update beachball-change-file
```

### Built-in for this repo

If you're working in the beachball repo itself, the skill is available automatically from the `skills/` directory at the repo root.

### Direct skill link

If you'd like to inspect or manually import the skill, you can view the [SKILL.md](https://github.com/microsoft/beachball/blob/main/skills/beachball-change-file/SKILL.md) file directly.

## How it works

The skill has instructions for checking which packages have changed and generating a change file with the appropriate type and comment based on each package's diffs (respecting settings such as `disallowedChangeTypes`).

The instructions direct the agent to create a change file manually, instead of using the CLI. This is because `beachball change` has the limitation that it can only accept a single `--type` and `--message` (applied to either all changed packages, or specific package(s) via `--package`). Using a single type and message for all packages is not ideal, and the downside of running multiple times with `--package` is that there would be a separate change file created each time.
