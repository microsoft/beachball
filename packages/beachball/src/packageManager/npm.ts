import { spawnSync, SpawnSyncOptions } from 'child_process';
import os from 'os';

export function npm(args: string[], options: SpawnSyncOptions = {}) {
  const npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  const results = spawnSync(npmCmd, args, { maxBuffer: 1024 * 1024, ...options });

  if (results.status === 0) {
    return {
      stderr: results.stderr.toString().trim(),
      stdout: results.stdout.toString().trim(),
      success: true,
    };
  } else {
    return {
      stderr: results.stderr.toString().trim(),
      stdout: results.stdout.toString().trim(),
      success: false,
    };
  }
}
