import { updateRelatedChangeType } from '../../bump/updateRelatedChangeType';
import { BumpInfo } from '../../types/BumpInfo';
import _ from 'lodash';
import { ChangeInfo, ChangeType } from '../../types/ChangeInfo';
import { PackageInfo, PackageInfos } from '../../types/PackageInfo';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U> ? Array<DeepPartial<U>> : DeepPartial<T[P]>;
};
type PartialBumpInfo = DeepPartial<Omit<BumpInfo, 'calculatedChangeTypes'>> & {
  // can't get DeepPartial to handle the index signature properly
  calculatedChangeTypes?: { [packageName: string]: ChangeType };
};

describe('updateRelatedChangeType', () => {
  const getBumpInfo = (overrides: PartialBumpInfo): BumpInfo =>
    _.merge<BumpInfo, PartialBumpInfo>(
      {
        changeFileChangeInfos: new Map(),
        dependents: {},
        calculatedChangeTypes: {},
        packageInfos: {
          foo: {
            name: 'foo',
            combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
          },
          bar: {
            name: 'bar',
            combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
          },
          baz: {
            name: 'baz',
            combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
          },
        } as { [packageName: string]: DeepPartial<PackageInfo> } as PackageInfos,
        modifiedPackages: new Set(),
        newPackages: new Set(),
        packageGroups: {},
        groupOptions: {},
        scopedPackages: new Set(),
        dependentChangedBy: {},
      },
      overrides
    );

  const changeInfoFixture: ChangeInfo = {
    dependentChangeType: 'none',
    packageName: 'foo',
    comment: 'test comment',
    commit: '0xdeadbeef',
    email: 'test@dev.com',
    type: 'none',
  };

  it('should bump dependent packages with "patch" change type by default', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        foo: ['bar'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'minor', dependentChangeType: 'patch' }],
      ]),
      calculatedChangeTypes: {
        foo: 'minor',
      },
      packageInfos: {
        bar: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('patch');
  });

  it('should bump dependent packages according to the dependentChangeTypes', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        foo: ['bar'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', dependentChangeType: 'minor' }],
      ]),
      calculatedChangeTypes: {
        foo: 'patch',
      },
      packageInfos: {
        bar: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('minor');
  });

  it("should bump dependent packages according to the bumpInfo.dependentChangeTypes and respect package's own change type", () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        foo: ['bar'],
        bar: ['app'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', packageName: 'foo', dependentChangeType: 'patch' }],
        ['bar.json', { ...changeInfoFixture, type: 'patch', packageName: 'bar', dependentChangeType: 'minor' }],
      ]),
      calculatedChangeTypes: {
        foo: 'patch',
        bar: 'major',
      },
      packageInfos: {
        app: {
          dependencies: {
            bar: '1.0.0',
          },
        },
        bar: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);
    updateRelatedChangeType('bar.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('major');
    expect(bumpInfo.calculatedChangeTypes['app']).toBe('minor');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and dependentChangeInfos must stay up to date', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        foo: ['bar'],
        baz: ['bar'],
        bar: ['app'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', packageName: 'foo', dependentChangeType: 'patch' }],
        [
          'baz.json',
          {
            ...changeInfoFixture,
            type: 'patch',
            email: 'dev@test.com',
            commit: '0xfeef',
            dependentChangeType: 'minor',
          },
        ],
      ]),
      calculatedChangeTypes: {
        foo: 'patch',
        baz: 'minor',
      },
      packageInfos: {
        app: {
          dependencies: {
            bar: '1.0.0',
          },
        },
        bar: {
          dependencies: {
            foo: '1.0.0',
            baz: '2.0.0',
          },
        },
      },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['baz']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['app']).toBe('patch');

    updateRelatedChangeType('baz.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('minor');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and roll-up multiple change infos', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        foo: ['bar'],
        bar: ['app'],
        baz: ['bar', 'app'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', dependentChangeType: 'major' }],
        ['baz.json', { ...changeInfoFixture, type: 'patch', dependentChangeType: 'minor' }],
      ]),
      calculatedChangeTypes: {
        foo: 'patch',
        baz: 'patch',
      },
      packageInfos: {
        app: {
          dependencies: {
            bar: '1.0.0',
            baz: '2.0.0',
          },
        },
        bar: {
          dependencies: {
            foo: '1.0.0',
            baz: '2.0.0',
          },
        },
      },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);
    updateRelatedChangeType('baz.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['baz']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('major');
    expect(bumpInfo.calculatedChangeTypes['app']).toBe('major');
  });

  it('should bump all packages in a group together as minor', () => {
    const bumpInfo = getBumpInfo({
      calculatedChangeTypes: {},
      packageInfos: {
        foo: {},
        bar: {},
        unrelated: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'minor', dependentChangeType: 'minor' }],
      ]),
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as patch', () => {
    const bumpInfo = getBumpInfo({
      calculatedChangeTypes: {},
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', dependentChangeType: 'patch' }],
      ]),
      packageInfos: {
        foo: {},
        bar: {},
        unrelated: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('patch');
    expect(bumpInfo.calculatedChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as none', () => {
    const bumpInfo = getBumpInfo({
      calculatedChangeTypes: {},
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'none', dependentChangeType: 'none' }],
      ]),
      packageInfos: {
        foo: {},
        bar: {},
        unrelated: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('none');
    expect(bumpInfo.calculatedChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as none with dependents', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        foo: ['bar'],
      },
      packageInfos: {
        foo: {},
        bar: {},
        unrelated: {},
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'none', dependentChangeType: 'none' }],
      ]),
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('none');
    expect(bumpInfo.calculatedChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump all grouped packages, if a dependency was bumped', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        dep: ['bar'],
      },
      packageInfos: {
        foo: {},
        bar: {
          dependencies: {
            dep: '1.0.0',
          },
        },
        dep: {
          name: 'dep',
          combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
        },
        unrelated: {
          name: 'unrelated',
          combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
        },
      },
      changeFileChangeInfos: new Map([
        ['dep.json', { ...changeInfoFixture, packageName: 'dep', type: 'patch', dependentChangeType: 'minor' }],
      ]),
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    updateRelatedChangeType('dep.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump dependent package, if a dependency was in a group', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        dep: ['bar'],
        foo: ['app'],
      },
      packageInfos: {
        foo: {},
        bar: {
          dependencies: {
            dep: '1.0.0',
          },
        },
        dep: {
          name: 'dep',
          combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
        },
        app: {
          name: 'app',
          dependencies: {
            foo: '1.0.0',
          },
          combinedOptions: { disallowedChangeTypes: [], defaultNpmTag: 'latest' },
        },
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },

      changeFileChangeInfos: new Map([
        ['dep.json', { ...changeInfoFixture, packageName: 'dep', type: 'patch', dependentChangeType: 'minor' }],
      ]),
    });

    updateRelatedChangeType('dep.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['app']).toBe('minor');
  });

  it('should propagate dependent change type across group', () => {
    const bumpInfo = getBumpInfo({
      dependents: {
        mergeStyles: ['styling'],
        styling: ['bar'],
        utils: ['bar'],
        bar: ['datetime'],
        datetimeUtils: ['datetime'],
      },
      packageInfos: {
        styling: {
          name: 'styling',
          dependencies: {
            mergeStyles: '1.0.0',
          },
        },
        utils: {
          name: 'utils',
        },
        mergeStyles: {
          name: 'mergeStyles',
        },
        foo: {},
        bar: {
          dependencies: {
            styling: '1.0.0',
            utils: '1.0.0',
          },
        },
        datetime: {
          name: 'datetime',
          dependencies: {
            bar: '1.0.0',
            datetimeUtils: '1.0.0',
          },
        },
        datetimeUtils: {
          name: 'datetimeUtils',
        },
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      changeFileChangeInfos: new Map([
        [
          'mergeStyles.json',
          { ...changeInfoFixture, packageName: 'mergeStyles', type: 'patch', dependentChangeType: 'minor' },
        ],
        [
          'datetimeUtils.json',
          { ...changeInfoFixture, packageName: 'datetimeUtils', type: 'patch', dependentChangeType: 'patch' },
        ],
      ]),
    });

    updateRelatedChangeType('mergeStyles.json', bumpInfo, true);
    updateRelatedChangeType('datetimeUtils.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['bar']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['datetime']).toBe('minor');
    expect(bumpInfo.calculatedChangeTypes['styling']).toBe('minor');
  });

  it('should respect disallowed change type', () => {
    const bumpInfo = getBumpInfo({
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'major', dependentChangeType: 'patch' }],
      ]),
      packageInfos: {
        foo: {
          combinedOptions: { disallowedChangeTypes: ['minor', 'major'], defaultNpmTag: 'latest' },
        },
      },
    });

    updateRelatedChangeType('foo.json', bumpInfo, true);

    expect(bumpInfo.calculatedChangeTypes['foo']).toBeUndefined();
  });
});
