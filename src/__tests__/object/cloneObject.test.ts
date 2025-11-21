import { describe, it, expect } from '@jest/globals';
import type { BumpInfo } from '../../types/BumpInfo';
import { cloneObject } from '../../object/cloneObject';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { getChange } from '../../__fixtures__/changeFiles';

describe('cloneObject', () => {
  it.each<[string, object | unknown[]]>([
    ['empty object', {}],
    ['empty object with null prototype', Object.create(null)],
    ['object', { a: 1, b: '2', c: true }],
    ['object with null prototype', Object.assign(Object.create(null), { a: 1, b: '2', c: true })],
    ['empty array', []],
    ['array', [1, '2', true]],
    ['set', new Set([1, 2, 3])],
    ['object of sets', { a: new Set([1, 2, 3]), b: new Set(['a', 'b', 'c']) }],
  ])('clones %s', (desc, val) => {
    const cloned = cloneObject(val);
    expect(cloned).toEqual(val);
    expect(cloned).not.toBe(val);
  });

  it('deeply clones nested object', () => {
    const orig = { a: { b: { c: 1 } } };
    const cloned = cloneObject(orig);
    expect(cloned).toEqual(orig);
    expect(cloned).not.toBe(orig);
    expect(cloned.a).not.toBe(orig.a);
    expect(cloned.a.b).not.toBe(orig.a.b);
  });

  it('deep clones array of objects and arrays', () => {
    const orig = [{ a: 1 }, [2, 3, 4]];
    const cloned = cloneObject(orig);
    expect(cloned).toEqual(orig);
    expect(cloned).not.toBe(orig);
    expect(cloned[0]).not.toBe(orig[0]);
    expect(cloned[1]).not.toBe(orig[1]);
  });

  it('throws on other object types', () => {
    expect(() => cloneObject(new Date())).toThrow('Unsupported object type found while cloning bump info: Date');
    expect(() => cloneObject(/abc/)).toThrow('Unsupported object type found while cloning bump info: RegExp');
    expect(() => cloneObject(new Map())).toThrow('Unsupported object type found while cloning bump info: Map');
    class Foo {}
    expect(() => cloneObject(new Foo())).toThrow('Unsupported object type found while cloning bump info: Foo');
  });

  it('clones bump info structure', () => {
    const original: BumpInfo = {
      // There's no attempt at consistency because it doesn't matter here
      calculatedChangeTypes: { pkgA: 'minor', pkgB: 'patch' },
      packageInfos: makePackageInfos({ a: { dependencies: { b: '^1.0.0' } }, b: {} }),
      changeFileChangeInfos: [
        { change: getChange('a'), changeFile: '' },
        { change: getChange('b'), changeFile: '' },
      ],
      packageGroups: { group1: { packageNames: ['a', 'b'], disallowedChangeTypes: null } },
      dependentChangedBy: { a: new Set(['b']) },
      modifiedPackages: new Set(['a']),
      scopedPackages: new Set(['a', 'b']),
    };

    const cloned = cloneObject(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.packageInfos).not.toBe(original.packageInfos);
    expect(cloned.packageInfos.a).not.toBe(original.packageInfos.a);
    expect(cloned.changeFileChangeInfos).not.toBe(original.changeFileChangeInfos);
    expect(cloned.changeFileChangeInfos[0]).not.toBe(original.changeFileChangeInfos[0]);
    expect(cloned.changeFileChangeInfos[0].change).not.toBe(original.changeFileChangeInfos[0].change);
    expect(cloned.packageGroups).not.toBe(original.packageGroups);
    expect(cloned.dependentChangedBy).not.toBe(original.dependentChangedBy);
    expect(cloned.dependentChangedBy.a).not.toBe(original.dependentChangedBy.a);
    expect(cloned.modifiedPackages).not.toBe(original.modifiedPackages);
    expect(cloned.scopedPackages).not.toBe(original.scopedPackages);
  });
});
