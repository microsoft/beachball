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

/**
 * Uses `prompts` package to prompt for change type and description, fills in git user.email and scope
 */
export async function promptForChange(options: BeachballOptions): Promise<ChangeFileInfo[] | undefined> {
  const { branch, path: cwd } = options;
  let { package: specificPackage } = options;

  if (specificPackage && !Array.isArray(specificPackage)) {
    specificPackage = [specificPackage];
  }
  const packageInfos = getPackageInfos(cwd);
  const changedPackages = specificPackage || getChangedPackages(options, packageInfos);
  const recentMessages = getRecentCommitMessages(branch, cwd) || [];
  const packageChangeInfo: ChangeFileInfo[] = [];

  const packageGroups = getPackageGroups(packageInfos, options.path, options.groups);

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
      ].filter(choice => !disallowedChangeTypes?.includes(choice.value as ChangeType)),
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
      suggest: input => {
        return Promise.resolve([...recentMessages.filter(msg => msg.startsWith(input)), input]);
      },
    };

    const showChangeTypePrompt = !options.type && changeTypePrompt.choices!.length > 1;

    const defaultPrompt: DefaultPrompt = {
      changeType: showChangeTypePrompt ? changeTypePrompt : undefined,
      description: !options.message ? descriptionPrompt : undefined,
    };
    const defaultPrompts = [defaultPrompt.changeType, defaultPrompt.description];

    const questions = (
      packageInfo.combinedOptions.changeFilePrompt?.changePrompt?.(defaultPrompt, pkg) || defaultPrompts
    ).filter((q): q is prompts.PromptObject => !!q);

    let response: { comment: string; type: ChangeType } = {
      type: options.type || 'none',
      comment: options.message || '',
    };

    if (questions.length > 0) {
      let isCancelled = false;
      response = (await prompts(questions, {
        onCancel: () => {
          isCancelled = true;
        },
      })) as typeof response;

      if (isCancelled) {
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

    packageChangeInfo.push({
      ...response,
      packageName: pkg,
      email: getUserEmail(cwd) || 'email not defined',
      dependentChangeType: options.dependentChangeType || (response.type === 'none' ? 'none' : 'patch'),
    });
  }

  return packageChangeInfo;
}
