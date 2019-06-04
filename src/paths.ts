import path from 'path';
import fs from 'fs';

function searchUp(pathName: string, cwd?: string) {
  if (!cwd) {
    cwd = process.cwd();
  }

  const root = path.parse(cwd).root;

  let found = false;

  while (!found && cwd !== root) {
    if (fs.existsSync(path.join(cwd, pathName))) {
      found = true;
      break;
    }

    cwd = path.dirname(cwd);
  }

  if (found) {
    return cwd;
  }

  return null;
}

export function findGitRoot(cwd?: string) {
  return searchUp('.git', cwd);
}

export function findPackageRoot(cwd?: string) {
  return searchUp('package.json', cwd);
}

export function getChangeFilePath(cwd?: string) {
  const gitRoot = findGitRoot(cwd);

  if (gitRoot) {
    return path.join(gitRoot, 'beachbump');
  }

  return null;
}

export function isChildOf(child: string, parent: string) {
  const relativePath = path.relative(child, parent);
  return /^[.\/\\]+$/.test(relativePath);
}
