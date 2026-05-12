import { ReleaseError } from './ReleaseError.ts';
import type { Logger } from './Logger.ts';

export interface PierceOptions {
  /** Map of package name to version to pierce into the feed. */
  packages: Record<string, string>;
  /**
   * `SYSTEM_COLLECTIONURI` of the ADO collection that owns the feed, e.g.
   * `https://dev.azure.com/office/` or `https://office.visualstudio.com/`.
   */
  collectionUri: string;
  /** Feed GUID. */
  feedId: string;
  /**
   * Bearer token used to authenticate to the ADO Artifacts API. In ADO pipelines this
   * should be `$(System.AccessToken)`; the build identity must have Packaging access on
   * the feed.
   */
  accessToken: string;
  /** Logger for progress/errors. */
  logger: Logger;
}

/**
 * Pierce every package/version pair in `options.packages` into the configured ADO feed.
 * "Piercing" forces an ADO Artifacts feed to ingest a package version from a configured
 * upstream source (e.g. npmjs.com) without downloading the package bytes locally.
 *
 * Each call is a single `HEAD` to the feed's content endpoint with `redirect: 'manual'`,
 * so no package bytes are ever transferred:
 * - 200 → already ingested.
 * - 303 → ADO will fetch from upstream and cache.
 *
 * Auth: the bearer token must have Packaging permissions on the feed. In an ADO pipeline,
 * `$(System.AccessToken)` works as long as the build identity is granted access to the feed.
 *
 * Throws `ReleaseError` if any package fails to pierce after retries.
 */
export async function pierce(options: PierceOptions): Promise<void> {
  const { packages, accessToken, logger, collectionUri, feedId } = options;

  const instance = parseInstance(collectionUri);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const entries = Object.entries(packages);

  if (!entries.length) {
    logger.log('No packages to pierce.');
    return;
  }

  logger.log(`Piercing ${entries.length} package version(s) into feed ${instance}/${feedId}`);

  const failures: string[] = [];
  for (const [packageName, version] of entries) {
    try {
      await retry(() => piercePackage({ packageName, version, headers, instance, feedId, logger }), {
        logger,
      });
    } catch (err) {
      const ref = `${packageName}@${version}`;
      logger.error(`Failed to pierce ${ref}: ${(err as Error).message || String(err)}`);
      failures.push(ref);
    }
  }

  if (failures.length) {
    throw new ReleaseError(`Failed to pierce ${failures.length} package(s): ${failures.join(', ')}`, {
      alreadyLogged: true,
    });
  }

  logger.log(`Pierced ${entries.length} package version(s) successfully.`);
}

interface PiercePackageParams {
  packageName: string;
  version: string;
  headers: Record<string, string>;
  instance: string;
  feedId: string;
  logger: Logger;
}

async function piercePackage(params: PiercePackageParams): Promise<void> {
  const { packageName, version, headers, instance, feedId, logger } = params;

  // Scoped names ("@scope/pkg") are accepted as-is by this endpoint.
  const url = `https://${instance}.pkgs.visualstudio.com/_apis/packaging/feeds/${feedId}/npm/packages/${packageName}/versions/${version}/content`;

  // HEAD with manual redirect handling: 200 = already cached, 303 = upstream pull triggered.
  // `redirect: 'manual'` prevents `fetch` from following the 303 to the upstream tarball
  // (which would download the bytes and defeat the point).
  const response = await fetch(url, { method: 'HEAD', headers, redirect: 'manual' });

  if (response.status === 200) {
    logger.log(`✅ ${packageName}@${version} (already ingested)`);
    return;
  }
  if (response.status === 303) {
    logger.log(`✅ ${packageName}@${version} (ingestion triggered)`);
    return;
  }

  throw new Error(`HTTP ${response.status} from ${url}`);
}

/**
 * Parse the ADO organization name out of `SYSTEM_COLLECTIONURI`. Supports both modern
 * (`https://dev.azure.com/<org>/`) and legacy (`https://<org>.visualstudio.com/`) URLs.
 */
function parseInstance(collectionUri: string): string {
  let url: URL;
  try {
    url = new URL(collectionUri);
  } catch {
    throw new ReleaseError(`Invalid SYSTEM_COLLECTIONURI: ${JSON.stringify(collectionUri)}`);
  }
  if (url.hostname.endsWith('.visualstudio.com')) {
    return url.hostname.split('.')[0];
  }
  const firstSegment = url.pathname.split('/').filter(Boolean)[0];
  if (!firstSegment) {
    throw new ReleaseError(`Could not parse organization from SYSTEM_COLLECTIONURI: ${collectionUri}`);
  }
  return firstSegment;
}

interface RetryOptions {
  logger: Logger;
  maxRetries?: number;
  initialDelay?: number;
}

async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { logger, maxRetries = 5, initialDelay = 1000 } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      const delay = initialDelay * 2 ** attempt;
      logger.warn(`Pierce attempt failed (${(err as Error).message || String(err)}); retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
