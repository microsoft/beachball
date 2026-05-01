export type ChangeType = 'patch' | 'minor' | 'major' | 'none';

/**
 * Legacy change types that have been removed (mapped to their replacements at read time).
 * `prerelease` is no longer accepted. `pre*` types are coerced to their stripped equivalents.
 */
export type LegacyChangeType = 'prerelease' | 'prepatch' | 'preminor' | 'premajor';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [extraInfo: string]: any;
}

/**
 * Info saved in each change file, plus the commit hash.
 */
export interface ChangeInfo extends ChangeFileInfo {
  /**
   * Commit hash where the change was made, if available.
   * Will be undefined if `options.change.includeCommitHashes` is false.
   */
  commit?: string;
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
export type ChangeSet = Array<{
  change: ChangeFileInfo;
  /**
   * Filename the change came from (under `BeachballOptions.changeDir`).
   * Multiple entries in the array might have come from the same file.
   */
  changeFile: string;
}>;
