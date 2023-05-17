import parser from 'yargs-parser';
import { CliOptions } from '../types/BeachballOptions';
import { getDefaultRemoteBranch, findProjectRoot } from 'workspace-tools';
import { env } from '../env';

let cachedCliOptions: CliOptions;

export function getCliOptions(argv: string[]): CliOptions {
  // Special case caching to process.argv which should be immutable
  if (argv === process.argv) {
    if (env.beachballDisableCache || !cachedCliOptions) {
      cachedCliOptions = getCliOptionsUncached(process.argv);
    }
    return cachedCliOptions;
  } else {
    return getCliOptionsUncached(argv);
  }
}

function getCliOptionsUncached(argv: string[]): CliOptions {
  // Be careful not to mutate the input argv
  const trimmedArgv = [...argv].splice(2);

  const args = parser(trimmedArgv, {
    string: ['branch', 'tag', 'message', 'package', 'since', 'dependent-change-type', 'config'],
    array: ['scope', 'disallowed-change-types'],
    boolean: ['git-tags', 'keep-change-files', 'force', 'disallow-deleted-change-files', 'no-commit', 'fetch'],
    number: ['depth'],
    alias: {
      authType: ['a'],
      branch: ['b'],
      config: ['c'],
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

  const { _, ...restArgs } = args;
  let cwd: string;
  try {
    cwd = findProjectRoot(process.cwd());
  } catch (err) {
    cwd = process.cwd();
  }
  const cliOptions = {
    ...(_.length > 0 && { command: _[0] }),
    ...(restArgs as any),
    path: cwd,
    fromRef: args.since,
    keepChangeFiles: args['keep-change-files'],
    disallowDeletedChangeFiles: args['disallow-deleted-change-files'],
    forceVersions: args.force,
    configPath: args.config,
  } as CliOptions;

  const disallowedChangeTypesArgs = args['disallowed-change-types'];
  if (disallowedChangeTypesArgs) {
    cliOptions.disallowedChangeTypes = disallowedChangeTypesArgs;
  }

  if (args.branch) {
    cliOptions.branch =
      args.branch.indexOf('/') > -1
        ? args.branch
        : getDefaultRemoteBranch({ branch: args.branch, verbose: args.verbose, cwd });
  }

  if (cliOptions.command === 'canary') {
    cliOptions.tag = cliOptions.canaryName || 'canary';
  }

  return cliOptions;
}
