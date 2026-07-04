import { Command, Option, InvalidArgumentError, type Help, type ParseOptionsResult } from 'commander';
import { resolveRemoteAndBranch } from 'workspace-tools';
import type { CliOptions } from '../types/BeachballOptions';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import { getDefaultOptions } from './getDefaultOptions';

/** Definition of a single CLI option, used to build its commander `Option`. */
export interface OptionDefinition {
  desc: string;
  /** Single-character short flag (without dash), e.g. `b` for `--branch`. */
  short?: string;
  /**
   * Extra long-flag alias (without dashes), e.g. `config` for the `configPath` option. When set,
   * the alias is shown in help *instead of* the canonical dashed name, but the value is still
   * stored under the canonical name.
   */
  alias?: string;
  /**
   * Value type. `'array'` is currently always a string array.
   * `'boolean'` values get a negated `--no-` form automatically.
   * @default 'string'
   */
  type?: 'string' | 'number' | 'boolean' | 'array';
  /** Parse the value or throw `InvalidArgumentError` if invalid. */
  parse?: (value: string, previous: unknown) => unknown;
  /** Valid choices, such as for `disallowedChangeTypes`. */
  choices?: string[];
  /** Omit the default option from `getDefaultOptions` from the help text. */
  omitDefault?: boolean;
}

/** Value placeholder shown after each option flag, by option type. */
const valueSyntax: Record<NonNullable<OptionDefinition['type']>, string> = {
  string: '<value>',
  number: '<value>',
  boolean: '',
  array: '<value...>',
};

/**
 * Custom Commander `Option` that matches camelCase spellings of its dashed flag (`--gitTags`
 * for `--git-tags`) and any extra long-flag `alias` (`--config` for `--config-path`).
 */
export class FlexibleOption extends Option {
  /** Extra long-flag alias name (without dash or `--no-` prefix), e.g. `config` for `--config-path`. */
  readonly alias: string | undefined;
  /** Help term to display instead of `flags` (used to show the alias instead of the canonical name). */
  readonly displayTerm?: string;

  constructor(
    params: OptionDefinition & {
      /** Canonical camelCase option name (a key of `CliOptions`). */
      name: keyof CliOptions;
      /** If true, build the negated `--no-` form of a boolean option. */
      negated?: boolean;
      /**
       * If non-null/undefined, show this default value in help text, but DON'T set it as the default
       * to avoid messing up order of precedence with the config file (CLI > config file > default).
       */
      defaultValue: unknown;
    }
  ) {
    const { name, type = 'string', negated, defaultValue } = params;
    const dashed = _toDashed(name);
    const suffix = valueSyntax[type] ? ` ${valueSyntax[type]}` : '';
    const shortPrefix = params.short && !negated ? `-${params.short}, ` : '';
    const canonicalLong = negated ? `--no-${dashed}` : `--${dashed}${suffix}`;
    // Show the default value (if any) at the end of the help text, but don't set it as commander's
    // actual default to preserve precedence (CLI > config file > default).
    const defaultSuffix =
      !negated && !params.omitDefault && defaultValue !== null && defaultValue !== undefined
        ? ` (default: ${JSON.stringify(defaultValue)})`
        : '';
    super(`${shortPrefix}${canonicalLong}`, negated ? undefined : `${params.desc}${defaultSuffix}`);

    if (params.alias) {
      this.alias = params.alias;
      // Show the alias instead of the canonical name in help.
      const aliasDashed = _toDashed(params.alias);
      const aliasLong = negated ? `--no-${aliasDashed}` : `--${aliasDashed}${suffix}`;
      this.displayTerm = `${shortPrefix}${aliasLong}`;
    }

    if (!negated) {
      if (params.choices) {
        this.choices(params.choices);
      }
      const parser = params.parse ?? (params.type === 'number' ? _parseNumber : undefined);
      if (parser) {
        this.argParser(parser);
      }
    }
  }

  is(arg: string): boolean {
    // Exact short/long match (the base `Option.is`, which isn't in the public types).
    if (this.short === arg || this.long === arg) {
      return true;
    }
    // Only extend matching for long flags; short flags are matched exactly above.
    if (!arg.startsWith('--')) {
      return false;
    }
    const argName = _normalizeFlagName(arg);
    // Match the option's own long flag in either dashed or camelCase spelling.
    if (this.long && _normalizeFlagName(this.long) === argName) {
      return true;
    }
    // Match any alias, applying the `--no-` prefix for negated options.
    return this.alias ? _normalizeFlagName(this.negate ? `--no-${this.alias}` : `--${this.alias}`) === argName : false;
  }
}

/**
 * A {@link Command} whose subcommands are also `FlexibleCommand`s, and whose help renders each
 * option's `displayTerm` (the alias, if any) instead of the canonical flag.
 */
export class FlexibleCommand extends Command {
  override createCommand(name?: string): FlexibleCommand {
    return new FlexibleCommand(name);
  }

  override createHelp(): Help {
    const help = super.createHelp();
    const originalOptionTerm = help.optionTerm.bind(help);
    help.optionTerm = option => (option as FlexibleOption).displayTerm ?? originalOptionTerm(option);
    return help;
  }

  /**
   * Rewrite boolean values that commander doesn't accept natively before it parses: a `true`/`false`
   * value passed via `=` or as a separate token (`--fetch=false`, `--yes false`, `-y false`) is
   * rewritten to commander's flag / `--no-` negation form. This runs as part of parsing (rather than
   * a separate preprocessing pass) so it can reuse each option's own `is()` to recognize any spelling
   * (camelCase, alias, or short) instead of re-deriving the set of boolean flag names.
   */
  override parseOptions(argv: string[]): ParseOptionsResult {
    return super.parseOptions(this._rewriteBooleanValues(argv));
  }

  /** Find a non-negated boolean option matching `flag` in any spelling, or `undefined`. */
  private _findBooleanOption(flag: string): Option | undefined {
    const option = this.options.find(opt => (opt as FlexibleOption).is(flag));
    return option?.isBoolean() ? option : undefined;
  }

  private _rewriteBooleanValues(argv: string[]): string[] {
    const result: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const token = argv[i];

      // Stop rewriting at the `--` end-of-options marker.
      if (token === '--') {
        result.push(...argv.slice(i));
        break;
      }

      if (!token.startsWith('-')) {
        result.push(token);
        continue;
      }

      const [eqFlag, eqValue] = token.split('=', 2);
      let option = eqValue === 'true' || eqValue === 'false' ? this._findBooleanOption(eqFlag) : undefined;
      if (option) {
        // boolean value passed via `=` (e.g. `--fetch=false` => `--no-fetch`).
        result.push(_toBooleanFlag(option, eqValue as 'true' | 'false'));
      } else if (eqValue !== undefined) {
        // non-boolean value passed via `=`
        result.push(token);
      } else {
        // boolean value passed as a separate `true`/`false` token (e.g. `--yes false`, `-y false`).
        const next = argv[i + 1];
        option = next === 'true' || next === 'false' ? this._findBooleanOption(token) : undefined;
        if (option) {
          result.push(_toBooleanFlag(option, next as 'true' | 'false'));
          i++; // consume the value token
        } else {
          result.push(token);
        }
      }
    }
    return result;
  }
}

/**
 * Add every option in `optionDefinitions` to the given command (plus the negated `--no-` form for
 * each boolean option).
 */
export function addAllOptions(params: { command: Command; optionDefinitions: Record<string, OptionDefinition> }): void {
  const { command, optionDefinitions } = params;

  const defaultOptions = getDefaultOptions();

  for (const [name, def] of Object.entries(optionDefinitions) as [keyof CliOptions, OptionDefinition][]) {
    command.addOption(new FlexibleOption({ name, ...def, defaultValue: defaultOptions[name] }));
    if (def.type === 'boolean') {
      command.addOption(new FlexibleOption({ name, ...def, negated: true, defaultValue: defaultOptions[name] }));
    }
  }
}

/** Convert a camelCase option name to its dashed CLI flag form (e.g. `gitTags` => `git-tags`). */
export function _toDashed(name: string): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** Build the flag (`--foo`) or negation (`--no-foo`) form for a boolean option and `true`/`false` value. */
function _toBooleanFlag(option: Option, value: 'true' | 'false'): string {
  return value === 'true' ? `--${option.name()}` : `--no-${option.name()}`;
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
 * Normalize a flag to a canonical camelCase key for comparison, so dashed and camelCase spellings
 * of the same option match (e.g. `--git-tags` and `--gitTags` => `gitTags`; `--no-git-tags` and
 * `--no-gitTags` => `noGitTags`). Leading dashes are stripped before normalizing.
 */
export function _normalizeFlagName(flag: string): string {
  return flag
    .replace(/^--?/, '')
    .split('-')
    .reduce((acc, word, i) => (i === 0 ? word : acc + (word ? word[0].toUpperCase() + word.slice(1) : '')), '');
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
