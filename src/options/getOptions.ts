import type { BeachballOptions, CliOptions, PackageOptions, RepoOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all repo level options (default + root options + cli options)
 */
export function getOptions(argv: string[]): BeachballOptions {
  const cliOptions = getCliOptions(argv);
  return mergeOptions({
    defaultOptions: getDefaultOptions(),
    repoOptions: getRepoOptions(cliOptions),
    cliOptions,
  });
}

/**
 * Merge options. Arrays will overwrite.
 */
export function mergeOptions(params: {
  defaultOptions?: BeachballOptions;
  repoOptions?: Partial<RepoOptions>;
  cliOptions?: CliOptions;
  packageOptions?: Partial<PackageOptions>;
}): BeachballOptions {
  return mergeObjects(
    params.defaultOptions,
    params.repoOptions,
    params.packageOptions,
    params.cliOptions
  ) as BeachballOptions;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeObjects(...objects: (Record<string, any> | undefined)[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acc: Record<string, any> = {};

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') {
      continue;
    }

    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        acc[key] = mergeObjects(acc[key] || {}, val);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        acc[key] = val;
      }
    }
  }

  return acc;
}
