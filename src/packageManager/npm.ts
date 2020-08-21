import { SpawnSyncOptions } from 'child_process';
import execa from 'execa';

export function npm(args: string[], options: SpawnSyncOptions = {}) {
  try {
    const result = execa.sync('npm', args, { ...options });
    return {
      ...result,
      success: !result.failed,
    };
  } catch (e) {
    return {
      ...e,
      success: false,
    };
  }
}

export async function npmAsync(args: string[], options: SpawnSyncOptions = {}) {
  try {
    const result = await execa('npm', args, { ...options });
    return {
      ...result,
      success: !result.failed,
    };
  } catch (e) {
    return {
      ...e,
      success: false,
    };
  }
}
