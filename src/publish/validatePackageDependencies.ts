import { consideredDependencies, type PackageInfos } from '../types/PackageInfo';
import { bulletedList } from '../logging/bulletedList';

const prodDepTypes = consideredDependencies.filter(t => t !== 'devDependencies');

/**
 * Validate no private package is listed as package dependency for packages which will be published.
 */
export function validatePackageDependencies(packagesToValidate: string[], packageInfos: PackageInfos): boolean {
  /** Mapping from in-repo dep to all validated packages that depend on it */
  const prodDeps: { [dep: string]: string[] } = {};

  for (const pkg of packagesToValidate) {
    for (const depType of prodDepTypes) {
      for (const dep of Object.keys(packageInfos[pkg][depType] || {})) {
        if (packageInfos[dep]) {
          (prodDeps[dep] ??= []).push(pkg);
        }
      }
    }
  }

  console.log(`Validating no private package among package dependencies`);

  // This makes the assumption that any dep matching a monorepo package name refers to the
  // in-repo version. If there's an issue because that's not the case, extra logic could be added
  // to verify that the versions are `workspace:` or semver-satisfied (which would also require
  // logic for catalog versions).
  const errorDeps = Object.keys(prodDeps).filter(dep => packageInfos[dep]?.private);
  if (errorDeps.length) {
    console.error(
      `\nERROR: Found private packages among published package dependencies:\n` +
        bulletedList(errorDeps.map(dep => `${dep}: used by ${prodDeps[dep].join(', ')}`).sort()) +
        '\n'
    );
    return false;
  }
  console.log('  OK!\n');
  return true;
}
