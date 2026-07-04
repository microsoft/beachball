import { findProjectRoot } from 'workspace-tools';
import { Command, type OptionValues } from 'commander';
import { env } from '../env';
import type { CliOptions, ParsedOptions } from '../types/BeachballOptions';
import { addAllOptions, normalizeArgv, resolveBranchOption } from './cliOptionsHelpers';

export interface ProcessInfo {
  /** Complete argv (node and script path aren't used but elements must be present) */
  argv: string[];
  /**
   * Current directory (search for the project root from here). Usually this should be `process.cwd()`.
   *
   * In tests, this is assumed to be the project root (searching up is skipped).
   * This can also be an empty string in tests that don't use the filesystem.
   */
  cwd: string;
  /**
   * Environment variables for the process (to easily mock in tests).
   * Only `NPM_TOKEN` is currently used.
   */
  env: NodeJS.ProcessEnv | { NPM_TOKEN?: string };
}

// NOTE: This file was migrated from yargs-parser to commander@14. Commander is currently used only
// for option parsing (not for dispatching to command implementations); the existing `cli.ts`
// dispatch (switch on `cliOptions.command`) is unchanged.
//
// The parent command declares every option (so options can be given before or after the command
// name) plus a positional `[command]` argument. The `config` command is declared as a commander
// subcommand so its extra positional args (e.g. `config get <name>`) are handled natively, while
// commander errors on excess positional args for all other commands.
//
// Unlike yargs-parser (which accepted arbitrary unknown flags), commander errors on unknown
// options. This is an intentional breaking change for v3.
//
// Each option is declared in its canonical dashed form. Commander is a schema-first parser, so a
// few permissive behaviors that yargs-parser accepted are reproduced with small argv preprocessing
// passes (see `normalizeArgv`):
//   - camelCase flags (`--gitTags`) and extra long aliases (`--config`, `--force`, `--since`)
//     are normalized to their canonical dashed form before parsing.
//   - boolean values passed via `=` or as a separate token (`--fetch=false`, `--yes false`) are
//     rewritten to commander's flag / `--no-` negation form.
//   - non-array options specified more than once throw (matching yargs).

/** Command run when none is specified on the command line. */
const defaultCommand = 'change';

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
  'publish',
  'push',
  'verbose',
  'version',
  'yes',
] as const;
const numberOptions = ['concurrency', 'depth', 'npmReadConcurrency', 'gitTimeout', 'retries', 'timeout'] as const;
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
  'packToPath',
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
// Otherwise it's possible that new CliOptions could be introduced without corresponding parsers.
//
// NOTE: If a prop is missing, this will have a somewhat misleading error:
//   Argument of type '"disallowedChangeTypes"' is not assignable to parameter of type '"tag" | "version"'
//
// To fix, add the missing names after "parameter of type" ("tag" and "version" in this example)
// to the appropriate array above.
allKeysOfType<keyof CliOptions>()(
  ...arrayOptions,
  ...booleanOptions,
  ...numberOptions,
  ...stringOptions,
  // these options are filled in below, not respected from the command line
  'path',
  'command',
  '_extraPositionalArgs'
);

/**
 * Short descriptions for each option, shown in commander's help output. Sourced from `help.ts`
 * and the doc comments in `BeachballOptions`. (Keyed by every parseable option name to require a
 * description whenever a new option is added.)
 */
const optionDescriptions: Record<keyof CliOptions, string> = {
  // array options
  disallowedChangeTypes: 'change types that are not allowed',
  package: 'force creating a change file for this package (can be specified multiple times)',
  scope: 'only consider package paths matching this pattern (can be specified multiple times; supports negations)',
  // boolean options
  all: 'generate change files for all packages',
  bump: 'bump versions during publish (use --no-bump to skip)',
  bumpDeps: 'bump dependent packages during publish (use --no-bump-deps to skip)',
  commit: 'commit change files after "change" (use --no-commit to only stage them)',
  disallowDeletedChangeFiles: 'verify that no change files were deleted between head and target branch',
  fetch: 'fetch from the remote before determining changes (use --no-fetch to skip)',
  forceVersions: "for 'sync': use the version from the registry even if it's older than local",
  gitTags: 'create git tags for each published package version (use --no-git-tags to skip)',
  help: 'show usage information',
  keepChangeFiles: "don't delete the change files from disk after bumping",
  publish: 'publish to the npm registry (use --no-publish to skip)',
  push: 'push changes back to the remote git branch (use --no-push to skip)',
  verbose: 'print additional information to the console',
  version: 'show the beachball version',
  yes: 'skip the confirmation prompts',
  // number options
  concurrency: 'maximum concurrency for write operations such as publishing (default: 1)',
  depth: 'for shallow clones: depth of git history to consider when fetching',
  npmReadConcurrency: 'maximum concurrency for reading package versions from the registry (default: 5)',
  gitTimeout: 'timeout in ms for git push operations',
  retries: 'number of retries for an npm publish before failing (default: 3)',
  timeout: 'timeout in ms for npm operations (other than install)',
  // string options
  access: 'npm publish access level: "public" or "restricted"',
  authType: 'npm auth type for NPM_TOKEN: "authtoken" or "password"',
  branch: 'target branch from remote (default: git config init.defaultBranch)',
  canaryName: 'dist-tag and version name to use for canary publishes',
  changehint: 'customized hint message shown when a change file is needed but missing',
  changeDir: 'name of the directory to store change files (default: change)',
  configPath: 'custom beachball config path (default: cosmiconfig standard paths)',
  dependentChangeType: 'change type to use for dependent packages (default: patch)',
  fromRef: 'consider changes or change files since this git ref (branch name, commit SHA)',
  message: 'for "change", the change description; for "publish", the commit message',
  packToPath: 'pack packages to tgz files under this path instead of publishing to npm',
  prereleasePrefix: 'prerelease prefix for packages that will receive a prerelease bump',
  registry: 'npm registry (default: https://registry.npmjs.org)',
  tag: 'npm dist-tag for publishes (default: "latest")',
  token: 'npm auth token (defaults to the NPM_TOKEN environment variable)',
  type: 'type of change: e.g. major, minor, patch, none (instead of prompting)',
  // not handled by commander parsing
  _extraPositionalArgs: '',
  command: '',
  path: '',
};

/** Short single-character aliases for certain options (option name => short flag without dash). */
const shortAliases: Partial<Record<keyof CliOptions, string>> = {
  authType: 'a',
  branch: 'b',
  configPath: 'c',
  help: 'h',
  message: 'm',
  package: 'p',
  registry: 'r',
  tag: 't',
  token: 'n',
  version: 'v',
  yes: 'y',
};

/**
 * Extra long-flag aliases accepted for certain options (alias => canonical option name).
 * Commander only allows one long flag per option, so these are normalized before parsing rather
 * than declared as real options.
 */
const longAliases: Record<string, keyof CliOptions> = {
  config: 'configPath',
  force: 'forceVersions',
  since: 'fromRef',
};

/** All option names (any value type). */
const allOptionNames = [...arrayOptions, ...booleanOptions, ...numberOptions, ...stringOptions];

/** Result captured from parsing. */
interface ParseResult {
  command: string;
  options: OptionValues;
  extraArgs: string[];
}

/**
 * Build the commander program. Every option is declared on the parent command (so options can be
 * given before or after the command name), plus a positional `[command]` argument. The `config`
 * command is declared as a subcommand so its extra positional args (`config get <name>`) are
 * handled natively and commander errors on excess positional args for all other commands.
 * Commander is currently used only for parsing, not command dispatch.
 *
 * @returns The program plus a getter for the parse result (populated by the action handlers when
 * `program.parse()` is called).
 */
function buildProgram(): { program: Command; getResult: () => ParseResult } {
  const program = new Command();

  // Throw instead of calling process.exit() or writing to stdout/stderr on error, so callers and
  // tests can handle failures. (This also makes commander error on unknown options and excess
  // positional args, which is an intentional breaking change from yargs-parser.)
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} }); // suppress commander output

  addAllOptions({
    command: program,
    stringOptions,
    numberOptions,
    arrayOptions,
    booleanOptions,
    optionDescriptions,
    shortAliases,
  });

  // The single positional is the command name (any value; validated by the caller/cli.ts).
  program.argument('[command]', 'beachball command to run');

  let result: ParseResult = { command: defaultCommand, options: {}, extraArgs: [] };

  program.action((command: string | undefined) => {
    result = { command: command ?? defaultCommand, options: program.opts(), extraArgs: [] };
  });

  // The `config` command takes extra positional args (its subcommand and arguments, e.g.
  // `config get <name>` or `config list`), which are validated by the config command itself.
  const configCommand = program.command('config');
  configCommand.argument('[args...]', 'config subcommand and arguments (e.g. `get <name>` or `list`)');
  configCommand.action((args: string[]) => {
    result = { command: 'config', options: program.opts(), extraArgs: args };
  });

  return { program, getResult: () => result };
}

/**
 * Gets CLI options. Also gets the `NPM_TOKEN` environment variable if present.
 */
export function getCliOptions(processInfo: ProcessInfo): ParsedOptions['cliOptions'] {
  // Be careful not to mutate the input argv
  const trimmedArgv = processInfo.argv.slice(2);

  // Preprocess argv to reproduce yargs-parser behaviors commander doesn't support natively:
  // normalize alternate flag spellings and boolean values.
  const normalizedArgv = normalizeArgv({
    argv: trimmedArgv,
    allOptionNames,
    longAliases,
    booleanOptions,
    shortAliases,
  });

  const { program, getResult } = buildProgram();
  program.parse(normalizedArgv, { from: 'user' });
  const { command, options, extraArgs: extraPositionalArgs } = getResult();

  let cwd = processInfo.cwd;
  try {
    // If a non-empty cwd is provided, find the project root from there.
    // Empty means this is a test without a filesystem.
    if (cwd && !env.isJest) {
      cwd = findProjectRoot(processInfo.cwd);
    }
  } catch {
    // use the provided cwd
  }

  const cliOptions: ParsedOptions['cliOptions'] = {
    ...options,
    command,
    path: cwd,
  };

  if (cliOptions.branch) {
    cliOptions.branch = resolveBranchOption(cliOptions, cwd);
  }

  if (cliOptions.command === 'canary') {
    cliOptions.tag = cliOptions.canaryName || 'canary';
  }

  for (const key of Object.keys(cliOptions) as (keyof CliOptions)[]) {
    if (cliOptions[key] === undefined) {
      delete cliOptions[key];
    }
  }

  // Save extra positional args for commands that support subcommands (e.g. 'config get <name>').
  if (extraPositionalArgs.length) {
    cliOptions._extraPositionalArgs = extraPositionalArgs;
  }

  // If both --token and NPM_TOKEN are provided, prefer the CLI token (could go either way, but
  // this is safer for compatibility in case anyone was already using that env name another way)
  if (processInfo.env.NPM_TOKEN && cliOptions.token === undefined) {
    cliOptions.token = processInfo.env.NPM_TOKEN;
  }

  return cliOptions;
}
