import { Command, type OptionValues, type OutputConfiguration, type ParseOptions } from 'commander';
import { env } from '../env';
import type { CliOptions } from '../types/BeachballOptions';
import type {
  CommandDefinition,
  CommandDefinitions,
  OptionDefinition,
  OptionDefinitions,
} from './cliOptionDefinitions';
import { getDefaultOptions } from './getDefaultOptions';
import { BeachballHelp } from './BeachballHelp';
import { BeachballOption } from './BeachballOption';

/** Result reported by a command's action when the CLI is parsed. */
export interface ParsedCommandResult {
  /** The command name that ran, e.g. `publish` or `config`. */
  command: string;
  /** Merged options (local command options plus inherited global options). */
  options: OptionValues;
  /** Extra positional args, e.g. `['get', '<name>']` for `config get <name>`. */
  extraArgs: string[];
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

    return program;
  }

  private constructor(params: {
    name: string;
    def: CommandDefinition;
    options?: OptionDefinitions;
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
    options && this._addOptions(options);

    // Register each command, inheriting settings from the parent, but omitting options.
    this._subCommands = Object.entries(def.subcommands || {}).map(
      ([subName, subDef]) => new BeachballCommand({ name: subName, def: subDef, parent: this })
    );

    if (this._subCommands.length) {
      // If there are sub-commands, skip setting an action to ensure that either a sub-command is run
      // or a default command is provided. But do set usage info.
      command.usage(parent ? `<${this._subCommands.map(sub => sub.command.name()).join('|')}>` : '<command> [options]');
    } else {
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
