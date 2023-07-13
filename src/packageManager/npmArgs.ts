import { AuthType } from '../types/Auth';
import { NpmOptions } from '../types/NpmOptions';
import { PackageInfo } from '../types/PackageInfo';

export function getNpmPublishArgs(packageInfo: PackageInfo, options: NpmOptions): string[] {
  const { registry, token, authType, access } = options;
  const pkgCombinedOptions = packageInfo.combinedOptions;
  const args = [
    'publish',
    '--registry',
    registry,
    '--tag',
    pkgCombinedOptions.tag || pkgCombinedOptions.defaultNpmTag || 'latest',
    '--loglevel',
    'warn',
    ...getNpmAuthArgs(registry, token, authType),
  ];

  if (access && packageInfo.name[0] === '@') {
    args.push('--access', access);
  }

  return args;
}

export function getNpmAuthArgs(registry: string, token?: string, authType?: AuthType): string[] {
  if (!token) {
    return [];
  }

  const npmKeyword = authType === 'password' ? '_password' : '_authToken';
  const shorthand = registry.substring(registry.indexOf('//'));
  return [`--${shorthand}:${npmKeyword}=${token}`];
}
