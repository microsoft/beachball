import type { BeachballOptions, ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { getCliOptions, type ProgramContext } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';
import { BeachballError } from '../types/BeachballError';

/**
 * Get merged and unmerged options, for reuse by `getPackageInfos`.
 * @param testRepoOptions Repo options for testing purposes
 */
export function getOptions(params: ProgramContext & { testRepoOptions?: Partial<RepoOptions> }): ParsedOptions {
  const { testRepoOptions, ...processInfo } = params;
  const cliOptions = getCliOptions(processInfo);
  const repoOptions = testRepoOptions || getRepoOptions(cliOptions);
  const result: ParsedOptions = {
    cliOptions,
    repoOptions,
    options: mergeRepoOptions({ repoOptions, cliOptions }),
  };

  if (result.options.token && !result.options.registry) {
    // Temporary until we support reading the registry from .npmrc
    throw new BeachballError('The "registry" option is required if an npm token is set.');
  }

  return result;
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
