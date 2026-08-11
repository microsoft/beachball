import type { NpmOptions } from '../types/NpmOptions';
import { getNpmAuthEnv, type NpmAuthOptions } from './npmArgs';
import { npm } from './npm';
import { BeachballError } from '../types/BeachballError';

/** Minimal package manifest data returned by npm registry reads. */
interface NpmPackageInfo {
  name: string;
  version: string;
}

const registryReadRetries = 3;

/**
 * `Accept` header for registry fetch requests. Per [npm registry docs][1], the first content type
 * requests a smaller subset of info from the public npm registry, and the other types are fallbacks.
 *
 * [1]: https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md
 */
export const _packageContentTypeAccept = 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*';

/**
 * Get basic manifest data for an exact package version or dist-tag.
 *
 * If `options.registry` is set, it will fetch directly from the registry.
 * Otherwise it uses `npm show`.
 * (TODO: always use the registry once npmrc reading is supported, unless there's a need to allow
 * using the CLI for certificate auth or something)
 *
 * Throws if the request fails with 401 or 403 (unauthorized).
 * Returns undefined on any other issue.
 */
export async function getNpmPackageInfo(
  packageName: string,
  versionOrTag: string,
  options: NpmAuthOptions & Pick<NpmOptions, 'registry' | 'timeout' | 'verbose' | 'path'>
): Promise<NpmPackageInfo | undefined> {
  options.verbose &&
    console.log(`Fetching info about "${packageName}@${versionOrTag}" from ${options.registry || 'using npm CLI'}`);
  try {
    let data: NpmPackageInfo | undefined;
    if (options.registry && options.authType !== 'password') {
      data = await fetchPackage(packageName, versionOrTag, { ...options, registry: options.registry });
    } else {
      data = await npmShow(packageName, versionOrTag, options);
    }
    if (!data) {
      return undefined;
    }

    if (data.name !== packageName || typeof data.version !== 'string') {
      throw new BeachballError(`Registry returned invalid package info for "${packageName}@${versionOrTag}"`);
    }
    return { name: data.name, version: data.version };
  } catch (err) {
    if (err instanceof NpmRegistryError && (err.status === 401 || err.status === 403)) {
      throw err;
    }
    options.verbose &&
      console.warn(`Failed to get or parse npm info for ${packageName}@${versionOrTag}: ${String(err)}`);
    return undefined;
  }
}

class NpmRegistryError extends BeachballError {
  public constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * Fetch an exact package version or dist-tag manifest directly from the registry.
 * Retries transient network and HTTP failures, returns undefined for 404, and throws on other failures.
 */
async function fetchPackage(
  packageName: string,
  versionOrTag: string,
  options: NpmAuthOptions & Pick<NpmOptions, 'timeout'> & { registry: string }
): Promise<NpmPackageInfo | undefined> {
  const registry = new URL(options.registry);
  registry.pathname = `${registry.pathname.replace(/\/?$/, '/')}${encodeURIComponent(packageName)}/${encodeURIComponent(versionOrTag)}`;

  for (let attempt = 0; ; attempt++) {
    const delay = () => new Promise(resolve => setTimeout(resolve, 2 ** attempt * 100));

    let response: Response;
    try {
      response = await fetch(registry, {
        headers: {
          Accept: _packageContentTypeAccept,
          // TODO: might need these other auth types including `Basic ${auth.auth}` in future
          // https://github.com/npm/npm-registry-fetch/blob/6b4159a2519ce5aab26cc4dd8d4596a0b47781d2/lib/index.js#L236
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
      });
    } catch (error) {
      if (attempt >= registryReadRetries) {
        throw error;
      }
      await delay();
      continue;
    }

    const { status } = response;
    if (status === 404) {
      return undefined;
    }
    if (!response.ok) {
      const error = new NpmRegistryError(
        `Getting info about "${packageName}@${versionOrTag}" failed: ${status} ${response.statusText}`,
        status
      );
      if (attempt >= registryReadRetries || !(status === 408 || status === 429 || status >= 500)) {
        throw error;
      }
      await delay();
      continue;
    }

    return (await response.json()) as NpmPackageInfo;
  }
}

/**
 * Use `npm show` to get info about a package.
 *
 */
async function npmShow(
  packageName: string,
  versionOrTag: string,
  options: NpmAuthOptions & Pick<NpmOptions, 'registry' | 'timeout' | 'path'>
): Promise<NpmPackageInfo | undefined> {
  const packageSpec = `${packageName}@${versionOrTag}`;
  const showResult = await npm(
    ['show', ...(options.registry ? ['--registry', options.registry] : []), '--json', packageSpec, 'name', 'version'],
    {
      timeout: options.timeout,
      cwd: options.path,
      env: getNpmAuthEnv(options),
    }
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(showResult.stdout.trim());
  } catch {
    throw new BeachballError(
      `Error getting info about "${packageName}": npm show returned invalid JSON. Output:\n${showResult.output}`,
      { cause: showResult }
    );
  }
  if (showResult.success) {
    return parsed as NpmPackageInfo;
  }

  // On error with --json, stdout is like this:
  // {
  //   "error": {
  //     "code": "E404",
  //     "summary": "No match found for version adslkfjsdf",
  //     "detail": "'beachball@adslkfjsdf' is not in this registry.\n\nNote that you can also install from a\ntarball, folder, http url, or git url."
  //   }
  // }
  const maybeError = parsed as { error?: { code?: `E${number}`; summary?: string; detail?: string } };
  if (maybeError.error?.code && /^E\d+$/.test(maybeError.error.code)) {
    const { code, summary } = maybeError.error;
    if (code === 'E404') {
      return undefined;
    }
    throw new NpmRegistryError(
      `Getting info about "${packageName}@${versionOrTag}" failed: ${code} ${summary ?? ''}`.trim(),
      Number(code.slice(1)),
      { cause: showResult }
    );
  }

  throw new BeachballError(`Getting info about "${packageSpec}" failed. Output:\n${showResult.output}`, {
    cause: showResult,
  });
}
