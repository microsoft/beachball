export type ChangeType = 'prerelease' | 'prepatch' | 'patch' | 'preminor' | 'minor' | 'premajor' | 'major' | 'none';

/**
 * Info saved in each change file.
 * (For entries in CHANGELOG.json, see `ChangelogEntry` in ./ChangeLog.ts.)
 */
export interface ChangeFileInfo {
  type: ChangeType;
  /** Change comment */
  comment: string;
  /** Package name the change was in */
  packageName: string;
  /** Author email */
  email: string;
  /** How to bump packages that depend on this one */
  dependentChangeType: ChangeType;
  /** Extra info added to the change file via custom prompts */
  [extraInfo: string]: unknown;
}

/**
 * Info saved in each change file, plus the commit hash.
 */
export interface ChangeInfo extends ChangeFileInfo {
  commit: string;
}

/**
 * Info saved in each grouped change file.
 */
export interface ChangeInfoMultiple {
  changes: ChangeInfo[];
}

/**
 * List of change file infos (not actually a set).
 */
export type ChangeSet = { changeFile: string; change: ChangeFileInfo }[];
