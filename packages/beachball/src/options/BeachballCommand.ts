import {
  Command,
  Help,
  InvalidArgumentError,
  Option,
  type OptionValues,
  type OutputConfiguration,
  type ParseOptions,
} from 'commander';
import { env } from '../env';
import type { CliOptions } from '../types/BeachballOptions';
import type { CommandDefinition, OptionDefinition, OptionType } from './cliOptionDefinitions';
import { getDefaultOptions } from './getDefaultOptions';

declare module 'commander' {
  interface Option {
    /**
     * Check if the argument matches this option. (missing from public types)
     * @param arg Flag only, e.g. `--foo` or `-f`
     */
    is(arg: string): boolean;
  }
}

/** Result reported by a command's action when the CLI is parsed. */
export interface ParsedCommandResult {
  /** The command name that ran, e.g. `publish` or `config`. */
  command: string;
  /** Merged options (local command options plus inherited global options). */
  options: OptionValues;
  /** Extra positional args, e.g. `['get', '<name>']` for `config get <name>`. */
  extraArgs: string[];
}

type OptionDefinitions = Partial<Record<keyof CliOptions, OptionDefinition>>;
type CommandDefinitions = Record<string, CommandDefinition>;

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

  /** Get the option term (flags) to show in the option list, with added `--[no-]` prefix for booleans. */
  override optionTerm(option: Option): string {
    const term = super.optionTerm(option);
    return option instanceof BeachballOption && option.isBoolean() ? term.replace('--', '--[no-]') : term;
  }

  /**
   * Format a single term/description item, adding a hanging indent so that wrapped description
   * lines are indented slightly past the start of the description's first line.
   */
  override formatItem(term: string, termWidth: number, description: string, helper: Help): string {
    // Temporarily reduce the help width so wrapping accounts for the extra hanging indent added
    // to continuation lines below (otherwise those lines could exceed the help width).
    const hangingIndent = 2;
    const originalHelpWidth = this.helpWidth;
    this.helpWidth = (this.helpWidth ?? 80) - hangingIndent;
    const formatted = super.formatItem(term, termWidth, description, helper);
    this.helpWidth = originalHelpWidth;

    // Commander indents wrapped description lines to align with the description's first line
    // (itemIndent + termWidth + spacerWidth). Add extra spaces to those continuation lines.
    const itemIndent = 2;
    const spacerWidth = 2;
    const continuationIndent = ' '.repeat(itemIndent + termWidth + spacerWidth);
    return formatted.replaceAll(`\n${continuationIndent}`, `\n${continuationIndent}${' '.repeat(hangingIndent)}`);
  }

  /**
   * Render the help text, moving the "Commands:" section before the "Options:" section for commands
   * that have sub-commands (so the more relevant commands list is shown first).
   */
  override formatHelp(cmd: Command, helper: Help): string {
    const help = super.formatHelp(cmd, helper);
    if (!helper.visibleCommands(cmd).length) {
      return help;
    }

    // Sections are separated by a blank line and each starts with a title line ("Options:",
    // "Commands:", etc). Move the "Commands:" section to just before the "Options:" section.
    const trailingNewline = help.endsWith('\n');
    const sections = help.replace(/\n+$/, '').split('\n\n');
    const optionsIndex = sections.findIndex(section => section.startsWith('Options:'));
    const commandsIndex = sections.findIndex(section => section.startsWith('Commands:'));
    if (optionsIndex !== -1 && commandsIndex > optionsIndex) {
      const [commandsSection] = sections.splice(commandsIndex, 1);
      sections.splice(optionsIndex, 0, commandsSection);
    }
    return sections.join('\n\n') + (trailingNewline ? '\n' : '');
  }
}

/**
 * `Command` wrapper that adds Beachball-specific behaviors.
 *
 * (Does not extend `Command` because a wrapper provides a clearer API.)
 */
export class BeachballCommand {
  public readonly command: Command;
  private _result: ParsedCommandResult | undefined;
  private readonly _subCommands: BeachballCommand[];

  /**
   * Create the top-level program command.
   *
   * By default in Jest, it will throw on error instead of calling `process.exit()`, and use no-op logging.
   */
  public static initProgram(params: {
    name: string;
    desc: string;
    options: OptionDefinitions;
    commands: CommandDefinitions;
    version?: string;
    outputOptions?: OutputConfiguration;
  }): BeachballCommand {
    const { name, version } = params;
    const program = new BeachballCommand({
      name,
      def: {
        desc: `${name}${version ? ` v${version}` : ''} - ${params.desc}`,
        subcommands: params.commands,
      },
      options: params.options,
      outputOptions: params.outputOptions,
    });
    // set this last so it's at the end of help
    version && program.command.version(version);
    program.command.usage('<command> [options]');

    return program;
  }

  private constructor(params: {
    name: string;
    def: CommandDefinition;
    options: OptionDefinitions;
    parent?: BeachballCommand;
    outputOptions?: OutputConfiguration;
  }) {
    const { name, def, options, parent } = params;

    const command = (this.command = parent
      ? parent.command.command(name, { isDefault: def.isDefault, hidden: def.hidden })
      : new Command(name));

    let outputOptions = params.outputOptions;
    // these are auto-inherited by .command(), so don't overwrite for subcommands
    if (!parent && env.isJest) {
      command.exitOverride();
      outputOptions ??= { writeOut: () => {}, writeErr: () => {} };
    }
    // Set output options before creating sub-commands so they're automatically inherited
    outputOptions && command.configureOutput(outputOptions);

    def.args && command.arguments(def.args);
    command.description(def.desc);
    command.createHelp = () => new BeachballHelp();

    // Declare every option on the parent so options can precede the command name (and to support the
    // default command, which receives options parsed by the parent).
    this._addOptions(options);

    // Register each command, inheriting settings from the parent and including the same options.
    this._subCommands = Object.entries(def.subcommands || {}).map(
      ([subName, subDef]) => new BeachballCommand({ name: subName, def: subDef, options, parent: this })
    );

    // If there are sub-commands, skip setting an action to ensure that either a sub-command is run
    // or a default command is provided.
    if (!this._subCommands.length) {
      // Currently the result is set as a side effect instead of having proper per-command action handlers.
      command.action(() => {
        this._result = {
          // 'bump' or 'config get'
          command: command.parent?.parent ? `${command.parent.name()} ${command.name()}` : command.name(),
          options: command.optsWithGlobals(),
          extraArgs: command.args,
        };
      });
    }
  }

  /** Parse the arguments and return the parsing result. */
  public parse(argv: string[], options?: ParseOptions): ParsedCommandResult {
    this.command.parse(argv, options);
    const result = this._getResult();
    if (!result) throw new Error('Internal error: no command was run');
    return result;
  }

  /** Recursively look up the parsing result from this command and its subcommands. */
  private _getResult(): ParsedCommandResult | undefined {
    if (this._result) return this._result;
    for (const subCommand of this._subCommands) {
      const result = subCommand._getResult();
      if (result) return result;
    }
    return undefined;
  }

  /**
   * Add every option in `options`, automatically handling aliases and negated boolean options.
   */
  private _addOptions(options: OptionDefinitions): void {
    const defaultOptions = getDefaultOptions();

    for (const [name, def] of Object.entries(options) as [keyof CliOptions, OptionDefinition][]) {
      const params = { name, ...def, defaultValue: defaultOptions[name] };
      this.command.addOption(new BeachballOption(params));
      // For booleans, commander requires manually adding negated option variants
      if (def.type === 'boolean') {
        this.command.addOption(new BeachballOption({ ...params, negated: true }));
      }
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
