import { ChangelogJson, PackageChangelog, ChangelogEntry } from './Changelog';
import { ChangeType } from './ChangeInfo';

/**
 * Options for changelog-related configuration.
 *
 * If you would like to entirely customize rendering, use `renderPackageChangelog`.
 * Otherwise, you can provide as many or as few of the other custom renderer options as you'd like
 * to achieve the desired level of customization.
 */
export interface ChangelogOptions {
  /** Options for grouping packages together in a single changelog. */
  groups?: ChangelogGroupOptions[];

  /**
   * Use this for full custom rendering of the entire changelog markdown for a particular package version.
   */
  renderPackageChangelog?: (renderInfo: PackageChangelogRenderInfo) => string;

  /**
   * Fine-grained custom renderers for individual parts of the changelog.
   * If using a custom `renderPackageChangelog`, these will not be called automatically.
   */
  customRenderers?: ChangelogRenderers;
}

/**
 * Options for generating a changelog for a group of packages.
 */
export interface ChangelogGroupOptions {
  /**
   * The main package which a group of changes bubbles up to.
   * All changes within the group are used to describe changes for the master package.
   */
  masterPackageName: string;

  /** minimatch pattern (or array of minimatch) to detect which packages should be included in this group */
  include: string | string[];

  /** minimatch pattern (or array of minimatch) to detect which packages should be excluded in this group */
  exclude?: string | string[];

  changelogPath: string;
}

/**
 * Info used for rendering the changelog markdown for a particular package version.
 */
export interface PackageChangelogRenderInfo {
  /** Existing json in CHANGELOG.json.  */
  previousJson: ChangelogJson | undefined;

  /** Changelog for a package version that is going to be added to full changelog. */
  newEntry: PackageChangelog;

  /** True if this is a grouped changelog. */
  isGrouped: boolean;

  /**
   * Renderers for individual elements of the changelog.
   * If any custom renderers were provided in `ChangelogOptions.customRenderers`, they will be included here.
   * Default renderers will be included in cases where a custom option wasn't provided.
   */
  renderers: Required<ChangelogRenderers>;
}

export interface ChangelogRenderers {
  /**
   * Custom renderer for the header for a particular package version.
   *
   * Default is like this:
   * ```txt
   * ## 1.23.1
   * Wed, 25 Mar 2020 20:20:02 GMT
   * ```
   */
  renderHeader?: (renderInfo: PackageChangelogRenderInfo) => string;

  /**
   * Custom renderer for the section about `changeType` changes for a particular package version.
   *
   * Default is like this:
   * ```txt
   * ### Minor changes
   *
   * - ChangeLog: add empty options interface (xgao@microsoft.com)
   * ```
   */
  renderChangeTypeSection?: (changeType: ChangeType, renderInfo: PackageChangelogRenderInfo) => string;

  /**
   * Custom renderer for the section header about `changeType` changes for a particular package version.
   *
   * Default is like this:
   * ```txt
   * ### Minor changes
   * ```
   */
  renderChangeTypeHeader?: (changeType: ChangeType, renderInfo: PackageChangelogRenderInfo) => string;

  /**
   * Custom renderer for an individual change entry.
   *
   * Default is like this:
   * ```txt
   * - ChangeLog: add empty options interface (xgao@microsoft.com)
   * ```
   */
  renderEntry?: (entry: ChangelogEntry, renderInfo: PackageChangelogRenderInfo) => string;
}
