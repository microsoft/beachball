import path from 'path';
import { HooksOptions } from '../types/BeachballOptions';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageGraph } from '../monorepo/getPackageGraph';

/**
 * Call a hook for each affected package. Does nothing if the hook is undefined.
 */
export async function callHook(
  hook: HooksOptions['prebump' | 'postbump' | 'prepublish' | 'postpublish'],
  affectedPackages: Iterable<string>,
  packageInfos: PackageInfos,
  concurrency: number
): Promise<void> {
  if (!hook) {
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
    const packageGraph = getPackageGraph(affectedPackages, packageInfos, callHookInternal);

    await packageGraph.run({
      concurrency: concurrency,
      continue: false
    })
  }
}
