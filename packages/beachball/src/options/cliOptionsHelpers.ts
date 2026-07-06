import { Command, Option, InvalidArgumentError } from 'commander';
import { resolveRemoteAndBranch } from 'workspace-tools';
import type { CliOptions } from '../types/BeachballOptions';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import { getDefaultOptions } from './getDefaultOptions';

declare module 'commander' {
  interface Option {
    /** Check if the argument matches this option. (missing from public types) */
    is(arg: string): boolean;
  }
}

type OptionType = 'string' | 'number' | 'boolean' | 'array';

/** Definition of a single CLI option, used to build its commander `Option`. */
export interface OptionDefinition {
  desc: string;
  /**
   * Single-character short flag (without dash), e.g. `b` for `--branch`.
   * For options with an alias, this is only applied to the alias variant of the option.
   */
  short?: string;
  /**
   * Extra long-flag alias (without dashes), e.g. `config` for the `configPath` option. When set,
   * the alias is shown in help *instead of* the canonical dashed name, but the value is still
   * stored under the canonical name.
   */
  alias?: string;
  /**
   * Value type. `'array'` is currently always a string array.
   * `'boolean'` values get a negated `--no-` form automatically when added via `addAllOptions`.
   * @default 'string'
   */
  type?: OptionType;
  /** Parse the value or throw `InvalidArgumentError` if invalid. */
  parse?: (value: string, previous: unknown) => unknown;
  /** Valid choices, such as for `disallowedChangeTypes`. */
  choices?: string[];
  /** Omit the default option from `getDefaultOptions` from the help text. */
  omitDefault?: boolean;
}

/** Value placeholder shown after each option flag, by option type. */
const valueSyntax: Record<OptionType, string> = {
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
  constructor(
    params: OptionDefinition & {
      /**
       * Canonical camelCase option name (a key of `CliOptions`).
       * If `OptionDefinition.alias` is set, the main option's help will be hidden.
       */
      name: keyof CliOptions;
      /** If true, build the negated `--no-` form of a boolean option. */
      negated?: boolean;
      /**
       * True if this option represents the alias for `name`.
       * It will still be stored under the canonical `name`, but the alias will be shown in help.
       */
      isAlias?: boolean;
      /**
       * If non-null/undefined, show this default value in help text, but DON'T set it as the default
       * to avoid messing up order of precedence with the config file (CLI > config file > default).
       */
      defaultValue: unknown;
    }
  ) {
    const { name, alias, isAlias, type = 'string', negated, defaultValue } = params;
    const showOptionName = (isAlias && alias) || name;
    const dashed = _toDashed(showOptionName);
    const suffix = valueSyntax[type] ? ` ${valueSyntax[type]}` : '';
    // For commands with an alias, only add the short option to the alias variant to avoid conflicts
    const shortPrefix = params.short && !negated && (!alias || isAlias) ? `-${params.short}, ` : '';
    const canonicalLong = negated ? `--no-${dashed}` : `--${dashed}${suffix}`;
    // Show the default value (if any) at the end of the help text, but don't set it as commander's
    // actual default to preserve precedence (CLI > config file > default).
    const defaultSuffix =
      !negated && !params.omitDefault && defaultValue !== null && defaultValue !== undefined
        ? ` (default: ${JSON.stringify(defaultValue)})`
        : '';
    super(`${shortPrefix}${canonicalLong}`, negated ? undefined : `${params.desc}${defaultSuffix}`);

    if (alias) {
      if (isAlias) {
        // For the alias variant of an option, use the actual CliOptions key in the result
        this.attributeName = () => name;
      } else {
        // Hide help for the literal variant of an option with an alias
        this.hideHelp();
      }
    }

    if (!negated) {
      params.choices && this.choices(params.choices);
      const parser = params.parse ?? (params.type === 'number' ? _parseNumber : undefined);
      if (parser) {
        this.argParser(parser);
      }
    }
  }

  override is(arg: string): boolean {
    // Exact short/long match
    if (super.is(arg)) {
      return true;
    }
    // Only extend matching for long flags; short flags are matched exactly above.
    if (!arg.startsWith('--')) {
      return false;
    }
    const argName = _normalizeFlagName(arg);
    // Match the option's own long flag in either dashed or camelCase spelling.
    return this.long ? _normalizeFlagName(this.long) === argName : false;
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
  /** Not supported--use `addOption(new FlexibleOption(...))` instead. */
  override option(): never {
    throw new Error('not supported by FlexibleCommand');
  }
  /** Not supported--use `addOption(new FlexibleOption(...))` instead. */
  override createOption(flags: string, description?: string): Option {
    if (flags.endsWith('--help')) return super.createOption(flags, description);
    throw new Error('not supported by FlexibleCommand');
  }

  /**
   * Add every option in `optionDefinitions` to the given command, automatically handling aliases and
   * negated `--no-` boolean options.
   */
  public addAllOptions(optionDefinitions: Record<string, OptionDefinition>): this {
    const defaultOptions = getDefaultOptions();

    for (const [name, def] of Object.entries(optionDefinitions) as [keyof CliOptions, OptionDefinition][]) {
      const mainParams = { name, ...def, defaultValue: defaultOptions[name] };
      this.addOption(new FlexibleOption(mainParams));
      def.alias && this.addOption(new FlexibleOption({ ...mainParams, isAlias: true }));
      if (def.type === 'boolean') {
        this.addOption(new FlexibleOption({ ...mainParams, negated: true }));
        def.alias && this.addOption(new FlexibleOption({ ...mainParams, isAlias: true, negated: true }));
      }
    }

    return this;
  }
}

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
