import { Command, CommanderError, Option } from 'commander';
import path from 'path';
import type { ParsedOptions } from '../types/BeachballOptions';
import type { PackageJson } from '../types/PackageInfo';
import { getDefaultRemoteBranch, findProjectRoot } from 'workspace-tools';
import { readJson } from '../object/readJson';
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

/** Add all shared CLI options (for every command except `config get`) to a command. */
function addSharedOptions(cmd: Command): Command {
  // -- Boolean options (with --no-X negation support) --
  cmd.option('--all', 'consider all packages to have changed');
  cmd.option('--bump', 'bump versions during publish');
  cmd.option('--no-bump', 'skip bumping versions during publish');
  cmd.option('--bump-deps', 'bump dependent packages');
  cmd.option('--no-bump-deps', 'skip bumping dependent packages');
  cmd.option('--commit', 'commit change files after creating');
  cmd.option('--no-commit', 'stage change files only');
  cmd.option('--disallow-deleted-change-files', 'verify no change files were deleted');
  cmd.option('--no-disallow-deleted-change-files');
  cmd.option('--fetch', 'fetch from the remote before determining changes');
  cmd.option('--no-fetch', 'skip fetching from the remote');
  cmd.option('--force, --force-versions', 'use version from registry even if older than local');
  cmd.option('--git-tags', 'create git tags for published package versions');
  cmd.option('--no-git-tags', 'skip creating git tags');
  cmd.option('--keep-change-files', 'keep change files on disk after bumping');
  cmd.option('--no-keep-change-files');
  cmd.option('--new', 'publish newly added packages');
  cmd.option('--no-new');
  cmd.option('--publish', 'publish to the npm registry');
  cmd.option('--no-publish', 'skip publishing to the npm registry');
  cmd.option('--push', 'push to the remote git branch when publishing');
  cmd.option('--no-push', 'skip pushing to the git remote');
  cmd.option('--verbose', 'print additional information to the console');
  cmd.option('-y, --yes', 'skip confirmation prompts');
  cmd.option('--no-yes');

  // -- Array options --
  cmd.option('--disallowed-change-types <types...>', 'disallow these change types');
  cmd.option('-p, --package <packages...>', 'target specific packages');
  cmd.option('--scope <patterns...>', 'only consider package paths matching these patterns');

  // -- Number options --
  cmd.addOption(
    new Option('--concurrency <n>', 'maximum concurrency for write operations').argParser((v: string) =>
      parseNumber(v, 'concurrency')
    )
  );
  cmd.addOption(
    new Option('--depth <n>', 'depth of git history for shallow clones').argParser((v: string) =>
      parseNumber(v, 'depth')
    )
  );
  cmd.addOption(
    new Option('--npm-read-concurrency <n>', 'maximum concurrency for npm registry reads').argParser((v: string) =>
      parseNumber(v, 'npmReadConcurrency')
    )
  );
  cmd.addOption(
    new Option('--git-timeout <n>', 'timeout for git push operations').argParser((v: string) =>
      parseNumber(v, 'gitTimeout')
    )
  );
  cmd.addOption(
    new Option('--retries <n>', 'number of retries for npm publish').argParser((v: string) => parseNumber(v, 'retries'))
  );
  cmd.addOption(
    new Option('--timeout <n>', 'timeout for npm operations').argParser((v: string) => parseNumber(v, 'timeout'))
  );

  // -- String options --
  cmd.option('--access <value>', "access level for npm publish: 'public' or 'restricted'");
  cmd.option('-a, --auth-type <value>', "npm auth type: 'authtoken' or 'password'");
  cmd.option('-b, --branch <value>', 'target branch from remote');
  cmd.option('--canary-name <value>', 'canary prerelease name');
  cmd.option('--changehint <value>', 'custom hint message when change files are needed');
  cmd.option('--change-dir <value>', 'directory to store change files');
  cmd.option('-c, --config <value>', 'custom beachball config path');
  cmd.addOption(new Option('--config-path <value>').hideHelp()); // hidden alias for --config
  cmd.option('--dependent-change-type <value>', 'change type for dependent packages');
  cmd.option('--since, --from-ref <value>', 'consider changes since this git ref');
  cmd.option('-m, --message <value>', 'change description or commit message');
  cmd.option('--pack-to-path <value>', 'pack packages to this path instead of publishing');
  cmd.option('--prerelease-prefix <value>', 'prerelease prefix for prerelease bumps');
  cmd.option('-r, --registry <value>', 'target npm registry');
  cmd.option('-t, --tag <value>', 'dist-tag for npm publishes');
  cmd.option('-n, --token <value>', 'npm token or password');
  cmd.option('--type <value>', 'type of change: major, minor, patch, none, ...');

  return cmd;
}

/**
 * Reference command with all shared options, used for error enhancement only.
 * (Separate from the real commands to avoid circular references.)
 */
const referenceCommand = addSharedOptions(new Command());

/** Version string, read once at module load (before tests can mock fs). */
const beachballVersion = (() => {
  try {
    return readJson<PackageJson>(path.resolve(__dirname, '../../package.json')).version || 'unknown';
  } catch {
    return 'unknown';
  }
})();
/** Convert a camelCase string to dashed form: e.g. `gitTags` => `git-tags` */
function camelToDash(str: string): string {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * If the unknown option matches a boolean flag, suggest both `--opt` and `--no-opt`.
 * If the unknown option is in camelCase, suggest the valid dashed form instead.
 * Otherwise re-throw the original error unchanged.
 */
function enhanceUnknownOptionError(err: CommanderError): never {
  // Parse the unknown flag from commander's error message format:
  //   "error: unknown option '--foo'"  or  "error: unknown option '--foo'\n(Did you mean --bar?)"
  const flagMatch = err.message.match(/^error: unknown option '(--[^']+)'/);
  if (!flagMatch) {
    throw err;
  }
  const unknownFlag = flagMatch[1];

  // Collect info about known options from the reference command
  const knownLongFlags = new Set<string>();
  const negatableBooleans = new Set<string>(); // long flags that have a --no-X counterpart
  for (const opt of referenceCommand.options) {
    if (opt.long) {
      knownLongFlags.add(opt.long);
      if (opt.negate && knownLongFlags.has(opt.long.replace(/^--no-/, '--'))) {
        negatableBooleans.add(opt.long.replace(/^--no-/, '--'));
      }
    }
  }
  // Second pass: if we saw --X before --no-X, we need to check in reverse
  for (const opt of referenceCommand.options) {
    if (opt.long && !opt.negate && knownLongFlags.has(`--no-${opt.long.slice(2)}`)) {
      negatableBooleans.add(opt.long);
    }
  }

  // Check if the unknown flag contains uppercase and the dashed version is valid
  const flagName = unknownFlag.replace(/^--/, '');
  if (/[A-Z]/.test(flagName)) {
    const dashedFlag = `--${camelToDash(flagName)}`;
    if (knownLongFlags.has(dashedFlag)) {
      let suggestion: string;
      if (negatableBooleans.has(dashedFlag)) {
        suggestion = `(Did you mean ${dashedFlag} or --no-${dashedFlag.slice(2)}?)`;
      } else if (dashedFlag.startsWith('--no-') && negatableBooleans.has(`--${dashedFlag.slice(5)}`)) {
        suggestion = `(Did you mean --${dashedFlag.slice(5)} or ${dashedFlag}?)`;
      } else {
        suggestion = `(Did you mean ${dashedFlag}?)`;
      }
      throw new CommanderError(err.exitCode, err.code, `error: unknown option '${unknownFlag}'\n${suggestion}`);
    }
  }

  // Check if commander's existing suggestion matches a negatable boolean flag
  const suggestMatch = err.message.match(/\(Did you mean (--[^ ?]+)\?\)/);
  if (suggestMatch) {
    const suggested = suggestMatch[1];
    if (negatableBooleans.has(suggested)) {
      throw new CommanderError(
        err.exitCode,
        err.code,
        `error: unknown option '${unknownFlag}'\n(Did you mean ${suggested} or --no-${suggested.slice(2)}?)`
      );
    }
    if (suggested.startsWith('--no-')) {
      const positiveFlag = `--${suggested.slice(5)}`;
      if (negatableBooleans.has(positiveFlag)) {
        throw new CommanderError(
          err.exitCode,
          err.code,
          `error: unknown option '${unknownFlag}'\n(Did you mean ${positiveFlag} or ${suggested}?)`
        );
      }
    }
  }

  // No enhancement possible, re-throw as-is
  throw err;
}

interface CommandMatch {
  command: string;
  opts: Record<string, unknown>;
  configSettingName?: string;
}

/** Suppress stderr but capture stdout (for help/version output). */
function makeOutputConfig(captured: { output: string }) {
  return {
    writeOut: (str: string) => {
      captured.output += str;
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    writeErr: () => {},
  };
}

/**
 * Creates and configures the commander program with all beachball commands and options.
 */
function createProgram(): {
  program: Command;
  getMatch: () => CommandMatch | undefined;
  captured: { output: string };
} {
  let match: CommandMatch | undefined;
  const captured = { output: '' };
  const outputConfig = makeOutputConfig(captured);

  const program = new Command('beachball')
    .description('the sunniest version bumping tool')
    .version(beachballVersion, '-v, --version')
    .exitOverride()
    .configureOutput(outputConfig);

  // Define standard commands — each gets all shared options
  const commandDefs = [
    { name: 'change', desc: 'create change files in the change/ folder' },
    { name: 'check', desc: 'check whether a change file is needed for this branch' },
    { name: 'bump', desc: 'bump versions and generate changelogs' },
    { name: 'publish', desc: 'bump, publish to npm registry, and push changelogs' },
    { name: 'canary', desc: 'publish canary prerelease versions' },
    { name: 'init', desc: 'initialize beachball config' },
    { name: 'sync', desc: 'synchronize published versions from the registry' },
  ];

  for (const { name, desc } of commandDefs) {
    const cmd = program.command(name).description(desc);
    cmd.exitOverride().configureOutput(outputConfig).allowExcessArguments(false);
    addSharedOptions(cmd);
    cmd.action(() => {
      match = { command: name, opts: cmd.opts() };
    });
  }

  // Config command with subcommands
  const config = program.command('config').description('view configuration');
  config.exitOverride().configureOutput(outputConfig);

  const configGet = config.command('get').description('get the value of a config setting');
  configGet.argument('<name>', 'config setting name');
  configGet.option('-p, --package <packages...>', 'get effective value for specific package(s)');
  configGet.exitOverride().configureOutput(outputConfig).allowExcessArguments(false);
  configGet.action((name: string) => {
    match = { command: 'config get', opts: configGet.opts(), configSettingName: name };
  });

  const configList = config.command('list').description('list all config settings');
  configList.exitOverride().configureOutput(outputConfig).allowExcessArguments(false);
  configList.action(() => {
    match = { command: 'config list', opts: configList.opts() };
  });

  return { program, getMatch: () => match, captured };
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

  const { program, getMatch, captured } = createProgram();

  try {
    program.parse(processInfo.argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
        // Re-throw with captured output so the caller can print it
        throw new CommanderError(err.exitCode, err.code, captured.output || err.message);
      }
      if (err.code === 'commander.unknownOption') {
        enhanceUnknownOptionError(err);
      }
    }
    throw err;
  }

  const match = getMatch();
  if (!match) {
    // No command was matched — show help
    program.outputHelp();
    throw new CommanderError(0, 'commander.helpDisplayed', captured.output);
  }

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

  // Build the cliOptions object from commander's parsed options.
  // Only include options that were explicitly set on the command line (not undefined defaults).
  const cliOptions: ParsedOptions['cliOptions'] = {
    command: match.command,
    path: cwd,
  };

  if (match.configSettingName !== undefined) {
    cliOptions.configSettingName = match.configSettingName;
  }

  const commanderOpts = { ...match.opts };

  // Handle --config-path as alias for --config (both map to configPath).
  // TODO: Replace this manual alias handling with `new Option(...).alias('--config-path')`
  // when upgrading to a commander version that supports .alias() on Option.
  if (commanderOpts.config !== undefined) {
    if (commanderOpts.configPath !== undefined) {
      throw new Error('Cannot specify both --config and --config-path');
    }
    commanderOpts.configPath = commanderOpts.config;
  }
  delete commanderOpts.config;

  // Copy all defined options from commander to cliOptions.
  // Commander already converts hyphenated option names to camelCase in its opts() output.
  for (const [key, value] of Object.entries(commanderOpts)) {
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
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

  return cliOptions;
}
