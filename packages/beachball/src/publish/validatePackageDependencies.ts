import { consideredDependencies, type PackageInfos } from '../types/PackageInfo';
import { bulletedList } from '../logging/bulletedList';

const prodDepTypes = consideredDependencies.filter(t => t !== 'devDependencies');

/**
 * Validate that no private or `shouldPublish: false` package is listed as a production dependency
 * of any package that will be published. Either would result in an unresolvable dependency at
 * install time.
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
  const privateDeps = Object.keys(prodDeps).filter(dep => packageInfos[dep]?.private);
  const unpublishedDeps = Object.keys(prodDeps).filter(
    dep => packageInfos[dep]?.packageOptions?.shouldPublish === false
  );

  if (privateDeps.length) {
    console.error(
      `ERROR: Found private packages among published package dependencies:\n` +
        bulletedList(privateDeps.map(dep => `${dep}: used by ${prodDeps[dep].join(', ')}`).sort()) +
        '\n'
    );
  }
  if (unpublishedDeps.length) {
    console.error(
      `ERROR: Found unpublished (beachball.shouldPublish: false) packages among published package dependencies:\n` +
        bulletedList(unpublishedDeps.map(dep => `${dep}: used by ${prodDeps[dep].join(', ')}`).sort()) +
        '\n'
    );
  }
  if (privateDeps.length || unpublishedDeps.length) {
    return false;
  }

  console.log('  OK!\n');
  return true;
}
