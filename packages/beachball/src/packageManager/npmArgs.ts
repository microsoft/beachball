import { getPackageOption } from '../options/getPackageOption';
import { BeachballError } from '../types/BeachballError';
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
    ...(registry ? ['--registry', registry] : []),
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
  const { registry, token, authType } = options;
  if (!token) {
    return undefined;
  }
  if (!registry) {
    // Temporary until we support reading the registry from .npmrc
    throw new BeachballError('The "registry" option is required if an npm token is set.');
  }

  const npmKeyword = authType === 'password' ? '_password' : '_authToken';
  // Like `//registry.npmjs.org/` - trailing slash is strictly required for env var form
  const shorthand = registry.substring(registry.indexOf('//')).replace(/\/?$/, '/');
  return {
    // npm_config_* env vars are automatically picked up by npm.
    [`npm_config_${shorthand}:${npmKeyword}`]: token,
  };
}
