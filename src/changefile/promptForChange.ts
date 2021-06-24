import { ChangeFileInfo, ChangeType } from '../types/ChangeInfo';
import { getChangedPackages } from './getChangedPackages';
import { getRecentCommitMessages, getUserEmail } from 'workspace-tools';
import prompts from 'prompts';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { prerelease } from 'semver';
import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { isValidChangeType } from '../validation/isValidChangeType';
import { DefaultPrompt } from '../types/ChangeFilePrompt';
import { getDisallowedChangeTypes } from './getDisallowedChangeTypes';
import { parseConventionalCommit } from './conventionalCommits';

/**
 * Uses `prompts` package to prompt for change type and description, fills in git user.email and scope
 */
export async function promptForChange(options: BeachballOptions) {
  const { branch, path: cwd, package: specificPackage } = options;

  const changedPackages = specificPackage ? [specificPackage] : getChangedPackages(options);
  const recentMessages = getRecentCommitMessages(branch, cwd) || [];
  const packageChangeInfo: { [pkgname: string]: ChangeFileInfo } = {};

  const packageInfos = getPackageInfos(cwd);
  const packageGroups = getPackageGroups(packageInfos, options.path, options.groups);

  // Check recent commit messages for structured conventional
  // commits. If present, and --useConventionalCommits is set, fetch
  // change type and description from the first available commit
  // message.
  const fromConventionalCommits =
    (options.useConventionalCommits &&
      recentMessages.map(parseConventionalCommit).filter(<T>(obj: T | undefined): obj is T => !!obj)) ||
    [];

  for (let pkg of changedPackages) {
    console.log('');
    console.log(`Please describe the changes for: ${pkg}`);

    const disallowedChangeTypes = getDisallowedChangeTypes(pkg, packageInfos, packageGroups);
    const packageInfo = packageInfos[pkg];
    const showPrereleaseOption = prerelease(packageInfo.version);
    const changeTypePrompt: prompts.PromptObject<string> = {
      type: 'select',
      name: 'type',
      message: 'Change type',
      choices: [
        ...(showPrereleaseOption ? [{ value: 'prerelease', title: ' [1mPrerelease[22m - bump prerelease version' }] : []),
        { value: 'patch', title: ' [1mPatch[22m      - bug fixes; no API changes.' },
        { value: 'minor', title: ' [1mMinor[22m      - small feature; backwards compatible API changes.' },
        {
          value: 'none',
          title: ' [1mNone[22m       - this change does not affect the published package in any way.',
        },
        { value: 'major', title: ' [1mMajor[22m      - major feature; breaking changes.' },
      ].filter((choice) => !disallowedChangeTypes?.includes(choice.value as ChangeType)),
    };

    if (changeTypePrompt.choices!.length === 0) {
      console.log('No valid changeTypes available, aborting');
      return;
    }

    if (options.type && disallowedChangeTypes?.includes(options.type as ChangeType)) {
      console.log(`${options.type} type is not allowed, aborting`);
      return;
    }

    const descriptionPrompt: prompts.PromptObject<string> = {
      type: 'autocomplete',
      name: 'comment',
      message: 'Describe changes (type or choose one)',
      suggest: (input) => {
        return Promise.resolve([...recentMessages.filter((msg) => msg.startsWith(input)), input]);
      },
    };

    // Only include structured commit messages that map to an allowed change type.
    const allowedConventionalCommit = fromConventionalCommits.find((c) => !disallowedChangeTypes?.includes(c.type));
    const showChangeTypePrompt = !options.type && !allowedConventionalCommit && changeTypePrompt.choices!.length > 1;

    const defaultPrompt: DefaultPrompt = {
      changeType: showChangeTypePrompt ? changeTypePrompt : undefined,
      description: !options.message && !allowedConventionalCommit ? descriptionPrompt : undefined,
    };

    let questions = [defaultPrompt.changeType, defaultPrompt.description];

    if (packageInfo.combinedOptions.changeFilePrompt?.changePrompt) {
      questions = packageInfo.combinedOptions.changeFilePrompt?.changePrompt(defaultPrompt);
    }

    questions = questions.filter((q) => !!q);

    let response: { comment: string; type: ChangeType } = {
      type: options.type || allowedConventionalCommit?.type || 'none',
      comment: options.message || allowedConventionalCommit?.message || '',
    };

    if (questions.length > 0) {
      response = (await prompts(questions as prompts.PromptObject[])) as { comment: string; type: ChangeType };

      if (Object.keys(response).length === 0) {
        console.log('Cancelled, no change files are written');
        return;
      }

      // if type is absent in the user input, there are two possiblities for
      // proceeding next:
      // 1) if options.type is defined, use that
      // 2) otherwise, we hit the edge case when options.type is undefined
      //    and there was only one possible ChangeType to display, 'none'
      //    but we didn't display it due to showChangeTypePrompt === false;
      //    so set the type to 'none'
      if (!response.type) {
        if (!options.type) {
          console.log("WARN: change type 'none' assumed by default");
          console.log('(Not what you intended? Check the repo-level and package-level beachball configs.)');
        }
        response = { ...response, type: options.type || 'none' };
      }

      // fallback to the options.message if message is absent in the user input
      if (!response.comment && options.message) {
        response = { ...response, comment: options.message };
      }

      if (!isValidChangeType(response.type)) {
        console.error('Prompt response contains invalid change type.');
        return;
      }
    }

    packageChangeInfo[pkg] = {
      ...response,
      packageName: pkg,
      email: getUserEmail(cwd) || 'email not defined',
      dependentChangeType: options.dependentChangeType || (response.type === 'none' ? 'none' : 'patch'),
    };
  }

  return packageChangeInfo;
}
