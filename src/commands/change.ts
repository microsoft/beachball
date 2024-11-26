import type { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getRecentCommitMessages, getUserEmail } from 'workspace-tools';
import { validate } from '../validation/validate';

export async function change(options: BeachballOptions): Promise<void> {
  const { branch, path: cwd, package: specificPackage } = options;

  const { isChangeNeeded, ...repoInfo } = validate(options, {
    allowMissingChangeFiles: true,
    // If the user requested a change file for a specific package, don't check if change files are needed
    checkChangeNeeded: !specificPackage,
  });

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
