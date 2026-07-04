import { describe, expect, it } from '@jest/globals';
import { Command, InvalidArgumentError } from 'commander';
import type { CliOptions } from '../../types/BeachballOptions';
import {
  _getFlagAliasMap,
  _parseNumber,
  _parseSingle,
  _toDashed,
  addAllOptions,
  normalizeArgv,
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

describe('_parseSingle', () => {
  it('returns the value on first use', () => {
    expect(_parseSingle()('main', undefined)).toBe('main');
  });

  it('throws InvalidArgumentError if the option is specified more than once', () => {
    expect(() => _parseSingle()('main', 'other')).toThrow(InvalidArgumentError);
    expect(() => _parseSingle()('main', 'other')).toThrow('Option can only be specified once.');
  });

  it('applies the coerce function when provided', () => {
    const parse = _parseSingle(_parseNumber);
    expect(parse('5', undefined)).toBe(5);
  });

  it('applies coerce and still throws on repeated use', () => {
    const parse = _parseSingle(_parseNumber);
    expect(() => parse('5', 5)).toThrow('Option can only be specified once.');
  });
});

describe('_getFlagAliasMap', () => {
  it('maps camelCase spellings to their dashed canonical form', () => {
    const map = _getFlagAliasMap({
      allOptionNames: ['gitTags', 'bumpDeps', 'branch'],
      longAliases: {},
    });
    expect(map).toEqual({ gitTags: 'git-tags', bumpDeps: 'bump-deps' });
  });

  it('does not map names that are already all-lowercase', () => {
    const map = _getFlagAliasMap({
      allOptionNames: ['branch', 'access'],
      longAliases: {},
    });
    expect(map).toEqual({});
  });

  it('maps long aliases to their dashed canonical form', () => {
    const map = _getFlagAliasMap({
      allOptionNames: ['configPath', 'fromRef'],
      longAliases: { config: 'configPath', since: 'fromRef' },
    });
    expect(map).toEqual({ configPath: 'config-path', fromRef: 'from-ref', config: 'config-path', since: 'from-ref' });
  });
});

describe('normalizeArgv', () => {
  const params = {
    allOptionNames: ['gitTags', 'branch', 'fetch', 'yes', 'configPath', 'fromRef'] as const,
    longAliases: { config: 'configPath', since: 'fromRef' } as Record<string, keyof CliOptions>,
    booleanOptions: ['fetch', 'yes', 'gitTags'] as const,
    shortAliases: { yes: 'y' },
  };

  const normalize = (argv: string[]) => normalizeArgv({ ...params, argv });

  it('leaves already-canonical args unchanged', () => {
    expect(normalize(['check', '--branch', 'main'])).toEqual(['check', '--branch', 'main']);
  });

  it('normalizes camelCase long flags to dashed', () => {
    expect(normalize(['--gitTags'])).toEqual(['--git-tags']);
  });

  it('normalizes long aliases to their canonical dashed form', () => {
    expect(normalize(['--config', 'foo'])).toEqual(['--config-path', 'foo']);
    expect(normalize(['--since', 'HEAD'])).toEqual(['--from-ref', 'HEAD']);
  });

  it('preserves inline values when renaming flags', () => {
    expect(normalize(['--config=foo'])).toEqual(['--config-path=foo']);
  });

  it('rewrites a boolean value passed via = to flag/negation form', () => {
    expect(normalize(['--fetch=false'])).toEqual(['--no-fetch']);
    expect(normalize(['--fetch=true'])).toEqual(['--fetch']);
  });

  it('rewrites a boolean value passed as a separate token', () => {
    expect(normalize(['--yes', 'false'])).toEqual(['--no-yes']);
    expect(normalize(['--yes', 'true'])).toEqual(['--yes']);
  });

  it('rewrites a camelCase boolean flag with a separate value token', () => {
    expect(normalize(['--gitTags', 'false'])).toEqual(['--no-git-tags']);
  });

  it('leaves a boolean flag alone if the next token is not true/false', () => {
    expect(normalize(['--fetch', 'check'])).toEqual(['--fetch', 'check']);
  });

  it('does not treat = values on non-boolean options as negations', () => {
    expect(normalize(['--branch=false'])).toEqual(['--branch=false']);
  });

  it('rewrites a short boolean flag with a separate value token', () => {
    expect(normalize(['-y', 'false'])).toEqual(['--no-yes']);
    expect(normalize(['-y', 'true'])).toEqual(['--yes']);
  });

  it('leaves a short boolean flag alone if the next token is not true/false', () => {
    expect(normalize(['-y', 'other'])).toEqual(['-y', 'other']);
  });

  it('does not mutate the input argv', () => {
    const argv = ['--gitTags', 'false'];
    normalizeArgv({ ...params, argv });
    expect(argv).toEqual(['--gitTags', 'false']);
  });
});

describe('addAllOptions', () => {
  function buildCommand() {
    const command = new Command();
    addAllOptions({
      command,
      stringOptions: ['branch'],
      numberOptions: ['depth'],
      arrayOptions: ['scope'],
      booleanOptions: ['fetch'],
      optionDescriptions: {
        branch: 'target branch',
        depth: 'clone depth',
        scope: 'scope pattern',
        fetch: 'fetch first',
      } as Record<keyof CliOptions, string>,
      shortAliases: { branch: 'b' },
    });
    return command;
  }

  it('parses a string option with its short alias and description', () => {
    const command = buildCommand();
    const branchOption = command.options.find(o => o.long === '--branch');
    expect(branchOption?.short).toBe('-b');
    expect(branchOption?.description).toBe('target branch');

    expect(command.parse(['-b', 'main'], { from: 'user' }).opts().branch).toBe('main');
    expect(buildCommand().parse(['--branch', 'main'], { from: 'user' }).opts().branch).toBe('main');
  });

  it('parses a number option coerced to a number', () => {
    const opts = buildCommand().parse(['--depth', '3'], { from: 'user' }).opts();
    expect(opts.depth).toBe(3);
  });

  it('throws when a single-value option is specified twice', () => {
    const command = buildCommand();
    command.exitOverride();
    expect(() => command.parse(['--branch', 'a', '--branch', 'b'], { from: 'user' })).toThrow(
      'Option can only be specified once.'
    );
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
});
