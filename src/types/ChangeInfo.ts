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
  /**
   * Flag that identifies the change resulting from a dependency bump
   */
  dependentChange?: boolean;
  commit: string;
}

/**
 * Map from change file name to change info
 */
export type ChangeSet = Map<string, ChangeInfo>;
