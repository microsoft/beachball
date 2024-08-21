import { PackageInfos, PackageJson, PublishConfig } from '../types/PackageInfo';
import * as fs from 'fs-extra';

const acceptedKeys: (keyof PublishConfig)[] = [
  'types',
  'typings',
  'main',
  'module',
  'exports',
  'repository',
  'bin',
  'browser',
  'files',
];
const workspacePrefix = 'workspace:';

export function performPublishOverrides(packagesToPublish: string[], packageInfos: PackageInfos): void {
  for (const pkgName of packagesToPublish) {
    const info = packageInfos[pkgName];
    const packageJson = fs.readJSONSync(info.packageJsonPath);

    performWorkspaceVersionOverrides(packageJson, packageInfos);
    performPublishConfigOverrides(packageJson);

    fs.writeJSONSync(info.packageJsonPath, packageJson, { spaces: 2 });
  }
}

function performPublishConfigOverrides(packageJson: PackageJson): void {
  // Everything in publishConfig in accepted keys here will get overridden & removed from the publishConfig section
  if (packageJson.publishConfig) {
    for (const [k, value] of Object.entries(packageJson.publishConfig)) {
      const key = k as keyof Required<PackageJson>['publishConfig'];
      if (acceptedKeys.includes(key)) {
        packageJson[key] = value;
        delete packageJson.publishConfig[key];
      }
    }
  }
}

/**
 * When dependencies are defined using workspace protocol they need to be replaced with a correct version during
 * publish. If publishing happened using a package manager that supports this protocol (pnpm/yarn) then it could
 * handle this replacement for us, but as of this time publishing only happens via npm, which can't do this
 * replacement.
 */
function performWorkspaceVersionOverrides(packageJson: PackageJson, packageInfos: PackageInfos): void {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } = packageJson;
  for (const deps of [dependencies, devDependencies, peerDependencies, optionalDependencies]) {
    if (!deps) continue;

    for (const [depName, depVersion] of Object.entries(deps)) {
      const packageInfo = packageInfos[depName];
      if (packageInfo && depVersion.startsWith(workspacePrefix)) {
        deps[depName] = resolveWorkspaceVersionForPublish(depVersion, packageInfo.version);
      }
    }
  }
}

/**
 * Resolves version for publishing following the replacements defined here:
 * https://pnpm.io/workspaces#workspace-protocol-workspace
 * https://yarnpkg.com/features/workspaces#publishing-workspaces
 */
function resolveWorkspaceVersionForPublish(workspaceDependency: string, packageInfoVersion: string): string {
  const workspaceVersion = workspaceDependency.substring(workspacePrefix.length);
  if (workspaceVersion === '*') {
    return packageInfoVersion;
  }
  if (workspaceVersion === '^' || workspaceVersion === '~') {
    return `${workspaceVersion}${packageInfoVersion}`;
  }
  return workspaceVersion;
}
