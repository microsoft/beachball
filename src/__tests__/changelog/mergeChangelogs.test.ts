import { PackageChangelog } from '../../types/ChangeLog';
import { mergeChangelogs } from '../../changelog/mergeChangelogs';
import { PackageInfo } from '../../types/PackageInfo';

describe('mergeChangelogs', () => {
  const primaryPackageInfo = {
    name: 'primary',
    version: '1.2.3',
  } as PackageInfo;

  const primaryDate = new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)');
  const fooDate = new Date('Thu Aug 22 2020 14:20:40 GMT-0700 (Pacific Daylight Time)');

  function getChangelog(packageName: 'primary' | 'foo'): PackageChangelog {
    return {
      name: packageName,
      date: packageName === 'primary' ? primaryDate : fooDate,
      version: '1.0.0',
      tag: packageName + '_v1.0.0',
      comments: {
        patch: [
          {
            comment: packageName + ' comment',
            author: packageName + ' author',
            commit: packageName + ' commit',
            package: packageName,
          },
        ],
      },
    };
  }

  it('merge changelogs when primary package has change', () => {
    const primaryChangelog = getChangelog('primary');

    const changelogs = [primaryChangelog, getChangelog('foo')];

    const mergedChangelog = mergeChangelogs(changelogs, primaryPackageInfo);
    expect(mergedChangelog).toBeTruthy();
    expect(mergedChangelog!.name).toBe(primaryPackageInfo.name);
    expect(mergedChangelog!.version).toBe(primaryPackageInfo.version);
    expect(mergedChangelog!.date).toBeTruthy();
    expect(mergedChangelog!.comments.patch).toHaveLength(2);
  });

  it('merge changelogs when primary package has no change', () => {
    const changelogs = [getChangelog('foo')];

    const mergedChangelog = mergeChangelogs(changelogs, primaryPackageInfo);
    expect(mergedChangelog).toBeTruthy();
    expect(mergedChangelog!.name).toBe(primaryPackageInfo.name);
    expect(mergedChangelog!.version).toBe(primaryPackageInfo.version);
    expect(mergedChangelog!.date).toBeTruthy();
    expect(mergedChangelog!.comments.patch).toEqual(changelogs[0].comments.patch);
  });
});
