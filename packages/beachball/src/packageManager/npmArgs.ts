import { getPackageOption } from '../options/getPackageOption';
import type { NpmOptions } from '../types/NpmOptions';
import type { PackageInfo } from '../types/PackageInfo';

export type NpmAuthOptions = Pick<NpmOptions, 'registry' | 'token' | 'authType'>;

export function getNpmLogLevelArgs(verbose: boolean | undefined): string[] {
  return ['--loglevel', verbose ? 'notice' : 'warn'];
}

export function getNpmPublishArgs(
  packageInfo: PackageInfo,
  options: Omit<NpmOptions, 'path' | 'token' | 'authType'>
): string[] {
  const { registry, access } = options;
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
  ];

  if (access && packageInfo.name[0] === '@') {
    args.push('--access', access);
  }

  return args;
}

/**
 * Get the environment variable key and value for npm authentication.
 */
export function getNpmAuthEnv(options: NpmAuthOptions): Record<`npm_config_${string}`, string> | undefined {
  const authArgs = getNpmAuthArgs(options);
  if (!authArgs) {
    return undefined;
  }
  return {
    // npm_config_* env vars are automatically picked up by npm.
    // getNpmAuthArgs returns the key in the appropriate format, including required trailing slash.
    [`npm_config_${authArgs.key}`]: authArgs.value,
  };
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
  return {
    // It appears that a trailing slash is strictly required for the environment variable form
    key: `${shorthand}${shorthand.endsWith('/') ? '' : '/'}:${npmKeyword}`,
    value: token,
  };
}
