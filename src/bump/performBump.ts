import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { callHook } from './callHook';
import { updatePackageJsons } from './updatePackageJsons';
import { updateLockFile } from './updateLockFile';

/**
 * Performs the bump and writes to the filesystem:
 * update package.json files, update lock file, write changelogs, and delete change files.
 */
export async function performBump(bumpInfo: BumpInfo, options: BeachballOptions): Promise<BumpInfo> {
  const { modifiedPackages, packageInfos, changeFileChangeInfos } = bumpInfo;

  await callHook(options.hooks?.prebump, modifiedPackages, packageInfos, options.concurrency);

  updatePackageJsons(modifiedPackages, packageInfos);
  await updateLockFile(options.path);

  if (options.generateChangelog) {
    // Generate changelog
    await writeChangelog(bumpInfo, options);
  }

  if (!options.keepChangeFiles) {
    // Unlink changelogs
    unlinkChangeFiles(changeFileChangeInfos, packageInfos, options);
  }

  await callHook(options.hooks?.postbump, modifiedPackages, packageInfos, options.concurrency);

  // This is returned from bump() for testing
  return bumpInfo;
}
