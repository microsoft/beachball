import { BeachballOptions } from '../types/BeachballOptions';
import * as fs from 'fs-extra';
import * as path from 'path';
import { findProjectRoot } from 'workspace-tools';
import { npm } from '../packageManager/npm';
import { PackageJson } from '../types/PackageInfo';

function errorExit(message: string): void {
  console.error(message);
  console.log(
    'You can still set up beachball manually by following the instructions here: https://microsoft.github.io/beachball/overview/getting-started.html'
  );
  process.exit(1);
}

export async function init(options: BeachballOptions): Promise<void> {
  let root: string;
  try {
    root = findProjectRoot(options.path);
  } catch (err) {
    console.log('Please run this command on an existing repository root.');
    return;
  }

  const packageJsonFilePath = path.join(root, 'package.json');

  if (!fs.existsSync(packageJsonFilePath)) {
    errorExit(`Cannot find package.json at ${packageJsonFilePath}`);
  }

  const npmResult = npm(['info', 'beachball', '--json']);
  if (!npmResult.success) {
    errorExit('Failed to retrieve beachball version from npm');
  }

  let beachballVersion = '';
  try {
    const beachballInfo = JSON.parse(npmResult.stdout.toString());
    beachballVersion = beachballInfo['dist-tags'].latest;
  } catch (err) {
    errorExit("Couldn't parse beachball version from npm");
  }

  let packageJson = {} as PackageJson;
  try {
    packageJson = fs.readJSONSync(packageJsonFilePath, 'utf-8');
  } catch (err) {
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
