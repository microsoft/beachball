import { spawnSync } from 'child_process';

export function git(args: string[]) {
  const results = spawnSync('git', args);

  if (results.status === 0) {
    return {
      stderr: results.stderr.toString().trim(),
      stdout: results.stdout.toString().trim()
    };
  } else {
    return null;
  }
}

export function getUncommittedChanges() {
  try {
    const results = git(['status', '--porcelain']);

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

export function getForkPoint(targetBranch: string = 'origin/master') {
  try {
    const results = git(['git', 'merge-base', '--fork-point', targetBranch, 'HEAD']);
    if (!results) {
      return targetBranch;
    }

    return results.stdout;
  } catch (e) {
    return targetBranch;
  }
}

export function getChanges() {
  try {
    const forkPoint = getForkPoint();
    const results = git(['--no-pager', 'diff', '--name-only', forkPoint + '...']);

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

export function getRecentCommitMessages() {
  try {
    const forkPoint = getForkPoint();
    const results = git(['log', '--decorate', '--pretty=format:%s', '--reverse', forkPoint, 'HEAD']);

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
