import { Command, Option } from 'commander';
import type { ParsedOptions } from '../types/BeachballOptions';
import { getDefaultRemoteBranch, findProjectRoot } from 'workspace-tools';
import { env } from '../env';

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
}

/** Parse a string value as a number, throwing if the result is NaN. */
function parseNumber(value: string, optionName: string): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Non-numeric value passed for numeric option "${optionName}"`);
  }
  return num;
}

/**
 * Creates and configures the commander program with all beachball options.
 */
function createProgram(): Command {
  const program = new Command();
  program
    .allowExcessArguments(true)
    .exitOverride() // throw instead of calling process.exit
    .configureOutput({
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      writeOut: () => {}, // suppress commander's built-in output
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      writeErr: () => {},
    });

  // Disable commander's built-in --help and --version so we can handle them ourselves
  program.helpOption(false);

  // -- Boolean options (with --no-X negation support) --
  program.option('--all');
  program.option('--bump');
  program.option('--no-bump');
  program.option('--bump-deps');
  program.option('--no-bump-deps');
  program.option('--commit');
  program.option('--no-commit');
  program.option('--disallow-deleted-change-files');
  program.option('--no-disallow-deleted-change-files');
  program.option('--fetch');
  program.option('--no-fetch');
  program.option('--force, --force-versions');
  program.option('--git-tags');
  program.option('--no-git-tags');
  program.option('-h, --help');
  program.option('--keep-change-files');
  program.option('--no-keep-change-files');
  program.option('--new');
  program.option('--no-new');
  program.option('--publish');
  program.option('--no-publish');
  program.option('--push');
  program.option('--no-push');
  program.option('--verbose');
  program.option('-v, --version');
  program.option('-y, --yes');
  program.option('--no-yes');

  // -- Array options (variadic: accepts multiple values or repeated flags) --
  program.option('--disallowed-change-types <types...>');
  program.option('-p, --package <packages...>');
  program.option('--scope <patterns...>');

  // -- Number options --
  program.addOption(new Option('--concurrency <n>').argParser((v: string) => parseNumber(v, 'concurrency')));
  program.addOption(new Option('--depth <n>').argParser((v: string) => parseNumber(v, 'depth')));
  program.addOption(
    new Option('--npm-read-concurrency <n>').argParser((v: string) => parseNumber(v, 'npmReadConcurrency'))
  );
  program.addOption(new Option('--git-timeout <n>').argParser((v: string) => parseNumber(v, 'gitTimeout')));
  program.addOption(new Option('--retries <n>').argParser((v: string) => parseNumber(v, 'retries')));
  program.addOption(new Option('--timeout <n>').argParser((v: string) => parseNumber(v, 'timeout')));

  // -- String options --
  program.option('--access <value>');
  program.option('-a, --auth-type <value>');
  program.option('-b, --branch <value>');
  program.option('--canary-name <value>');
  program.option('--changehint <value>');
  program.option('--change-dir <value>');
  program.option('-c, --config-path <value>');
  // --config is a long alias for --config-path (commander only supports one long name per option)
  program.addOption(new Option('--config <value>').hideHelp());
  program.option('--dependent-change-type <value>');
  program.option('--since, --from-ref <value>');
  program.option('-m, --message <value>');
  program.option('--pack-to-path <value>');
  program.option('--prerelease-prefix <value>');
  program.option('-r, --registry <value>');
  program.option('-t, --tag <value>');
  program.option('-n, --token <value>');
  program.option('--type <value>');

  return program;
}

/**
 * Gets CLI options.
 */
export function getCliOptions(processInfo: ProcessInfo): ParsedOptions['cliOptions'];
/** @deprecated Pass full process info */
export function getCliOptions(argv: string[]): ParsedOptions['cliOptions'];
export function getCliOptions(processOrArgv: ProcessInfo | string[]): ParsedOptions['cliOptions'] {
  const processInfo = Array.isArray(processOrArgv)
    ? // eslint-disable-next-line no-restricted-properties -- legacy API
      { argv: processOrArgv, cwd: env.isJest ? '' : process.cwd() }
    : processOrArgv;

  const program = createProgram();
  program.parse(processInfo.argv);

  const commanderOpts = program.opts();
  const positionalArgs = program.args;

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

  // Determine command from positional args
  const command = positionalArgs.length ? String(positionalArgs[0]) : 'change';

  if (positionalArgs.length > 1 && command !== 'config') {
    throw new Error(`Only one positional argument (the command) is allowed. Received: ${positionalArgs.join(' ')}`);
  }

  // Build the cliOptions object from commander's parsed options.
  // Only include options that were explicitly set on the command line (not undefined defaults).
  const cliOptions: ParsedOptions['cliOptions'] = {
    command,
    path: cwd,
  };

  // Handle --config as alias for --config-path
  if (commanderOpts.config !== undefined && commanderOpts.configPath === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    commanderOpts.configPath = commanderOpts.config;
  }
  delete commanderOpts.config;

  // Copy all defined options from commander to cliOptions.
  // Commander already converts hyphenated option names to camelCase in its opts() output.
  for (const [key, value] of Object.entries(commanderOpts)) {
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      (cliOptions as any)[key] = value;
    }
  }

  // Handle branch argument: add remote if missing slash
  const branchArg = cliOptions.branch;
  if (branchArg) {
    // TODO: This logic assumes the first segment of any branch name with a slash must be the remote,
    // which is not necessarily accurate. Ideally we should check if a remote with that name exists,
    // and if not, perform the default remote lookup.
    cliOptions.branch =
      branchArg.indexOf('/') > -1
        ? branchArg
        : getDefaultRemoteBranch({ branch: branchArg, verbose: cliOptions.verbose, cwd });
  }

  // For canary command, set tag to canaryName or default 'canary'
  if (cliOptions.command === 'canary') {
    cliOptions.tag = cliOptions.canaryName || 'canary';
  }

  // Save extra positional args for commands that support subcommands (e.g. 'config get <name>')
  if (positionalArgs.length > 1) {
    cliOptions._extraPositionalArgs = positionalArgs.slice(1).map(String);
  }

  return cliOptions;
}
