import { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { npm } from '../packageManager/npm';
import semver from 'semver';
import fs from 'fs-extra';

export async function sync(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);
  const scopedPackages = new Set(getScopedPackages(options));

  for (const [pkg, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.has(pkg) || info.private) {
      continue;
    }

    if (semver.prerelease(info.version)) {
      console.log(`Warning: cannot sync prerelease package "${pkg}@${info.version}"`);
      continue;
    }

    // Get the latest of *this major version* of the package.
    // To do this we have to get all versions within this major version then take the latest.
    const npmArgs = ['view', `${pkg}@${semver.major(info.version)}`, 'version', '--json'];
    if (options.registry) {
      npmArgs.push('--registry');
      npmArgs.push(options.registry);
    }
    const result = npm(npmArgs);
    let publishedVersion = '';

    try {
      // The returned array of versions will already be sorted and not include prerelease because
      // prerelease versions don't satisfy semver pkg@x.
      publishedVersion = JSON.parse(result.stdout).slice(-1)[0];
    } catch (ex) {
      // Package is not published or possibly some other issue (don't need to warn user)
    }

    if (publishedVersion && semver.lt(info.version, publishedVersion)) {
      console.log(
        `There is a newer version of "${pkg}" (local version: ${info.version}). ` +
          `Syncing to the published version ${publishedVersion}.`
      );

      const packageJson = fs.readJsonSync(info.packageJsonPath);
      packageJson.version = publishedVersion;
      fs.writeJsonSync(info.packageJsonPath, packageJson, { spaces: 2 });
    }
  }
}
