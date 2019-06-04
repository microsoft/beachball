import { spawnSync } from 'child_process';

export function git(args: string[]) {
  return spawnSync('git', args);
}
