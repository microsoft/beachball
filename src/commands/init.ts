import type { BeachballOptions } from '../types/BeachballOptions';
import * as fs from 'fs';
import * as path from 'path';
import type { PackageJson } from '../types/PackageInfo';
import { readJson } from '../object/readJson';
import { getNpmPackageInfo } from '../packageManager/getNpmPackageInfo';
import { BeachballError } from '../types/BeachballError';
import { logger } from '../logging/logger';

function throwInitError(message: string): never {
  logger.error(message);
  logger.log(
    'You can still set up beachball manually by following the instructions here: https://microsoft.github.io/beachball/overview/getting-started.html'
  );
  throw new BeachballError(message, { alreadyLogged: true });
}

export async function init(options: Pick<BeachballOptions, 'path' | 'registry'>): Promise<void> {
  const packageJsonFilePath = path.join(options.path, 'package.json');

  if (!fs.existsSync(packageJsonFilePath)) {
    throwInitError(`Cannot find package.json at ${packageJsonFilePath}`);
  }

  const beachballInfo = await getNpmPackageInfo('beachball', options);
  if (!beachballInfo) {
    throwInitError('Failed to retrieve beachball version from npm');
  }
  const beachballVersion = beachballInfo['dist-tags'].latest;

  let packageJson = {} as PackageJson;
  try {
    packageJson = readJson<PackageJson>(packageJsonFilePath);
  } catch {
    throwInitError(`Failed to read package.json at ${packageJsonFilePath}`);
  }

  packageJson.devDependencies ??= {};
  packageJson.devDependencies.beachball = beachballVersion;
  packageJson.scripts ??= {};
  packageJson.scripts.checkchange = 'beachball check';
  packageJson.scripts.change = 'beachball change';
  packageJson.scripts.release = 'beachball publish';

  fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, 2));

  if (!packageJson.repository) {
    logger.warn(
      'Please add a "repository" field to your repo root package.json so beachball always ' +
        'knows which remote to use when checking for changes.'
    );
  }

  logger.log('beachball has been initialized! Please run `yarn` or `npm install` to install beachball in your repo.');
}
