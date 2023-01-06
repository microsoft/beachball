import { BeachballOptions } from '../types/BeachballOptions';
import * as fs from 'fs';
import * as path from 'path';
import { findProjectRoot } from 'workspace-tools';
import { npm } from '../packageManager/npm';

export async function init(options: BeachballOptions) {
  let root: string;
  try {
    root = findProjectRoot(options.path);
  } catch (err) {
    console.log('Please run this command on an existing repository root.');
    return;
  }

  const packageJsonFilePath = path.join(root, 'package.json');

  if (fs.existsSync(packageJsonFilePath)) {
    const beachballInfo = JSON.parse(npm(['info', 'beachball', '--json']).stdout.toString());
    const beachballVersion = beachballInfo['dist-tags'].latest;

    const packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf-8'));
    packageJson.devDependencies = packageJson.devDependencies ?? {};
    packageJson.devDependencies.beachball = beachballVersion;
    packageJson.scripts = packageJson.scripts ?? {};
    packageJson.scripts.checkchange = 'beachball check';
    packageJson.scripts.change = 'beachball change';
    packageJson.scripts.release = 'beachball publish';

    fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, 2));

    console.log(
      'beachball has been initialized, please run `yarn` or `npm install` to install beachball into your repo'
    );
  }
}
