import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
import { BeachballOptions } from '../types/BeachballOptions';

export function bump(options: BeachballOptions) {
  const { path, bumpDeps } = options;
  return performBump(gatherBumpInfo(path), path, bumpDeps);
}
