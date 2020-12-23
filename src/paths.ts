import path from 'path';
import fs from 'fs-extra';
import { getWorkspaceRoot } from 'workspace-tools';

/**
 * Starting from `cwd`, searches up the directory hierarchy for `pathName`
 */
export function searchUp(pathName: string, cwd: string) {
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

export function findProjectRoot(cwd: string) {
  const root = getWorkspaceRoot(cwd) || searchUp('.git', cwd);
  return root;
}

export function findPackageRoot(cwd: string) {
  return searchUp('package.json', cwd);
}

export function getChangePath(cwd: string) {
  const gitRoot = findProjectRoot(cwd);

  if (gitRoot) {
    return path.join(gitRoot, 'change');
  }

  return null;
}

export function isChildOf(child: string, parent: string) {
  const relativePath = path.relative(child, parent);
  return /^[.\/\\]+$/.test(relativePath);
}
