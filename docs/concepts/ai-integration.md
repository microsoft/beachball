---
tags:
  - overview
category: doc
---

# AI integration

Normally, Beachball uses an interactive CLI prompt for generating change files. Since this doesn't work for AI agents, we provide a **change file skill** that guides AI agents through creating properly formatted change files. The skill should be used automatically when you ask to generate a change file.

## Plugin marketplace (Claude Code or Copilot CLI)

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

## Direct skill link

If your tool doesn't support plugin marketplaces, or you'd like to view the skill content first, you can reference the [skill markdown file](https://github.com/microsoft/beachball/blob/main/.claude/skills/beachball-change-file/SKILL.md) directly.
