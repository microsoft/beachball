import { readChangeFiles } from '../changefile/readChangeFiles';
import type { ParsedOptions } from '../types/BeachballOptions';
import type { BasicCommandContext, CommandContext } from '../types/CommandContext';
import { getPackageGroups } from './getPackageGroups';
import { getPackageInfos } from './getPackageInfos';
import { getScopedPackages } from './getScopedPackages';

/**
 * Create a command context for commands that don't call `validate()`, or for tests.
 * This skips `changeSet` for commands that don't need it.
 */
export function createBasicCommandContext(parsedOptions: ParsedOptions): BasicCommandContext {
  const { options } = parsedOptions;
  const originalPackageInfos = getPackageInfos(parsedOptions);
  const scopedPackages = getScopedPackages(options, originalPackageInfos);
  return {
    originalPackageInfos,
    scopedPackages,
    packageGroups: getPackageGroups(originalPackageInfos, options.path, options.groups),
  };
}

/**
 * Create a command context for temporary compatibility with private API usage that
 * may not provide it. (Usually now the context is generated during `validate()`.)
 * Does not populate `bumpInfo`.
 */
export function createCommandContext(parsedOptions: ParsedOptions): CommandContext {
  const context = createBasicCommandContext(parsedOptions);
  const options = parsedOptions.options;
  return {
    ...context,
    changeSet: readChangeFiles(options, context.originalPackageInfos, context.scopedPackages),
    bumpInfo: undefined,
  };
}
