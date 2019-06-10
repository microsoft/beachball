import { promptForChange, writeChangeFiles } from './changefile';
import { getUncommittedChanges } from './git';
import { isChangeFileNeeded, isGitAvailable } from './validation';
import { bump, getPackageInfos } from './bump';
import parser from 'yargs-parser';
import { findPackageRoot } from './paths';
import { publish } from './publish';
import { writeChangelog } from './changelog';
import { CliOptions } from './CliOptions';

let argv = process.argv.splice(2);
let args = parser(argv, {
  alias: {
    path: ['p'],
    branch: ['b'],
    tag: ['t'],
    registry: ['r'],
    message: ['m'],
    help: ['h', '?']
  }
});

if (args.help) {
  showHelp();
  process.exit(0);
}

const defaultCommand = 'change';

const options: CliOptions = {
  command: args._.length === 0 ? defaultCommand : args._[0],
  registry: args.registry || 'http://registry.npmjs.org',
  branch: args.branch || 'master',
  tag: args.tag || 'latest',
  path: args.path || findPackageRoot(process.cwd()),
  message: args.message || 'applying package updates'
};

(async () => {
  if (!isGitAvailable(options.path)) {
    console.error('Please make sure git is installed and initialize the repository with "git init".');
    process.exit(1);
  }

  const uncommitted = getUncommittedChanges(options.path);

  if (uncommitted && uncommitted.length > 0) {
    console.warn('There are uncommitted changes in your repository. Please commit these files first:');
    console.warn('- ' + uncommitted.join('\n- '));
    return;
  }

  if (isChangeFileNeeded(options.branch, options.path) && options.command !== 'change') {
    console.log('Change files are needed!');
    process.exit(1);
  }

  switch (options.command) {
    case 'check':
      console.log('No change files are needed');
      break;

    case 'changelog':
      const packageInfos = getPackageInfos(options.path);
      writeChangelog(packageInfos, options.path);

    case 'publish':
      publish(options);
      break;

    case 'bump':
      bump(options.path);
      break;

    default:
      if (!isChangeFileNeeded(options.branch, options.path)) {
        console.log('No change files are needed');
        return;
      }

      const changes = await promptForChange(options.branch, options.path);

      if (changes) {
        writeChangeFiles(changes, options.path);
      }

      break;
  }
})();

function showHelp() {
  const packageJson = require('../package.json');
  console.log(`beachball v${packageJson.version} - the sunniest version bumping tool

Prerequisites:

  git and a remote named "origin"

Usage:

  beachball [command] [options]

Commands:

  change (default)    - a tool to help create change files in the change/ folder
  check               - checks whether a change file is needed for this branch
  changelog           - based on change files, create changelogs and then unlinks the change files
  bump                - bumps versions as well as generating changelogs
  publish             - bumps, publishes to npm registry (optionally does dist-tags), and pushes changelogs back into master

Options:

  --registry, -r      - registry, defaults to https://registry.npmjs.org
  --tag, -t           - dist-tag for npm publishes
  --branch, -b        - target branch from origin (default: master)
  --message, -m       - custom message for the checkin (default: applying package updates)
  --help, -?, -h      - this very help message

Examples:

  $ beachball
  $ beachball check
  $ beachball publish -r http://localhost:4873 -t beta -b beta

`);
}
