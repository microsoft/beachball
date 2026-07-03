import { findProjectRoot } from 'workspace-tools';
import { Command, Option, type OptionValues } from 'commander';
import { env } from '../env';
import type { CliOptions, ParsedOptions } from '../types/BeachballOptions';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import { resolveRemoteAndBranch } from '../git/tempGetDefaultRemoteBranch';

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

// NOTE: This file is being migrated from yargs-parser to commander@14. Commander is currently used
// only for option parsing (not for dispatching to command implementations).
//
// Options are defined on proper sub-commands, one per beachball command. For now, every option is
// added to each sub-command as well as to the parent command, so options can be specified either
// before the command (as "global" options on the parent) or after it (on the sub-command). A later
// change will split up which options apply to which commands.
//
// This step defines each option in its canonical dashed form only. Additional forms that
// yargs-parser accepted today (camelCase flags, extra long aliases, boolean values passed as a
// separate token, arbitrary unknown options, "specified multiple times" errors, etc.) are not yet
// handled here; see the migration plan for the proposed workarounds.

/** All beachball commands. Each becomes a commander sub-command. */
const commands = ['change', 'check', 'publish', 'bump', 'canary', 'sync', 'init', 'config', 'migrate'] as const;

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

/** Convert a camelCase option name to its dashed CLI flag form (e.g. `gitTags` => `git-tags`). */
function toDashed(name: string): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** Coerce a value to a number, throwing if it's not numeric (matches previous yargs behavior). */
function parseNumber(name: string): (value: string) => number {
  return (value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) {
      throw new Error(`Non-numeric value passed for numeric option "${name}"`);
    }
    return num;
  };
}

/** Collector for array options: accumulate repeated/variadic values into a single array. */
function collectArray(value: string, previous: string[] | undefined): string[] {
  return previous ? [...previous, value] : [value];
}

/** Add every beachball option (dashed forms only for now) to the given command. */
function addAllOptions(command: Command): void {
  const flags = (name: string, valuePlaceholder?: string): string => {
    const dashed = toDashed(name);
    const short = shortAliases[name as keyof CliOptions];
    const long = valuePlaceholder ? `--${dashed} ${valuePlaceholder}` : `--${dashed}`;
    return short ? `-${short}, ${long}` : long;
  };

  for (const name of stringOptions) {
    command.addOption(new Option(flags(name, '<value>')));
  }

  for (const name of numberOptions) {
    command.addOption(new Option(flags(name, '<value>')).argParser(parseNumber(name)));
  }

  for (const name of arrayOptions) {
    // Variadic to allow multiple space-separated values, plus a collector for repeated usage.
    command.addOption(new Option(flags(name, '<values...>')).argParser(collectArray));
  }

  for (const name of booleanOptions) {
    command.addOption(new Option(flags(name)));
    // Negated form (e.g. `--no-fetch`).
    command.addOption(new Option(`--no-${toDashed(name)}`));
  }
}

/** Result captured from whichever sub-command commander dispatches to. */
interface ParseResult {
  command: string;
  options: OptionValues;
  extraArgs: string[];
}

/**
 * Build a commander program with one sub-command per beachball command. All options are added to
 * both the parent (so they can be given before the command) and each sub-command (so they can be
 * given after it). Commander is currently used only for parsing, not command dispatch.
 *
 * @returns The program plus a getter for the parse result (populated by the matched sub-command's
 * action handler when `program.parse()` is called).
 */
function buildProgram(): { program: Command; getResult: () => ParseResult } {
  const program = new Command();

  // Throw instead of calling process.exit() or writing to stdout/stderr on error, so callers and
  // tests can handle failures.
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} }); // suppress commander output

  // Allow options we haven't explicitly defined to pass through without erroring.
  // (Full parsing of arbitrary unknown options is handled in a later step; see the plan.)
  program.allowUnknownOption();

  // Add all options to the parent so they can be specified before the command name.
  addAllOptions(program);

  let result: ParseResult = { command: defaultCommand, options: {}, extraArgs: [] };

  for (const name of commands) {
    const subcommand = program.command(name, { isDefault: name === defaultCommand });
    addAllOptions(subcommand);
    subcommand.allowUnknownOption();
    // Capture any extra positional args (e.g. `config get <name>`). A consistent error for
    // non-config commands with extra args is produced later in getCliOptions.
    subcommand.argument('[extraArgs...]', 'extra positional arguments (e.g. for `config get <name>`)');
    subcommand.action(() => {
      result = {
        command: name,
        // Merge parent ("global") options with this sub-command's options.
        options: subcommand.optsWithGlobals(),
        // processedArgs is positional in declaration order; index 0 is the `[extraArgs...]`
        // variadic declared above, which commander populates as a string array (or undefined
        // when no extra args were given).
        extraArgs: (subcommand.processedArgs[0] as string[] | undefined) ?? [],
      };
    });
  }

  return { program, getResult: () => result };
}

/**
 * Gets CLI options. Also gets the `NPM_TOKEN` environment variable if present.
 */
export function getCliOptions(processInfo: ProcessInfo): ParsedOptions['cliOptions'];
/** @deprecated Pass full process info */
export function getCliOptions(argv: string[]): ParsedOptions['cliOptions'];
export function getCliOptions(processOrArgv: ProcessInfo | string[]): ParsedOptions['cliOptions'] {
  const processInfo = Array.isArray(processOrArgv)
    ? // eslint-disable-next-line no-restricted-properties -- legacy API
      { argv: processOrArgv, cwd: env.isJest ? '' : process.cwd(), env: process.env }
    : processOrArgv;

  // Be careful not to mutate the input argv
  const trimmedArgv = processInfo.argv.slice(2);

  const { program, getResult } = buildProgram();
  program.parse(trimmedArgv, { from: 'user' });
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

  if (extraPositionalArgs.length && command !== 'config') {
    throw new Error(
      `Only one positional argument (the command) is allowed. Received: ${[command, ...extraPositionalArgs].join(' ')}`
    );
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

/**
 * Resolves `rawOptions.branch` if provided to ensure it includes the remote name.
 * If no branch is provided, returns the default branch.
 */
export function resolveBranchOption(rawOptions: Partial<Pick<CliOptions, 'branch' | 'verbose'>>, cwd: string): string {
  const branchResult = resolveRemoteAndBranch({
    branch: rawOptions.branch,
    cwd,
    verbose: rawOptions.verbose,
    strict: true,
  });
  cacheRemoteBranch(branchResult, cwd);

  return `${branchResult.remote}/${branchResult.remoteBranch}`;
}
