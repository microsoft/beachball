import fs from 'fs';
import { type PackageInfos, type PackageJson, consideredDependencies } from '../types/PackageInfo';
import { readJson } from '../object/readJson';
import { writeJson } from '../object/writeJson';

/**
 * Update package.json files for modified packages after bumping.
 */
export function updatePackageJsons(modifiedPackages: ReadonlySet<string>, packageInfos: Readonly<PackageInfos>): void {
  for (const pkgName of modifiedPackages) {
    const info = packageInfos[pkgName];
    if (!fs.existsSync(info.packageJsonPath)) {
      // rare case in highly active monorepos where a package might have been deleted in main
      console.warn(`Skipping ${pkgName} since package.json does not exist`);
      continue;
    }
    const packageJson = readJson<PackageJson>(info.packageJsonPath);

    if (!info.private) {
      packageJson.version = info.version;
    }

    for (const depKind of consideredDependencies) {
      // updatedDeps contains all of the dependencies in the bump info since the beginning of a build job
      const updatedDeps = info[depKind] || {};

      // to be cautious, only update internal && modifiedPackages, since some other dependency
      // changes could have occurred since the beginning of the build job and the next merge step
      // would overwrite those incorrectly!
      for (const [dep, updatedVersion] of Object.entries(updatedDeps)) {
        if (modifiedPackages.has(dep) && packageJson[depKind]?.[dep]) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          packageJson[depKind]![dep] = updatedVersion;
        }
      }
    }

    writeJson(info.packageJsonPath, packageJson);
  }
}
