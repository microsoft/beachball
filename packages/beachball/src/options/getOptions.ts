import type { BeachballOptions, ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { getCliOptions, type ProcessInfo } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Get merged and unmerged options, for reuse by `getPackageInfos`.
 * @param testRepoOptions Repo options for testing purposes
 */
export function getOptions(params: ProcessInfo & { testRepoOptions?: Partial<RepoOptions> }): ParsedOptions {
  const { testRepoOptions, ...processInfo } = params;
  const cliOptions = getCliOptions(processInfo);
  const repoOptions = testRepoOptions || getRepoOptions(cliOptions);
  return {
    cliOptions,
    repoOptions,
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
