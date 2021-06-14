import fs from 'fs-extra';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { PackageDeps, PackageInfo } from '../types/PackageInfo';

export async function star(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);
  const packageInfoKeys = Object.keys(packageInfos);
  const packageKeysSet = new Set<string>(packageInfoKeys);
  packageInfoKeys.forEach(pkgName => {
    const info = packageInfos[pkgName];
    const packageJson: PackageInfo = fs.readJSONSync(info.packageJsonPath);
    let writePackageJson = false;

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      const deps: PackageDeps | undefined = (info as any)[depKind];

      if (deps) {
        const workspaceDeps = Object.keys(deps).filter(dep => packageKeysSet.has(dep));
        if (workspaceDeps.length > 0) {
          workspaceDeps.forEach(dep => {
            packageJson[depKind][dep] = '*';
          });
          writePackageJson = true;
        }
      }
    });

    if (writePackageJson) {
      fs.writeJSONSync(info.packageJsonPath, packageJson, { spaces: 2 });
    }
  });
}