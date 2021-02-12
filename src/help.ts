import { BeachballOptions } from './types/BeachballOptions';

export function showVersion() {
  const packageJson = require('../package.json');
  console.log(`beachball v${packageJson.version} - the sunniest version bumping tool`);
}

const commandHelp = {
  change: 'a tool to help create change files in the change/ folder',
  check: 'checks whether a change file is needed for this branch',
  bump: 'bumps versions as well as generating changelogs',
  publish:
    'bumps, publishes to npm registry (optionally does dist-tags), and pushes changelogs back into the default branch',
  sync: 'gets published versions of local packages from a registry and updates package.json files to match what is published',
};

export function showHelp(options: BeachballOptions) {
  showVersion();

  const command = options.command;
  console.log(`Prerequisites:

  git and a remote named "origin"

Usage:

  beachball ${command || '[command]'} [options]
`);

  if (!command) {
    console.log(`
Commands:

  change (default)    - ${commandHelp.change}
  check               - ${commandHelp.check}
  bump                - ${commandHelp.bump}
  publish             - ${commandHelp.publish}
  sync                - ${commandHelp.sync}

Run \`beachball --help [command]\` to get help with a specific command.

Examples:

  $ beachball
  $ beachball check
  $ beachball publish -r http://localhost:4873 -t beta -b beta
`);
  } else {
  }

  console.log(`
Common options:
  --branch, -b                    - target branch from origin (default: master)
  --verbose                       - prints additional information to the console
  --help, -?, -h                  - help for a command
`);
  console.log(`
Options:

  --registry, -r                  - registry, defaults to https://registry.npmjs.org
  --tag, -t                       - for the publish command: dist-tag for npm publishes
                                  - for the sync command: will use specified tag to set the version
  --message, -m                   - for the publish command: custom publish message for the checkin (default: applying package updates);
                                    for the change command: description of the change
  --no-push                       - skip pushing changes back to git remote origin
  --no-publish                    - skip publishing to the npm registry
  --no-bump                       - skip both bumping versions and pushing changes back to git remote origin when publishing;
  --no-commit                     - for the change command: stage change files only without autocommitting them
  --yes, -y                       - skips the prompts for publish
  --package, -p                   - manually specify a package to create a change file; creates a change file regardless of diffs
  --changehint                    - give your developers a customized hint message when they forget to add a change file
  --since                         - for the bump command: allows to specify the range of change files used to bump packages by using git refs (branch name, commit SHA, etc);
                                    for the publish command: bumps and publishes packages based on the specified range of the change files.
  --keep-change-files             - for the bump and publish commands: when specified, both bump and publish commands do not delete the change files on the disk.
  --force                         - force the sync command to skip the version comparison and use the version in the registry as is.
  --dependent-change-type         - for the change command: override the default dependent-change-type that will end-up in the change file.
  --disallow-deleted-change-files - for the check command: verifies that no change files were deleted between head and target branch.
  --prerelease-prefix             - for the bump and publish commands: specify a prerelease prefix for packages that will receive a prerelease bump.

`);
}
