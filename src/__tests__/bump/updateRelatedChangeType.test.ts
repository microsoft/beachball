import { updateRelatedChangeType } from '../../bump/updateRelatedChangeType';
import { BumpInfo } from '../../types/BumpInfo';
import _ from 'lodash';
import { ChangeInfo } from '../../types/ChangeInfo';

describe('updateRelatedChangeType', () => {
  const bumpInfoFixture: BumpInfo = ({
    changeFileChangeInfos: new Map(),
    dependents: {},
    calculatedChangeInfos: {},
    dependentChangeTypes: {
      foo: 'patch',
    },
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
    },
    dependentChangeInfos: {},
    modifiedPackages: new Set(),
    newPackages: new Set(),
    packageGroups: {},
    groupOptions: {},
  } as unknown) as BumpInfo;

  const changeInfoFixture: ChangeInfo = {
    dependentChangeType: 'none',
    packageName: 'foo',
    comment: 'test comment',
    commit: '0xdeadbeef',
    email: 'test@dev.com',
    type: 'none',
  };

  it('should bump dependent packages with "patch" change type by default', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'minor', dependentChangeType: 'patch' }],
      ]),
      calculatedChangeInfos: {
        foo: {
          type: 'minor',
        },
      },
      packageInfos: {
        bar: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      },
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('patch');
    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(1);

    const fooChangeInfo = bumpInfo.dependentChangeInfos['foo'];
    expect(fooChangeInfo).toBeUndefined();

    const barChangeInfo = bumpInfo.dependentChangeInfos['bar'];
    expect(barChangeInfo).toBeDefined();
    expect(barChangeInfo?.type).toBe('patch');
    expect(barChangeInfo?.packageName).toBe('bar');
    expect(barChangeInfo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfo?.email).toBe('test@dev.com');
    expect(barChangeInfo?.comment).toBe('');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
      },
      changeFileChangeInfos: new Map([['foo.json', { ...changeInfoFixture, type: 'patch' }]]),
      calculatedChangeInfos: {
        foo: { type: 'patch' },
      },
      dependentChangeTypes: {
        foo: 'minor',
      },
      packageInfos: {
        bar: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      },
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('minor');
    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(1);

    const barDependentChangeInfo = bumpInfo.dependentChangeInfos['bar'];
    expect(barDependentChangeInfo).toBeDefined();
    expect(barDependentChangeInfo?.type).toBe('minor');
    expect(barDependentChangeInfo?.packageName).toBe('bar');
    expect(barDependentChangeInfo?.commit).toBe('0xdeadbeef');
    expect(barDependentChangeInfo?.email).toBe('test@dev.com');
    expect(barDependentChangeInfo?.comment).toBe('');
  });

  it("should bump dependent packages according to the bumpInfo.dependentChangeTypes and respect package's own change type", () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
        bar: ['app'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', packageName: 'foo' }],
        ['bar.json', { ...changeInfoFixture, type: 'patch', packageName: 'bar' }],
      ]),
      calculatedChangeInfos: {
        foo: { type: 'patch' },
        bar: { type: 'major' },
      },
      dependentChangeTypes: {
        foo: 'patch',
        bar: 'minor',
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
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);
    updateRelatedChangeType('bar.json', 'bar', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('major');
    expect(bumpInfo.calculatedChangeInfos['app'].type).toBe('minor');
    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(2);

    const barDependentChangeInfo = bumpInfo.dependentChangeInfos['bar'];
    expect(barDependentChangeInfo).toBeDefined();
    expect(barDependentChangeInfo?.type).toBe('major');
    expect(barDependentChangeInfo?.commit).toBe('0xdeadbeef');
    expect(barDependentChangeInfo?.email).toBe('test@dev.com');
    expect(barDependentChangeInfo?.comment).toBe('');

    const appChangeInfoForBar = bumpInfo.dependentChangeInfos['app'];
    expect(appChangeInfoForBar?.type).toBe('minor');
    expect(appChangeInfoForBar?.packageName).toBe('app');
    expect(appChangeInfoForBar?.commit).toBe('0xdeadbeef');
    expect(appChangeInfoForBar?.email).toBe('test@dev.com');
    expect(appChangeInfoForBar?.comment).toBe('');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and dependentChangeInfos must stay up to date', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
        baz: ['bar'],
        bar: ['app'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch', packageName: 'foo' }],
        ['baz.json', { ...changeInfoFixture, type: 'patch', email: 'dev@test.com', commit: '0xfeef' }],
      ]),
      calculatedChangeInfos: {
        foo: { type: 'patch' },
        baz: { type: 'minor' },
      },
      dependentChangeTypes: {
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

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['baz'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['app'].type).toBe('patch');
    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(2);

    const fooDependentChangeInfos = bumpInfo.dependentChangeInfos['foo'];
    expect(fooDependentChangeInfos).toBeUndefined();

    const barChangeInfoForFoo = bumpInfo.dependentChangeInfos['bar'];
    expect(barChangeInfoForFoo?.type).toBe('patch');
    expect(barChangeInfoForFoo?.packageName).toBe('bar');
    expect(barChangeInfoForFoo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForFoo?.email).toBe('test@dev.com');
    expect(barChangeInfoForFoo?.comment).toBe('');

    const appChangeInfoForBar = bumpInfo.dependentChangeInfos['app'];
    expect(appChangeInfoForBar?.type).toBe('patch');
    expect(appChangeInfoForBar?.packageName).toBe('app');
    expect(appChangeInfoForBar?.commit).toBe('0xdeadbeef');
    expect(appChangeInfoForBar?.email).toBe('test@dev.com');
    expect(appChangeInfoForBar?.comment).toBe('');

    updateRelatedChangeType('baz.json', 'baz', bumpInfo, true);

    expect(bumpInfo.dependentChangeInfos['baz']).toBeUndefined();
    expect(bumpInfo.dependentChangeInfos['bar'].commit).toBe('0xfeef');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and roll-up multiple change infos', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
        bar: ['app'],
        baz: ['bar', 'app'],
      },
      changeFileChangeInfos: new Map([
        ['foo.json', { ...changeInfoFixture, type: 'patch' }],
        ['baz.json', { ...changeInfoFixture, type: 'patch' }],
      ]),
      calculatedChangeInfos: {
        foo: { type: 'patch' },
        baz: { type: 'patch' },
      },
      dependentChangeTypes: {
        foo: 'major',
        baz: 'minor',
      },
      dependentChangeInfos: {},
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

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);
    updateRelatedChangeType('baz.json', 'baz', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['baz'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('major');
    expect(bumpInfo.calculatedChangeInfos['app'].type).toBe('major');

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(2);

    const fooDependentChangeInfos = bumpInfo.dependentChangeInfos['foo'];
    expect(fooDependentChangeInfos).toBeUndefined();

    const barChangeInfoForFoo = bumpInfo.dependentChangeInfos['bar'];
    expect(barChangeInfoForFoo?.type).toBe('major');
    expect(barChangeInfoForFoo?.packageName).toBe('bar');
    expect(barChangeInfoForFoo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForFoo?.email).toBe('test@dev.com');
    expect(barChangeInfoForFoo?.comment).toBe('');

    const appChangeInfoForBar = bumpInfo.dependentChangeInfos['app'];
    expect(appChangeInfoForBar?.type).toBe('major');
    expect(appChangeInfoForBar?.packageName).toBe('app');
    expect(appChangeInfoForBar?.commit).toBe('0xdeadbeef');
    expect(appChangeInfoForBar?.email).toBe('test@dev.com');
    expect(appChangeInfoForBar?.comment).toBe('');
  });

  it('should bump all packages in a group together as minor', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        foo: 'minor',
      },
      calculatedChangeInfos: {},
      packageInfos: {
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
        },
        unrelated: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      changeFileChangeInfos: new Map([['foo.json', { ...changeInfoFixture, type: 'minor' }]]),
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(1);
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as patch', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        foo: 'patch',
      },
      calculatedChangeInfos: {},
      changeFileChangeInfos: new Map([['foo.json', { ...changeInfoFixture, type: 'patch' }]]),
      packageInfos: {
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
        },
        unrelated: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(1);
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('patch');
    expect(bumpInfo.calculatedChangeInfos['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as none', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        foo: 'none',
      },
      calculatedChangeInfos: {},
      changeFileChangeInfos: new Map([['foo.json', { ...changeInfoFixture, type: 'none' }]]),
      packageInfos: {
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
        },
        unrelated: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(1);
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('none');
    expect(bumpInfo.calculatedChangeInfos['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as none with dependents', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
      },
      dependentChangeTypes: {
        foo: 'none',
      },
      packageInfos: {
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
        },
        unrelated: {},
      },
      changeFileChangeInfos: new Map([['foo.json', { ...changeInfoFixture, type: 'none' }]]),
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(1);
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('none');
    expect(bumpInfo.calculatedChangeInfos['unrelated']).toBeUndefined();
  });

  it('should bump all grouped packages, if a dependency was bumped', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        dep: 'minor',
      },
      dependents: {
        dep: ['bar'],
      },
      packageInfos: {
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
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
      changeFileChangeInfos: new Map([['dep.json', { ...changeInfoFixture, type: 'patch' }]]),
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('dep.json', 'dep', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['unrelated']).toBeUndefined();

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(2);
  });

  it('should bump dependent package, if a dependency was in a group', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        dep: 'minor',
      },
      dependents: {
        dep: ['bar'],
        foo: ['app'],
      },
      packageInfos: {
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
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
      dependentChangeInfos: {},
      changeFileChangeInfos: new Map([['dep.json', { ...changeInfoFixture, type: 'patch' }]]),
    });

    updateRelatedChangeType('dep.json', 'dep', bumpInfo, true);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['app'].type).toBe('minor');

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(3);

    const fooChangeInfo = bumpInfo.dependentChangeInfos['app'];
    expect(fooChangeInfo?.type).toBe('minor');
    expect(fooChangeInfo?.packageName).toBe('app');
    expect(fooChangeInfo?.commit).toBe('0xdeadbeef');
    expect(fooChangeInfo?.email).toBe('test@dev.com');
    expect(fooChangeInfo?.comment).toBe('');
  });

  it('should propagate dependent change type across group', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        mergeStyles: 'minor',
        datetimeUtils: 'patch',
      },
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
        foo: {
          group: 'grp',
        },
        bar: {
          group: 'grp',
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
        ['mergeStyles.json', { ...changeInfoFixture, type: 'patch' }],
        ['datetimeUtils.json', { ...changeInfoFixture, type: 'patch' }],
      ]),
      dependentChangeInfos: {},
    });

    updateRelatedChangeType('mergeStyles.json', 'mergeStyles', bumpInfo, true);
    updateRelatedChangeType('datetimeUtils.json', 'datetimeUtils', bumpInfo, true);

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(4);

    expect(bumpInfo.calculatedChangeInfos['foo'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['bar'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['datetime'].type).toBe('minor');
    expect(bumpInfo.calculatedChangeInfos['styling'].type).toBe('minor');
  });

  it('should respect disallowed change type', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      changeFileChangeInfos: new Map([['foo.json', { ...changeInfoFixture, type: 'major' }]]),
      packageInfos: {
        foo: {
          combinedOptions: { disallowedChangeTypes: ['minor', 'major'], defaultNpmTag: 'latest' },
        },
      },
    });

    updateRelatedChangeType('foo.json', 'foo', bumpInfo, true);

    expect(Object.keys(bumpInfo.dependentChangeInfos).length).toBe(0);
    expect(bumpInfo.calculatedChangeInfos['foo']).toBeUndefined();
  });
});
