import type { BumpInfo } from './BumpInfo';
import type { ChangeSet } from './ChangeInfo';
import type { PackageGroups, PackageInfos, ScopedPackages } from './PackageInfo';

/**
 * Basic context used by most commands.
 * This is usually calculated by `validate()` and passed back for commands to use.
 */
export interface BasicCommandContext {
  /** Original package info before bumping (should not be mutated) */
  originalPackageInfos: Readonly<PackageInfos>;
  /** Package groups derived from config */
  packageGroups: PackageGroups;
  /** List of in-scope package names, or true if all packages are in-scope */
  scopedPackages: ScopedPackages;
}

/**
 * Context for multiple commands with the most commonly-used properties.
 * This is usually calculated by `validate()` and passed back for commands to use.
 */
export interface CommandContext extends BasicCommandContext {
  /** Change file info for in-scope packages */
  changeSet: ChangeSet;
  /** Pre-calculated bump info, if relevant */
  bumpInfo: BumpInfo | undefined;
}

/**
 * Context for the `change` command, as usually calculated by `validate()`.
 * (It's a separate interface since most commands don't need `changedPackages`.)
 */
export interface ChangeCommandContext extends BasicCommandContext {
  /**
   * List of packages that have changed since the target, or overrides provided by the user.
   * - If `options.all` is true, includes all in-scope packages.
   * - If `options.package` is provided, includes those package(s) without scope validation.
   */
  changedPackages: string[] | undefined;
}
