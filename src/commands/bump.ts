import { performBump } from '../bump/performBump';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import { validateWithBump } from '../validation/validate';

/**
 * Run validation and bump versions
 * @returns bump info for testing
 */
export async function bump(options: BeachballOptions): Promise<BumpInfo | undefined> {
  const { bumpInfo } = validateWithBump(options);

  return performBump(bumpInfo, options);
}
