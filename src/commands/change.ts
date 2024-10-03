import type { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getRecentCommitMessages, getUserEmail } from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';
import { validate } from '../validation/validate';

/**
 * Generate change files.
 */
export async function change(options: BeachballOptions, packageInfos: PackageInfos): Promise<void>;
/** @deprecated Must provide the package infos */
export async function change(options: BeachballOptions): Promise<void>;
export async function change(options: BeachballOptions, packageInfos?: PackageInfos): Promise<void> {
  const { branch, path: cwd, package: specificPackage } = options;

  packageInfos ||= getPackageInfos(cwd);

  const { isChangeNeeded, ...repoInfo } = validate(
    options,
    {
      allowMissingChangeFiles: true,
      // If the user requested a change file for a specific package, don't check if change files are needed
      checkChangeNeeded: !specificPackage,
    },
    packageInfos
  );

  if (!isChangeNeeded && !specificPackage) {
    console.log('No change files are needed');
    return;
  }

  const { packageInfos, packageGroups } = repoInfo;

  const changedPackages =
    typeof specificPackage === 'string'
      ? [specificPackage]
      : Array.isArray(specificPackage)
      ? specificPackage
      : repoInfo.changedPackages;
  if (!changedPackages?.length) {
    return;
  }

  const recentMessages = getRecentCommitMessages(branch, cwd);
  const email = getUserEmail(cwd);

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
