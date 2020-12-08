import parser from 'yargs-parser';
import { CliOptions } from '../types/BeachballOptions';
import { findGitRoot } from '../paths';
import { getDefaultRemoteBranch } from '../git';

// CLI Options cache
let cliOptions: CliOptions;

export function getCliOptions(): CliOptions {
  if (cliOptions) {
    return cliOptions;
  }

  const argv = process.argv.splice(2);
  const args = parser(argv, {
    string: ['branch', 'tag', 'message', 'package', 'since', 'dependent-change-type'],
    array: ['scope', 'disallowed-change-types'],
    boolean: ['git-tags', 'keep-change-files', 'force', 'disallow-deleted-change-files'],
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

  const { _, ...restArgs } = args;
  const cwd = findGitRoot(process.cwd()) || process.cwd();
  cliOptions = {
    ...(_.length > 0 && { command: _[0] }),
    ...(restArgs as any),
    path: cwd,
    fromRef: args.since,
    keepChangeFiles: args['keep-change-files'],
    disallowDeletedChangeFiles: args['disallow-deleted-change-files'],
    forceVersions: args['force'],
  } as CliOptions;

  const disallowedChangeTypesArgs = args['disallowed-change-types'];
  if (disallowedChangeTypesArgs) {
    cliOptions.disallowedChangeTypes = disallowedChangeTypesArgs;
  }

  if (args.branch) {
    cliOptions.branch = args.branch.indexOf('/') > -1 ? args.branch : getDefaultRemoteBranch(args.branch, cwd);
  }

  return cliOptions;
}
