import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { BeachballOptions } from '../types/BeachballOptions';

export async function bump(options: BeachballOptions) {
  return await performBump(gatherBumpInfo(options), options);
}
