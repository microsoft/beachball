import fs from 'fs';
import path from 'path';
/**
 * Find the actual package.json (the one with a name) for the current file.
 * This implementation accounts for intermediate package.json files with just a "type", no name.
 * @param cache Optional cache if iterating over multiple files which may be from the same package
 */
export function findRealPackageJson(fileRealpath, cache = new Map()) {
  const root = path.parse(fileRealpath).root;
  // Start with the path itself in case it's already a directory
  let dir = fileRealpath;
  const dirs = [];
  while (dir !== root) {
    dirs.push(dir);
    if (cache.has(dir)) {
      break;
    }
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const packageJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (packageJson.name) {
        cache.set(dir, { packageRoot: dir, packageJson });
        break;
      }
    }
    dir = path.dirname(dir);
  }
  const result = cache.get(dir) || null;
  for (const d of dirs) {
    cache.set(d, result);
  }
  if (result) {
    return result;
  }
  throw new Error('Unable to find package.json for ' + fileRealpath);
}
//# sourceMappingURL=findRealPackageJson.js.map
