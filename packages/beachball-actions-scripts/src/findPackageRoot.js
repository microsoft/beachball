import fs from 'fs';
import path from 'path';

/** Find the package root from cwd */
export function findPackageRoot() {
  let currentDir = process.cwd();

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached the filesystem root without finding a package.json
      throw new Error(`Could not find package root for directory: ${process.cwd()}`);
    }
    currentDir = parentDir;
  }
}
