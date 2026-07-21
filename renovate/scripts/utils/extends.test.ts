import { describe, it, expect } from '@jest/globals';
import { getExtendsForLocalPreset, getLocalPresetFromExtends, repoPresetPrefix } from './extends.ts';

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
  it('gets extends without ref', () => {
    expect(getExtendsForLocalPreset('groupFoo')).toBe(repoPresetPrefix + 'groupFoo');
    expect(getExtendsForLocalPreset('restrictNode(14)')).toBe(repoPresetPrefix + 'restrictNode(14)');
  });

  it('gets extends with ref', () => {
    expect(getExtendsForLocalPreset('groupFoo', 'v1.2.3')).toBe(repoPresetPrefix + 'groupFoo#v1.2.3');
    expect(getExtendsForLocalPreset('restrictNode(14)', 'v1.2.3')).toBe(repoPresetPrefix + 'restrictNode(14)#v1.2.3');
  });
});
