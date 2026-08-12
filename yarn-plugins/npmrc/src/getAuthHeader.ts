import type NpmConfig from '@npmcli/config';
import { throwError, type VerboseLogger } from './helpers';

/**
 * Get the auth header for a given registry, using the provided npm config and Yarn's current
 * auth header as a fallback.
 */
export function getAuthHeader(params: {
  npmrc: NpmConfig;
  verboseLog: VerboseLogger;
  registry: string;
  currentHeader: string | undefined;
}): string | undefined {
  const { npmrc, verboseLog, registry, currentHeader } = params;

  verboseLog(`Looking up credentials for registry ${registry}`);

  let credentials = npmrc.getCredentialsByURI(registry);
  if (Object.keys(credentials).length === 0 && !registry.endsWith('/')) {
    // try with a trailing slash--otherwise npm config's nerfDart function might remove the last segment
    credentials = npmrc.getCredentialsByURI(`${registry}/`);
  }

  if (credentials.certfile || credentials.keyfile) {
    throwError(`This plugin does not support certfile or keyfile auth (for registry "${registry}")`);
  }

  // Follow logic from npm-registry-fetch (what npm uses internally)
  // https://github.com/npm/npm-registry-fetch/blob/a50fb07ae60005a6002a9e231a25bba9c88b1c77/lib/index.js#L236-L240
  // (yarn version for reference: https://github.com/yarnpkg/berry/blob/f6a58c2803d6572af28e118eecd10c795e1228b1/packages/plugin-npm/sources/npmHttpUtils.ts#L459)
  if ('token' in credentials) {
    verboseLog(`Using npm _authToken`);
    return `Bearer ${credentials.token}`;
  }
  if ('auth' in credentials) {
    verboseLog(`Using npm _password or _auth`);
    return `Basic ${credentials.auth}`;
  }
  // Fall back to whatever logic yarn is using
  verboseLog("No matching npm credentials found; using yarn's auth header");
  return currentHeader;
}
