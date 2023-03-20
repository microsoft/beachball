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
  timeout?: number | undefined,
  verbose?: boolean
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
    // With the verbose option, restore default level of logs (including list of files published).
    // A more specific npm log level option could be added in the future if needed.
    verbose ? 'notice' : 'warn',
    ...getNpmAuthArgs(registry, token, authType),
  ];

  if (access && packageInfo.name.startsWith('@')) {
    args.push('--access');
    args.push(access);
  }
  console.log(`publish command: ${args.join(' ')}`);
  return npmAsync(args, { cwd: packagePath, timeout, all: true, pipe: verbose });
}
