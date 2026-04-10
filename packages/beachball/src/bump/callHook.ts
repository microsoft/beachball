import path from 'path';
import type { HooksOptions } from '../types/BeachballOptions';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageGraph } from '../monorepo/getPackageGraph';

/**
 * Call a hook for each affected package. Does nothing if the hook is undefined.
 */
export async function callHook(
  hook: HooksOptions['prebump' | 'postbump' | 'prepublish' | 'postpublish'],
  affectedPackages: string[] | Set<string>,
  packageInfos: PackageInfos,
  concurrency: number
): Promise<void> {
  if (!hook) {
    return;
  }

  // Filter out nonexistent packages in case of theoretical race conditions or something
  affectedPackages = [...affectedPackages].filter(pkgName => pkgName in packageInfos);
  if (!affectedPackages.length) {
    return;
  }

  const callHookInternal = async (packageInfo: PackageInfo) => {
    const packagePath = path.dirname(packageInfo.packageJsonPath);
    await hook(packagePath, packageInfo.name, packageInfo.version, packageInfos);
  };

  if (concurrency === 1) {
    for (const pkg of affectedPackages) {
      await callHookInternal(packageInfos[pkg]);
    }
  } else {
    // TODO: reuse the graph across hooks if possible (depends on if internal state is used)
    const packageGraph = getPackageGraph(affectedPackages, packageInfos, callHookInternal);

    await packageGraph.run({
      concurrency: concurrency,
      continue: false,
    });
  }
}
