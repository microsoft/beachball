import { BumpInfo } from '../types/BumpInfo';
import { shouldPublishPackage } from './shouldPublishPackage';

/**
 * Validate no private package is listed as package dependency for packages which will be published.
 */
export function validatePackageDependencies(bumpInfo: BumpInfo): boolean {
  let hasErrors: boolean = false;
  const { modifiedPackages, newPackages, packageInfos } = bumpInfo;

  const packagesToValidate = [...modifiedPackages, ...newPackages];
  let allDeps: string[] = [];
  packagesToValidate.forEach(pkg => {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping package dep validation - ${reasonToSkip}`);
      return;
    }

    const packageInfo = packageInfos[pkg];
    if (packageInfo.dependencies) {
      const depPkgNames = Object.keys(packageInfo.dependencies);
      allDeps = allDeps.concat(depPkgNames);
    }
  });

  process.stdout.write(`Validating no private package among package dependencies`);
  for (const dep of new Set(allDeps)) {
    if (packageInfos[dep] && packageInfos[dep].private === true) {
      console.error(`\nPrivate package ${dep} should not be a dependency.`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    process.stdout.write(' OK!\n');
  }
  return !hasErrors;
}
