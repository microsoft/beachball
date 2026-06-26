import type { PackageJson } from '../types.ts';
export interface PackageJsonResult {
  packageRoot: string;
  packageJson: PackageJson;
}
/**
 * Find the actual package.json (the one with a name) for the current file.
 * This implementation accounts for intermediate package.json files with just a "type", no name.
 * @param cache Optional cache if iterating over multiple files which may be from the same package
 */
export declare function findRealPackageJson(
  fileRealpath: string,
  cache?: Map<string, PackageJsonResult | null>
): PackageJsonResult;
//# sourceMappingURL=findRealPackageJson.d.ts.map
