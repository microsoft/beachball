import * as fs from 'fs-extra';
import { getWorkspaceRange } from '../packageManager/getWorkspaceRange';
import { consideredDependencies, type PackageInfos, type PackageJson, type PublishConfig } from '../types/PackageInfo';

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

export function performPublishOverrides(packagesToPublish: string[], packageInfos: PackageInfos): void {
  for (const pkgName of packagesToPublish) {
    const info = packageInfos[pkgName];
    const packageJson = fs.readJSONSync(info.packageJsonPath) as PackageJson;

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
        // eslint-disable-next-line
        packageJson[key] = value as any;
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
  for (const depType of consideredDependencies) {
    const deps = packageJson[depType];
    if (!deps) continue;

    for (const [depName, depVersion] of Object.entries(deps)) {
      const packageInfo = packageInfos[depName];
      const workspaceRange = getWorkspaceRange(depVersion);
      if (packageInfo && workspaceRange) {
        deps[depName] = resolveWorkspaceVersionForPublish(workspaceRange, packageInfo.version);
      }
    }
  }
}

/**
 * Resolves version for publishing following the replacements defined here:
 * https://pnpm.io/workspaces#workspace-protocol-workspace
 * https://yarnpkg.com/features/workspaces#publishing-workspaces
 * @param workspaceRange Second part of a `workspace:___` range, e.g. `^` or `^1.0.0`
 */
function resolveWorkspaceVersionForPublish(workspaceRange: string, packageInfoVersion: string): string {
  if (workspaceRange === '*') {
    return packageInfoVersion;
  }
  if (workspaceRange === '^' || workspaceRange === '~') {
    return `${workspaceRange}${packageInfoVersion}`;
  }
  return workspaceRange;
}
