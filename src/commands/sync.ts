import type { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { listPackageVersionsByTag } from '../packageManager/listPackageVersions';
import semver from 'semver';
import { setDependentVersions } from '../bump/setDependentVersions';
import { updateLockFile } from '../bump/updateLockFile';
import { updatePackageJsons } from '../bump/updatePackageJsons';
import type { BasicCommandContext } from '../types/CommandContext';

export type SyncCommandContext = Pick<BasicCommandContext, 'originalPackageInfos' | 'scopedPackages'>;

/**
 * Sync with the latest versions on the registry.
 */
export async function sync(options: BeachballOptions, context: SyncCommandContext): Promise<void>;
/** @deprecated Use other signature */
export async function sync(options: BeachballOptions): Promise<void>;
export async function sync(options: BeachballOptions, context?: SyncCommandContext): Promise<void> {
  // eslint-disable-next-line etc/no-deprecated
  const packageInfos = context?.originalPackageInfos ?? getPackageInfos(options.path);
  const scopedPackages = context?.scopedPackages ?? getScopedPackages(options, packageInfos);

  const infos = new Map(
    Object.entries(packageInfos).filter(
      ([pkg, info]) => !info.private && (scopedPackages.allInScope || scopedPackages.has(pkg))
    )
  );

  console.log(`Getting versions from registry for ${infos.size} package(s)...`);

  const publishedVersions = await listPackageVersionsByTag([...infos.values()], options);

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

  // Update dependencies on the packages with updated versions
  const dependentModifiedPackages = setDependentVersions({ packageInfos, scopedPackages, modifiedPackages }, options);
  // Add the dependent modified packages to the list that needs to be updated on disk
  // (this is a different purpose than other use of modifiedPackages)
  Object.keys(dependentModifiedPackages).forEach(pkg => modifiedPackages.add(pkg));

  updatePackageJsons(modifiedPackages, packageInfos);
  await updateLockFile(options);
}
