import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import fs from 'fs';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';

/**
 * Performs the bump, writes to the file system
 *
 * deletes change files, update package.json, and changelogs
 *
 * @param bumpInfo
 * @param cwd
 * @param bumpDeps
 */
export function performBump(bumpInfo: BumpInfo, options: BeachballOptions) {
  const { modifiedPackages, packageInfos, changes } = bumpInfo;

  for (const pkgName of modifiedPackages) {
    const info = packageInfos[pkgName];
    const packageJson = JSON.parse(fs.readFileSync(info.packageJsonPath, 'utf-8'));

    packageJson.version = info.version;

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      if (info[depKind]) {
        packageJson[depKind] = { ...packageJson[depKind], ...info[depKind] };
      }
    });

    fs.writeFileSync(info.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  // Generate changelog
  writeChangelog(options, changes, packageInfos);

  // Unlink changelogs
  unlinkChangeFiles(changes, packageInfos, options.path);
}
