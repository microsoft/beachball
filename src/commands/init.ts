import type { BeachballOptions } from '../types/BeachballOptions';
import * as fs from 'fs';
import * as path from 'path';
import { findGitRoot } from 'workspace-tools';
import { npm } from '../packageManager/npm';
import type { PackageJson } from '../types/PackageInfo';
import { readJson } from '../object/readJson';

// TODO: consider modifying this to propagate up
function errorExit(message: string): void {
  console.error(message);
  console.log(
    'You can still set up beachball manually by following the instructions here: https://microsoft.github.io/beachball/overview/getting-started.html'
  );
  // eslint-disable-next-line no-restricted-properties
  process.exit(1);
}

export async function init(options: Pick<BeachballOptions, 'path'>): Promise<void> {
  try {
    findGitRoot(options.path);
  } catch {
    console.error('beachball only works in a git repository. Please initialize git and try again.');
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  const packageJsonFilePath = path.join(options.path, 'package.json');

  if (!fs.existsSync(packageJsonFilePath)) {
    errorExit(`Cannot find package.json at ${packageJsonFilePath}`);
  }

  const npmResult = await npm(['info', 'beachball', '--json'], { cwd: undefined });
  if (!npmResult.success) {
    errorExit('Failed to retrieve beachball version from npm');
  }

  let beachballVersion = '';
  try {
    const beachballInfo = JSON.parse(npmResult.stdout.toString()) as { 'dist-tags': { latest: string } };
    beachballVersion = beachballInfo['dist-tags'].latest;
  } catch {
    errorExit("Couldn't parse beachball version from npm");
  }

  let packageJson = {} as PackageJson;
  try {
    packageJson = readJson<PackageJson>(packageJsonFilePath);
  } catch {
    errorExit(`Failed to read package.json at ${packageJsonFilePath}`);
  }

  packageJson.devDependencies ??= {};
  packageJson.devDependencies.beachball = beachballVersion;
  packageJson.scripts ??= {};
  packageJson.scripts.checkchange = 'beachball check';
  packageJson.scripts.change = 'beachball change';
  packageJson.scripts.release = 'beachball publish';

  fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, 2));

  if (!packageJson.repository) {
    console.warn(
      'Please add a "repository" field to your repo root package.json so beachball always ' +
        'knows which remote to use when checking for changes.'
    );
  }

  console.log('beachball has been initialized! Please run `yarn` or `npm install` to install beachball in your repo.');
}
