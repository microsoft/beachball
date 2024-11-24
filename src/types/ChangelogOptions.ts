import type { ChangelogJson, PackageChangelog, ChangelogEntry } from './ChangeLog';
import type { ChangeType } from './ChangeInfo';

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
   * Default renderers (and `customRenderers` if provided) will be available in `renderInfo.renderers`
   * but will not be called automatically.
   */
  renderPackageChangelog?: (renderInfo: PackageChangelogRenderInfo) => string | Promise<string>;

  /**
   * Fine-grained custom renderers for individual parts of the changelog.
   * If using a custom `renderPackageChangelog`, these will not be called automatically.
   */
  customRenderers?: ChangelogRenderers;

  /**
   * Custom renderer for the header for the entire changelog.
   *
   * Default is like this (no leading or trailing newlines):
   * ```txt
   * # Change Log - @scope/package-name
   * ```
   */
  renderMainHeader?: (packageChangelog: PackageChangelog) => string | Promise<string>;

  /**
   * If true, add a unique suffix to changelog filenames, based on the hash of the package name:
   * e.g. `CHANGELOG-d7d39c3f.md`/`.json`.
   *
   * When this is initially enabled, any existing changelog files will be renamed. If the package name
   * (and therefore the hash) changes, renaming the file should also be handled automatically.
   *
   * This is one option for working around an issue with Git: its default hash algorithm only
   * considers the last 16 characters of filenames, which can lead to collisions and inefficient
   * packing when many files have similar names.
   */
  uniqueFilenames?: boolean;

  /**
   * Maximum number of versions to keep in the changelog md and json files.
   * (If the md file is truncated, it will include a comment about referring to git for older entries.)
   */
  maxVersions?: number;
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

  /**
   * minimatch pattern(s) for package paths to include in this group.
   * Patterns are relative to the repo root and must use forward slashes.
   * If `true`, include all packages except those matching `exclude`.
   */
  include: string | string[] | true;

  /**
   * minimatch pattern(s) for package paths to exclude from this group.
   * Patterns are relative to the repo root and must use forward slashes.
   */
  exclude?: string | string[];

  /**
   * Put the grouped changelog file under this directory.
   * Can be relative to the root, or absolute.
   */
  changelogPath: string;
}

/**
 * Info used for rendering the changelog markdown for a particular package version.
 */
export interface PackageChangelogRenderInfo {
  /** Existing json in CHANGELOG.json.  */
  previousJson: ChangelogJson | undefined;

  /** Changelog for a package version that is going to be added to full changelog. */
  newVersionChangelog: PackageChangelog;

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
   * The returned string must start with a markdown header, usually h2 (`##`).
   *
   * Default is like this (no leading or trailing newlines):
   * ```txt
   * ## 1.23.1
   * Wed, 25 Mar 2020 20:20:02 GMT
   * ```
   */
  renderHeader?: (renderInfo: PackageChangelogRenderInfo) => string | Promise<string>;

  /**
   * Custom renderer for the section about `changeType` changes for a particular package version.
   *
   * Default is like this (no leading or trailing newlines):
   * ```txt
   * ### Minor changes
   *
   * - Really interesting change (user1@microsoft.com)
   * ```
   */
  renderChangeTypeSection?: (
    changeType: ChangeType,
    renderInfo: PackageChangelogRenderInfo
  ) => string | Promise<string>;

  /**
   * Custom renderer for the section header about `changeType` changes for a particular package version.
   *
   * Default is like this (no leading or trailing newlines):
   * ```txt
   * ### Minor changes
   * ```
   */
  renderChangeTypeHeader?: (changeType: ChangeType, renderInfo: PackageChangelogRenderInfo) => string | Promise<string>;

  /**
   * Custom renderer for the list of `changeType` changes (not including the change type header)
   * for a particular package version.
   *
   * Default is like this for non-grouped changelogs (no leading or trailing newlines):
   * ```txt
   * - Really interesting change (user1@microsoft.com)
   * - Boring change (user2@microsoft.com)
   * ```
   *
   * Or like this for grouped changelogs:
   * ```txt
   * - `foo`
   *   - Really interesting change (user1@microsoft.com)
   * - `bar`
   *   - Boring change (user2@microsoft.com)
   * ```
   */
  renderEntries?: (changeType: ChangeType, renderInfo: PackageChangelogRenderInfo) => string | Promise<string>;

  /**
   * Custom renderer for an individual change entry.
   *
   * Default is like this (no leading or trailing newlines):
   * ```txt
   * - Really interesting change (user1@microsoft.com)
   * ```
   */
  renderEntry?: (entry: ChangelogEntry, renderInfo: PackageChangelogRenderInfo) => string | Promise<string>;
}
