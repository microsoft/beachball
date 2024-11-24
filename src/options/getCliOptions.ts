import parser from 'yargs-parser';
import type { CliOptions } from '../types/BeachballOptions';
import { getDefaultRemoteBranch, findProjectRoot } from 'workspace-tools';
import { env } from '../env';

// For camelCased options, yargs will automatically accept them with-dashes too.
const arrayOptions = ['disallowedChangeTypes', 'package', 'scope'] as const;
const booleanOptions = [
  'all',
  'bump',
  'bumpDeps',
  'commit',
  'disallowDeletedChangeFiles',
  'fetch',
  'forceVersions',
  'gitTags',
  'help',
  'keepChangeFiles',
  'new',
  'publish',
  'push',
  'verbose',
  'version',
  'yes',
] as const;
const numberOptions = ['concurrency', 'depth', 'gitTimeout', 'retries', 'timeout'] as const;
const stringOptions = [
  'access',
  'authType',
  'branch',
  'canaryName',
  'changehint',
  'changeDir',
  'configPath',
  'dependentChangeType',
  'fromRef',
  'message',
  'prereleasePrefix',
  'registry',
  'tag',
  'token',
  'type',
] as const;

type AtLeastOne<T> = [T, ...T[]];
/** Type hack to verify that an array includes all keys of a type */
const allKeysOfType =
  <T extends string>() =>
  <L extends AtLeastOne<T>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...x: L extends any ? (Exclude<T, L[number]> extends never ? L : Exclude<T, L[number]>[]) : never
  ) =>
    x;

// Verify that all the known CLI options have types specified, to ensure correct parsing.
//
// NOTE: If a prop is missing, this will have a somewhat misleading error:
//   Argument of type '"disallowedChangeTypes"' is not assignable to parameter of type '"tag" | "version"'
//
// To fix, add the missing names after "parameter of type" ("tag" and "version" in this example)
// to the appropriate array above.
const knownOptions = allKeysOfType<keyof CliOptions>()(
  ...arrayOptions,
  ...booleanOptions,
  ...numberOptions,
  ...stringOptions,
  // these options are filled in below, not respected from the command line
  'path',
  'command'
);

const parserOptions: parser.Options = {
  configuration: {
    'boolean-negation': true,
    'camel-case-expansion': true,
    'dot-notation': false,
    'duplicate-arguments-array': true,
    'flatten-duplicate-arrays': true,
    'greedy-arrays': true, // for now; we might want to change this to false in the future
    'parse-numbers': true,
    'parse-positional-numbers': false,
    'short-option-groups': false,
    'strip-aliased': true,
    'strip-dashed': true,
  },
  // spread to get rid of readonly...
  array: [...arrayOptions],
  boolean: [...booleanOptions],
  number: [...numberOptions],
  string: [...stringOptions],
  alias: {
    authType: ['a'],
    branch: ['b'],
    configPath: ['c', 'config'],
    forceVersions: ['force'],
    fromRef: ['since'],
    help: ['h', '?'],
    message: ['m'],
    package: ['p'],
    registry: ['r'],
    tag: ['t'],
    token: ['n'],
    version: ['v'],
    yes: ['y'],
  },
};

let cachedCliOptions: CliOptions;

export function getCliOptions(argv: string[], disableCache?: boolean): CliOptions {
  // Special case caching to process.argv which should be immutable
  if (argv === process.argv) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (disableCache || env.beachballDisableCache || !cachedCliOptions) {
      cachedCliOptions = getCliOptionsUncached(process.argv);
    }
    return cachedCliOptions;
  } else {
    return getCliOptionsUncached(argv);
  }
}

function getCliOptionsUncached(argv: string[]): CliOptions {
  // Be careful not to mutate the input argv
  const trimmedArgv = argv.slice(2);

  const args = parser(trimmedArgv, parserOptions);

  const { _: positionalArgs, ...options } = args;
  let cwd: string;
  try {
    cwd = findProjectRoot(process.cwd());
  } catch {
    cwd = process.cwd();
  }

  if (positionalArgs.length > 1) {
    throw new Error(`Only one positional argument (the command) is allowed. Received: ${positionalArgs.join(' ')}`);
  }

  const cliOptions = {
    ...(options as CliOptions),
    command: positionalArgs.length ? String(positionalArgs[0]) : 'change',
    path: cwd,
  };

  const branchArg = args.branch as string | undefined;
  if (branchArg) {
    // TODO: This logic assumes the first segment of any branch name with a slash must be the remote,
    // which is not necessarily accurate. Ideally we should check if a remote with that name exists,
    // and if not, perform the default remote lookup.
    cliOptions.branch =
      branchArg.indexOf('/') > -1
        ? branchArg
        : getDefaultRemoteBranch({ branch: branchArg, verbose: args.verbose as boolean | undefined, cwd });
  }

  if (cliOptions.command === 'canary') {
    cliOptions.tag = cliOptions.canaryName || 'canary';
  }

  for (const key of Object.keys(cliOptions) as (keyof CliOptions)[]) {
    const value = cliOptions[key];
    if (value === undefined) {
      delete cliOptions[key];
    } else if (typeof value === 'number' && isNaN(value)) {
      throw new Error(`Non-numeric value passed for numeric option "${key}"`);
    } else if (knownOptions.includes(key)) {
      if (Array.isArray(value) && !arrayOptions.includes(key as (typeof arrayOptions)[number])) {
        throw new Error(`Option "${key}" only accepts a single value. Received: ${value.join(' ')}`);
      }
    } else if (value === 'true') {
      // For unknown arguments like --foo=true or --bar=false, yargs will handle the value as a string.
      // Convert it to a boolean to avoid subtle bugs.
      // eslint-disable-next-line
      (cliOptions as any)[key] = true;
    } else if (value === 'false') {
      // eslint-disable-next-line
      (cliOptions as any)[key] = false;
    }
  }

  return cliOptions;
}
