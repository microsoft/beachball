import type { Command, OptionValues, OutputConfiguration } from 'commander';
import { findProjectRoot } from 'workspace-tools';
import { env } from '../env';
import type { CliOptions, ParsedOptions } from '../types/BeachballOptions';
import { FlexibleCommand, resolveBranchOption, type OptionDefinition } from './cliOptionsHelpers';

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
// Unlike yargs-parser (which accepted arbitrary unknown flags), commander errors on unknown
// options. This is an intentional breaking change for v3.
//
// Each option is declared in its canonical dashed form. Commander is a schema-first parser, so a
// few permissive behaviors that yargs-parser accepted are reproduced:
//   - camelCase flags (`--gitTags`) and extra long aliases (`--config`, `--force`, `--since`) are
//     matched natively by the `FlexibleOption`/`FlexibleCommand` subclasses.
//   - boolean values passed via `=` or as a separate token (`--fetch=false`, `--yes false`) are
//     rewritten to commander's flag / `--no-` negation form during parsing by
//     `FlexibleCommand.parseOptions`.

/** Command run when none is specified on the command line. */
const defaultCommand = 'change';

/**
 * Single source of truth for every parseable CLI option: its type, description, short flag, and
 * optional long-flag alias. TypeScript enforces (via the `Record<Exclude<...>>` type) that every
 * `CliOptions` key except the ones filled in elsewhere has an entry here.
 */
const optionDefinitions: Record<
  Exclude<keyof CliOptions, 'path' | 'command' | '_extraPositionalArgs' | 'version' | 'help'>,
  OptionDefinition
> = {
  // array options
  disallowedChangeTypes: { type: 'array', desc: 'change types that are not allowed' },
  package: {
    type: 'array',
    short: 'p',
    desc: 'force creating a change file for this package (can be specified multiple times)',
  },
  scope: {
    type: 'array',
    desc: 'only consider package paths matching this pattern (can be specified multiple times; supports negations)',
  },
  // boolean options
  all: { type: 'boolean', desc: 'generate change files for all packages' },
  bump: { type: 'boolean', desc: 'bump versions during publish' },
  bumpDeps: { type: 'boolean', desc: 'bump dependent packages during publish' },
  commit: { type: 'boolean', desc: 'commit change files after "change"' },
  disallowDeletedChangeFiles: {
    type: 'boolean',
    desc: 'verify that no change files were deleted between head and target branch',
  },
  fetch: { type: 'boolean', desc: 'fetch from the remote before determining changes' },
  forceVersions: {
    type: 'boolean',
    alias: 'force',
    desc: "for 'sync': use the version from the registry even if it's older than local",
  },
  gitTags: { type: 'boolean', desc: 'create git tags for each published package version' },
  keepChangeFiles: { type: 'boolean', desc: "don't delete the change files from disk after bumping" },
  publish: { type: 'boolean', desc: 'publish to the npm registry' },
  push: { type: 'boolean', desc: 'push changes back to the remote git branch' },
  verbose: { type: 'boolean', desc: 'print additional information to the console' },
  yes: { type: 'boolean', short: 'y', desc: 'skip the confirmation prompts' },
  // number options
  concurrency: { type: 'number', desc: 'maximum concurrency for write operations such as publishing' },
  depth: { type: 'number', desc: 'for shallow clones: depth of git history to consider when fetching' },
  npmReadConcurrency: {
    type: 'number',
    desc: 'maximum concurrency for reading package versions from the registry',
  },
  gitTimeout: { type: 'number', desc: 'timeout in ms for git push operations' },
  retries: { type: 'number', desc: 'number of retries for an npm publish before failing' },
  timeout: { type: 'number', desc: 'timeout in ms for npm operations (other than install)' },
  // string options
  access: { desc: 'npm publish access level: "public" or "restricted"' },
  authType: { short: 'a', desc: 'npm auth type for NPM_TOKEN: "authtoken" or "password"' },
  branch: { short: 'b', desc: 'target branch from remote (default: git config init.defaultBranch)', omitDefault: true },
  canaryName: { desc: 'dist-tag and version name to use for canary publishes' },
  changehint: { desc: 'customized hint message shown when a change file is needed but missing' },
  changeDir: { desc: 'name of the directory to store change files' },
  configPath: {
    short: 'c',
    alias: 'config',
    desc: 'custom beachball config path (default: cosmiconfig standard paths)',
  },
  dependentChangeType: { desc: 'change type to use for dependent packages (default: patch)' },
  fromRef: { alias: 'since', desc: 'consider changes or change files since this git ref (branch name, commit SHA)' },
  message: { short: 'm', desc: 'for "change", the change description; for "publish", the commit message' },
  packToPath: { desc: 'pack packages to tgz files under this path instead of publishing to npm' },
  prereleasePrefix: { desc: 'prerelease prefix for packages that will receive a prerelease bump' },
  registry: { short: 'r', desc: 'npm registry' },
  tag: { short: 't', desc: 'npm dist-tag for publishes (default: "latest")', omitDefault: true },
  token: { short: 'n', desc: 'npm auth token (defaults to the NPM_TOKEN environment variable)' },
  type: { desc: 'type of change: e.g. major, minor, patch, none (instead of prompting)' },
};

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

  const program = new FlexibleCommand();
  program.name('beachball');
  program.description(`beachball${version ? ` v${version}` : ''} - the sunniest version bumping tool`);
  program.usage('<command> [options]');

  let outputOptions = params.outputOptions;
  if (env.isJest) {
    program.exitOverride(err => {
      throw err;
    });
    outputOptions ??= { writeOut: () => {}, writeErr: () => {} };
  }
  outputOptions && program.configureOutput(outputOptions);

  program.addAllOptions(optionDefinitions);
  // set this last so it's at the end of help
  version && program.version(version);

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
