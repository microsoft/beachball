import { spawnSync, SpawnSyncOptions } from 'child_process';
import os from 'os';

export function npm(args: string[], options: SpawnSyncOptions = {}) {
  const npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  const maxBuffer = 1024 * 1024 * 10; // default is 1024 * 1024
  const results = spawnSync(npmCmd, args, { maxBuffer, ...options });

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
