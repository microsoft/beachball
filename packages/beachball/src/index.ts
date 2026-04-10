// Public types of Beachball used in config files
// (the package does not have a callable public API since it's meant to be invoked via command line)
import type { RepoOptions, PackageOptions } from './types/BeachballOptions';

export type BeachballConfig = Partial<RepoOptions> & Partial<PackageOptions>;

export type { VersionGroupOptions } from './types/BeachballOptions';
export type { ChangeFilePromptOptions } from './types/ChangeFilePrompt';
export type { ChangeType } from './types/ChangeInfo';
export type { ChangelogEntry, ChangelogJson, ChangelogJsonEntry, PackageChangelog } from './types/ChangeLog';
export type {
  ChangelogOptions,
  ChangelogGroupOptions,
  PackageChangelogRenderInfo,
  ChangelogRenderers,
} from './types/ChangelogOptions';
