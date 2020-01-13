import { getChangedPackages } from '../changefile/getChangedPackages';
export function isChangeFileNeeded(branch: string, cwd: string, fetch: boolean) {
  console.log(`Checking for changes against "${branch}"`);
  const changedPackages = getChangedPackages(branch, cwd, fetch);
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
