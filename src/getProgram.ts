import { Command, type CommanderError, type OutputConfiguration } from 'commander';
import type { BeachballOptions } from './types/BeachballOptions';
import { type CommandName, cliCommands } from './options/cliCommands';
import { cliOptions } from './options/cliOptions';

export interface ProgramTestOptions {
  outputOptions: OutputConfiguration;
  exitOverride: (err: CommanderError) => void;
  /** Override the main part of the action (after setting up the options) */
  actionOverride: (options: BeachballOptions) => void;
}

export function getProgram(testOptions?: ProgramTestOptions): Command {
  const program = new Command('beachball');
  program.description('the sunniest version bumping tool');
  program.version(require('../../package.json').version, '-v, --version');
  program.showHelpAfterError();

  if (testOptions) {
    program.configureOutput(testOptions.outputOptions);
    program.exitOverride(testOptions.exitOverride);
  }

  for (const [_cmdName, cmdMeta] of Object.entries(cliCommands)) {
    const cmdName = _cmdName as CommandName;
    const command = program
      .command(cmdName, cmdMeta)
      .description(cmdMeta.description)
      .action(async rawOptions => {
        const options = processOptions(rawOptions, cmdName);

        if (testOptions) {
          testOptions.actionOverride(options);
        } else {
          await cmdMeta.action(options);
        }
      });

    for (const [configName, optMeta] of Object.entries(cliOptions)) {
      if (!optMeta.commands.includes(cmdName)) {
        continue;
      }

      const {
        displayName = configName,
        description: desc,
        choices,
        default: defaultValue,
        hide,
        short,
        type = 'default',
      } = optMeta;

      const description = typeof desc === 'string' ? desc : desc(cmdName);

      const options =
        type === 'boolean' || type === 'boolean-negated'
          ? makeBooleanOptions({ name: displayName, short, description, negated: type === 'boolean-negated' })
          : makeOtherOptions({ name: displayName, short, description, type });

      for (const opt of options) {
        hide && opt.hideHelp();
        defaultValue !== undefined && opt.default(defaultValue);
        choices && opt.choices(choices);
        type === 'int' && opt.argParser(parseIntValue);
        type === 'multi' && opt.argParser(v => v.split(','));
        command.addOption(opt);
      }
    }
  }

  return program;
}

function processOptions(rawOptions: Partial<BeachballOptions>, cmdName: CommandName): BeachballOptions {
  for (const [configName, optMeta] of Object.entries(cliOptions)) {
    if (!optMeta.commands.includes(cmdName)) {
      continue;
    }
  }
}
