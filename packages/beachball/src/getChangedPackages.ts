import { ChangeInfo } from './ChangeInfo';
import { findPackageRoot, getChangePath } from './paths';
import { getChanges, git } from './git';
import fs from 'fs';
import path from 'path';

/**
 * Gets all the changed packages, regardless of the change files
 * @param cwd
 */
function getAllChangedPackages(branch: string, cwd: string) {
  const changes = getChanges(branch, cwd);

  const packageRoots: { [pathName: string]: string } = {};
  if (changes) {
    // Discover package roots from modded files
    changes.forEach(moddedFile => {
      const root = findPackageRoot(path.join(cwd, path.dirname(moddedFile)));

      if (root && !packageRoots[root]) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json')).toString());

          if (!packageJson.private && (!packageJson.beachball || packageJson.beachball.shouldPublish !== false)) {
            const packageName = packageJson.name;
            packageRoots[root] = packageName;
          }
        } catch (e) {
          // Ignore JSON errors
        }
      }
    });
  }

  return Object.values(packageRoots);
}

/**
 * Gets all the changed packages, accounting for change files
 * @param cwd
 */
export function getChangedPackages(branch: string, cwd: string) {
  const changePath = getChangePath(cwd);
  const changedPackages = getAllChangedPackages(branch, cwd);

  const changeFileResult = git(['ls-tree', '-r', '--name-only', '--full-tree', branch, 'change'], { cwd });

  if (!changePath || !fs.existsSync(changePath) || !changeFileResult.success) {
    return changedPackages;
  }

  const remoteChangeFiles = changeFileResult.stdout.split(/\n/).map(line => path.basename(line.trim()));
  const changeFiles = fs.readdirSync(changePath).filter(entry => fs.statSync(path.join(changePath, entry)).isFile);
  const changeFilePackageSet = new Set<string>();

  changeFiles.forEach(file => {
    if (file === 'CHANGELOG.md' || file === 'CHANGELOG.md' || remoteChangeFiles.includes(file)) {
      return;
    }

    try {
      const changeInfo: ChangeInfo = JSON.parse(fs.readFileSync(path.join(changePath, file)).toString());
      changeFilePackageSet.add(changeInfo.packageName);
    } catch (e) {
      console.warn(`Invalid change file encountered: ${file}`);
    }
  });

  return changedPackages.filter(pkgName => !changeFilePackageSet.has(pkgName));
}
