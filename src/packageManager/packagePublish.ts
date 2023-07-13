import { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { npmAsync } from './npm';
import { NpmOptions } from '../types/NpmOptions';
import { getNpmPublishArgs } from './npmArgs';

export function packagePublish(packageInfo: PackageInfo, options: NpmOptions): ReturnType<typeof npmAsync> {
  const args = getNpmPublishArgs(packageInfo, options);
  console.log(`publish command: ${args.join(' ')}`);

  return npmAsync(args, {
    cwd: path.dirname(packageInfo.packageJsonPath),
    timeout: options.timeout,
    all: true,
  });
}
