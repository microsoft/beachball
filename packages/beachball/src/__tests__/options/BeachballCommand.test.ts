import { describe, expect, it, jest } from '@jest/globals';
import { CommanderError, type OutputConfiguration } from 'commander';
import { BeachballCommand, type ParsedCommandResult } from '../../options/BeachballCommand';
import type { CliOptions } from '../../types/BeachballOptions';
import type { CommandDefinition, OptionDefinition, OptionDefinitions } from '../../options/cliOptionDefinitions';
import { _defaultHelpWidth } from '../../options/BeachballHelp';

describe('BeachballCommand', () => {
  describe('option parsing', () => {
    /** Build a command with a standard subset of options */
    function buildCommand(outputOptions?: OutputConfiguration) {
      return BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: {},
        outputOptions,
        options: {
          branch: { type: 'string', short: 'b', desc: 'target branch' },
          changeDir: { type: 'string', desc: 'change directory' },
          configPath: { type: 'string', alias: 'config', desc: 'config path' },
          depth: { type: 'number', desc: 'clone depth' },
          scope: { type: 'array', desc: 'scope pattern' },
          forceVersions: { type: 'boolean', alias: 'force', desc: 'force versions' },
          gitTags: { type: 'boolean', desc: 'create git tags' },
          type: { type: 'string', desc: 'change type', choices: ['patch', 'minor', 'major'] },
          disallowedChangeTypes: {
            type: 'array',
            desc: 'disallowed change types',
            choices: ['patch', 'minor', 'major'],
          },
        },
      });
    }

    /** Build a command with a standard subset of options and parse the given arguments */
    function buildAndParseOpts(args: string[]) {
      return buildCommand().parse(args, { from: 'user' }).options;
    }

    /** Parse args that should throw an error, verify it throws, and return the message */
    function buildAndExpectError(args: string[]) {
      const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
      const command = buildCommand(outputOptions);
      let error: unknown;
      try {
        command.parse(args, { from: 'user' });
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(CommanderError);
      expect(outputOptions.writeOut).not.toHaveBeenCalled();
      expect(outputOptions.writeErr).toHaveBeenCalledTimes(1);
      return (outputOptions.writeErr.mock.calls[0][0] as string).trim();
    }

    it('parses a string option with short alias', () => {
      expect(buildAndParseOpts(['-b', 'main']).branch).toBe('main');
      expect(buildAndParseOpts(['--branch', 'main']).branch).toBe('main');
      expect(buildAndParseOpts(['--branch=main']).branch).toBe('main');
    });

    it('parses valid choice', () => {
      expect(buildAndParseOpts(['--type', 'minor']).type).toBe('minor');
      expect(buildAndParseOpts(['--type=major']).type).toBe('major');
    });

    it('parses dashed and camelCase spellings of a multi-word option', () => {
      expect(buildAndParseOpts(['--changeDir', 'foo']).changeDir).toBe('foo');
      expect(buildAndParseOpts(['--changeDir=foo']).changeDir).toBe('foo');
      expect(buildAndParseOpts(['--change-dir', 'foo']).changeDir).toBe('foo');
      expect(buildAndParseOpts(['--change-dir=foo']).changeDir).toBe('foo');
    });

    it('parses alias and original names', () => {
      expect(buildAndParseOpts(['--config', 'foo']).configPath).toBe('foo');
      expect(buildAndParseOpts(['--config=foo']).configPath).toBe('foo');
      expect(buildAndParseOpts(['--configPath', 'foo']).configPath).toBe('foo');
      expect(buildAndParseOpts(['--configPath=foo']).configPath).toBe('foo');
      expect(buildAndParseOpts(['--config-path', 'foo']).configPath).toBe('foo');
      expect(buildAndParseOpts(['--config-path=foo']).configPath).toBe('foo');
    });

    it('parses a number option coerced to a number', () => {
      expect(buildAndParseOpts(['--depth', '3']).depth).toBe(3);
      expect(buildAndParseOpts(['--depth=3']).depth).toBe(3);
    });

    it('collects array options from repeated and variadic usage', () => {
      expect(buildAndParseOpts(['--scope', 'a', '--scope', 'b']).scope).toEqual(['a', 'b']);
      expect(buildAndParseOpts(['--scope', 'a', 'b']).scope).toEqual(['a', 'b']);
      expect(buildAndParseOpts(['--scope=a', '--depth=3', '--scope', 'b', 'c']).scope).toEqual(['a', 'b', 'c']);
    });

    it('parses valid array choices', () => {
      const options = buildAndParseOpts(['--disallowedChangeTypes', 'major', '--disallowedChangeTypes', 'minor']);
      expect(options.disallowedChangeTypes).toEqual(['major', 'minor']);
    });

    // documenting that this is not currently supported (could change in the future if desired)
    it('does not parse values with commas as separate array entries', () => {
      expect(buildAndParseOpts(['--scope', 'a,b', '--scope=c,d']).scope).toEqual(['a,b', 'c,d']);
    });

    it('parses a multi-word boolean option', () => {
      expect(buildAndParseOpts([]).gitTags).toBeUndefined();
      expect(buildAndParseOpts(['--git-tags']).gitTags).toBe(true);
      expect(buildAndParseOpts(['--gitTags']).gitTags).toBe(true);
      expect(buildAndParseOpts(['--no-git-tags']).gitTags).toBe(false);
      expect(buildAndParseOpts(['--no-gitTags']).gitTags).toBe(false);
    });

    it('parses a boolean alias and its negated alias', () => {
      expect(buildAndParseOpts(['--force']).forceVersions).toBe(true);
      expect(buildAndParseOpts(['--no-force']).forceVersions).toBe(false);
      // original names are kept too
      expect(buildAndParseOpts(['--force-versions']).forceVersions).toBe(true);
      expect(buildAndParseOpts(['--forceVersions']).forceVersions).toBe(true);
      expect(buildAndParseOpts(['--no-force-versions']).forceVersions).toBe(false);
      expect(buildAndParseOpts(['--no-forceVersions']).forceVersions).toBe(false);
    });

    it('errors on invalid number value', () => {
      expect(buildAndExpectError(['--depth', 'abc'])).toMatchInlineSnapshot(
        `"error: option '--depth <num>' argument 'abc' is invalid. Expected numeric value."`
      );
    });

    it('errors on unknown long option', () => {
      expect(buildAndExpectError(['--unknown'])).toMatchInlineSnapshot(`"error: unknown option '--unknown'"`);
    });

    it('errors on unknown short option', () => {
      expect(buildAndExpectError(['-x'])).toMatchInlineSnapshot(`"error: unknown option '-x'"`);
    });

    it('errors on unknown option with value', () => {
      expect(buildAndExpectError(['--unknown', 'foo'])).toMatchInlineSnapshot(`"error: unknown option '--unknown'"`);
    });

    it('errors on unknown option combined with valid option', () => {
      expect(buildAndExpectError(['--branch', 'main', '--unknown'])).toMatchInlineSnapshot(
        `"error: unknown option '--unknown'"`
      );
    });

    it('errors on invalid choice', () => {
      expect(buildAndExpectError(['--type', 'foo'])).toMatchInlineSnapshot(
        `"error: option '--type <value>' argument 'foo' is invalid. Allowed choices are patch, minor, major."`
      );
    });

    it('errors on boolean option with =value', () => {
      // TODO override error handling for this case to recommend --no-<opt> instead
      expect(buildAndExpectError(['--git-tags=false'])).toMatchInlineSnapshot(
        `"error: unknown option '--git-tags=false'"`
      );
    });

    it('errors on boolean option with separate value', () => {
      expect(buildAndExpectError(['--git-tags', 'false'])).toMatchInlineSnapshot(
        `"error: too many arguments. Expected 0 arguments but got 1."`
      );
    });
  });

  describe('commands', () => {
    const testOptions: Partial<Record<keyof CliOptions, OptionDefinition>> = {
      tag: { type: 'string', short: 't', desc: 'npm dist-tag' },
      package: { type: 'array', short: 'p', desc: 'packages' },
    };

    const testCommands: Record<string, CommandDefinition> = {
      change: { desc: 'create change files', isDefault: true },
      publish: { desc: 'publish packages' },
      canary: { desc: 'canary publish', hidden: true },
      config: {
        desc: 'get or list config settings',
        subcommands: {
          get: { desc: 'get a setting', args: '<name>' },
          list: { desc: 'list settings' },
        },
      },
    };

    /** Build a program with the test commands/options, parse args, and return the reported result. */
    function buildAndParse(args: string[]): ParsedCommandResult {
      return BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: testCommands,
        options: testOptions,
      }).parse(args, { from: 'user' });
    }

    /** Parse args that should throw, verify it throws a CommanderError, and return the message. */
    function buildAndExpectError(args: string[]): string {
      const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
      const program = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: testCommands,
        options: testOptions,
        outputOptions,
      });
      let error: unknown;
      try {
        program.parse(args, { from: 'user' });
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(CommanderError);
      expect(outputOptions.writeOut).not.toHaveBeenCalled();
      expect(outputOptions.writeErr).toHaveBeenCalledTimes(1);
      return (outputOptions.writeErr.mock.calls[0][0] as string).trim();
    }

    it('registers each command from the definitions', () => {
      const program = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: testCommands,
        options: testOptions,
      });
      const names = program.command.commands.map(c => c.name());
      expect(names).toEqual(['change', 'publish', 'canary', 'config']);
    });

    it('runs the default command when no command is given', () => {
      expect(buildAndParse([])).toEqual({ command: 'change', options: {}, extraArgs: [] });
    });

    it('runs a named command', () => {
      expect(buildAndParse(['publish'])).toEqual({ command: 'publish', options: {}, extraArgs: [] });
    });

    it('runs a hidden command', () => {
      expect(buildAndParse(['canary'])).toEqual({ command: 'canary', options: {}, extraArgs: [] });
    });

    it('parses options given after the command', () => {
      expect(buildAndParse(['publish', '-t', 'foo'])).toEqual({
        command: 'publish',
        options: { tag: 'foo' },
        extraArgs: [],
      });
    });

    it('parses options given before the command (via the parent)', () => {
      expect(buildAndParse(['-t', 'foo', 'publish'])).toEqual({
        command: 'publish',
        options: { tag: 'foo' },
        extraArgs: [],
      });
    });

    it('merges options given before and after the command', () => {
      expect(buildAndParse(['-t', 'foo', 'publish', '-p', 'pkg'])).toEqual({
        command: 'publish',
        options: { tag: 'foo', package: ['pkg'] },
        extraArgs: [],
      });
    });

    it('reports a nested subcommand with a positional arg as extra args', () => {
      expect(buildAndParse(['config', 'get', 'tag'])).toEqual({
        command: 'config get',
        options: {},
        extraArgs: ['tag'],
      });
    });

    it('reports a nested subcommand without args', () => {
      expect(buildAndParse(['config', 'list'])).toEqual({
        command: 'config list',
        options: {},
        extraArgs: [],
      });
    });

    it('parses options on a nested subcommand', () => {
      expect(buildAndParse(['config', 'get', 'tag', '-p', 'pkg'])).toEqual({
        command: 'config get',
        options: { package: ['pkg'] },
        extraArgs: ['tag'],
      });
    });

    it('errors on excess positional args for a command without args', () => {
      expect(buildAndExpectError(['publish', 'extra'])).toBe(
        "error: too many arguments for 'publish'. Expected 0 arguments but got 1."
      );
    });

    it('errors on a missing subcommand', () => {
      expect(buildAndExpectError(['config'])).toMatch(/^Usage:/);
    });

    it('errors on a missing required subcommand arg', () => {
      expect(buildAndExpectError(['config', 'get'])).toBe("error: missing required argument 'name'");
    });
  });

  describe('version', () => {
    it('prints the version and exits when --version is given', () => {
      const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
      const program = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: { change: { desc: 'create change files', isDefault: true } },
        options: {},
        version: '1.2.3',
        outputOptions,
      });
      expect(() => program.parse(['--version'], { from: 'user' })).toThrow(CommanderError);
      expect(outputOptions.writeErr).not.toHaveBeenCalled();
      expect(outputOptions.writeOut).toHaveBeenCalledTimes(1);
      expect(outputOptions.writeOut.mock.calls[0][0]).toBe('1.2.3\n');
    });

    it('does not register a version option when no version is given', () => {
      const program = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: { change: { desc: 'create change files', isDefault: true } },
        options: {},
      });
      expect(program.command.helpInformation()).not.toContain('--version');
    });
  });

  // This
  describe('help', () => {
    function getOptionsHelpText(options: OptionDefinitions) {
      const command = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: {},
        options,
      });
      return command.command.helpOption(false).helpInformation().split('Options:\n')[1].trimEnd();
    }

    it('handles string option with no default', () => {
      const optionsHelp = getOptionsHelpText({
        message: { type: 'string', desc: 'commit message', short: 'm' },
      });
      expect(optionsHelp).toMatchInlineSnapshot(`"  -m, --message <value>  commit message"`);
    });

    it('handles string option with default', () => {
      // the default is defined in getDefaultOptions
      const optionsHelp = getOptionsHelpText({
        changeDir: { type: 'string', desc: 'change file directory' },
      });
      expect(optionsHelp).toMatchInlineSnapshot(`"  --change-dir <value>  change file directory (default: "change")"`);
    });

    it('handles string option with alias', () => {
      const optionsHelp = getOptionsHelpText({
        configPath: { type: 'string', desc: 'config path', alias: 'config', short: 'c' },
      });
      expect(optionsHelp).toMatchInlineSnapshot(`"  -c, --config <value>  config path"`);
    });

    it('omits getDefaultOptions default if description includes "(default:"', () => {
      const optionsHelp = getOptionsHelpText({
        branch: { type: 'string', desc: 'target branch (default: something custom)' },
      });
      expect(optionsHelp).toMatchInlineSnapshot(`"  --branch <value>  target branch (default: something custom)"`);
    });

    it('handles boolean option (including negated form)', () => {
      const optionsHelp = getOptionsHelpText({
        fetch: { type: 'boolean', desc: 'fetch first' },
      });
      // the option is technically added twice but shown once
      expect(optionsHelp).toMatchInlineSnapshot(`"  --[no-]fetch  fetch first (default: true)"`);
    });

    it('handles boolean option with alias', () => {
      const optionsHelp = getOptionsHelpText({
        gitTags: { type: 'boolean', desc: 'create git tags', alias: 'tags', short: 't' },
      });
      // note: --tags and -t are NOT actually used for --git-tags
      expect(optionsHelp).toMatchInlineSnapshot(`"  -t, --[no-]tags  create git tags (default: true)"`);
    });

    it('excludes hidden commands from the command listing', () => {
      const program = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: {
          change: { desc: 'create change files', isDefault: true },
          publish: { desc: 'publish packages' },
          canary: { desc: 'canary publish', hidden: true },
        },
        options: {},
      });
      const commandsHelp = program.command.helpInformation();
      expect(commandsHelp).toContain('create change files');
      expect(commandsHelp).toContain('publish packages');
      expect(commandsHelp).not.toContain('canary');
    });

    it('shows help for child commands', () => {
      const program = BeachballCommand.initProgram({
        name: 'beachball',
        desc: '',
        commands: { change: { desc: 'create change files', isDefault: true } },
        options: {
          package: { desc: 'some package' },
          disallowDeletedChangeFiles: { type: 'boolean', desc: 'disallow delete' },
        },
      });

      // Options are only declared on the parent program, but they show in child command help too
      // (see BeachballHelp.visibleOptions).
      expect(program.command.commands[0].helpInformation()).toMatchInlineSnapshot(`
        "Usage: beachball change [options]

        create change files

        Options:
          --package <value>           some package
          --[no-]disallow-deleted-change-files - disallow delete
          -h, --help                  display help for command
        "
      `);
    });
  });
});
