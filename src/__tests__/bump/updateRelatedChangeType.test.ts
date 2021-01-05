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
    },
    modifiedPackages: new Set(),
    newPackages: new Set(),
    packageGroups: {},
    groupOptions: {},
  } as unknown) as BumpInfo;

  const changeInfoFixture: ChangeInfo = {
    dependentChangeType: 'none',
    packageName: '',
    comment: '',
    commit: '',
    email: '',
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
      dependentChangeTypes: {
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

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'minor' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('patch');
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

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
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

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'minor' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

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

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

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

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'none' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

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

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'none' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('none');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('none');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();
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

    updateRelatedChangeType(
      'dep',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['dep'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['unrelated']).toBeUndefined();
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

    updateRelatedChangeType(
      'dep',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['dep'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['app'].type).toBe('minor');
  });

  it('should propagate dependent change type across group', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      dependentChangeTypes: {
        mergeStyles: 'minor',
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
          name: 'app',
        },
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'] } },
    });

    updateRelatedChangeType(
      'mergeStyles',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );
    updateRelatedChangeType(
      'datetimeUtils',
      { ...changeInfoFixture, type: 'patch' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['bar'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['mergeStyles'].type).toBe('patch');
    expect(bumpInfo.packageChangeTypes['datetime'].type).toBe('minor');
    expect(bumpInfo.packageChangeTypes['datetimeUtils'].type).toBe('patch');
  });

  it('should respect disallowed change type', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      packageInfos: {
        foo: {
          combinedOptions: { disallowedChangeTypes: ['minor', 'major'], defaultNpmTag: 'latest' },
        },
      },
    });

    updateRelatedChangeType(
      'foo',
      { ...changeInfoFixture, type: 'major' },
      bumpInfo,
      new Map<string, Array<ChangeInfo>>(),
      true
    );

    expect(bumpInfo.packageChangeTypes['foo'].type).toBe('patch');
  });
});
