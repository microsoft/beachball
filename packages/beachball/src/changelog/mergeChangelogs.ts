import type { PackageChangelog } from '../types/ChangeLog';
import type { PackageInfo } from '../types/PackageInfo';
import type { ChangeType } from '../types/ChangeInfo';

/**
 * Merge multiple package changelogs into one.
 * `name` and `version` will use the values from `mainPackage`'s changelog.
 * `comments` are merged. `date` will be now. `tag` is taken from `mainPackageTag`
 * (the primary precomputed git tag for `mainPackage`, or `undefined` if no tag will be created).
 */
export function mergeChangelogs(
  changelogs: PackageChangelog[],
  mainPackage: PackageInfo,
  mainPackageTag: string | undefined
): PackageChangelog | undefined {
  if (changelogs.length < 1 || !mainPackage) {
    return undefined;
  }

  const result: PackageChangelog = {
    name: mainPackage.name,
    version: mainPackage.version,
    ...(mainPackageTag !== undefined && { tag: mainPackageTag }),
    date: new Date(),
    comments: {},
  };

  for (const changelog of changelogs) {
    for (const changeType of Object.keys(changelog.comments) as ChangeType[]) {
      const comments = changelog.comments[changeType];
      if (comments?.length) {
        (result.comments[changeType] ??= []).push(...comments);
      }
    }
  }

  return result;
}
