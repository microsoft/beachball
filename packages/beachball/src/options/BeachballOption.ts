import { InvalidArgumentError, Option } from 'commander';
import type { CliOptions } from '../types/BeachballOptions';
import { optionGroups, type OptionDefinition, type OptionType } from './optionDefinitions';
import type { CommandName } from './commandDefinitions';

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
  private readonly _def: Pick<OptionDefinition, 'desc' | 'group' | 'commands'>;
  /** All long and short flag spellings for this item */
  private readonly _allFlags = new Set<string>();

  public constructor(params: BeachballOptionParams) {
    const { name: canonicalName, alias, type = 'string', negated, defaultValue } = params;

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

    // Store all flag variants for option matching (negated if appropriate):
    // -f, --foo-bar, --fooBar, --some-alias, --someAlias
    this.short && this._allFlags.add(this.short);
    this._allFlags.add(`${prefix}${_toDashed(canonicalName)}`);
    this._allFlags.add(`${prefix}${canonicalName}`);
    alias && this._allFlags.add(`${prefix}${_toDashed(alias)}`);
    alias && this._allFlags.add(`${prefix}${alias}`);

    // Store the aliased option value under the canonical attribute
    alias && (this.attributeName = () => canonicalName);

    if (negated) {
      // Negated options are hidden since BeachballHelp automatically adds `--[no-]`
      this.hideHelp();
    } else if (!([null, undefined, ''] as unknown[]).includes(defaultValue)) {
      // Save the default value (if any) to show at the end of the help text, but don't set it as
      // commander's actual default to preserve precedence (CLI > config file > default).
      this.defaultValueDescription = JSON.stringify(defaultValue);
    }

    this._def = { desc: params.desc, group: params.group, commands: params.commands };
    params.choices && this.choices(params.choices);
    params.conflicts && this.conflicts(params.conflicts as string[]);

    const parser = params.parse || (type === 'number' ? _parseNumber : undefined);
    parser && this.argParser(parser);
  }

  public override is(arg: string): boolean {
    return this._allFlags.has(arg);
  }

  /**
   * Get a command-specific description for this option.
   *
   * NOTE: BeachballHelp will set `description` as a side effect while generating a command
   * description, due to internals of the default help formatting.
   */
  public getDescriptionForCommand(subcommand: string | undefined): string {
    return typeof this._def.desc === 'function' ? this._def.desc(subcommand) : this._def.desc;
  }

  /** Get which group this option goes in for the given command. */
  public getHelpGroupHeading(subcommand: string | undefined): string {
    const groupDef = this._def.group;
    return optionGroups[typeof groupDef === 'function' ? groupDef(subcommand) : groupDef];
  }

  /** Returns whether this option applies to the given subcommand (probably a {@link CommandName}) */
  public appliesToCommand(subcommand: string | undefined): boolean {
    return typeof this._def.commands === 'function'
      ? this._def.commands(subcommand)
      : !!subcommand && this._def.commands.includes(subcommand as CommandName);
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
