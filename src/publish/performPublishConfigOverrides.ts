import { PackageInfos } from '../types/PackageInfo';
import * as fs from 'fs-extra';

export const acceptedKeys = ['types', 'typings', 'main', 'module', 'exports', 'repository', 'bin', 'browser', 'files'];

export function performPublishConfigOverrides(packagesToPublish: string[], packageInfos: PackageInfos) {
  // Everything in publishConfig in accepted keys here will get overridden & removed from the publishConfig section

  for (const pkgName of packagesToPublish) {
    const info = packageInfos[pkgName];
    const packageJson = fs.readJSONSync(info.packageJsonPath);

    if (packageJson.publishConfig) {
      for (const key of acceptedKeys) {
        const value = packageJson.publishConfig[key] || packageJson[key];
        packageJson[key] = value;
        delete packageJson.publishConfig[key];
      }
    }

    fs.writeJSONSync(info.packageJsonPath, packageJson, { spaces: 2 });
  }
}
