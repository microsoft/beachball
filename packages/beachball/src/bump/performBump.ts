import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { callHook } from './callHook';
import { updatePackageJsons } from './updatePackageJsons';
import { updateLockFile } from './updateLockFile';

/**
 * Write the bump results to the filesystem:
 * update package.json files, update lock file, write changelogs, and delete change files.
 *
 * This should NOT mutate `bumpInfo`.
 * @param bumpInfo Bump info produced by `bumpInMemory` which already reflects in-memory bumps
 */
export async function performBump(bumpInfo: Readonly<BumpInfo>, options: BeachballOptions): Promise<void> {
  const { modifiedPackages, packageInfos, changeFileChangeInfos } = bumpInfo;

  // TODO: this uses the wrong version https://github.com/microsoft/beachball/issues/1116
  await callHook(options.hooks?.prebump, modifiedPackages, packageInfos, options.concurrency);

  updatePackageJsons(modifiedPackages, packageInfos);
  await updateLockFile(options);

  if (options.generateChangelog) {
    // Generate changelog
    await writeChangelog(bumpInfo, options);
  }

  // Unlink changelogs
  unlinkChangeFiles(changeFileChangeInfos, options);

  await callHook(options.hooks?.postbump, modifiedPackages, packageInfos, options.concurrency);
}
