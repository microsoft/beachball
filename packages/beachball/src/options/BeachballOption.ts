import { InvalidArgumentError, Option } from 'commander';
import type { CliOptions } from '../types/BeachballOptions';
import { optionGroups, type OptionDefinition, type OptionGroup, type OptionType } from './optionDefinitions';

declare module 'commander' {
  interface Option {
    /**
     * Check if the argument matches this option. (missing from public types)
     * @param arg Flag only, e.g. `--foo` or `-f`
     */
    is(arg: string): boolean;
  }
}

/** Constructor params for `BeachballOption` */
export interface BeachballOptionParams extends OptionDefinition {
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
  defaultValue?: unknown;
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
  public readonly group: OptionGroup | undefined;
  /** The option is only shown in help for these command names */
  public readonly commands: readonly string[] | true;

  /** All long and short flag spellings for this item */
  private readonly _allFlags = new Set<string>();
  private readonly _descriptionForCommand?: (cmdName: string | undefined) => string;

  constructor(params: BeachballOptionParams) {
    const { name: canonicalName, alias, type = 'string', negated, defaultValue, desc } = params;

    if (alias && (type === 'number' || params.parse)) {
      // If the user provided the invalid value with the canonical option name (not the alias),
      // commander's built-in invalid argument error would show the alias name instead of what
      // they typed, which is confusing. There's not an easy way around this without adding a
      // separate option for the alias (possible but more complex; could reconsider if needed).
      throw new Error(`Internal error: aliases are not supported for options with custom parsing`);
    }

    // Build short flag prefix
    const maybeShort = params.short && !negated ? `-${params.short}, ` : '';
    // Add the primary long flag: use the standard dash-case name, or alias if present.
    // `--foo-bar <value>` or `--no-foo-bar` (no value for boolean)
    const prefix = negated ? '--no-' : '--';
    super(
      `${maybeShort}${prefix}${_toDashed(alias || canonicalName)}${valueSyntax[type] ? ` ${valueSyntax[type]}` : ''}`
    );

    this.description = typeof desc === 'function' ? desc(undefined) : desc;
    this._descriptionForCommand = typeof desc === 'function' ? desc : undefined;

    // Save the default value (if any) to show at the end of the help text, but don't set it as
    // commander's actual default to preserve precedence (CLI > config file > default).
    if (!negated && !([null, undefined, ''] as unknown[]).includes(defaultValue)) {
      this.defaultValueDescription = JSON.stringify(defaultValue);
    }

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
    params.conflicts && this.conflicts(params.conflicts as string[]);
    this.commands = params.commands;
    this.group = params.group;
    this.helpGroup(optionGroups[params.group || 'default']);

    const parser = params.parse || (type === 'number' ? _parseNumber : undefined);
    parser && this.argParser(parser);
  }

  override is(arg: string): boolean {
    return this._allFlags.has(arg);
  }

  /** If this option has a custom description function, set the description for the given command. */
  public setDescriptionForCommand(cmdName: string): void {
    if (this._descriptionForCommand) {
      this.description = this._descriptionForCommand(cmdName);
    }
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
