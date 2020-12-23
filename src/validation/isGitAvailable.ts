import { findProjectRoot } from '../paths';
import { git } from '../git';

export function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  const gitRoot = findProjectRoot(cwd);
  return result.success && gitRoot;
}
