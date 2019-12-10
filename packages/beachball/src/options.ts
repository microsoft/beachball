import { cosmiconfigSync } from 'cosmiconfig';
import parser from 'yargs-parser';
import { RepoOptions, BeachballOptions, CliOptions, PackageOptions } from './BeachballOptions';
import { findGitRoot } from './paths';
import { getDefaultRemoteBranch } from './git';

export function getOptions(): BeachballOptions {
  return { ...getDefaultOptions(), ...getRootOptions(), ...getCliOptions() };
}

export function getPackageOptions(packagePath: string): PackageOptions {
  const configExplorer = cosmiconfigSync('beachball', { cache: false });
  const searchResults = configExplorer.search(packagePath);

  const defaultOptions = getDefaultOptions();
  const rootOptions = getRootOptions();

  return {
    ...defaultOptions,
    ...rootOptions,
    ...(searchResults && searchResults.config),
    ...getCliOptions(),
  };
}

function getRootOptions(): RepoOptions {
  const configExplorer = cosmiconfigSync('beachball');
  const searchResults = configExplorer.search();

  if (searchResults && searchResults.config) {
    return searchResults.config;
  }

  return {} as RepoOptions;
}

function getDefaultOptions() {
  return {
    branch: 'origin/master',
    command: 'change',
    message: '',
    publish: true,
    bumpDeps: true,
    push: true,
    registry: 'https://registry.npmjs.org/',
    token: '',
    tag: '',
    yes: false,
    access: 'restricted',
    package: '',
    changehint: 'Run "beachball change" to create a change file',
    type: null,
    fetch: true,
    version: false,
    disallowedChangeTypes: null,
    defaultNpmTag: 'latest',
  } as BeachballOptions;
}

// CLI Options cache
let cliOptions: CliOptions;

function getCliOptions(): CliOptions {
  if (cliOptions) {
    return cliOptions;
  }

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

  const { _, restArgs } = args;

  const cwd = findGitRoot(process.cwd()) || process.cwd();

  cliOptions = {
    ...(_.length === 0 && { command: _[0] }),
    ...restArgs,
    path: cwd,
    branch: args.branch && args.branch.indexOf('/') > -1 ? args.branch : getDefaultRemoteBranch(args.branch, cwd),
  } as CliOptions;

  return cliOptions;
}
