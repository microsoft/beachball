import { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { getNpmAuthArgs, npmAsync } from './npm';
import { NpmOptions } from '../types/NpmOptions';

export function packagePublish(packageInfo: PackageInfo, options: NpmOptions): ReturnType<typeof npmAsync> {
  const { registry, token, authType, access, timeout } = options;
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
