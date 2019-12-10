import { cosmiconfigSync } from 'cosmiconfig';

import parser from 'yargs-parser';
import { CliOptions } from './CliOptions';
import { findGitRoot } from './paths';
import { getDefaultRemoteBranch } from './git';
import { showVersion, showHelp } from './help';

export function getOptions() {
  const argv = process.argv.splice(2);
  const args = parser(argv, {
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
    bumpDeps: args.bumpDeps === false ? false : true,
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

  const configExplorer = cosmiconfigSync('beachball');
  const searchResults = configExplorer.search();

  if (searchResults && searchResults.config) {
    return { ...searchResults.config, ...options };
  }

  return options;
}

export function getPackageOptions(packagePath: string) {
  const options = getOptions();
  const configExplorer = cosmiconfigSync('beachball');
  const searchResults = configExplorer.search(packagePath);

  if (searchResults && searchResults.config) {
    return { ...searchResults.config, ...options };
  }
}
