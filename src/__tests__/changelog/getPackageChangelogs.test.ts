import { getPackageChangelogs } from '../../changelog/getPackageChangelogs';
import { BumpInfo } from '../../types/BumpInfo';
import { ChangeSet } from '../../types/ChangeInfo';
import { PackageInfos } from '../../types/PackageInfo';

describe('getPackageChangelogs', () => {
  it('should have multiple comment entries when a package has a changefile AND was part of a dependent bump', () => {
    const changeFileChangeInfos: ChangeSet = [
      {
        changeFile: 'foo.json',
        change: {
          comment: 'comment for foo',
          commit: 'deadbeef',
          dependentChangeType: 'patch',
          email: 'something@something.com',
          packageName: 'foo',
          type: 'patch',
        },
      },
      {
        changeFile: 'bar.json',
        change: {
          comment: 'comment for bar',
          commit: 'deadbeef',
          dependentChangeType: 'patch',
          email: 'something@something.com',
          packageName: 'bar',
          type: 'patch',
        },
      },
    ];

    const dependentChangedBy: BumpInfo['dependentChangedBy'] = {
      bar: new Set(['foo']),
    };

    const packageInfos: PackageInfos = {
      foo: {
        combinedOptions: {} as any,
        name: 'foo',
        packageJsonPath: 'packages/foo/package.json',
        packageOptions: {},
        private: false,
        version: '1.0.0',
        dependencies: {
          bar: '^1.0.0',
        },
      },
      bar: {
        combinedOptions: {} as any,
        name: 'bar',
        packageJsonPath: 'packages/bar/package.json',
        packageOptions: {},
        private: false,
        version: '1.0.0',
      },
    };

    const changelogs = getPackageChangelogs(
      changeFileChangeInfos,
      { foo: 'patch', bar: 'patch' },
      dependentChangedBy,
      packageInfos,
      '.'
    );

    expect(Object.keys(changelogs.bar.comments.patch!).length).toBe(2);
    expect(Object.keys(changelogs.foo.comments.patch!).length).toBe(1);
  });
});
