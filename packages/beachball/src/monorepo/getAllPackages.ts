import { getPackageInfos } from "./getPackageInfos";
export function getAllPackages(cwd: string): string[] {
  const infos = getPackageInfos(cwd);
  return Object.keys(infos);
}
