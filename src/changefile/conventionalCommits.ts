import { ChangeType } from '../types/ChangeInfo';

/**
 * 1. type
 * 2. scope
 * 3. breaking
 * 4. message
 */
const COMMIT_RE = /([a-z]+)(?:\(([a-z]+)\))?(!)?: (.+)/;

interface ConventionalCommit {
  type: string;
  scope?: string;
  breaking: boolean;
  message: string;
}

interface Change {
  type: ChangeType;
  message: string;
}

export function parseConventionalCommit(commitMessage: string): Change | undefined {
  const match = commitMessage.match(COMMIT_RE);
  const data: ConventionalCommit | undefined = match
    ? { type: match[1], scope: match[2], breaking: !!match[3], message: match[4] }
    : undefined;
  return data && map(data);
}

function map(d: ConventionalCommit): Change | undefined {
  if (d.breaking) {
    return { type: 'major', message: d.message };
  }

  switch (d.type) {
    case 'fix':
    case 'chore':
      return { type: 'patch', message: d.message };
    case 'feat':
      return { type: 'minor', message: d.message };
  }
}
