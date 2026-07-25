import type { PGraph } from 'p-graph';
import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import { getPackageGraph } from '../monorepo/getPackageGraph';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import { callHook } from './callHook';
import { updateLockFile } from './updateLockFile';
import { updatePackageJsons } from './updatePackageJsons';

/**
 * Write the bump results to the filesystem (but don't commit yet):
 * - call prebump hook
 * - update package.json files
 * - update lock file
 * - write changelogs
 * - delete change files
 * - call postbump hook
 *
 * This should NOT mutate `bumpInfo`.
 *
 * @param bumpInfo Bump info produced by `bumpInMemory` which already reflects in-memory bumps
 */
export async function performBump(bumpInfo: Readonly<BumpInfo>, options: BeachballOptions): Promise<void> {
  const { modifiedPackages, packageInfos, changeFileChangeInfos } = bumpInfo;

  // Build the graph once so it can be reused across the prebump and postbump hooks.
  // Following previous behavior, this runs for ALL modified packages (not just ones that will be
  // published, even in the publishToRegistry flow) - could be modified if needed.
  let packageGraph: PGraph | undefined;
  if (options.hooks?.prebump || options.hooks?.postbump) {
    packageGraph = getPackageGraph(modifiedPackages, packageInfos);
  }

  // "prebump" receives the bumped version, but is called before writing to disk
  // (seemingly intended by the original PR https://github.com/microsoft/beachball/pull/608)
  await callHook('prebump', packageGraph, packageInfos, options);

  updatePackageJsons(modifiedPackages, packageInfos);
  await updateLockFile(options);

  if (options.generateChangelog) {
    // Generate changelog
    await writeChangelog(bumpInfo, options);
  }

  // Unlink changelogs
  unlinkChangeFiles(changeFileChangeInfos, options);

  await callHook('postbump', packageGraph, packageInfos, options);
}
