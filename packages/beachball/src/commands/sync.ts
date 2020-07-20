import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import semver from 'semver';
import { setDependentVersions } from '../bump/setDependentVersions';
import { writePackageJson } from '../bump/performBump';

export async function sync(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);
  const scopedPackages = new Set(getScopedPackages(options));

  const infos = new Map(Object.entries(packageInfos).filter(([pkg, info]) => !info.private && scopedPackages.has(pkg)));
  const publishedVersions = await listPackageVersions([...infos.keys()], options.registry);

  const modifiedPackages = new Set<string>();

  for (const [pkg, info] of infos.entries()) {
    if (publishedVersions[pkg]) {
      const publishedVersion = semver.sort(publishedVersions[pkg])[publishedVersions[pkg].length - 1];

      if (publishedVersion && semver.lt(info.version, publishedVersion)) {
        console.log(
          `There is a newer version of "${pkg}@${info.version}". Syncing to the published version ${publishedVersion}`
        );

        packageInfos[pkg].version = publishedVersion;
        modifiedPackages.add(pkg);
      }
    }
  }

  const dependentModifiedPackages = setDependentVersions(packageInfos);
  dependentModifiedPackages.forEach(pkg => modifiedPackages.add(pkg));

  writePackageJson(modifiedPackages, packageInfos);
}
