import { describe, expect, it } from '@jest/globals';
import { InvalidArgumentError, type OptionValues } from 'commander';
import {
  _normalizeFlagName,
  _parseNumber,
  _toDashed,
  addAllOptions,
  FlexibleCommand,
  FlexibleOption,
  type OptionDefinition,
} from '../../options/cliOptionsHelpers';

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

describe('_normalizeFlagName', () => {
  it('strips leading dashes and camelCases dashed names', () => {
    expect(_normalizeFlagName('--git-tags')).toBe('gitTags');
    expect(_normalizeFlagName('--gitTags')).toBe('gitTags');
    expect(_normalizeFlagName('--branch')).toBe('branch');
  });

  it('normalizes negated forms consistently', () => {
    expect(_normalizeFlagName('--no-git-tags')).toBe('noGitTags');
    expect(_normalizeFlagName('--no-gitTags')).toBe('noGitTags');
  });

  it('handles names without leading dashes', () => {
    expect(_normalizeFlagName('config')).toBe('config');
    expect(_normalizeFlagName('no-force')).toBe('noForce');
  });
});

describe('FlexibleCommand boolean value rewriting', () => {
  const optionDefinitions = {
    fetch: { type: 'boolean', desc: '' },
    yes: { type: 'boolean', short: 'y', desc: '' },
    gitTags: { type: 'boolean', alias: 'force', desc: '' },
    branch: { type: 'string', short: 'b', desc: '' },
    configPath: { type: 'string', alias: 'config', desc: '' },
  } satisfies Record<string, OptionDefinition>;

  /** Parse args with a fresh command (with a positional to absorb non-option tokens) and return its option values. */
  const parse = (argv: string[]): OptionValues => {
    const command = new FlexibleCommand();
    command.exitOverride();
    command.configureOutput({ writeErr: () => {}, writeOut: () => {} });
    addAllOptions({ command, optionDefinitions });
    command.argument('[command]');
    command.parse(argv, { from: 'user' });
    return command.opts();
  };

  it('leaves already-canonical args unchanged', () => {
    expect(parse(['check', '--branch', 'main'])).toEqual({ branch: 'main' });
  });

  it('rewrites a boolean value passed via = to flag/negation form', () => {
    expect(parse(['--fetch=false'])).toEqual({ fetch: false });
    expect(parse(['--fetch=true'])).toEqual({ fetch: true });
  });

  it('rewrites a boolean value passed as a separate token', () => {
    expect(parse(['--yes', 'false'])).toEqual({ yes: false });
    expect(parse(['--yes', 'true'])).toEqual({ yes: true });
  });

  it('rewrites a camelCase boolean flag with a separate value token', () => {
    expect(parse(['--gitTags', 'false'])).toEqual({ gitTags: false });
  });

  it('rewrites a boolean alias flag value', () => {
    expect(parse(['--force=false'])).toEqual({ gitTags: false });
  });

  it('leaves a boolean flag alone if the next token is not true/false', () => {
    expect(parse(['--fetch', 'check'])).toEqual({ fetch: true });
  });

  it('does not treat = values on non-boolean options as negations', () => {
    expect(parse(['--branch=false'])).toEqual({ branch: 'false' });
  });

  it('rewrites a short boolean flag with a separate value token', () => {
    expect(parse(['-y', 'false'])).toEqual({ yes: false });
    expect(parse(['-y', 'true'])).toEqual({ yes: true });
  });

  it('leaves a short boolean flag alone if the next token is not true/false', () => {
    expect(parse(['-y', 'other'])).toEqual({ yes: true });
  });
});

describe('FlexibleOption', () => {
  it('builds a string option with short flag and value placeholder', () => {
    const option = new FlexibleOption({
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
    expect(option.displayTerm).toBeUndefined();
  });

  it('converts camelCase names to dashed flags', () => {
    const option = new FlexibleOption({
      name: 'gitTags',
      type: 'boolean',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--git-tags');
    expect(option.long).toBe('--git-tags');
  });

  it('uses a variadic placeholder for array options', () => {
    const option = new FlexibleOption({
      name: 'scope',
      type: 'array',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--scope <value...>');
  });

  it('shows the alias instead of the canonical name via displayTerm', () => {
    const option = new FlexibleOption({
      name: 'configPath',
      type: 'string',
      short: 'c',
      alias: 'config',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.flags).toBe('-c, --config-path <value>');
    expect(option.long).toBe('--config-path');
    expect(option.alias).toBe('config');
    expect(option.displayTerm).toBe('-c, --config <value>');
  });

  it('builds the negated form of a boolean option', () => {
    const option = new FlexibleOption({
      name: 'gitTags',
      type: 'boolean',
      desc: '',
      negated: true,
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--no-git-tags');
    expect(option.long).toBe('--no-git-tags');
  });

  it('shows the negated alias via displayTerm', () => {
    const option = new FlexibleOption({
      name: 'forceVersions',
      type: 'boolean',
      alias: 'force',
      desc: '',
      negated: true,
      defaultValue: undefined,
    });
    expect(option.flags).toBe('--no-force-versions');
    expect(option.displayTerm).toBe('--no-force');
  });

  it('matches camelCase, dashed, and alias spellings via is()', () => {
    const option = new FlexibleOption({
      name: 'configPath',
      type: 'string',
      alias: 'config',
      desc: '',
      defaultValue: undefined,
    });
    expect(option.is('--config-path')).toBe(true);
    expect(option.is('--configPath')).toBe(true);
    expect(option.is('--config')).toBe(true);
    expect(option.is('--other')).toBe(false);
  });

  it('appends the default value to the help description', () => {
    const option1 = new FlexibleOption({ name: 'tag', type: 'string', desc: 'npm dist-tag', defaultValue: 'latest' });
    expect(option1.description).toBe('npm dist-tag (default: "latest")');
    const option2 = new FlexibleOption({ name: 'fetch', type: 'boolean', desc: 'fetch first', defaultValue: true });
    expect(option2.description).toBe('fetch first (default: true)');
  });

  it('omits the default when it is null or undefined', () => {
    const option1 = new FlexibleOption({
      name: 'branch',
      type: 'string',
      desc: 'target branch',
      defaultValue: undefined,
    });
    expect(option1.description).toBe('target branch');
    const option2 = new FlexibleOption({
      name: 'scope',
      type: 'array',
      desc: 'scope pattern',
      defaultValue: null,
    });
    expect(option2.description).toBe('scope pattern');
  });

  it('has no description on the negated form', () => {
    const option = new FlexibleOption({
      name: 'fetch',
      type: 'boolean',
      desc: 'fetch first',
      negated: true,
      defaultValue: true,
    });
    expect(option.description).toBe('');
  });
});

describe('addAllOptions', () => {
  function buildCommand() {
    const command = new FlexibleCommand();
    command.exitOverride();
    addAllOptions({
      command,
      optionDefinitions: {
        branch: { type: 'string', short: 'b', desc: 'target branch' },
        configPath: { type: 'string', alias: 'config', desc: 'config path' },
        depth: { type: 'number', desc: 'clone depth' },
        scope: { type: 'array', desc: 'scope pattern' },
        fetch: { type: 'boolean', desc: 'fetch first' },
        forceVersions: { type: 'boolean', alias: 'force', desc: 'force versions' },
      },
    });
    return command;
  }

  it('parses a string option with its short alias and description', () => {
    const command = buildCommand();
    const branchOption = command.options.find(o => o.long === '--branch');
    expect(branchOption?.short).toBe('-b');
    // The description may include a `(default: ...)` suffix from the real default options.
    expect(branchOption?.description).toMatch(/^target branch/);

    expect(command.parse(['-b', 'main'], { from: 'user' }).opts().branch).toBe('main');
    expect(buildCommand().parse(['--branch', 'main'], { from: 'user' }).opts().branch).toBe('main');
  });

  it('matches the camelCase spelling of a dashed flag', () => {
    expect(buildCommand().parse(['--configPath', 'foo'], { from: 'user' }).opts().configPath).toBe('foo');
    expect(buildCommand().parse(['--config-path', 'foo'], { from: 'user' }).opts().configPath).toBe('foo');
  });

  it('matches an extra long-flag alias', () => {
    expect(buildCommand().parse(['--config', 'foo'], { from: 'user' }).opts().configPath).toBe('foo');
  });

  it('parses a number option coerced to a number', () => {
    const opts = buildCommand().parse(['--depth', '3'], { from: 'user' }).opts();
    expect(opts.depth).toBe(3);
  });

  it('uses second value when a single-value option is specified twice', () => {
    const command = buildCommand();
    expect(command.parse(['--branch', 'a', '--branch', 'b'], { from: 'user' }).opts().branch).toBe('b');
  });

  it('collects array options from repeated and variadic usage', () => {
    expect(buildCommand().parse(['--scope', 'a', '--scope', 'b'], { from: 'user' }).opts().scope).toEqual(['a', 'b']);
    expect(buildCommand().parse(['--scope', 'a', 'b'], { from: 'user' }).opts().scope).toEqual(['a', 'b']);
  });

  it('parses a boolean option and its negation', () => {
    expect(buildCommand().parse(['--fetch'], { from: 'user' }).opts().fetch).toBe(true);
    expect(buildCommand().parse(['--no-fetch'], { from: 'user' }).opts().fetch).toBe(false);
    expect(buildCommand().parse([], { from: 'user' }).opts().fetch).toBeUndefined();
  });

  it('matches a boolean alias and its negated alias', () => {
    expect(buildCommand().parse(['--force'], { from: 'user' }).opts().forceVersions).toBe(true);
    expect(buildCommand().parse(['--no-force'], { from: 'user' }).opts().forceVersions).toBe(false);
  });
});
