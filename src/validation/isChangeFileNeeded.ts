import { getChangedPackages } from '../changefile/getChangedPackages';
import type { PackageInfos } from '../types/PackageInfo';

export function isChangeFileNeeded(
  options: Parameters<typeof getChangedPackages>[0],
  packageInfos: PackageInfos
): boolean {
  const { branch } = options;

  console.log(`Checking for changes against "${branch}"`);
  const changedPackages = getChangedPackages(options, packageInfos);
  if (changedPackages.length > 0) {
    console.log(
      `Found changes in the following packages: ${[...changedPackages]
        .sort()
        .map(pkg => `\n  ${pkg}`)
        .join('')}`
    );
    return true;
  }
  return false;
}
