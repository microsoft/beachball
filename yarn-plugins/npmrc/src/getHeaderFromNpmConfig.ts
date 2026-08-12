// NOTE: Only import types, required yarn internals, or lightweight files here!
// Auth isn't needed in many cases, so we shouldn't load bigger dependencies upfront.
import type NpmConfig from '@npmcli/config';
import { npath, type PortablePath } from '@yarnpkg/fslib';
import type { VerboseLogger } from './types.ts';
import { getAuthHeader } from './getAuthHeader.ts';

/** Mapping from registry URL to cached header */
const cachedHeaders = new Map<string, string | undefined>();
/**
 * Shared/cached promised from reading .npmrc. This prevents the initial round of parallel requests
 * from trying to all read npmrc at the same time (the symptom was a "too many listeners" error for
 * the `log` listener added by `loadNpmrc`).
 */
let npmrcPromise: Promise<NpmConfig> | undefined;

/**
 * Reads the .npmrc configuration and returns the authentication header for a given registry, if any,
 * with caching by registry. Returns `currentHeader` if no header can be determined from .npmrc.
 *
 * Throws if there's an issue reading the npm config, or if the config uses an unsupported auth method.
 */
export async function getHeaderFromNpmConfig(params: {
  currentHeader: string | undefined;
  registry: string;
  projectCwd: PortablePath | null;
  verboseLog: VerboseLogger;
}): Promise<string | undefined> {
  const { currentHeader, registry, verboseLog } = params;

  if (!params.projectCwd) {
    verboseLog('No projectCwd; skipping .npmrc auth header', true);
    return currentHeader;
  }

  // Wait for the npmrc reading promise before checking the cache to avoid race conditions
  // with initial requests.
  npmrcPromise ??= (async () => {
    // Fix yarn's weird PortablePath /C:/some/dir formatting for windows
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- was checked above
    const projectRoot = npath.fromPortablePath(params.projectCwd!);
    verboseLog(`Loading .npmrc for projectRoot=${projectRoot}`);

    // Delay load this since auth is irrelevant for many commands
    const { loadNpmrc } = await import('./loadNpmrc.ts');
    return await loadNpmrc({ projectRoot, verboseLog });
  })();
  const npmrc = await npmrcPromise;

  if (cachedHeaders.has(registry)) {
    // Verbose logging here would get very noisy for every request
    return cachedHeaders.get(registry) ?? currentHeader;
  }

  const result = getAuthHeader({ npmrc, verboseLog, registry });
  cachedHeaders.set(registry, result);
  return result ?? currentHeader;
}

/** For testing: Clear cached headers and npmrc promise. */
export function _clearCaches(): void {
  cachedHeaders.clear();
  npmrcPromise = undefined;
}
