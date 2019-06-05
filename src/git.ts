import { spawnSync } from 'child_process';

export function git(args: string[], options?: { cwd?: string }) {
  const results = spawnSync('git', args, options);

  if (results.status === 0) {
    return {
      stderr: results.stderr.toString().trim(),
      stdout: results.stdout.toString().trim()
    };
  } else {
    return null;
  }
}

export function getUncommittedChanges(cwd?: string) {
  try {
    const results = git(['status', '--porcelain'], { cwd });

    if (!results) {
      return [];
    }

    const changes = results.stdout;

    if (changes.length == 0) {
      return [];
    }

    const lines = changes.split(/\n/) || [];

    return lines.map(line => line.trim().split(/ /)[1]);
  } catch (e) {
    console.error('Cannot gather information about changes: ', e.message);
  }
}

export function getForkPoint(cwd?: string, targetBranch: string = 'origin/master') {
  try {
    let results = git(['merge-base', '--fork-point', targetBranch, 'HEAD'], { cwd });

    if (!results) {
      results = git(['merge-base', '--fork-point', 'master', 'HEAD'], { cwd });
    }

    if (!results) {
      return null;
    }

    return results.stdout;
  } catch (e) {
    return targetBranch;
  }
}

export function getChanges(cwd?: string) {
  try {
    const forkPoint = getForkPoint(cwd);

    if (!forkPoint) {
      return [];
    }

    const results = git(['--no-pager', 'diff', '--name-only', forkPoint + '...'], { cwd });

    if (!results) {
      return [];
    }

    let changes = results.stdout;
    let lines = changes.split(/\n/) || [];

    return lines.map(line => line.trim());
  } catch (e) {
    console.error('Cannot gather information about changes: ', e.message);
  }
}

export function getRecentCommitMessages(cwd?: string) {
  try {
    const forkPoint = getForkPoint(cwd);

    if (!forkPoint) {
      return [];
    }

    const results = git(['log', '--decorate', '--pretty=format:%s', forkPoint, 'HEAD'], { cwd });

    if (!results) {
      return [];
    }

    let changes = results.stdout;
    let lines = changes.split(/\n/) || [];

    return lines.map(line => line.trim());
  } catch (e) {
    console.error('Cannot gather information about recent commits: ', e.message);
  }
}

export function getUserEmail(cwd?: string) {
  try {
    const results = git(['config', 'user.email'], { cwd });

    if (!results) {
      return null;
    }

    return results.stdout;
  } catch (e) {
    console.error('Cannot gather information about user.email: ', e.message);
  }
}
