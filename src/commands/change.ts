import type { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { writeChangeFilesFixup } from '../changefile/writeChangeFilesFixup';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getRecentCommitMessages, getUserEmail } from 'workspace-tools';
import { getChangedPackages } from '../changefile/getChangedPackages';
import { getPackageGroups } from '../monorepo/getPackageGroups';

export async function change(options: BeachballOptions): Promise<void> {
  const { branch, path: cwd, package: specificPackage, fixup } = options;

  const packageInfos = getPackageInfos(cwd);
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
    if (fixup) {
      // Use fixup mode: update most recent change file and create fixup commit
      const updatedChangeFile = await writeChangeFilesFixup(changes, options);
      if (updatedChangeFile) {
        // Success!
        return;
      }

      console.log('No suitable commit found for fixup mode. Creating new change file instead.');
      // Fall back to normal mode
    }

    // Normal mode: create new change files
    writeChangeFiles(changes, options);
  }
}
