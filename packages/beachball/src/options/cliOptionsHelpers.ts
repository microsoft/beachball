import { type Command, Option, InvalidArgumentError } from 'commander';
import type { CliOptions } from '../types/BeachballOptions';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import { resolveRemoteAndBranch } from '../git/tempGetDefaultRemoteBranch';

/** Convert a camelCase option name to its dashed CLI flag form (e.g. `gitTags` => `git-tags`). */
export function _toDashed(name: string): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** Coerce a value to a number, throwing `InvalidArgumentError` if it's not numeric. */
export function _parseNumber(value: string): number {
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new InvalidArgumentError('Expected numeric value.');
  }
  return num;
}

/**
 * Build an `argParser` for a non-array option that throws `InvalidArgumentError` if the option is
 * specified more than once (commander passes the previously-parsed value as the second argument).
 * @param coerce Optional function to transform the value before returning it.
 */
export function _parseSingle<T>(coerce?: (value: string) => T): (value: string, previous: unknown) => T | string {
  return (value: string, previous: unknown) => {
    if (previous !== undefined) {
      throw new InvalidArgumentError('Option can only be specified once.');
    }
    return coerce ? coerce(value) : value;
  };
}

/** Collector for array options: accumulate repeated/variadic values into a single array. */
function collectArray(value: string, previous: string[] | undefined): string[] {
  return previous ? [...previous, value] : [value];
}

/**
 * Get a map of alternate long-flag spellings to their canonical dashed flag (without leading `--`).
 * Covers camelCase spellings of dashed options (`gitTags` => `git-tags`) and extra long aliases
 * (`config` => `config-path`).
 */
export function _getFlagAliasMap(params: {
  allOptionNames: readonly (keyof CliOptions)[];
  longAliases: Record<string, keyof CliOptions>;
}): Record<string, string> {
  const { allOptionNames, longAliases } = params;
  const map: Record<string, string> = {};
  for (const name of allOptionNames) {
    const dashed = _toDashed(name);
    if (name !== dashed) {
      map[name] = dashed; // camelCase spelling => dashed canonical
    }
  }
  for (const [alias, name] of Object.entries(longAliases)) {
    map[alias] = _toDashed(name);
  }
  return map;
}

/**
 * Preprocess argv to reproduce yargs-parser behaviors that commander doesn't support natively:
 * - normalize camelCase and long-alias long flags to their canonical dashed form;
 * - rewrite boolean values passed via `=` or as a separate `true`/`false` token to commander's
 *   flag / `--no-` negation form.
 */
export function normalizeArgv(params: {
  argv: string[];
  allOptionNames: readonly (keyof CliOptions)[];
  longAliases: Record<string, keyof CliOptions>;
  booleanOptions: readonly (keyof CliOptions)[];
  shortAliases: Partial<Record<keyof CliOptions, string>>;
}): string[] {
  const { argv, booleanOptions, shortAliases } = params;
  const result: string[] = [];

  /** Dashed names of boolean options (e.g. `git-tags`). */
  const booleanDashedSet = new Set<string>(booleanOptions.map(_toDashed));

  /** map of alternate long-flag spellings to their canonical dashed flag (without leading `--`) */
  const flagAliasMap = _getFlagAliasMap(params);

  /** Short flag character => camelCase option name mapping (e.g. `y` => `yes`). */
  const shortToName = Object.fromEntries(
    Object.entries(shortAliases).map(([name, short]) => [short, name as keyof CliOptions])
  );

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token.startsWith('--')) {
      // Split a `--flag` or `--flag=value` token into its name and (optional) inline value
      const [splitName, value] = token.slice(2).split('=', 2);
      // Normalize alternate long-flag spellings to the canonical dashed form.
      const name = flagAliasMap[splitName] ?? splitName;

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
          result.push(next === 'true' ? `--${_toDashed(optionName)}` : `--no-${_toDashed(optionName)}`);
          i++; // consume the value token
          continue;
        }
      }
    }

    result.push(token);
  }

  return result;
}

/** Add every beachball option (in its canonical dashed form) to the given command. */
export function addAllOptions(params: {
  command: Command;
  stringOptions: readonly (keyof CliOptions)[];
  numberOptions: readonly (keyof CliOptions)[];
  arrayOptions: readonly (keyof CliOptions)[];
  booleanOptions: readonly (keyof CliOptions)[];
  optionDescriptions: Record<keyof CliOptions, string>;
  shortAliases: Partial<Record<keyof CliOptions, string>>;
}): void {
  const { command, stringOptions, numberOptions, arrayOptions, booleanOptions, optionDescriptions, shortAliases } =
    params;

  const flags = (name: string, valuePlaceholder?: string): string => {
    const dashed = _toDashed(name);
    const short = shortAliases[name as keyof CliOptions];
    const long = valuePlaceholder ? `--${dashed} ${valuePlaceholder}` : `--${dashed}`;
    return short ? `-${short}, ${long}` : long;
  };

  for (const name of stringOptions) {
    command.addOption(new Option(flags(name, '<value>'), optionDescriptions[name]).argParser(_parseSingle()));
  }

  for (const name of numberOptions) {
    command.addOption(
      new Option(flags(name, '<value>'), optionDescriptions[name]).argParser(_parseSingle(_parseNumber))
    );
  }

  for (const name of arrayOptions) {
    // Variadic to allow multiple space-separated values, plus a collector for repeated usage.
    command.addOption(new Option(flags(name, '<values...>'), optionDescriptions[name]).argParser(collectArray));
  }

  for (const name of booleanOptions) {
    command.addOption(new Option(flags(name), optionDescriptions[name]));
    // Negated form (e.g. `--no-fetch`).
    command.addOption(new Option(`--no-${_toDashed(name)}`));
  }
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
