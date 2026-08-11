import semver from 'semver';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getPackageTagVersions } from '../packageManager/getPackageVersions';
import { setDependentVersions } from '../bump/setDependentVersions';
import { updateLockFile } from '../bump/updateLockFile';
import { updatePackageJsons } from '../bump/updatePackageJsons';
import type { BasicCommandContext } from '../types/CommandContext';

export type SyncCommandContext = Pick<BasicCommandContext, 'originalPackageInfos' | 'scopedPackages'>;

/**
 * Sync with the latest versions on the registry.
 */
export async function sync(options: BeachballOptions, context: SyncCommandContext): Promise<void> {
  const { originalPackageInfos: packageInfos, scopedPackages } = context;

  const infos = Object.values(packageInfos).filter(info => !info.private && scopedPackages.has(info.name));

  console.log(`Getting versions from registry for ${infos.length} package(s)...`);

  const publishedVersions = await getPackageTagVersions(infos, options);

  const modifiedPackages = new Set<string>();

  for (const info of infos) {
    const pkg = info.name;
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

  // Update dependencies on the packages with updated versions (only need to include package.json updates)
  const dependentModifiedPackages = setDependentVersions({
    bumpInfo: { packageInfos, scopedPackages, modifiedPackages },
    options,
    skipImplicitBumps: true,
  });
  // Add the dependent modified packages to the list that needs to be updated on disk
  // (this is a different purpose than other use of modifiedPackages)
  Object.keys(dependentModifiedPackages).forEach(pkg => modifiedPackages.add(pkg));

  updatePackageJsons(modifiedPackages, packageInfos);
  await updateLockFile(options);
}
