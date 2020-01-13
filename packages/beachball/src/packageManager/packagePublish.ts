import { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { npm } from './npm';
export function packagePublish(
  packageInfo: PackageInfo,
  registry: string,
  token: string,
  tag: string | undefined,
  access: string
) {
  const packageOptions = packageInfo.options;
  const packagePath = path.dirname(packageInfo.packageJsonPath);
  const args = ['publish', '--registry', registry, '--tag', tag || packageOptions.defaultNpmTag];
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
