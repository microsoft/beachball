import { Command, Option, InvalidArgumentError, Help } from 'commander';
import { resolveRemoteAndBranch } from 'workspace-tools';
import type { CliOptions } from '../types/BeachballOptions';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import { getDefaultOptions } from './getDefaultOptions';
import type { OptionDefinition, OptionType } from './cliOptionDefinitions';
import { env } from '../env';

declare module 'commander' {
  interface Option {
    /**
     * Check if the argument matches this option. (missing from public types)
     * @param arg Flag only, e.g. `--foo` or `-f`
     */
    is(arg: string): boolean;
  }
}

/** Value placeholder shown after each option flag, by option type. */
const valueSyntax: Record<OptionType, string> = {
  string: '<value>',
  number: '<num>',
  boolean: '',
  array: '<value...>',
};

/**
 * Custom Commander `Option` that matches camelCase spellings of its dashed flag and has special
 * handling of other behaviors from `OptionDefinition`.
 */
export class BeachballOption extends Option {
  private readonly _allFlags = new Set<string>();

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
       * If non-null/undefined/`''`, show this default value in help text, but DON'T set it as the default
       * to avoid messing up order of precedence with the config file (CLI > config file > default).
       */
      defaultValue: unknown;
    }
  ) {
    const { name: canonicalName, alias, type = 'string', negated, defaultValue, desc } = params;

    if (alias && (type === 'number' || params.parse)) {
      // This is restricted because if the user provided the invalid value with the canonical
      // option name (not the alias), commander's built-in invalid argument error would show the
      // alias name instead of what they typed, which is confusing. There's not an easy way around
      // this without adding a separate option for the alias (possible but more complex).
      // If this is needed in the future, could reconsider whether it's really so bad, or check
      // commander internals to investigate other customization possibilities.
      throw new Error(`Internal error: aliases are not supported for options with custom parsing`);
    }

    // Build short flag prefix
    let flags = params.short && !negated ? `-${params.short}, ` : '';

    // Add the long flag: use the standard dash-case name, or alias if present.
    // `--foo-bar <value>` or `--no-foo-bar` (no value for boolean)
    const prefix = negated ? '--no-' : '--';
    flags += `${prefix}${_toDashed(alias || canonicalName)}${valueSyntax[type] ? ` ${valueSyntax[type]}` : ''}`;

    // Show the default value (if any) at the end of the help text, but don't set it as commander's
    // actual default to preserve precedence (CLI > config file > default).
    const descriptionText =
      !negated && !params.desc.includes('(default:') && !([null, undefined, ''] as unknown[]).includes(defaultValue)
        ? `${desc} (default: ${JSON.stringify(defaultValue)})`
        : desc;

    super(flags, descriptionText);

    // Store all flag variants for option matching (negated if appropriate):
    // -f, --foo-bar, --fooBar, --some-alias, --someAlias
    this.short && this._allFlags.add(this.short);
    this._allFlags.add(`${prefix}${_toDashed(canonicalName)}`);
    this._allFlags.add(`${prefix}${canonicalName}`);
    alias && this._allFlags.add(`${prefix}${_toDashed(alias)}`);
    alias && this._allFlags.add(`${prefix}${alias}`);

    if (alias) {
      // Store the aliased option value under the canonical attribute
      this.attributeName = () => canonicalName;
    }

    // Negated options are hidden since BeachballHelp automatically adds `--[no-]`
    negated && this.hideHelp();

    params.choices && this.choices(params.choices);

    const parser = params.parse || (type === 'number' ? _parseNumber : undefined);
    parser && this.argParser(parser);
  }

  override is(arg: string): boolean {
    return this._allFlags.has(arg);
  }
}

class BeachballHelp extends Help {
  constructor() {
    super();
    if (env.isJest) {
      this.helpWidth = 100;
    }
  }

  /** Add `--[no-]` prefix for boolean options in help text. */
  override optionTerm(option: Option): string {
    const term = super.optionTerm(option);
    return option instanceof BeachballOption && option.isBoolean() ? term.replace('--', '--[no-]') : term;
  }
}

export class BeachballCommand extends Command {
  override createCommand(name?: string): BeachballCommand {
    return new BeachballCommand(name);
  }
  /** Not supported--use `addAllOptions` instead. */
  override option(): never {
    throw new Error('not supported by BeachballCommand');
  }
  /** Not supported--use `addAllOptions` instead. */
  override createOption(flags: string, description?: string): Option {
    if (/--(help|version)$/.test(flags)) return super.createOption(flags, description);
    throw new Error('not supported by BeachballCommand');
  }
  /** Not supported--use `addAllOptions` instead. */
  override addOption(): never {
    throw new Error('not supported by BeachballCommand');
  }

  override createHelp(): Help {
    return new BeachballHelp();
  }

  /**
   * Add every option in `optionDefinitions` to the given command, automatically handling aliases and
   * negated `--no-` boolean options.
   */
  public addAllOptions(optionDefinitions: Partial<Record<keyof CliOptions, OptionDefinition>>): this {
    const defaultOptions = getDefaultOptions();

    for (const [name, def] of Object.entries(optionDefinitions) as [keyof CliOptions, OptionDefinition][]) {
      const params = { name, ...def, defaultValue: defaultOptions[name] };
      super.addOption(new BeachballOption(params));
      // For booleans, commander requires manually adding negated option variants
      if (def.type === 'boolean') {
        super.addOption(new BeachballOption({ ...params, negated: true }));
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
