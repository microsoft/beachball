import { readChangeFiles } from '../changefile/readChangeFiles';
import type { BeachballOptions, ParsedOptions } from '../types/BeachballOptions';
import type { BasicCommandContext, CommandContext } from '../types/CommandContext';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageGroups } from './getPackageGroups';
import { getPackageInfos } from './getPackageInfos';
import { getScopedPackages } from './getScopedPackages';

/**
 * Create a command context for temporary compatibility with private API usage that
 * may not provide it. (Usually now the context is generated during `validate()`.)
 * This skips `changeSet` for commands that don't need it.
 */
export function createBasicCommandContext(options: ParsedOptions): BasicCommandContext;
/** @deprecated Only to support other deprecated scenarios */
export function createBasicCommandContext(
  options: BeachballOptions,
  originalPackageInfos?: PackageInfos
): BasicCommandContext;
export function createBasicCommandContext(
  _options: BeachballOptions | ParsedOptions,
  originalPackageInfos?: PackageInfos
): BasicCommandContext {
  const options = 'cliOptions' in _options ? _options.options : _options;
  originalPackageInfos ??=
    // eslint-disable-next-line beachball/no-deprecated -- this is a compat helper
    'cliOptions' in _options ? getPackageInfos(_options.cliOptions) : getPackageInfos(options.path);
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
export function createCommandContext(options: ParsedOptions): CommandContext;
/** @deprecated Only to support other deprecated scenarios */
export function createCommandContext(options: BeachballOptions, originalPackageInfos?: PackageInfos): CommandContext;
export function createCommandContext(
  _options: BeachballOptions | ParsedOptions,
  originalPackageInfos?: PackageInfos
): CommandContext {
  const context =
    'cliOptions' in _options
      ? createBasicCommandContext(_options)
      : // eslint-disable-next-line beachball/no-deprecated
        createBasicCommandContext(_options, originalPackageInfos);
  const options = 'cliOptions' in _options ? _options.options : _options;
  return {
    ...context,
    changeSet: readChangeFiles(options, context.originalPackageInfos, context.scopedPackages),
    bumpInfo: undefined,
  };
}
