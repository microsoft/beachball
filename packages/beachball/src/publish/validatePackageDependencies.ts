import * as _ from 'lodash';
import { BumpInfo } from '../types/BumpInfo';
import { shouldPublishPackage } from './shouldPublishPackage';

/**
 * Validate no private package is listed as package dependency for packages which will be published.
 */
export function validatePackageDependencies(bumpInfo: BumpInfo): boolean {
  process.stdout.write(`Validating no private package among package dependencies`);

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
    ['dependencies', 'devDependencies'].forEach(depKind => {
      const deps = packageInfo[depKind];
      if (deps) {
        const depPkgNames = Object.keys(deps);
        allDeps = allDeps.concat(depPkgNames);
      }
    });
  });

  allDeps = _.uniq(allDeps);

  for (const dep of allDeps) {
    if (packageInfos[dep] && packageInfos[dep].private === true) {
      console.error(`Private package ${dep} should not be a dependency.`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    process.stdout.write(' OK!\n');
  }
  return !hasErrors;
}
