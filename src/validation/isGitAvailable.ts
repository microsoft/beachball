import { git, findGitRoot } from 'workspace-tools';

export function isGitAvailable(cwd: string): boolean {
  const result = git(['--version']);
  try {
    return result.success && !!findGitRoot(cwd);
  } catch {
    return false;
  }
}
