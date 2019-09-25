import { PackageInfo } from './bump';
import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';

export function npm(args: string[], options?: { cwd: string }) {
  const npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm';

  const results = spawnSync(npmCmd, args, options);

  if (results.status === 0) {
    return {
      stderr: results.stderr.toString().trim(),
      stdout: results.stdout.toString().trim(),
      success: true
    };
  } else {
    return {
      stderr: results.stderr.toString().trim(),
      stdout: results.stdout.toString().trim(),
      success: false
    };
  }
}

export function packagePublish(packageInfo: PackageInfo, registry: string, token: string, tag: string | undefined, access: string) {
  const packagePath = path.dirname(packageInfo.packageJsonPath);
  const args = ['publish', '--registry', registry, '--tag', tag || packageInfo.defaultNpmTag];

  if (token) {
    const shorthand = registry.substring(registry.indexOf('//'));
    args.push(`--${shorthand}:_authToken=${token}`);
  }

  if (access && packageInfo.name.startsWith('@')) {
    args.push('--access');
    args.push(access);
  }

  console.log(`publish command: ${args.join(' ')}`);
  return npm(args, { cwd: packagePath });
}

const packageVersions: { [pkgName: string]: string[] } = {};

export function listPackageVersions(packageName: string, registry: string) {
  if (!packageVersions[packageName]) {
    const showResult = npm(['show', '--registry', registry, '--json', packageName]);
    if (showResult.success) {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersions[packageName] = packageInfo.versions;
    } else {
      packageVersions[packageName] = [];
    }
  }

  return packageVersions[packageName];
}
