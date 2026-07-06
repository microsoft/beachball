import { Argument, type Command, type OptionValues, type OutputConfiguration } from 'commander';
import { findProjectRoot } from 'workspace-tools';
import { env } from '../env';
import type { CliOptions, ParsedOptions } from '../types/BeachballOptions';
import { BeachballCommand, resolveBranchOption } from './cliOptionsHelpers';
import { allCommands, defaultCommand, optionDefinitions } from './cliOptionDefinitions';

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

// NOTE: This file was migrated from yargs-parser to commander@14. Commander is currently used only
// for option parsing (not for dispatching to command implementations); the existing `cli.ts`
// dispatch (switch on `cliOptions.command`) is unchanged.
//
// The parent command declares every option (so options can be given before or after the command
// name) plus a positional `[command]` argument. The `config` command is declared as a commander
// subcommand so its extra positional args (e.g. `config get <name>`) are handled natively, while
// commander errors on excess positional args for all other commands.
//
// Certain yargs-parser behaviors are preserved by `BeachballOption`/`BeachballCommand`:
// - camelCase flags (e.g. `--gitTags`) in addition to dashed flags (e.g. `--git-tags`)
// - extra long-flag aliases (e.g. `--config` for `--config-path`)
// - boolean options automatically get a negated `--no-` form
//
// Other yargs-parser behaviors are NOT preserved:
// - arbitrary unknown options are errors
// - boolean options do not accept a value (e.g. `--verbose true` is an error)

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
 * Also configures the description and version. In Jest, it configures commander to throw on error
 * and write to no-op functions (though passing `outputOptions` is recommended).
 *
 * @returns The program plus a getter for the parse result (populated by the action handlers when
 * `program.parse()` is called).
 */
function buildProgram(params: Pick<ProgramContext, 'outputOptions' | 'version'>): {
  program: Command;
  getResult: () => ParseResult;
} {
  const { version } = params;

  const program = new BeachballCommand();
  program.name('beachball');
  program.description(`beachball${version ? ` v${version}` : ''} - the sunniest version bumping tool`);
  program.usage('<command> [options]');

  let outputOptions = params.outputOptions;
  if (env.isJest) {
    program.exitOverride();
    outputOptions ??= { writeOut: () => {}, writeErr: () => {} };
  }
  outputOptions && program.configureOutput(outputOptions);

  program.addAllOptions(optionDefinitions);
  // set this last so it's at the end of help
  version && program.version(version);

  // The single positional is the command name (any value; validated by the caller/cli.ts).
  program.addArgument(
    new Argument('[command]', 'beachball command to run').default(defaultCommand).choices(allCommands)
  );

  let result: ParseResult = { command: defaultCommand, options: {}, extraArgs: [] };

  program.action((command: string) => {
    result = { command, options: program.opts(), extraArgs: [] };
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
export function getCliOptions(programContext: ProgramContext): ParsedOptions['cliOptions'] {
  // Be careful not to mutate the input argv
  const trimmedArgv = programContext.argv.slice(2);

  const { program, getResult } = buildProgram(programContext);
  program.parse(trimmedArgv, { from: 'user' });
  const { command, options, extraArgs: extraPositionalArgs } = getResult();

  let cwd = programContext.cwd;
  try {
    // If a non-empty cwd is provided, find the project root from there.
    // Empty means this is a test without a filesystem.
    if (cwd && !env.isJest) {
      cwd = findProjectRoot(programContext.cwd);
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
