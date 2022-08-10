import { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { getNpmAuthArgs, npmAsync } from './npm';
import { AuthType } from '../types/Auth';

export function packagePublish(
  packageInfo: PackageInfo,
  registry: string,
  token: string,
  access: string,
  authType?: AuthType,
  timeout?: number | undefined
) {
  const packageOptions = packageInfo.combinedOptions;
  const packagePath = path.dirname(packageInfo.packageJsonPath);
  const args = [
    'publish',
    '--registry',
    registry,
    '--tag',
    packageOptions.tag || packageOptions.defaultNpmTag,
    '--loglevel',
    'warn',
    ...getNpmAuthArgs(registry, token, authType),
  ];

  if (access && packageInfo.name.startsWith('@')) {
    args.push('--access');
    args.push(access);
  }
  console.log(`publish command: ${args.join(' ')}`);
  return npmAsync(args, { cwd: packagePath, timeout, all: true });
}
