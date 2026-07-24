import { describe, it, expect } from '@jest/globals';
import {
  extendsLocalPreset,
  getExtendsForLocalPreset,
  getLocalPresetFromExtends,
  getServerConfigExtends,
  repoPresetPrefix,
} from '../utils/extends.ts';
import type { BasicRenovateConfig, LocalPresetData } from '../utils/types.ts';
import { readPresets } from '../utils/readPresets.ts';

const realPresets = readPresets();

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
  type PartialPreset = Parameters<typeof getExtendsForLocalPreset>[0];
  const groupFoo: PartialPreset = { name: 'groupFoo' };
  const restrictNode: PartialPreset = { name: 'restrictNode', argValues: ['16'] };

  it('gets extends without ref', () => {
    expect(getExtendsForLocalPreset(groupFoo)).toBe(repoPresetPrefix + 'groupFoo');
  });

  it('gets extends with ref', () => {
    expect(getExtendsForLocalPreset(groupFoo, { ref: 'v1.2.3' })).toBe(repoPresetPrefix + 'groupFoo#v1.2.3');
  });

  it('adds specific value placeholder without ref when needed', () => {
    expect(getExtendsForLocalPreset(restrictNode)).toBe(repoPresetPrefix + 'restrictNode(16)');
  });

  it('adds generic value placeholder without ref when needed', () => {
    expect(getExtendsForLocalPreset(restrictNode, { placeholderArgs: true })).toBe(
      repoPresetPrefix + 'restrictNode(<arg0>)'
    );
  });

  it('adds placeholder with ref when needed', () => {
    expect(getExtendsForLocalPreset(restrictNode, { ref: 'v1.2.3' })).toBe(
      repoPresetPrefix + 'restrictNode#v1.2.3(16)'
    );
  });
});

describe('extendsLocalPreset', () => {
  it('returns true if config extends a preset from this repo', () => {
    expect(extendsLocalPreset({ extends: [repoPresetPrefix + 'groupFoo'] })).toBe(true);
    expect(extendsLocalPreset({ extends: [repoPresetPrefix + 'groupFoo(16)'] })).toBe(true);
    expect(extendsLocalPreset({ extends: [repoPresetPrefix + 'groupFoo#bar'] })).toBe(true);
  });

  it('returns false if config does not extend a preset from this repo', () => {
    expect(extendsLocalPreset({ extends: ['some-external-preset'] })).toBe(false);
    expect(extendsLocalPreset({ extends: ['github>foo/bar//renovate/presets/baz'] })).toBe(false);
  });
});

describe('getServerConfigExtends', () => {
  function makePresets(presets: Record<string, BasicRenovateConfig>): LocalPresetData[] {
    return Object.entries(presets).map(([name, json]) => ({
      absolutePath: '',
      name,
      content: JSON.stringify(json),
      json,
    }));
  }

  const extendsFoo = repoPresetPrefix + 'groupFoo';
  const extendsBar = repoPresetPrefix + 'groupBar';
  const extendsAll = repoPresetPrefix + 'groupAll';
  const testPresets = makePresets({
    groupFoo: {},
    groupBar: { extends: ['other:foo'] },
    groupAll: { extends: [extendsFoo, extendsBar, 'other:foo'] },
  });

  it('includes all presets without refs if branch is not specified', () => {
    const result = getServerConfigExtends(testPresets, undefined);
    expect(result).toEqual([extendsFoo, extendsBar, extendsAll]);
  });

  it('includes appropriate presets with refs on a branch', () => {
    const branch = 'feature-branch';
    const result = getServerConfigExtends(testPresets, branch);
    // preset with local references is omitted, but its non-local reference is included
    // (see comment on getServerConfigExtends)
    expect(result).toEqual(['other:foo', `${extendsFoo}#${branch}`, `${extendsBar}#${branch}`]);
  });

  it('includes all real presets if branch is not specified', () => {
    const result = getServerConfigExtends(realPresets);
    expect(result).toHaveLength(realPresets.length);
    expect(result[0]).not.toContain('#');
  });

  it('includes appropriate real presets with refs on a branch', () => {
    const result = getServerConfigExtends(realPresets, 'feat');
    expect(result).toEqual([
      // non-local references copied from groupMore
      'group:monorepos',
      'group:recommended',
      // local presets which don't extend other local presets
      'github>microsoft/beachball//renovate/presets/base#feat',
      'github>microsoft/beachball//renovate/presets/beachballPostUpgrade#feat',
      'github>microsoft/beachball//renovate/presets/customTagActions#feat',
      'github>microsoft/beachball//renovate/presets/dependencyDashboardMajor#feat',
      'github>microsoft/beachball//renovate/presets/disableEsmVersions#feat',
      'github>microsoft/beachball//renovate/presets/groupActions#feat',
      'github>microsoft/beachball//renovate/presets/groupD3#feat',
      'github>microsoft/beachball//renovate/presets/groupEslint#feat',
      'github>microsoft/beachball//renovate/presets/groupFluent#feat',
      'github>microsoft/beachball//renovate/presets/groupJest#feat',
      'github>microsoft/beachball//renovate/presets/groupLageBackfill#feat',
      'github>microsoft/beachball//renovate/presets/groupNodeMajor#feat',
      'github>microsoft/beachball//renovate/presets/groupReact#feat',
      'github>microsoft/beachball//renovate/presets/groupRollup#feat',
      'github>microsoft/beachball//renovate/presets/groupTypes#feat',
      'github>microsoft/beachball//renovate/presets/groupYargs#feat',
      'github>microsoft/beachball//renovate/presets/keepFresh#feat',
      'github>microsoft/beachball//renovate/presets/restrictNode#feat(16)',
      'github>microsoft/beachball//renovate/presets/scheduleNoisy#feat',
    ]);
  });
});
