---
tags:
  - overview
category: doc
---

# AI integration

Normally, Beachball uses an interactive CLI prompt for generating change files. Since this doesn't work for AI agents, we provide a **change file skill** that guides AI agents through creating change files. The skill should be used automatically when you ask to generate a change file.

## Installation

### Plugin marketplace (Claude Code or Copilot CLI)

Add the beachball marketplace, then install the plugin:

```sh
# Claude Code
/plugin marketplace add microsoft/beachball
/plugin install beachball-change-file@beachball-plugins
# To update later:
/plugin marketplace update beachball-plugins

# Copilot CLI
copilot plugin marketplace add microsoft/beachball
copilot plugin install beachball-change-file@beachball-plugins
# To update later:
copilot plugin update beachball-change-file
```

### Direct skill link

If you'd like to inspect or manually import the skill, you can view the [skill markdown file](https://github.com/microsoft/beachball/blob/main/.claude-plugin/plugins/beachball-change-file/skills/beachball-change-file/SKILL.md) directly.

## How it works

The skill has instructions for checking which packages have changed and generating a change file with the appropriate type and comment based on each package's diffs (respecting settings such as `disallowedChangeTypes`).

The instructions direct the agent to create a change file manually, instead of using the CLI. This is because `beachball change` has the limitation that it can only accept a single `--type` and `--message` (applied to either all changed packages, or specific package(s) via `--package`). Using a single type and message for all packages is not ideal, and the downside of running multiple times with `--package` is that there would be a separate change file created each time.
