This folder contains the `/beachball-change-file` skill. See the [AI integration docs](https://microsoft.github.io/beachball/concepts/ai-integration) for how to use the skill.

As a hack to allow Beachball to manage changes/versions/tags without including `package.json` (and `CHANGELOG.md`) in the skill itself, there's a fake `package.json` in this directory. This will work as long as there's only one skill in the repo. The root `beachball.config.js` hooks handle updating the skill file when the version is bumped.
