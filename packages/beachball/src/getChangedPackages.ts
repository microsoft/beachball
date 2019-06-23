import { ChangeInfo } from './ChangeInfo';
import { findLernaConfig, getPackagePatterns } from './monorepo';
import { findPackageRoot, findGitRoot, getChangePath } from './paths';
import { getChanges, git } from './git';
import fs from 'fs';
import minimatch from 'minimatch';
import path from 'path';

/**
 * Gets all the changed packages, regardless of the change files
 * @param cwd
 */
function getAllChangedPackages(branch: string, cwd: string) {
  const gitRoot = findGitRoot(cwd) || cwd;
  const changes = getChanges(branch, cwd);

  const packageRoots: { [pathName: string]: string } = {};
  if (changes) {
    // Discover package roots from modded files
    changes.forEach(moddedFile => {
      const root = findPackageRoot(path.join(cwd, path.dirname(moddedFile)));

      if (root && !packageRoots[root]) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json')).toString());

          if (!packageJson.private) {
            const packageName = packageJson.name;
            packageRoots[root] = packageName;
          }
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
export function getChangedPackages(branch: string, cwd: string) {
  const changePath = getChangePath(cwd);
  const changedPackages = getAllChangedPackages(branch, cwd);

  const changeFileResult = git(['ls-tree', '-r', '--name-only', '--full-tree', branch, 'change'], { cwd });

  if (!changePath || !fs.existsSync(changePath) || !changeFileResult.success) {
    return changedPackages;
  }

  const remoteChangeFiles = changeFileResult.stdout.split(/\n/).map(line => path.basename(line.trim()));
  const changeFileDirents = fs.readdirSync(changePath, { withFileTypes: true });
  const changeFiles = changeFileDirents.filter(dirent => dirent.isFile).map(dirent => dirent.name);
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
