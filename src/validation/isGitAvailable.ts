import { git, findGitRoot } from 'workspace-tools';

export function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  try {
    return result.success && !!findGitRoot(cwd);
  } catch (err) {
    return false;
  }
}
