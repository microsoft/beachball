import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { performBump } from '../bump/performBump';
export function bump(cwd: string, bumpDeps: boolean) {
  return performBump(gatherBumpInfo(cwd), cwd, bumpDeps);
}
