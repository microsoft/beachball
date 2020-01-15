import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { BeachballOptions } from '../types/BeachballOptions';

export function bump(options: BeachballOptions) {
  return performBump(gatherBumpInfo(options), options);
}
