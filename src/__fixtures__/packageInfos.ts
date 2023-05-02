import { BeachballOptions } from '../types/BeachballOptions';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';

/**
 * Makes a properly typed PackageInfos object from a partial object, filling in the `name`,
 * `version` 1.0.0, and an empty `combinedOptions` object. (Other properties are not set, but this
 * at least makes the fixture code a bit more concise and ensures that any properties provided in
 * the override object are valid.)
 */
export function makePackageInfos(packageInfos: {
  [name: string]: Partial<Omit<PackageInfo, 'combinedOptions'>> & { combinedOptions?: Partial<BeachballOptions> };
}): PackageInfos {
  const result: PackageInfos = {};
  for (const [name, info] of Object.entries(packageInfos)) {
    result[name] = {
      name,
      combinedOptions: {} as BeachballOptions,
      ...info,
    } as PackageInfo;
  }
  return result;
}
