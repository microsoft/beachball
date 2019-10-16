export type ChangeType = 'prerelease' | 'patch' | 'minor' | 'major' | 'none';

export interface ChangeInfo {
  type: ChangeType;
  comment: string;
  packageName: string;
  email: string;
  commit: string;
  date: Date;
}

export type ChangeSet = Map<string, ChangeInfo>;
