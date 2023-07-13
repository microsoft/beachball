import { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { npm, NpmResult } from './npm';
import { NpmOptions } from '../types/NpmOptions';
import { getNpmPublishArgs } from './npmArgs';

export function packagePublish(packageInfo: PackageInfo, options: NpmOptions): Promise<NpmResult> {
  const args = getNpmPublishArgs(packageInfo, options);
  console.log(`publish command: ${args.join(' ')}`);

  return npm(args, {
    cwd: path.dirname(packageInfo.packageJsonPath),
    timeout: options.timeout,
    all: true,
  });
}
