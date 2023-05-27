import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { BumpInfo } from '../types/BumpInfo';

export async function bump(options: BeachballOptions): Promise<BumpInfo> {
  const bumpInfo = gatherBumpInfo(options, getPackageInfos(options.path));
  // The bumpInfo is returned for testing
  return performBump(bumpInfo, options);
}
