import { describe, expect, it } from '@jest/globals';
import { InvalidArgumentError } from 'commander';
import { _toDashed, _parseNumber, BeachballOption, type BeachballOptionParams } from '../../options/BeachballOption';
import { optionGroups } from '../../options/optionDefinitions';

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
  /** make a BeachballOption applied to all commands and with an empty description */
  function makeBeachballOption(
    params: Omit<BeachballOptionParams, 'commands' | 'desc'> & Partial<BeachballOptionParams>
  ) {
    return new BeachballOption({ commands: true, desc: '', ...params });
  }

  it('builds a string option with short flag and value placeholder', () => {
    const option = makeBeachballOption({ name: 'branch', short: 'b', desc: 'target branch' });
    expect(option.flags).toBe('-b, --branch <value>');
    expect(option.short).toBe('-b');
    expect(option.long).toBe('--branch');
    expect(option.description).toBe('target branch');
  });

  it('converts camelCase names to dashed flags', () => {
    const option = makeBeachballOption({ name: 'gitTags', type: 'boolean' });
    expect(option.flags).toBe('--git-tags');
    expect(option.long).toBe('--git-tags');
  });

  it('uses a variadic placeholder for array options', () => {
    const option = makeBeachballOption({ name: 'scope', type: 'array' });
    expect(option.flags).toBe('--scope <value...>');
  });

  it('for option with alias, uses the canonical name for the attribute', () => {
    const option = makeBeachballOption({ name: 'configPath', short: 'c', alias: 'config' });
    expect(option.flags).toBe('-c, --config <value>');
    expect(option.long).toBe('--config');
    expect(option.attributeName()).toBe('configPath');
  });

  it('builds the negated form of a boolean option', () => {
    const option = makeBeachballOption({ name: 'gitTags', type: 'boolean', negated: true });
    expect(option.flags).toBe('--no-git-tags');
    expect(option.long).toBe('--no-git-tags');
  });

  it('shows the negated alias for an alias boolean option', () => {
    const option = makeBeachballOption({ name: 'forceVersions', type: 'boolean', alias: 'force', negated: true });
    expect(option.flags).toBe('--no-force');
    expect(option.long).toBe('--no-force');
    expect(option.attributeName()).toBe('forceVersions');
  });

  it('matches camelCase and dashed spellings via is()', () => {
    const option = makeBeachballOption({ name: 'configPath', alias: 'configAlias', short: 'c' });
    expect(option.is('--config-path')).toBe(true);
    expect(option.is('--configPath')).toBe(true);
    expect(option.is('--config-alias')).toBe(true);
    expect(option.is('--configAlias')).toBe(true);
    expect(option.is('-c')).toBe(true);
    expect(option.is('--other')).toBe(false);
  });

  it('matches negated boolean options via is()', () => {
    const option = makeBeachballOption({ name: 'forceVersions', type: 'boolean', alias: 'forceVer', negated: true });
    expect(option.is('--no-force-ver')).toBe(true);
    expect(option.is('--no-force-versions')).toBe(true);
    expect(option.is('--no-forceVersions')).toBe(true);
    expect(option.is('--no-forceVer')).toBe(true);
    expect(option.is('--force-versions')).toBe(false);
    expect(option.is('--forceVersions')).toBe(false);
  });

  it('saves default string value description', () => {
    const opt = makeBeachballOption({ name: 'tag', type: 'string', desc: 'npm dist-tag', defaultValue: 'latest' });
    expect(opt.defaultValueDescription).toBe('"latest"');
    // commander default is not set to preserve precedence
    expect(opt.defaultValue).toBeUndefined();
  });

  it('saves default boolean value description', () => {
    let opt = makeBeachballOption({ name: 'fetch', type: 'boolean', defaultValue: true });
    expect(opt.defaultValueDescription).toBe('true');
    opt = makeBeachballOption({ name: 'bump', type: 'boolean', defaultValue: false });
    expect(opt.defaultValueDescription).toBe('false');
  });

  it('saves default 0 value description', () => {
    const opt = makeBeachballOption({ name: 'depth', type: 'number', defaultValue: 0 });
    expect(opt.defaultValueDescription).toBe('0');
  });

  it('omits the default when null/undefined/empty', () => {
    let opt = makeBeachballOption({ name: 'branch' });
    expect(opt.defaultValueDescription).toBeUndefined();

    opt = makeBeachballOption({ name: 'scope', defaultValue: null });
    expect(opt.defaultValueDescription).toBeUndefined();

    opt = makeBeachballOption({ name: 'configPath', defaultValue: '' });
    expect(opt.defaultValueDescription).toBeUndefined();
  });

  it('hides the negated form from help', () => {
    const option = makeBeachballOption({ name: 'fetch', type: 'boolean', negated: true, defaultValue: true });
    expect(option.hidden).toBe(true);
  });

  it('applies choices param', () => {
    const option = makeBeachballOption({ name: 'tag', choices: ['latest', 'beta'] });
    expect(option.argChoices).toEqual(['latest', 'beta']);
  });

  it('applies conflicts param', () => {
    const option = makeBeachballOption({ name: 'tag', conflicts: ['bump'] });
    expect((option as { conflictsWith?: string[] }).conflictsWith).toEqual(['bump']);
  });

  it('applies option group param', () => {
    const option = makeBeachballOption({ name: 'tag', group: 'npm' });
    expect(option.group).toBe('npm');
    expect(option.helpGroupHeading).toBe(optionGroups.npm);
  });

  it('applies commands param', () => {
    const option = new BeachballOption({
      name: 'message',
      desc: 'commit message',
      commands: ['change', 'publish'],
    });
    expect(option.commands).toEqual(['change', 'publish']);
  });

  it('applies custom parser for string type', () => {
    const parse = (value: unknown) => (value as string).toUpperCase();
    const option = makeBeachballOption({ name: 'tag', type: 'string', parse });
    expect(option.parseArg?.('latest', undefined)).toBe('LATEST');
  });

  it('applies custom parser for number type', () => {
    const parse = (value: unknown) => parseInt(value as string, 16);
    const option = makeBeachballOption({ name: 'depth', type: 'number', parse });
    expect(option.parseArg?.('10', undefined)).toBe(16);
  });

  it('initializes description using desc(undefined) for a function desc', () => {
    const desc = (cmd: string | undefined) => (cmd === 'change' ? 'change description' : 'commit message');
    const option = makeBeachballOption({ name: 'message', desc });
    expect(option.description).toBe('commit message');
  });
});
