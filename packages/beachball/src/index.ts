// Public types of Beachball used in config files
// (the package does not have a callable public API since it's meant to be invoked via command line)
import { RepoOptions, PackageOptions } from './types/BeachballOptions';

export type BeachballConfig = Partial<RepoOptions> & Partial<PackageOptions>;

export { VersionGroupOptions } from './types/BeachballOptions';
export { ChangeFilePromptOptions } from './types/ChangeFilePrompt';
export { ChangeType } from './types/ChangeInfo';
export { ChangelogEntry, ChangelogJson, ChangelogJsonEntry, PackageChangelog } from './types/ChangeLog';
export {
  ChangelogOptions,
  ChangelogGroupOptions,
  PackageChangelogRenderInfo,
  ChangelogRenderers,
} from './types/ChangelogOptions';
