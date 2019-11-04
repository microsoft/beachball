import { bump } from './bump';
import { CliOptions } from './CliOptions';
import { findGitRoot } from './paths';
import { getUntrackedChanges, getDefaultRemoteBranch } from './git';
import {
  isChangeFileNeeded as checkChangeFileNeeded,
  isGitAvailable,
  isValidPackageName,
  isValidChangeType,
} from './validation';
import { promptForChange, writeChangeFiles } from './changefile';
import { publish } from './publish';
import parser from 'yargs-parser';

let argv = process.argv.splice(2);
let args = parser(argv, {
  string: ['branch', 'tag', 'message', 'package'],
  alias: {
    branch: ['b'],
    tag: ['t'],
    registry: ['r'],
    message: ['m'],
    token: ['n'],
    help: ['h', '?'],
    yes: ['y'],
    package: ['p'],
    version: ['v'],
  },
});

if (args.help) {
  showHelp();
  process.exit(0);
}

if (args.version) {
  showVersion();
  process.exit(0);
}

const defaultCommand = 'change';
const cwd = findGitRoot(process.cwd()) || process.cwd();

const branch = args.branch && args.branch.indexOf('/') > -1 ? args.branch : getDefaultRemoteBranch(args.branch, cwd);
console.log(`Target branch is "${branch}"`);

const options: CliOptions = {
  branch,
  command: args._.length === 0 ? defaultCommand : args._[0],
  message: args.message || '',
  path: cwd,
  publish: args.publish === false ? false : true,
  push: args.push === false ? false : true,
  registry: args.registry || 'https://registry.npmjs.org/',
  tag: args.tag,
  token: args.token || '',
  yes: args.yes === true || false,
  access: args.access || 'restricted',
  package: args.package || '',
  changehint: args.changehint || 'Run "beachball change" to create a change file',
  type: args.type || null,
  fetch: args.fetch !== false,
  version: args.version === true || false,
};

(async () => {
  // Validation Steps

  if (!isGitAvailable(options.path)) {
    console.error('ERROR: Please make sure git is installed and initialize the repository with "git init".');
    process.exit(1);
  }

  const untracked = getUntrackedChanges(options.path);

  if (untracked && untracked.length > 0) {
    console.warn('WARN: There are untracked changes in your repository:');
    console.warn('- ' + untracked.join('\n- '));
    console.warn('Changes in these files will not trigger a prompt for change descriptions');
  }

  const isChangeNeeded = checkChangeFileNeeded(options.branch, options.path, options.fetch);

  if (isChangeNeeded && options.command !== 'change') {
    console.error('ERROR: Change files are needed!');
    console.log(options.changehint);

    process.exit(1);
  }

  if (options.package && !isValidPackageName(options.package, options.path)) {
    console.error('ERROR: Specified package name is not valid');
    process.exit(1);
  }

  if (options.type && !isValidChangeType(options.type)) {
    console.error(`ERROR: change type ${options.type} is not valid`);
    process.exit(1);
  }

  switch (options.command) {
    case 'check':
      console.log('No change files are needed');
      break;

    case 'publish':
      // set a default publish message
      options.message = options.message || 'applying package updates';
      publish(options);
      break;

    case 'bump':
      bump(options.path);
      break;

    default:
      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

      const changes = await promptForChange(options);

      if (changes) {
        writeChangeFiles(changes, options.path);
      }

      break;
  }
})();

function showVersion() {
  const packageJson = require('../package.json');
  console.log(`beachball v${packageJson.version} - the sunniest version bumping tool`);
}

function showHelp() {
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
