import { BumpInfo } from '../types/BumpInfo';
import { shouldPublishPackage } from './shouldPublishPackage';

/**
 * Validate no private package is listed as package dependency for packages which will be published.
 */
export function validatePackageDependencies(bumpInfo: BumpInfo): boolean {
  let hasErrors: boolean = false;
  const { modifiedPackages, newPackages, packageInfos } = bumpInfo;

  const packagesToValidate = [...modifiedPackages, ...newPackages];
  /** Mapping from dep to all validated packages that depend on it */
  const allDeps: { [dep: string]: string[] } = {};
  for (const pkg of packagesToValidate) {
    const { publish, reasonToSkip } = shouldPublishPackage(bumpInfo, pkg);
    if (!publish) {
      console.log(`Skipping package dep validation - ${reasonToSkip}`);
      continue;
    }

    const packageInfo = packageInfos[pkg];
    if (packageInfo.dependencies) {
      for (const dep of Object.keys(packageInfo.dependencies)) {
        if (!allDeps[dep]) {
          allDeps[dep] = [];
        }
        allDeps[dep].push(pkg);
      }
    }
  }

  process.stdout.write(`Validating no private package among package dependencies`);
  for (const [dep, usedBy] of Object.entries(allDeps)) {
    if (packageInfos[dep] && packageInfos[dep].private === true) {
      console.error(
        `\nERROR: Private package ${dep} should not be a dependency of published package(s) ${usedBy.join(', ')}.`
      );
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    process.stdout.write(' OK!\n');
  }
  return !hasErrors;
}
