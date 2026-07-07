import type { OutputConfiguration } from 'commander';
import { findProjectRoot, resolveRemoteAndBranch } from 'workspace-tools';
import { env } from '../env';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import type { CliOptions, ParsedOptions } from '../types/BeachballOptions';
import { BeachballCommand } from './BeachballCommand';
import { optionDefinitions } from './optionDefinitions';
import { commandDefinitions } from './commandDefinitions';

export interface ProgramContext {
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
  /** Beachball version (optional in tests) */
  version?: string;
  /** Output options override (mainly for testing) */
  outputOptions?: OutputConfiguration;
}

/**
 * Gets CLI options. Also gets the `NPM_TOKEN` environment variable if present.
 *
 * In v3, parsing was migrated from `yargs-parser` to `commander`. Implementation notes:
 * - Each beachball command is registered as a commander subcommand, but currently `cli.ts` still
 *   handles the actual command dispatching (switch on `options.command`).
 * - The `config` command has commander `get <name>` / `list` subcommands.
 * - Every option is declared on both the parent command and each subcommand (so options can be
 *   specified either before or after the command name), following yargs behavior.
 * - Descriptions/help are handled through commander's built-in help system.
 * - `--help` and `--version` flags are handled by commander (it will print the info and exit).
 * - In Jest, commander is configured to throw on error rather than calling `process.exit()`,
 *   and `outputOptions` (logging) use no-op functions by default.
 *
 * Some yargs-parser behaviors are preserved by custom logic in `BeachballOption`/`BeachballCommand`:
 * - camelCase flags (e.g. `--gitTags`) in addition to dashed flags (e.g. `--git-tags`)
 * - extra long-flag aliases (e.g. `--config` for `--config-path`)
 * - boolean options automatically get a negated `--no-` form
 *
 * Other yargs-parser behaviors are NOT preserved:
 * - arbitrary unknown options are errors
 * - boolean options do not accept a value (e.g. `--verbose true` is an error)
 */
export function getCliOptions(programContext: ProgramContext): ParsedOptions['cliOptions'] {
  let { cwd } = programContext;

  const program = BeachballCommand.initProgram({
    name: 'beachball',
    desc: 'the sunniest version bumping tool',
    options: optionDefinitions,
    commands: commandDefinitions,
    version: programContext.version,
    outputOptions: programContext.outputOptions,
  });

  // For --help or --version, this will print the info and exit
  const { command, options, extraArgs: extraPositionalArgs } = program.beachballParse(programContext.argv);

  try {
    // If a non-empty cwd is provided, find the project root from there.
    // Empty means this is a test without a filesystem.
    if (cwd && !env.isJest) {
      cwd = findProjectRoot(cwd);
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
  if (programContext.env.NPM_TOKEN && cliOptions.token === undefined) {
    cliOptions.token = programContext.env.NPM_TOKEN;
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
