import { getPackageOption } from '../options/getPackageOption';
import type { NpmOptions } from '../types/NpmOptions';
import type { PackageInfo } from '../types/PackageInfo';

export type NpmAuthOptions = Pick<NpmOptions, 'registry' | 'token' | 'authType'>;

export function getNpmLogLevelArgs(verbose: boolean | undefined): string[] {
  return ['--loglevel', verbose ? 'notice' : 'warn'];
}

export function getNpmPublishArgs(packageInfo: PackageInfo, options: Omit<NpmOptions, 'path'>): string[] {
  const { registry, access } = options;
  const authArgs = getNpmAuthArgs(options);
  const args = [
    'publish',
    '--registry',
    registry,
    '--tag',
    // TODO: unclear what tag=null in PackageOptions was originally supposed to do
    // (most recent logic prior to this also used || which ignores null)
    getPackageOption('tag', packageInfo, options) ||
      getPackageOption('defaultNpmTag', packageInfo, options) ||
      'latest',
    ...getNpmLogLevelArgs(options.verbose),
    ...(authArgs ? [`--${authArgs.key}=${authArgs.value}`] : []),
  ];

  if (access && packageInfo.name[0] === '@') {
    args.push('--access', access);
  }

  return args;
}

/**
 * Get the npm auth args for the given registry and token.
 */
export function getNpmAuthArgs(options: NpmAuthOptions):
  | {
      /** Like `//registry.npmjs.org/:_password` */
      key: `//${string}:${'_authToken' | '_password'}`;
      /** The token or password */
      value: string;
    }
  | undefined {
  const { registry, token, authType } = options;
  if (!token) {
    return undefined;
  }

  const npmKeyword = authType === 'password' ? '_password' : '_authToken';
  const shorthand = registry.substring(registry.indexOf('//')) as `//${string}`;
  return { key: `${shorthand}:${npmKeyword}`, value: token };
}
