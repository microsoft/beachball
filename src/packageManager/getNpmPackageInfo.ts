// import fetch from 'npm-registry-fetch';
import type { NpmOptions } from '../types/NpmOptions';
import { getNpmAuthArgs, type NpmAuthOptions } from './npmArgs';
import type { PackageJson } from '../types/PackageInfo';
import { npm } from './npm';

/** Published versions and dist-tags for a package */
export interface NpmPackageVersionsData {
  /** All versions of a package */
  versions: string[];
  /** Mapping from package dist-tag to version */
  'dist-tags': Record<string, string>;
}

export interface NpmRegistryFetchJson {
  /** Package name */
  name: string;
  /** String of date modified (as of writing, this isn't used, and will be a constant date in tests) */
  modified: string;
  /**
   * Mapping from version to package manifest (package.json and some extra properties).
   *
   * This includes manifests for all published versions of the package, which is unfortunate since
   * this could be a lot of data and there doesn't appear to be a consistent way to reduce it.
   * (It appears this is what [`npm show/view`][1] receives internally as well, and filtering is applied
   * to the result. [`pacote`][2] uses `npm-registry-fetch` internally.)
   *
   * [1]: https://github.com/npm/cli/blob/f2c3af7de1906b0517bba1e7e5b9247d57960d99/lib/commands/view.js#L102
   * [2]: https://github.com/npm/pacote/blob/4b559c4c663a23f988f6be5094c9a45faf6231bc/lib/registry.js
   */
  versions: Record<string, PackageJson>;
  'dist-tags': Record<string, string>;
}

/**
 * `Accept` header for `npm-registry-fetch` requests. Per [npm registry docs][1], the first content type
 * requests a smaller subset of info from the public npm registry, and the other types are fallbacks.
 *
 * [1]: https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md
 */
export const _packageContentTypeAccept = 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*';

// TODO remove after https://github.com/microsoft/beachball/issues/1143
export const _npmShowProperties = ['versions', 'dist-tags'];

/**
 * Get package versions and tags using `npm-registry-fetch`.
 * @returns Data about the package, or undefined if there was some issue
 */
export async function getNpmPackageInfo(
  packageName: string,
  // TODO remove path after https://github.com/microsoft/beachball/issues/1143
  options: NpmAuthOptions & Pick<NpmOptions, 'registry' | 'timeout' | 'verbose' | 'path'>
): Promise<NpmPackageVersionsData | undefined> {
  const authArgs = getNpmAuthArgs(options);
  try {
    options.verbose && console.log(`Fetching info about "${packageName}" from ${options.registry}`);

    const showResult = await npm(
      [
        'show',
        '--registry',
        options.registry,
        '--json',
        ...(authArgs ? [`--${authArgs.key}=${authArgs.value}`] : []),
        packageName,
        // Only output the properties we need (npm show fetches everything internally)
        ..._npmShowProperties,
      ],
      { timeout: options.timeout, cwd: options.path, all: true }
    );

    if (showResult.success && showResult.stdout !== '') {
      const data = JSON.parse(showResult.stdout) as NpmPackageVersionsData;
      // Weird thing showing up in tests only with npm 8: sometimes `versions` is a single string?
      if (typeof data.versions === 'string') {
        data.versions = [data.versions];
      }
      return data;
    }
    throw new Error(showResult.all ? `Output:\n${showResult.all}` : 'unknown error');

    // const result = (await fetch.json(`/${encodeURIComponent(packageName)}`, {
    //   registry: options.registry,
    //   timeout: options.timeout,
    //   ...(authArgs && {
    //     alwaysAuth: true,
    //     [authArgs.key]: authArgs.value,
    //   }),
    //   headers: {
    //     accept: _packageContentTypeAccept,
    //   },
    // })) as unknown as NpmRegistryFetchJson;

    // return {
    //   versions: Object.keys(result.versions || {}),
    //   'dist-tags': result['dist-tags'] || {},
    // };
  } catch (err) {
    options.verbose && console.warn(`Failed to get or parse npm info for ${packageName}: ${String(err)}`);
    return undefined;
  }
}
