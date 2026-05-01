import type { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getRecentCommitMessages, getUserEmail } from 'workspace-tools';
import { getChangedPackages } from '../changefile/getChangedPackages';
import type { ChangeCommandContext } from '../types/CommandContext';
import { createBasicCommandContext } from '../monorepo/createCommandContext';

/**
 * Generate change files.
 * @param context Command context from `validate()`. `changedPackages` may be undefined for tests.
 */
export async function change(options: BeachballOptions, context: ChangeCommandContext): Promise<void>;
/** @deprecated Use other signature */
export async function change(options: BeachballOptions): Promise<void>;
export async function change(options: BeachballOptions, context?: ChangeCommandContext): Promise<void> {
  const { branch, path: cwd } = options;

  // eslint-disable-next-line beachball/no-deprecated -- compat code
  context ??= { ...createBasicCommandContext(options), changedPackages: undefined };

  const {
    originalPackageInfos: packageInfos,
    packageGroups,
    // This considers --package and --all
    changedPackages = getChangedPackages(options, packageInfos, context.scopedPackages),
  } = context;

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
