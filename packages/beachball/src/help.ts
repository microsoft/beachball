export function showVersion() {
  const packageJson = require('../package.json');
  console.log(`beachball v${packageJson.version} - the sunniest version bumping tool`);
}

export function showHelp() {
  showVersion();

  console.log(`Prerequisites:

  git and a remote named "origin"

Usage:

  beachball [command] [options]

Commands:

  change (default)    - a tool to help create change files in the change/ folder
  check               - checks whether a change file is needed for this branch
  changelog           - based on change files, create changelogs and then unlinks the change files
  bump                - bumps versions as well as generating changelogs
  publish             - bumps, publishes to npm registry (optionally does dist-tags), and pushes changelogs back into master
  sync                - synchronizes published versions of packages from a registry, makes local package.json changes to match what is published

Options:

  --registry, -r      - registry, defaults to https://registry.npmjs.org
  --tag, -t           - dist-tag for npm publishes
  --branch, -b        - target branch from origin (default: master)
  --message, -m       - for publish command: custom publish message for the checkin (default: applying package updates);
                        for change command: description of the change
  --no-push           - skip pushing changes back to git remote origin
  --no-publish        - skip publishing to the npm registry
  --help, -?, -h      - this very help message
  --yes, -y           - skips the prompts for publish
  --package, -p       - manually specify a package to create a change file; creates a change file regardless of diffs
  --changehint        - give your developers a customized hint message when they forget to add a change file

Examples:

  $ beachball
  $ beachball check
  $ beachball publish -r http://localhost:4873 -t beta -b beta

`);
}
