import type { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersionsByTag } from '../packageManager/listPackageVersions';
import semver from 'semver';
import { setDependentVersions } from '../bump/setDependentVersions';
import { updateLockFile } from '../bump/updateLockFile';
import { updatePackageJsons } from '../bump/updatePackageJsons';

export async function sync(options: BeachballOptions): Promise<void> {
  const packageInfos = getPackageInfos(options.path);
  const scopedPackages = new Set(getScopedPackages(options, packageInfos));

  const infos = new Map(Object.entries(packageInfos).filter(([pkg, info]) => !info.private && scopedPackages.has(pkg)));
  const publishedVersions = await listPackageVersionsByTag([...infos.values()], options.tag, options);

  const modifiedPackages = new Set<string>();

  for (const [pkg, info] of infos.entries()) {
    if (publishedVersions[pkg]) {
      const publishedVersion = publishedVersions[pkg];

      if (publishedVersion && (options.forceVersions || semver.lt(info.version, publishedVersion))) {
        console.log(
          `There is a newer version of "${pkg}@${info.version}". Syncing to the published version ${publishedVersion}`
        );

        packageInfos[pkg].version = publishedVersion;
        modifiedPackages.add(pkg);
      }
    }
  }

  const dependentModifiedPackages = setDependentVersions({ packageInfos, scopedPackages }, options);
  Object.keys(dependentModifiedPackages).forEach(pkg => modifiedPackages.add(pkg));

  updatePackageJsons(modifiedPackages, packageInfos);
  await updateLockFile(options.path);
}
