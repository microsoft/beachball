import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { npm } from '../packageManager/npm';
import semver from 'semver';
import fs from 'fs-extra';

export async function sync(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);

  for (const [pkg, info] of Object.entries(packageInfos)) {
    const npmArgs = ['view', pkg, 'version'];
    if (options.registry) {
      npmArgs.push('--registry');
      npmArgs.push(options.registry);
    }
    const result = npm(npmArgs);
    const publishedVersion = result.stdout;

    if (semver.lt(info.version, publishedVersion)) {
      console.log(`There is a newer version of "${pkg}@${info.version}". Syncing to the published version ${publishedVersion}`)

      const packageJson = fs.readJsonSync(info.packageJsonPath);
      packageJson.version = publishedVersion;
      fs.writeJsonSync(info.packageJsonPath, packageJson, { spaces: 2 });
    }
  }
}
