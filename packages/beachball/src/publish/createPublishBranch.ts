import { gitFailFast } from 'workspace-tools';

export function createPublishBranch(cwd: string): string {
  const publishBranch = `publish_${Date.now()}`;

  console.log(`Creating temporary publish branch ${publishBranch}\n`);
  gitFailFast(['checkout', '-b', publishBranch], { cwd });

  return publishBranch;
}
