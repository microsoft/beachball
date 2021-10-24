export type ChangeType = 'prerelease' | 'patch' | 'minor' | 'major' | 'none';

/**
 * Info saved in each change file.
 */
export interface ChangeFileInfo {
  type: ChangeType;
  comment: string;
  packageName: string;
  email: string;
  dependentChangeType: ChangeType;
  /** Extra info added to the change file via custom prompts */
  [extraInfo: string]: any;
}

/**
 * Info saved in each change file, plus the commit hash.
 */
export interface ChangeInfo extends ChangeFileInfo {
  commit: string;
}

export interface ChangeInfoMultiple {
  changes: ChangeInfo[];
}

/**
 * List of change file infos
 */
export type ChangeSet = { changeFile: string; change: ChangeFileInfo }[];
