import { validatePackageDependencies } from '../../publish/validatePackageDependencies';
import { BumpInfo } from '../../types/BumpInfo';
import _ from 'lodash';

describe('validatePackageDependencies', () => {
  const bumpInfoFixture = ({
    changes: new Map(),
    dependents: {},
    packageChangeTypes: {},
    dependentChangeTypes: {
      foo: 'patch',
    },
    packageInfos: {
      foo: {
        name: 'foo',
      },
      bar: {
        name: 'bar',
      },
    },
    modifiedPackages: new Set(),
    newPackages: new Set(),
    scopedPackages: new Set(['foo', 'bar']),
    packageGroups: {},
    groupOptions: {},
  } as unknown) as BumpInfo;

  it('invalid when dependencies contains private package', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      packageInfos: {
        foo: {
          private: true,
        },
        bar: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      },
      modifiedPackages: new Set(['bar']),
      newPackages: new Set(['foo']),
    });

    expect(validatePackageDependencies(bumpInfo)).toBeFalsy();
  });

  it('valid when devDependencies contains private package', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      packageInfos: {
        foo: {
          private: true,
        },
        bar: {
          devDependencies: {
            foo: '1.0.0',
          },
        },
      },
      modifiedPackages: new Set(['bar']),
      newPackages: new Set(['foo']),
    });

    expect(validatePackageDependencies(bumpInfo)).toBeTruthy();
  });

  it('valid when no private package is listed as dependency', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      packageInfos: {
        bar: {
          devDependencies: {
            foo: '1.0.0',
          },
        },
      },
      modifiedPackages: new Set(['bar']),
      newPackages: new Set(['foo']),
    });

    expect(validatePackageDependencies(bumpInfo)).toBeTruthy();
  });

  it('valid when no package has dependency', () => {
    const bumpInfo = _.merge(_.cloneDeep(bumpInfoFixture), {
      modifiedPackages: new Set(['foo', 'bar']),
    });

    expect(validatePackageDependencies(bumpInfo)).toBeTruthy();
  });
});
