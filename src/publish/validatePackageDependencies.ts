import { PackageInfos } from '../types/PackageInfo';

/**
 * Validate no private package is listed as package dependency for packages which will be published.
 */
export function validatePackageDependencies(packagesToValidate: string[], packageInfos: PackageInfos): boolean {
  /** Mapping from dep to all validated packages that depend on it */
  const allDeps: { [dep: string]: string[] } = {};
  for (const pkg of packagesToValidate) {
    for (const dep of Object.keys(packageInfos[pkg].dependencies || {})) {
      allDeps[dep] ??= [];
      allDeps[dep].push(pkg);
    }
  }

  console.log(`Validating no private package among package dependencies`);
  const errorDeps = Object.keys(allDeps).filter(dep => packageInfos[dep]?.private);
  if (errorDeps.length) {
    console.error(
      `ERROR: Found private packages among published package dependencies:\n` +
        errorDeps.map(dep => `- ${dep}: used by ${allDeps[dep].join(', ')}`).join('\n')
    );
    return false;
  }

  console.log('  OK!\n');
  return true;
}
