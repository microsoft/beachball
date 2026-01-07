import type { BeachballOptions, ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { getCliOptions, type ProcessInfo } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all repo level options (default + root options + cli options)
 * @deprecated Use `getParsedOptions`
 */
export function getOptions(argv: string[]): BeachballOptions {
  // eslint-disable-next-line no-restricted-properties -- deprecated API
  const cliOptions = getCliOptions({ argv, cwd: process.cwd() });
  return mergeRepoOptions({
    repoOptions: getRepoOptions(cliOptions),
    cliOptions,
  });
}

/**
 * Get merged and unmerged options, for reuse by `getPackageInfos`.
 * @param testRepoOptions Repo options for testing purposes
 */
// TODO: rename back to getOptions in a major release
export function getParsedOptions(params: ProcessInfo & { testRepoOptions?: Partial<RepoOptions> }): ParsedOptions {
  const { testRepoOptions, ...processInfo } = params;
  const cliOptions = getCliOptions(processInfo);
  const repoOptions = testRepoOptions || getRepoOptions(cliOptions);
  return {
    cliOptions,
    options: mergeRepoOptions({ repoOptions, cliOptions }),
  };
}

/** Merge repo-wide options in the proper order. */
function mergeRepoOptions(
  params: Pick<ParsedOptions, 'cliOptions'> & { repoOptions: Partial<RepoOptions> }
): BeachballOptions {
  const { repoOptions, cliOptions } = params;
  // TODO: proper recursive merging
  // (right now it's not important because no nested objects are expected outside of repoOptions)
  return {
    ...getDefaultOptions(),
    ...repoOptions,
    ...cliOptions,
  };
}
