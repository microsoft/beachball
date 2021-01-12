import { updateRelatedChangeType } from '../../bump/updateRelatedChangeType';
import { BumpInfo } from '../../types/BumpInfo';
import _ from 'lodash';
import { ChangeInfo } from '../../types/ChangeInfo';

describe('updateRelatedChangeType', () => {
  const bumpInfoFixture: BumpInfo = ({
    changes: new Map(),
    dependents: {},
    packageChangeTypes: {},
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
      packageChangeTypes: {
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
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'minor' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('patch');
    expect(dependentChangeInfos.size).toBe(1);

    const fooChangeInfos = dependentChangeInfos.get('foo');
    expect(fooChangeInfos).toBeDefined();
    expect(fooChangeInfos?.size).toBe(1);

    const fooChangeInfo = fooChangeInfos?.get('bar');
    expect(fooChangeInfo?.type).toBe('patch');
    expect(fooChangeInfo?.packageName).toBe('bar');
    expect(fooChangeInfo?.commit).toBe('0xdeadbeef');
    expect(fooChangeInfo?.email).toBe('test@dev.com');
    expect(fooChangeInfo?.comment).toBe('');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
      },
      packageChangeTypes: {
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
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(dependentChangeInfos.size).toBe(1);

    const fooDependentChangeInfos = dependentChangeInfos.get('foo');
    expect(fooDependentChangeInfos).toBeDefined();
    expect(fooDependentChangeInfos?.size).toBe(1);

    const barDependentChangeInfo = fooDependentChangeInfos?.get('bar');

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
      packageChangeTypes: {
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
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();

    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);
    updateRelatedChangeType('bar', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('major');
    expect(bumpInfo.packageChangeTypes['app'].type).toBe('patch');
    expect(dependentChangeInfos.size).toBe(2);

    const fooDependentChangeInfos = dependentChangeInfos.get('foo');
    expect(fooDependentChangeInfos?.size).toBe(1);

    const barChangeInfoForFoo = fooDependentChangeInfos?.get('bar');
    expect(barChangeInfoForFoo?.type).toBe('patch');
    expect(barChangeInfoForFoo?.packageName).toBe('bar');
    expect(barChangeInfoForFoo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForFoo?.email).toBe('test@dev.com');
    expect(barChangeInfoForFoo?.comment).toBe('');

    const barDependentChangeInfos = dependentChangeInfos.get('bar');
    expect(barDependentChangeInfos?.size).toBe(1);

    const appChangeInfoForBar = barDependentChangeInfos?.get('app');
    expect(appChangeInfoForBar?.type).toBe('patch');
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
      packageChangeTypes: {
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

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();

    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['baz'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['app'].type).toBe('patch');
    expect(dependentChangeInfos.size).toBe(2);

    const fooDependentChangeInfos = dependentChangeInfos.get('foo');
    expect(fooDependentChangeInfos?.size).toBe(1);

    const barChangeInfoForFoo = fooDependentChangeInfos?.get('bar');
    expect(barChangeInfoForFoo?.type).toBe('patch');
    expect(barChangeInfoForFoo?.packageName).toBe('bar');
    expect(barChangeInfoForFoo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForFoo?.email).toBe('test@dev.com');
    expect(barChangeInfoForFoo?.comment).toBe('');

    const barDependentChangeInfos = dependentChangeInfos.get('bar');
    expect(barDependentChangeInfos?.size).toBe(1);

    const appChangeInfoForBar = barDependentChangeInfos?.get('app');
    expect(appChangeInfoForBar?.type).toBe('patch');
    expect(appChangeInfoForBar?.packageName).toBe('app');
    expect(appChangeInfoForBar?.commit).toBe('0xdeadbeef');
    expect(appChangeInfoForBar?.email).toBe('test@dev.com');
    expect(appChangeInfoForBar?.comment).toBe('');

    updateRelatedChangeType(
      'baz',
      { ...changeInfoFixture, type: 'patch', email: 'dev@test.com', commit: '0xfeef' },
      bumpInfo,
      dependentChangeInfos,
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['baz'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['app'].type).toBe('minor');
    expect(dependentChangeInfos.size).toBe(3);

    const fooDependentChangeInfos2 = dependentChangeInfos.get('foo');
    expect(fooDependentChangeInfos2?.size).toBe(1);

    const barChangeInfoForFoo2 = fooDependentChangeInfos?.get('bar');
    expect(barChangeInfoForFoo2?.type).toBe('patch');
    expect(barChangeInfoForFoo2?.packageName).toBe('bar');
    expect(barChangeInfoForFoo2?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForFoo2?.email).toBe('test@dev.com');
    expect(barChangeInfoForFoo2?.comment).toBe('');

    const bazDependentChangeInfos = dependentChangeInfos.get('baz');
    expect(bazDependentChangeInfos?.size).toBe(1);

    const bazChangeInfoForBar = bazDependentChangeInfos?.get('bar');
    expect(bazChangeInfoForBar?.type).toBe('minor');
    expect(bazChangeInfoForBar?.packageName).toBe('bar');
    expect(bazChangeInfoForBar?.commit).toBe('0xfeef');
    expect(bazChangeInfoForBar?.email).toBe('dev@test.com');
    expect(bazChangeInfoForBar?.comment).toBe('');

    const barDependentChangeInfos2 = dependentChangeInfos.get('bar');
    expect(barDependentChangeInfos2?.size).toBe(1);

    const appChangeInfoForBar2 = barDependentChangeInfos2?.get('app');
    expect(appChangeInfoForBar2?.type).toBe('minor');
    expect(appChangeInfoForBar2?.packageName).toBe('app');
    expect(appChangeInfoForBar2?.commit).toBe('0xfeef');
    expect(appChangeInfoForBar2?.email).toBe('dev@test.com');
    expect(appChangeInfoForBar2?.comment).toBe('');
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and roll-up multiple change infos', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependents: {
        foo: ['bar'],
        bar: ['app'],
        baz: ['bar', 'app'],
      },
      packageChangeTypes: {
        foo: { type: 'patch' },
        baz: { type: 'patch' },
      },
      dependentChangeTypes: {
        foo: 'major',
        baz: 'minor',
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

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);
    updateRelatedChangeType('baz', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['baz'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('major');
    expect(bumpInfo.packageChangeTypes['app'].type).toBe('major');

    expect(dependentChangeInfos.size).toBe(3);

    const fooDependentChangeInfos = dependentChangeInfos.get('foo');
    expect(fooDependentChangeInfos?.size).toBe(1);

    const barChangeInfoForFoo = fooDependentChangeInfos?.get('bar');
    expect(barChangeInfoForFoo?.type).toBe('major');
    expect(barChangeInfoForFoo?.packageName).toBe('bar');
    expect(barChangeInfoForFoo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForFoo?.email).toBe('test@dev.com');
    expect(barChangeInfoForFoo?.comment).toBe('');

    const barDependentChangeInfos = dependentChangeInfos.get('bar');
    expect(barDependentChangeInfos?.size).toBe(1);

    const appChangeInfoForBar = barDependentChangeInfos?.get('app');
    expect(appChangeInfoForBar?.type).toBe('major');
    expect(appChangeInfoForBar?.packageName).toBe('app');
    expect(appChangeInfoForBar?.commit).toBe('0xdeadbeef');
    expect(appChangeInfoForBar?.email).toBe('test@dev.com');
    expect(appChangeInfoForBar?.comment).toBe('');

    const bazDependentChangeInfos = dependentChangeInfos.get('baz');
    expect(bazDependentChangeInfos?.size).toBe(2);

    const barChangeInfoForBaz = bazDependentChangeInfos?.get('bar');
    expect(barChangeInfoForBaz?.type).toBe('minor');
    expect(barChangeInfoForBaz?.packageName).toBe('bar');
    expect(barChangeInfoForBaz?.commit).toBe('0xdeadbeef');
    expect(barChangeInfoForBaz?.email).toBe('test@dev.com');
    expect(barChangeInfoForBaz?.comment).toBe('');

    const appChangeInfoForBaz = bazDependentChangeInfos?.get('app');
    expect(appChangeInfoForBaz?.type).toBe('minor');
    expect(appChangeInfoForBaz?.packageName).toBe('app');
    expect(appChangeInfoForBaz?.commit).toBe('0xdeadbeef');
    expect(appChangeInfoForBaz?.email).toBe('test@dev.com');
    expect(appChangeInfoForBaz?.comment).toBe('');
  });

  it('should bump all packages in a group together as minor', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        foo: 'minor',
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
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'minor' }, bumpInfo, dependentChangeInfos, true);

    expect(dependentChangeInfos.size).toBe(0);
    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as patch', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        foo: 'patch',
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
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(dependentChangeInfos.size).toBe(0);
    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();
  });

  it('should bump all packages in a group together as none', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        foo: 'patch',
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
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'none' }, bumpInfo, dependentChangeInfos, true);

    expect(dependentChangeInfos.size).toBe(0);
    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('none');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('none');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();
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
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'none' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('none');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('none');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();
    expect(dependentChangeInfos.size).toBe(0);
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
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('dep', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['dep'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();

    expect(dependentChangeInfos.size).toBe(1);

    const depChangeInfos = dependentChangeInfos.get('dep');
    expect(depChangeInfos).toBeDefined();
    expect(depChangeInfos?.size).toBe(1);

    const depChangeInfo = depChangeInfos?.get('bar');
    expect(depChangeInfo?.type).toBe('minor');
    expect(depChangeInfo?.packageName).toBe('bar');
    expect(depChangeInfo?.commit).toBe('0xdeadbeef');
    expect(depChangeInfo?.email).toBe('test@dev.com');
    expect(depChangeInfo?.comment).toBe('');
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
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('dep', { ...changeInfoFixture, type: 'patch' }, bumpInfo, dependentChangeInfos, true);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['dep'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['app'].type).toBe('minor');

    expect(dependentChangeInfos.size).toBe(2);

    const depChangeInfos = dependentChangeInfos.get('dep');
    expect(depChangeInfos).toBeDefined();
    expect(depChangeInfos?.size).toBe(1);

    const depChangeInfo = depChangeInfos?.get('bar');
    expect(depChangeInfo?.type).toBe('minor');
    expect(depChangeInfo?.packageName).toBe('bar');
    expect(depChangeInfo?.commit).toBe('0xdeadbeef');
    expect(depChangeInfo?.email).toBe('test@dev.com');
    expect(depChangeInfo?.comment).toBe('');

    const fooChangeInfos = dependentChangeInfos.get('foo');
    expect(fooChangeInfos).toBeDefined();
    expect(fooChangeInfos?.size).toBe(1);

    const fooChangeInfo = fooChangeInfos?.get('app');
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
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType(
      'mergeStyles',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      dependentChangeInfos,
      true
    );

    updateRelatedChangeType(
      'datetimeUtils',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      dependentChangeInfos,
      true
    );

    expect(dependentChangeInfos.size).toBe(4);

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['mergeStyles'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['datetime'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['datetimeUtils'].type).toBe('patch');

    const mergeStylesChangeInfos = dependentChangeInfos.get('mergeStyles');
    expect(mergeStylesChangeInfos).toBeDefined();
    expect(mergeStylesChangeInfos?.size).toBe(1);

    const mergeStyleChangeInfo = mergeStylesChangeInfos?.get('styling');
    expect(mergeStyleChangeInfo?.type).toBe('minor');
    expect(mergeStyleChangeInfo?.packageName).toBe('styling');
    expect(mergeStyleChangeInfo?.commit).toBe('0xdeadbeef');
    expect(mergeStyleChangeInfo?.email).toBe('test@dev.com');
    expect(mergeStyleChangeInfo?.comment).toBe('');

    const stylingChangeInfos = dependentChangeInfos.get('styling');
    expect(stylingChangeInfos).toBeDefined();
    expect(stylingChangeInfos?.size).toBe(1);

    const stylingChangeInfo = stylingChangeInfos?.get('bar');
    expect(stylingChangeInfo?.type).toBe('minor');
    expect(stylingChangeInfo?.packageName).toBe('bar');
    expect(stylingChangeInfo?.commit).toBe('0xdeadbeef');
    expect(stylingChangeInfo?.email).toBe('test@dev.com');
    expect(stylingChangeInfo?.comment).toBe('');

    const barChangeInfos = dependentChangeInfos.get('bar');
    expect(barChangeInfos).toBeDefined();
    expect(barChangeInfos?.size).toBe(1);

    const barChangeInfo = barChangeInfos?.get('datetime');
    expect(barChangeInfo?.type).toBe('minor');
    expect(barChangeInfo?.packageName).toBe('datetime');
    expect(barChangeInfo?.commit).toBe('0xdeadbeef');
    expect(barChangeInfo?.email).toBe('test@dev.com');
    expect(barChangeInfo?.comment).toBe('');

    const datetimeUtilsChangeInfos = dependentChangeInfos.get('datetimeUtils');
    expect(datetimeUtilsChangeInfos).toBeDefined();
    expect(datetimeUtilsChangeInfos?.size).toBe(1);

    const datetimeUtilsChangeInfo = datetimeUtilsChangeInfos?.get('datetime');
    expect(datetimeUtilsChangeInfo?.type).toBe('patch');
    expect(datetimeUtilsChangeInfo?.packageName).toBe('datetime');
    expect(datetimeUtilsChangeInfo?.commit).toBe('0xdeadbeef');
    expect(datetimeUtilsChangeInfo?.email).toBe('test@dev.com');
    expect(datetimeUtilsChangeInfo?.comment).toBe('');
  });

  it('should respect disallowed change type', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      packageInfos: {
        foo: {
          combinedOptions: { disallowedChangeTypes: ['minor', 'major'], defaultNpmTag: 'latest' },
        },
      },
    });

    const dependentChangeInfos = new Map<string, Map<string, ChangeInfo>>();
    updateRelatedChangeType('foo', { ...changeInfoFixture, type: 'major' }, bumpInfo, dependentChangeInfos, true);

    expect(dependentChangeInfos.size).toBe(0);
    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
  });
});
