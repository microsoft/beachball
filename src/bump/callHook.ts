import path from 'path';
import { HooksOptions } from '../types/BeachballOptions';
import { PackageInfos } from '../types/PackageInfo';

/**
 * Call a hook for each affected package. Does nothing if the hook is undefined.
 */
export async function callHook(
  hook: HooksOptions['prebump' | 'postbump' | 'prepublish' | 'postpublish'],
  affectedPackages: Iterable<string>,
  packageInfos: PackageInfos
): Promise<void> {
  if (!hook) {
    return;
  }

  const bumpVersions = Object.keys(packageInfos).reduce((accumulator, pkgName) => {
    accumulator[pkgName] = packageInfos[pkgName].version;
    return accumulator;
  }, {} as Record<string, string>);

  for (const pkg of affectedPackages) {
    const packageInfo = packageInfos[pkg];
    const packagePath = path.dirname(packageInfo.packageJsonPath);

    await hook(packagePath, packageInfo.name, packageInfo.version, bumpVersions);
  }
}
