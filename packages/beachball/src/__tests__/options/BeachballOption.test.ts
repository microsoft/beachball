import { describe, expect, it } from '@jest/globals';
import { InvalidArgumentError } from 'commander';
import { _toDashed, _parseNumber, BeachballOption } from '../../options/BeachballOption';

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
