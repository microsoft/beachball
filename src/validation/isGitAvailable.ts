import { findGitRoot } from '../paths';
import { git } from '../git';

export function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  const gitRoot = findGitRoot(cwd);
  return result.success && gitRoot;
}
