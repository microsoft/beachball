import { PackageInfos } from '../types/PackageInfo';
import * as fs from 'fs-extra';

export const acceptedKeys = ['types', 'typings', 'main', 'module', 'exports', 'repository', 'bin', 'browser', 'files'];

export function performPublishOverrides(packagesToPublish: string[], packageInfos: PackageInfos) {
  for (const pkgName of packagesToPublish) {
    const info = packageInfos[pkgName];
    const packageJson = fs.readJSONSync(info.packageJsonPath);

    performWorkspaceVersionOverrides(packageJson, packageInfos);
    performPublishConfigOverrides(packageJson);

    fs.writeJSONSync(info.packageJsonPath, packageJson, { spaces: 2 });
  }
}

function performPublishConfigOverrides(packageJson: any) {
  // Everything in publishConfig in accepted keys here will get overridden & removed from the publishConfig section
  if (packageJson.publishConfig) {
    for (const key of acceptedKeys) {
      const value = packageJson.publishConfig[key] || packageJson[key];
      packageJson[key] = value;
      delete packageJson.publishConfig[key];
    }
  }
}

/**
 * When dependencies are defined using workspace protocol they need to be replaced with a correct version during
 * publish. If publishing happened using a package manager that supports this protocol (pnpm/yarn) then it could
 * handle this replacement for us, but as of this time publishing only happens via npm, which can't do this
 * replacement.
 */
function performWorkspaceVersionOverrides(packageJson: any, packageInfos: PackageInfos) {
  const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
  depTypes.forEach(depKind => {
    const deps = packageJson[depKind];
    if (deps) {
      Object.keys(deps).forEach(dep => {
        const packageInfo = packageInfos[dep];
        if (packageInfo && deps[dep].startsWith('workspace:')) {
          deps[dep] = resolveWorkspaceVersionForPublish(deps[dep], packageInfo.version);
        }
      });
    }
  });
}

/**
 * Resolves version for publishing following the replacements defined here:
 * https://pnpm.io/workspaces#workspace-protocol-workspace
 * https://yarnpkg.com/features/workspaces#publishing-workspaces
 */
function resolveWorkspaceVersionForPublish(workspaceDependency: string, packageInfoVersion: string): string {
  const versionStartIndex = "workspace:".length;
  if (workspaceDependency === 'workspace:*') {
    return packageInfoVersion;
  } else if (new Set(['workspace:~', 'workspace:^']).has(workspaceDependency)) {
    return `${workspaceDependency[versionStartIndex]}${packageInfoVersion}`;
  } else {
    return workspaceDependency.substring(versionStartIndex);
  }
}
