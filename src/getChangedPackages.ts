import { ChangeInfo } from './ChangeInfo';
import { findLernaConfig, getPackagePatterns } from './monorepo';
import { findPackageRoot, findGitRoot, getChangePath } from './paths';
import { getChanges } from './git';
import fs from 'fs';
import minimatch from 'minimatch';
import path from 'path';

/**
 * Gets all the changed packages, regardless of the change files
 * @param cwd
 */
function getAllChangedPackages(cwd?: string) {
  cwd = cwd || process.cwd();

  const gitRoot = findGitRoot(cwd) || cwd;
  const changes = getChanges(cwd);

  const packageRoots: { [pathName: string]: string } = {};

  if (changes) {
    // Discover package roots from modded files
    changes.forEach(moddedFile => {
      const root = findPackageRoot(path.join(cwd!, path.dirname(moddedFile)));

      if (root && !packageRoots[root]) {
        try {
          const packageName = JSON.parse(fs.readFileSync(path.join(root, 'package.json')).toString()).name;
          packageRoots[root] = packageName;
        } catch (e) {
          // Ignore JSON errors
        }
      }
    });
  }

  if (findLernaConfig(cwd)) {
    const packagePatterns = getPackagePatterns(cwd);

    return Object.keys(packageRoots)
      .filter(pkgPath => {
        for (let pattern of packagePatterns) {
          const relativePath = path.relative(gitRoot, pkgPath);
          if (minimatch(relativePath, pattern)) {
            return true;
          }
        }

        return false;
      })
      .map(pkgPath => {
        return packageRoots[pkgPath];
      });
  } else {
    return Object.values(packageRoots);
  }
}

/**
 * Gets all the changed packages, accounting for change files
 * @param cwd
 */
export function getChangedPackages(cwd?: string) {
  const changePath = getChangePath(cwd);
  const changedPackages = getAllChangedPackages(cwd);

  if (!changePath || !fs.existsSync(changePath)) {
    return changedPackages;
  }

  const changeFileDirents = fs.readdirSync(changePath, { withFileTypes: true });
  const changeFiles = changeFileDirents.filter(dirent => dirent.isFile).map(dirent => dirent.name);
  const changeFilePackageSet = new Set<string>();
  changeFiles.forEach(file => {
    try {
      const changeInfo: ChangeInfo = JSON.parse(fs.readFileSync(path.join(changePath, file)).toString());
      changeFilePackageSet.add(changeInfo.packageName);
    } catch (e) {
      console.warn(`Invalid change file encountered: ${file}`);
    }
  });

  return changedPackages.filter(pkgName => !changeFilePackageSet.has(pkgName));
}
