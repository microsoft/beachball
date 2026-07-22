import { Command, type Help, type OptionValues, type OutputConfiguration, type ParseOptions } from 'commander';
import { env } from '../env';
import type { CliOptions } from '../types/BeachballOptions';
import { BeachballHelp, getSubcommandName } from './BeachballHelp';
import { BeachballOption } from './BeachballOption';
import type { CommandDefinition } from './commandDefinitions';
import { getDefaultOptions } from './getDefaultOptions';
import type { OptionDefinition, OptionDefinitions } from './optionDefinitions';

/** Result reported by a command's action when the CLI is parsed. */
export interface ParsedCommandResult {
  /** The command name that ran, e.g. `publish` or `config`. */
  command: string;
  /** Merged options (local command options plus inherited global options). */
  options: OptionValues;
  /** Extra positional args, e.g. `['<name>']` for `config get <name>`. */
  extraArgs: string[];
}

/**
 * `Command` wrapper that adds Beachball-specific behaviors.
 *
 * Only `BeachballCommand.initProgram()` and `command.beachballParse()` should be used.
 */
export class BeachballCommand extends Command {
  public extraDesc: CommandDefinition['extraDesc'];
  private _result: ParsedCommandResult | undefined;

  /**
   * Create the top-level program command.
   *
   * By default in Jest, it will throw on error instead of `process.exit()`, and use no-op logging.
   */
  public static initProgram(params: {
    name: string;
    desc: string;
    options: OptionDefinitions;
    commands?: Record<string, CommandDefinition>;
    version?: string;
    outputOptions?: OutputConfiguration;
  }): BeachballCommand {
    const { name, version } = params;

    const program = new BeachballCommand(name);

    // Set output options before creating sub-commands so they're automatically inherited
    let outputOptions = params.outputOptions;
    if (env.isJest) {
      program.exitOverride();
      outputOptions ??= { writeOut: () => {}, writeErr: () => {} };
    }
    outputOptions && program.configureOutput(outputOptions);

    const desc = `${name}${version ? ` v${version}` : ''} - ${params.desc}`;
    program._beachballConfigure({ desc, subcommands: params.commands }, params.options);

    // set this last so it's at the end of help (use -v to match yargs behavior)
    version && program.version(version, '-v, --version');

    return program;
  }

  private constructor(name?: string) {
    super(name);
  }

  /** Parse the arguments and return the parsing result. */
  public beachballParse(argv: string[], options?: ParseOptions): ParsedCommandResult {
    super.parse(argv, options);
    const result = this._getResult();
    if (!result) throw new Error('Internal error: no command was run');
    return result;
  }

  private _beachballConfigure(def: CommandDefinition, options?: OptionDefinitions): void {
    for (const [argSyntax, argDesc] of Object.entries(def.args || {})) {
      this.argument(argSyntax, argDesc);
    }
    this.description(def.desc);
    this.extraDesc = def.extraDesc;

    // Declare every option on the parent so options can precede the command name (and to support the
    // default command, which receives options parsed by the parent).
    options && this._addOptions(options);

    if (def.subcommands) {
      for (const [subName, subDef] of Object.entries(def.subcommands)) {
        (this.command(subName, subDef) as BeachballCommand)._beachballConfigure(subDef);
      }

      // If there are sub-commands, skip setting an action to ensure that either a sub-command is run
      // or a default command is provided. But do set usage info.
      this.usage(this.parent ? `<${this.commands.map(sub => sub.name()).join('|')}>` : '<command> [options]');
    } else {
      // Currently the result is set as a side effect instead of having proper per-command action handlers.
      this.action(() => {
        this._result = {
          command: getSubcommandName(this),
          options: this.optsWithGlobals(),
          extraArgs: this.args,
        };
      });
    }
  }

  /** Not valid for BeachballCommand */
  public parse(): never {
    throw new Error('Use .beachballParse() instead');
  }

  /** Recursively look up the parsing result from this command and its subcommands. */
  private _getResult(): ParsedCommandResult | undefined {
    if (this._result) return this._result;
    for (const subCommand of this.commands) {
      const result = subCommand instanceof BeachballCommand && subCommand._getResult();
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
      this.addOption(new BeachballOption(params));
      // For booleans, commander requires manually adding negated option variants
      if (def.type === 'boolean') {
        this.addOption(new BeachballOption({ ...params, negated: true }));
      }
    }
  }

  // must be overridden for .command() to call to inherit parent info
  public override createCommand(name?: string): BeachballCommand {
    return new BeachballCommand(name);
  }

  public override createHelp(): Help {
    return new BeachballHelp();
  }
}
