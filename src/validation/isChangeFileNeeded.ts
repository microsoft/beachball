import { getChangedPackages } from '../changefile/getChangedPackages';
import { BeachballOptions } from '../types/BeachballOptions';

export function isChangeFileNeeded(options: BeachballOptions) {
  const { branch } = options;

  console.log(`Checking for changes against "${branch}"`);
  const changedPackages = getChangedPackages(options);
  if (changedPackages.length > 0) {
    console.log(
      `Found changes in the following packages: ${[...changedPackages]
        .sort()
        .map(pkg => `\n  ${pkg}`)
        .join('')}`
    );
  }
  return changedPackages.length > 0;
}
