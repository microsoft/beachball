import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';

export async function bump(options: BeachballOptions) {
  const bumpInfo = gatherBumpInfo(options, getPackageInfos(options));
  return await performBump(bumpInfo, options);
}
