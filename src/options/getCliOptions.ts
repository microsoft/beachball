import { Command, InvalidArgumentError, Option } from 'commander';
import { findProjectRoot, getDefaultRemoteBranch } from 'workspace-tools';
import { env } from '../env';
import { CliOptions } from '../types/BeachballOptions';
import { CommandName, cliCommands } from './cliCommands';
import { cliOptions } from './cliOptions';

let cachedCliOptions: CliOptions;

export function getCliOptions(argv: string[], disableCache?: boolean): CliOptions {
  // Special case caching to process.argv which should be immutable
  if (argv === process.argv) {
    if (disableCache || env.beachballDisableCache || !cachedCliOptions) {
      cachedCliOptions = getCliOptionsUncached(process.argv);
    }
    return cachedCliOptions;
  }

  return getCliOptionsUncached(argv);
}

function getCliOptionsUncached(argv: string[]): CliOptions {
  const program = new Command('beachball')
    .description('the sunniest version bumping tool')
    .version(require('../../package.json').version, '-v, --version')
    .showHelpAfterError().exitOverride;

  let chosenCommand: CommandName | undefined;

  for (const [_cmdName, cmdMeta] of Object.entries(cliCommands)) {
    const cmdName = _cmdName as CommandName;
    const command = program
      .command(cmdName, cmdMeta)
      .description(cmdMeta.description)
      .action(() => {
        // hack to save the chosen command
        // TODO properly implement commands.....
        chosenCommand = cmdName;
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

  // // Be careful not to mutate the input argv
  // program.parse([...argv]);

  // const options = program.opts<CliOptions>();

  // const options = { ...program.lastOptions };
  // for (const [optionName, configName] of Object.entries(remappedOpts)) {
  //   if (options[optionName] !== undefined) {
  //     options[configName] = options[optionName];
  //     delete options[optionName];
  //   }
  // }

  // const cliOptions = options as CliOptions;
  // cliOptions.command = program.lastSubCommand;

  if (!options.path) {
    try {
      options.path = findProjectRoot(process.cwd());
    } catch (err) {
      options.path = process.cwd();
    }
  }

  if (options.branch) {
    options.branch = options.branch.includes('/')
      ? options.branch
      : getDefaultRemoteBranch({ branch: options.branch, verbose: options.verbose, cwd: options.path });
  }

  if (options.command === 'canary') {
    options.tag = options.canaryName || 'canary';
  }

  for (const key of Object.keys(options) as (keyof CliOptions)[]) {
    const value = options[key];
    if (value === undefined) {
      delete options[key];
    } else if (typeof value === 'number' && isNaN(value)) {
      throw new Error(`Non-numeric value passed for numeric option "${key}"`);
    } else if (knownOptions.includes(key)) {
      if (Array.isArray(value) && !arrayOptions.includes(key as any)) {
        throw new Error(`Option "${key}" only accepts a single value. Received: ${value.join(' ')}`);
      }
    } else if (value === 'true') {
      // For unknown arguments like --foo=true or --bar=false, yargs will handle the value as a string.
      // Convert it to a boolean to avoid subtle bugs.
      (options as any)[key] = true;
    } else if (value === 'false') {
      (options as any)[key] = false;
    }
  }

  return options;
}

function parseIntValue(value: string) {
  const num = parseInt(value);
  if (isNaN(num)) {
    throw new InvalidArgumentError('Not a number');
  }
  return num;
}

function getMainOptionFlags(name: string, short: string | undefined) {
  const decamelizedName = decamelize(name);
  return short ? `-${short}, --${decamelizedName}` : `--${decamelizedName}`;
}

function makeBooleanOptions(params: {
  name: string;
  short: string | undefined;
  description: string;
  negated: boolean;
}) {
  const { name, short, description, negated } = params;

  // Accept multiple variations of boolean input:
  // `--some-opt`, `--some-opt=true|false`, `--some-opt true|false`
  const booleanOption = (nameFlags: string) =>
    new Option(`${nameFlags} [value]`, description).choices(['true', 'false']).argParser(v => v === 'true');

  const options: Option[] = [booleanOption(getMainOptionFlags(name, short))];
  const decamelizedName = decamelize(name);

  if (decamelizedName !== name) {
    // As above but camel case (`--someOpt`) and hidden from help
    options.push(booleanOption(`--${name}`).hideHelp());
  }

  if (negated) {
    // If requested, make a negated version (non-camelcase only, `--no-some-opt`)
    const negativeDescription = description.replace(/^(whether to)?/, 'do not').replace(' (default true)', '');
    options.push(new Option(`--no-${decamelizedName}`, negativeDescription).hideHelp());
  }

  return options;
}

function makeOtherOptions(params: {
  name: string;
  short: string | undefined;
  description: string;
  type: 'int' | 'multi' | 'default' | 'flag';
}) {
  const { name, short, description, type } = params;

  const valueFlags = type === 'multi' ? '<values...>' : type === 'flag' ? '' : '<value>';

  const options = [new Option(`${getMainOptionFlags(name, short)} ${valueFlags}`.trim(), description)];

  if (decamelize(name) !== name) {
    // As above but camel case (`--someOpt`) and hidden from help
    options.push(new Option(`--${name} ${valueFlags}`, description).hideHelp());
  }
  return options;
}

function decamelize(str: string) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
