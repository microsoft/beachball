import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersionsByTag, listPackageVersionsFromChangelog } from '../packageManager/listPackageVersions';
import semver from 'semver';
import { setDependentVersions } from '../bump/setDependentVersions';
import { writePackageJson } from '../bump/performBump';

export async function sync(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);
  const scopedPackages = new Set(getScopedPackages(options));

  const infos = new Map(Object.entries(packageInfos).filter(([pkg, info]) => !info.private && scopedPackages.has(pkg)));
  const infosArr = [...infos.values()];
  const currentVersions = options.useChangelogVersions ?
    await listPackageVersionsFromChangelog(infosArr) :
    await listPackageVersionsByTag(
      infosArr,
      options.registry,
      options.tag,
      options.token,
      options.authType
    );

  const modifiedPackages = new Set<string>();

  for (const [pkg, info] of infos.entries()) {
    if (currentVersions[pkg]) {
      const currentVersion = currentVersions[pkg];

      if (currentVersion && (options.forceVersions || semver.lt(info.version, currentVersion))) {
        console.log(
          `There is a newer version of "${pkg}@${info.version}". Syncing to the ${options.useChangelogVersions ? 'changelog' : 'published'} version ${currentVersion}`
        );

        packageInfos[pkg].version = currentVersion;
        modifiedPackages.add(pkg);
      }
    }
  }

  const dependentModifiedPackages = setDependentVersions(packageInfos, scopedPackages, options.replaceStars);
  dependentModifiedPackages.forEach(pkg => modifiedPackages.add(pkg));

  writePackageJson(modifiedPackages, packageInfos);
}
