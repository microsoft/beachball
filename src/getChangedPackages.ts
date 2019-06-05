import { getChanges } from './git';
import { findPackageRoot } from './paths';
import { findLernaConfig, getPackagePatterns } from './monorepo';
import fs from 'fs';
import minimatch from 'minimatch';
import path from 'path';

export function getChangedPackages(cwd?: string) {
  const changes = getChanges(cwd);

  const packageRoots: { [pathName: string]: string } = {};

  if (changes) {
    // Discover package roots from modded files
    changes.forEach(moddedFile => {
      const root = findPackageRoot(path.join(cwd || process.cwd(), path.dirname(moddedFile)));

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
          const relativePath = path.relative(cwd || process.cwd(), pkgPath);

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
