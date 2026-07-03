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

// NOTE: This file was migrated from yargs-parser to commander@14. Commander is currently used only
// for option parsing (not for dispatching to command implementations); the existing `cli.ts`
// dispatch (switch on `cliOptions.command`) is unchanged.
//
// A single commander command declares every option (so options can be given before or after the
// command name) plus two positional arguments: the command name and any extra positional args
// (e.g. `config get <name>`). A later change will split up which options apply to which commands.
//
// Each option is declared in its canonical dashed form. Commander is a schema-first parser, so
// several permissive behaviors that yargs-parser accepted are reproduced with small argv
// preprocessing passes (see `normalizeArgv`) plus a mini-parser for arbitrary unknown options
// (`extractUnknownOptions`):
//   - camelCase flags (`--gitTags`) and extra long aliases (`--config`, `--force`, `--since`)
//     are normalized to their canonical dashed form before parsing.
//   - boolean values passed via `=` or as a separate token (`--fetch=false`, `--yes false`) are
//     rewritten to commander's flag / `--no-` negation form.
//   - arbitrary unknown options are parsed with yargs-like type inference.
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

/**
 * Build an `argParser` for a non-array option that throws if the option is specified more than once
 * (commander passes the previously-parsed value as the second argument). This matches yargs-parser,
 * which errored on repeated single-value options. An optional `coerce` transforms each value.
 */
function parseSingle<T>(name: string, coerce?: (value: string) => T): (value: string, previous: unknown) => T | string {
  return (value: string, previous: unknown) => {
    if (previous !== undefined) {
      throw new Error(`Option "${name}" can only be specified once`);
    }
    return coerce ? coerce(value) : value;
  };
}

/** Collector for array options: accumulate repeated/variadic values into a single array. */
function collectArray(value: string, previous: string[] | undefined): string[] {
  return previous ? [...previous, value] : [value];
}

/** Infer the type of an unknown option's value the way yargs-parser did. */
function inferUnknownValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * Map of alternate long-flag spellings to their canonical dashed flag (without leading `--`).
 * Covers camelCase spellings of dashed options (`gitTags` => `git-tags`) and extra long aliases
 * (`config` => `config-path`).
 */
const flagAliasMap: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const name of allOptionNames) {
    const dashed = toDashed(name);
    if (name !== dashed) {
      map[name] = dashed; // camelCase spelling => dashed canonical
    }
  }
  for (const [alias, name] of Object.entries(longAliases)) {
    map[alias] = toDashed(name);
  }
  return map;
})();

/** Dashed names of boolean options (e.g. `git-tags`). */
const booleanDashedSet = new Set<string>(booleanOptions.map(toDashed));

/** Short flag character => camelCase option name (e.g. `y` => `yes`). */
const shortToName: Record<string, keyof CliOptions> = (() => {
  const map: Record<string, keyof CliOptions> = {};
  for (const [name, short] of Object.entries(shortAliases)) {
    map[short] = name as keyof CliOptions;
  }
  return map;
})();

/** All known long flag names (dashed), including `no-*` negations for boolean options. */
const knownLongSet: Set<string> = (() => {
  const set = new Set<string>();
  for (const name of allOptionNames) {
    set.add(toDashed(name));
  }
  for (const name of booleanOptions) {
    set.add(`no-${toDashed(name)}`);
  }
  return set;
})();

/** Split a `--flag` or `--flag=value` token into its name and (optional) inline value. */
function splitLongFlag(token: string): { name: string; value?: string } {
  const rest = token.slice(2);
  const eq = rest.indexOf('=');
  return eq === -1 ? { name: rest } : { name: rest.slice(0, eq), value: rest.slice(eq + 1) };
}

/**
 * Preprocess argv to reproduce yargs-parser behaviors that commander doesn't support natively:
 * - normalize camelCase and long-alias long flags to their canonical dashed form;
 * - rewrite boolean values passed via `=` or as a separate `true`/`false` token to commander's
 *   flag / `--no-` negation form.
 */
function normalizeArgv(argv: string[]): string[] {
  const result: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token.startsWith('--')) {
      const split = splitLongFlag(token);
      const { value } = split;
      // Normalize alternate long-flag spellings to the canonical dashed form.
      const name = flagAliasMap[split.name] ?? split.name;

      // Boolean value passed via `=` (e.g. `--fetch=false` => `--no-fetch`).
      if (value !== undefined && booleanDashedSet.has(name) && (value === 'true' || value === 'false')) {
        result.push(value === 'true' ? `--${name}` : `--no-${name}`);
        continue;
      }

      // Boolean value passed as a separate token (e.g. `--yes false` => `--no-yes`).
      if (value === undefined && booleanDashedSet.has(name)) {
        const next = argv[i + 1];
        if (next === 'true' || next === 'false') {
          result.push(next === 'true' ? `--${name}` : `--no-${name}`);
          i++; // consume the value token
          continue;
        }
      }

      // Push the (possibly renamed) flag, preserving any inline value.
      result.push(value === undefined ? `--${name}` : `--${name}=${value}`);
      continue;
    }

    // Short boolean flag with a separate `true`/`false` value (e.g. `-y false` => `--no-yes`).
    if (token.length === 2 && token[0] === '-' && token[1] !== '-') {
      const optionName = shortToName[token[1]];
      if (optionName && (booleanOptions as readonly string[]).includes(optionName)) {
        const next = argv[i + 1];
        if (next === 'true' || next === 'false') {
          result.push(next === 'true' ? `--${toDashed(optionName)}` : `--no-${toDashed(optionName)}`);
          i++; // consume the value token
          continue;
        }
      }
    }

    result.push(token);
  }

  return result;
}

/**
 * Extract arbitrary unknown options from argv, reproducing yargs-parser's type inference (boolean
 * for bare flags, number for numeric strings, string otherwise, array when repeated). Known options
 * and positionals are left in place for commander to parse.
 *
 * @returns the remaining argv (known options + positionals) and a map of the parsed unknown options.
 */
function extractUnknownOptions(argv: string[]): { remaining: string[]; unknown: Record<string, unknown> } {
  const remaining: string[] = [];
  const unknown: Record<string, unknown> = {};

  const record = (name: string, value: unknown): void => {
    if (name in unknown) {
      const prev = unknown[name];
      unknown[name] = Array.isArray(prev) ? [...(prev as unknown[]), value] : [prev, value];
    } else {
      unknown[name] = value;
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token.startsWith('--')) {
      const { name, value } = splitLongFlag(token);

      // Known options (including `no-*` negations) are handled by commander.
      if (knownLongSet.has(name)) {
        remaining.push(token);
        continue;
      }

      // Unknown negated boolean (e.g. `--no-bar` => `bar: false`).
      if (name.startsWith('no-')) {
        record(name.slice(3), false);
        continue;
      }

      // Unknown option with an inline value (e.g. `--foo=bar`).
      if (value !== undefined) {
        record(name, inferUnknownValue(value));
        continue;
      }

      // Unknown option; consume the next token as its value unless it's another flag.
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        record(name, inferUnknownValue(next));
        i++; // consume the value token
      } else {
        record(name, true);
      }
      continue;
    }

    // Known/unknown short flags and positionals are left for commander.
    remaining.push(token);
  }

  return { remaining, unknown };
}

/** Add every beachball option (in its canonical dashed form) to the given command. */
function addAllOptions(command: Command): void {
  const flags = (name: string, valuePlaceholder?: string): string => {
    const dashed = toDashed(name);
    const short = shortAliases[name as keyof CliOptions];
    const long = valuePlaceholder ? `--${dashed} ${valuePlaceholder}` : `--${dashed}`;
    return short ? `-${short}, ${long}` : long;
  };

  for (const name of stringOptions) {
    command.addOption(new Option(flags(name, '<value>')).argParser(parseSingle(name)));
  }

  for (const name of numberOptions) {
    command.addOption(new Option(flags(name, '<value>')).argParser(parseSingle(name, parseNumber(name))));
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

/** Result captured from parsing. */
interface ParseResult {
  command: string;
  options: OptionValues;
  extraArgs: string[];
}

/**
 * Build a single commander command with every option (so options can be given before or after the
 * command name) plus positional arguments for the command name and any extra positional args.
 * Commander is currently used only for parsing, not command dispatch.
 *
 * @returns The program plus a getter for the parse result (populated by the action handler when
 * `program.parse()` is called).
 */
function buildProgram(): { program: Command; getResult: () => ParseResult } {
  const program = new Command();

  // Throw instead of calling process.exit() or writing to stdout/stderr on error, so callers and
  // tests can handle failures.
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} }); // suppress commander output

  // Allow any short flags not explicitly defined to pass through without erroring. (Unknown long
  // options are pulled out beforehand by `extractUnknownOptions`.)
  program.allowUnknownOption();
  program.allowExcessArguments();

  addAllOptions(program);

  // The first positional is the command name (any value; validated by the caller/cli.ts), and any
  // remaining positionals are extra args (e.g. for `config get <name>`).
  program.argument('[command]', 'beachball command to run');
  program.argument('[extraArgs...]', 'extra positional arguments (e.g. for `config get <name>`)');

  let result: ParseResult = { command: defaultCommand, options: {}, extraArgs: [] };

  program.action((command: string | undefined, extraArgs: string[]) => {
    result = {
      command: command ?? defaultCommand,
      options: program.opts(),
      extraArgs: extraArgs ?? [],
    };
  });

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

  // Preprocess argv to reproduce yargs-parser behaviors commander doesn't support natively:
  // normalize alternate flag spellings and boolean values, then pull out arbitrary unknown options
  // (with type inference) so they don't interfere with commander's positional/command detection.
  const normalizedArgv = normalizeArgv(trimmedArgv);
  const { remaining, unknown } = extractUnknownOptions(normalizedArgv);

  const { program, getResult } = buildProgram();
  program.parse(remaining, { from: 'user' });
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
    ...unknown,
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
