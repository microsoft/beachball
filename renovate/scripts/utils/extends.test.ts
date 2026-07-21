import { describe, it, expect } from '@jest/globals';
import { getExtendsForLocalPreset, getLocalPresetFromExtends, repoPresetPrefix } from './extends.ts';
import type { LocalPresetData } from './types.ts';

describe('getLocalPresetFromExtends', () => {
  it('returns undefined for value not from this repo', () => {
    expect(getLocalPresetFromExtends('some-external-preset')).toBeUndefined();
    expect(getLocalPresetFromExtends(':foo')).toBeUndefined();
    expect(getLocalPresetFromExtends('foo//bar')).toBeUndefined();
    expect(getLocalPresetFromExtends('foo#bar')).toBeUndefined();
  });

  it.each<[desc: string, preset: string, extnds: string]>([
    ['simple name', 'groupFoo', 'groupFoo'],
    ['simple name with ref', 'groupFoo', 'groupFoo#v1.2.3'],
    ['name with argument', 'restrictNode', 'restrictNode(14)'],
    ['name with argument and ref', 'restrictNode', 'restrictNode(14)#v1.2.3'],
  ])('converts %s', (_, preset, extnds) => {
    expect(getLocalPresetFromExtends(repoPresetPrefix + extnds)).toBe(preset);
  });
});

describe('getExtendsForLocalPreset', () => {
  function createPreset(name: string, content: string): LocalPresetData {
    return { absolutePath: '', name, content, json: {} };
  }

  it('gets extends without ref', () => {
    expect(getExtendsForLocalPreset(createPreset('groupFoo', '{"extends":[]}'))).toBe(repoPresetPrefix + 'groupFoo');
  });

  it('adds numeric arg0 placeholder without ref when needed', () => {
    expect(getExtendsForLocalPreset(createPreset('restrictNode', '{"description":"{{arg0}}"}'))).toBe(
      repoPresetPrefix + 'restrictNode(16)'
    );
  });

  it('gets extends with ref', () => {
    expect(getExtendsForLocalPreset(createPreset('groupFoo', '{"extends":[]}'), 'v1.2.3')).toBe(
      repoPresetPrefix + 'groupFoo#v1.2.3'
    );
  });

  it('adds numeric arg0 placeholder with ref when needed', () => {
    expect(getExtendsForLocalPreset(createPreset('restrictNode', '{"description":"{{arg0}}"}'), 'v1.2.3')).toBe(
      repoPresetPrefix + 'restrictNode#v1.2.3(16)'
    );
  });
});
