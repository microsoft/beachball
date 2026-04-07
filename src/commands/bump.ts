import { bumpInMemory } from '../bump/bumpInMemory';
import { performBump } from '../bump/performBump';
import { createCommandContext } from '../monorepo/createCommandContext';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import type { CommandContext } from '../types/CommandContext';

/**
 * Bump versions and update changelogs, but don't commit, push, or publish.
 * @param context Command context from `validate()`
 */
export async function bump(options: BeachballOptions, context: CommandContext): Promise<BumpInfo>;
/** @deprecated Use other signature */
export async function bump(options: BeachballOptions): Promise<BumpInfo>;
export async function bump(options: BeachballOptions, context?: CommandContext): Promise<BumpInfo> {
  // eslint-disable-next-line beachball/no-deprecated -- compat code
  context ??= createCommandContext(options);
  const bumpInfo = context.bumpInfo || bumpInMemory(options, context);
  await performBump(bumpInfo, options);
  // The bumpInfo is returned for testing
  return bumpInfo;
}
