import { describe, expect, it, jest } from '@jest/globals';
import { CommanderError, InvalidArgumentError } from 'commander';
import { _toDashed, _parseNumber, BeachballCommand, BeachballOption } from '../../options/cliOptionsHelpers';
import type { CliOptions } from '../../types/BeachballOptions';
import type { OptionDefinition } from '../../options/cliOptionDefinitions';

describe('_toDashed', () => {
  it('leaves all-lowercase names unchanged', () => {
    expect(_toDashed('branch')).toBe('branch');
    expect(_toDashed('access')).toBe('access');
  });

  it('converts camelCase to dashed', () => {
    expect(_toDashed('gitTags')).toBe('git-tags');
    expect(_toDashed('bumpDeps')).toBe('bump-deps');
    expect(_toDashed('disallowedChangeTypes')).toBe('disallowed-change-types');
  });
});

describe('_parseNumber', () => {
  it('parses numeric strings', () => {
    expect(_parseNumber('1')).toBe(1);
    expect(_parseNumber('0')).toBe(0);
    expect(_parseNumber('-3')).toBe(-3);
    expect(_parseNumber('1.5')).toBe(1.5);
  });

  it('throws InvalidArgumentError for non-numeric values', () => {
    expect(() => _parseNumber('abc')).toThrow(InvalidArgumentError);
    expect(() => _parseNumber('abc')).toThrow('Expected numeric value.');
    expect(() => _parseNumber('')).not.toThrow(); // empty string coerces to 0
  });
});

describe('BeachballOption', () => {
  it('builds a string option with short flag and value placeholder', () => {
    const option = new BeachballOption({
      name: 'branch',
      type: 'string',
      short: 'b',
      desc: 'target branch',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('-b, --branch <value>');
    expect(option.short).toBe('-b');
    expect(option.long).toBe('--branch');
    expect(option.description).toBe('target branch');
  });

  it('converts camelCase names to dashed flags', () => {
    const option = new BeachballOption({
      name: 'gitTags',
      type: 'boolean',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--git-tags');
    expect(option.long).toBe('--git-tags');
  });

  it('uses a variadic placeholder for array options', () => {
    const option = new BeachballOption({
      name: 'scope',
      type: 'array',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--scope <value...>');
  });

  it('for option with alias, uses the canonical name for the attribute', () => {
    const option = new BeachballOption({
      name: 'configPath',
      type: 'string',
      short: 'c',
      alias: 'config',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('-c, --config <value>');
    expect(option.long).toBe('--config');
    expect(option.attributeName()).toBe('configPath');
  });

  it('builds the negated form of a boolean option', () => {
    const option = new BeachballOption({
      name: 'gitTags',
      type: 'boolean',
      desc: '',
      negated: true,
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--no-git-tags');
    expect(option.long).toBe('--no-git-tags');
  });

  it('shows the negated alias for an alias boolean option', () => {
    const option = new BeachballOption({
      name: 'forceVersions',
      type: 'boolean',
      alias: 'force',
      desc: '',
      negated: true,
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--no-force');
    expect(option.long).toBe('--no-force');
    expect(option.attributeName()).toBe('forceVersions');
  });

  it('matches camelCase and dashed spellings via is()', () => {
    const option = new BeachballOption({
      name: 'configPath',
      type: 'string',
      alias: 'configAlias',
      short: 'c',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.is('--config-path')).toBe(true);
    expect(option.is('--configPath')).toBe(true);
    expect(option.is('--config-alias')).toBe(true);
    expect(option.is('--configAlias')).toBe(true);
    expect(option.is('-c')).toBe(true);
    expect(option.is('--other')).toBe(false);
  });

  it('matches negated boolean options via is()', () => {
    const option = new BeachballOption({
      name: 'forceVersions',
      type: 'boolean',
      alias: 'forceVer',
      desc: '',
      negated: true,
      defaultValue: undefined,
    });
    expect(option.is('--no-force-ver')).toBe(true);
    expect(option.is('--no-force-versions')).toBe(true);
    expect(option.is('--no-forceVersions')).toBe(true);
    expect(option.is('--no-forceVer')).toBe(true);
    expect(option.is('--force-versions')).toBe(false);
    expect(option.is('--forceVersions')).toBe(false);
  });

  it('appends the default value to the help description', () => {
    const option1 = new BeachballOption({ name: 'tag', type: 'string', desc: 'npm dist-tag', defaultValue: 'latest' });
    expect(option1.description).toBe('npm dist-tag (default: "latest")');
    const option2 = new BeachballOption({ name: 'fetch', type: 'boolean', desc: 'fetch first', defaultValue: true });
    expect(option2.description).toBe('fetch first (default: true)');
  });

  it('omits the default when null/undefined/empty', () => {
    const option1 = new BeachballOption({ name: 'branch', desc: 'target branch', defaultValue: undefined });
    expect(option1.description).toBe('target branch');

    const option2 = new BeachballOption({ name: 'scope', desc: 'scope pattern', defaultValue: null });
    expect(option2.description).toBe('scope pattern');

    const option3 = new BeachballOption({ name: 'configPath', desc: 'config path', defaultValue: '' });
    expect(option3.description).toBe('config path');
  });

  it('hides the negated form from help', () => {
    const option = new BeachballOption({
      name: 'fetch',
      type: 'boolean',
      desc: 'fetch first',
      negated: true,
      defaultValue: true,
    });
    expect(option.hidden).toBe(true);
  });

  // this prevents interference with CLI/config/default precedence
  it('adds default value to description but not the commander default', () => {
    const option = new BeachballOption({
      name: 'tag',
      type: 'string',
      desc: 'npm dist-tag',
      defaultValue: 'latest',
    });
    expect(option.description).toBe('npm dist-tag (default: "latest")');
    expect(option.defaultValue).toBeUndefined();
  });
});

describe('BeachballCommand', () => {
  /** Build a command with a standard subset of options */
  function buildCommand() {
    return new BeachballCommand().exitOverride().addAllOptions({
      branch: { type: 'string', short: 'b', desc: 'target branch' },
      changeDir: { type: 'string', desc: 'change directory' },
      configPath: { type: 'string', alias: 'config', desc: 'config path' },
      depth: { type: 'number', desc: 'clone depth' },
      scope: { type: 'array', desc: 'scope pattern' },
      forceVersions: { type: 'boolean', alias: 'force', desc: 'force versions' },
      gitTags: { type: 'boolean', desc: 'create git tags' },
      type: { type: 'string', desc: 'change type', choices: ['patch', 'minor', 'major'] },
      disallowedChangeTypes: { type: 'array', desc: 'disallowed change types', choices: ['patch', 'minor', 'major'] },
    });
  }

  /** Build a command with a standard subset of options and parse the given arguments */
  function buildAndParseOpts(args: string[]) {
    return buildCommand().parse(args, { from: 'user' }).opts();
  }

  /** Parse args that should throw an error, verify it throws, and return the message */
  function buildAndExpectError(args: string[]) {
    const outputOptions = { writeOut: jest.fn(), writeErr: jest.fn() };
    const command = buildCommand().configureOutput(outputOptions);
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

  describe('parsing', () => {
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
      expect(buildAndExpectError(['--fetch=false'])).toMatchInlineSnapshot(`"error: unknown option '--fetch=false'"`);
    });

    it('errors on boolean option with separate value', () => {
      // The error message for this will vary depending on argument context
      buildAndExpectError(['--fetch', 'false']);
    });
  });

  describe('help', () => {
    function getOptionsHelpText(options: Partial<Record<keyof CliOptions, OptionDefinition>>) {
      return new BeachballCommand()
        .helpOption(false)
        .addAllOptions(options)
        .helpInformation()
        .split('Options:\n')[1]
        .trimEnd();
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
      expect(optionsHelp).toMatchInlineSnapshot(`"  --[no-]fetch  fetch first (default: true)"`);
    });

    it('handles boolean option with alias', () => {
      const optionsHelp = getOptionsHelpText({
        gitTags: { type: 'boolean', desc: 'create git tags', alias: 'tags', short: 't' },
      });
      // note: --tags and -t are NOT actually used for --git-tags
      expect(optionsHelp).toMatchInlineSnapshot(`"  -t, --[no-]tags  create git tags (default: true)"`);
    });
  });
});
