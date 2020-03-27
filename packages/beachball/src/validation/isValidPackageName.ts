import { getAllPackages } from '../monorepo/getAllPackages';

export function isValidPackageName(pkg: string, cwd: string) {
  const packages = getAllPackages(cwd);
  return packages.includes(pkg);
}
