import type { Catalogs } from 'workspace-tools';
import { consideredDependencies, type PackageInfos, type PackageJson, type PublishConfig } from '../types/PackageInfo';
import { readJson } from '../object/readJson';
import { writeJson } from '../object/writeJson';
import { resolveSpecialVersion } from '../packageManager/resolveSpecialVersion';

const acceptedKeys: (keyof PublishConfig)[] = [
  'types',
  'typings',
  'main',
  'module',
  'exports',
  'repository',
  'bin',
  'browser',
  'files',
];

/**
 * Check for `publishConfig` overrides and `workspace:` or `catalog:` versions, and update the
 * package.jsons on disk accordingly.
 */
export function performPublishOverrides(
  packagesToPublish: string[],
  packageInfos: PackageInfos,
  catalogs: Catalogs | undefined
): void {
  for (const pkgName of packagesToPublish) {
    const info = packageInfos[pkgName];
    const packageJson = readJson<PackageJson>(info.packageJsonPath);

    const hasVersionOverrides = _performVersionOverrides(packageJson, packageInfos, catalogs);
    const hasPublishConfigOverrides = _performPublishConfigOverrides(packageJson);

    if (hasVersionOverrides || hasPublishConfigOverrides) {
      writeJson(info.packageJsonPath, packageJson);
    }
  }
}

/**
 * Apply valid overrides from `packageJson.publishConfig`.
 * (Exported for testing.)
 * @returns True if any overrides were applied.
 */
export function _performPublishConfigOverrides(packageJson: PackageJson): boolean {
  let hasOverrides = false;
  if (packageJson.publishConfig) {
    // Everything in publishConfig in accepted keys here will get overridden & removed from the publishConfig section
    for (const [k, value] of Object.entries(packageJson.publishConfig)) {
      const key = k as keyof Required<PackageJson>['publishConfig'];
      if (acceptedKeys.includes(key)) {
        // eslint-disable-next-line
        (packageJson as any)[key] = value;
        delete packageJson.publishConfig[key];
        hasOverrides = true;
      }
    }
  }
  return hasOverrides;
}

/**
 * When dependencies are defined using workspace protocol they need to be replaced with a correct version during
 * publish. If publishing happened using a package manager that supports this protocol (pnpm/yarn) then it could
 * handle this replacement for us, but as of this time publishing only happens via npm, which can't do this
 * replacement.
 *
 * Additionally, if a dependency version is defined via a catalog, that must be manually substituted.
 *
 * (Exported for testing.)
 * @returns True if any overrides were applied.
 */
export function _performVersionOverrides(
  packageJson: PackageJson,
  packageInfos: PackageInfos,
  catalogs: Catalogs | undefined
): boolean {
  let hasOverrides = false;

  for (const depType of consideredDependencies) {
    const deps = packageJson[depType];
    if (!deps) continue;

    for (const [depName, depVersion] of Object.entries(deps)) {
      const resolvedVersion = resolveSpecialVersion({ depName, depVersion, catalogs, packageInfos });
      if (resolvedVersion) {
        deps[depName] = resolvedVersion;
        hasOverrides = true;
      }
    }
  }

  return hasOverrides;
}
