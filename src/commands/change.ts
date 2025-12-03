import type { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getRecentCommitMessages, getUserEmail } from 'workspace-tools';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Generate change files.
 */
export async function change(options: BeachballOptions, packageInfos: PackageInfos): Promise<void>;
/** @deprecated Must provide the package infos */
export async function change(options: BeachballOptions): Promise<void>;
export async function change(options: BeachballOptions, packageInfos?: PackageInfos): Promise<void> {
  const { branch, path: cwd, package: specificPackage } = options;

  packageInfos ||= getPackageInfos(cwd);
  const packageGroups = getPackageGroups(packageInfos, cwd, options.groups);

  const changedPackages =
    typeof specificPackage === 'string'
      ? [specificPackage]
      : Array.isArray(specificPackage)
      ? specificPackage
      : getChangedPackages(options, packageInfos);
  if (!changedPackages.length) {
    return;
  }

  const recentMessages = getRecentCommitMessages({ branch, cwd });
  const email = getUserEmail({ cwd });

  const changes = await promptForChange({
    changedPackages,
    packageInfos,
    packageGroups,
    recentMessages,
    email,
    options,
  });

  if (changes) {
    writeChangeFiles(changes, options);
  }
}
