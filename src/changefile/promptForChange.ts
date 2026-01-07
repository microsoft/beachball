import prompts from 'prompts';
import type { ChangeFileInfo, ChangeType } from '../types/ChangeInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { isValidChangeType } from '../validation/isValidChangeType';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';
import { getQuestionsForPackage } from './getQuestionsForPackage';

export type ChangePromptResponse = { type?: ChangeType; comment?: string };

/**
 * Uses `prompts` package to prompt for change type and description.
 * (For easier testing, this function does not handle filesystem access.)
 */
export async function promptForChange(params: {
  changedPackages: string[];
  packageInfos: PackageInfos;
  packageGroups: PackageGroups;
  recentMessages: string[];
  email: string | null;
  options: Pick<
    BeachballOptions,
    'message' | 'type' | 'dependentChangeType' | 'changeFilePrompt' | 'disallowedChangeTypes'
  >;
}): Promise<ChangeFileInfo[] | undefined> {
  const { changedPackages, email, options } = params;
  if (!changedPackages.length) {
    return;
  }

  // Get the questions for each package first, in case one package has a validation issue
  const packageQuestions: { [pkg: string]: prompts.PromptObject[] } = {};
  for (const pkg of changedPackages) {
    const questions = getQuestionsForPackage({ pkg, ...params });
    if (!questions) {
      return; // validation issue
    }
    packageQuestions[pkg] = questions;
  }

  // Now prompt for each package
  const packageChangeInfo: ChangeFileInfo[] = [];
  for (const pkg of changedPackages) {
    const response = await _promptForPackageChange(packageQuestions[pkg], pkg);
    if (!response) {
      return; // user cancelled
    }

    const change = _getChangeFileInfoFromResponse({ response, pkg, email, options });
    if (!change) {
      return; // validation issue
    }
    packageChangeInfo.push(change);
  }

  return packageChangeInfo;
}

/**
 * Do the actual prompting.
 * @internal exported for testing
 */
export async function _promptForPackageChange(
  questions: prompts.PromptObject[],
  pkg: string
): Promise<ChangePromptResponse | undefined> {
  if (!questions.length) {
    // This MUST return an empty object rather than nothing, because returning nothing means the
    // prompt was cancelled and the whole change prompt process should end
    return {};
  }

  console.log('');
  console.log(`Please describe the changes for: ${pkg}`);

  let isCancelled = false;
  const onCancel = () => {
    isCancelled = true;
  };
  const response: ChangePromptResponse = await prompts(questions, { onCancel });

  if (isCancelled) {
    console.log('Cancelled, no change files are written');
  } else {
    return response;
  }
}

/**
 * Validate/update the response from the user and return the full change file info.
 * @internal exported for testing
 */
export function _getChangeFileInfoFromResponse(params: {
  response: ChangePromptResponse;
  pkg: string;
  email: string | null;
  options: Pick<BeachballOptions, 'type' | 'message' | 'dependentChangeType'>;
}): ChangeFileInfo | undefined {
  const { pkg, email, options } = params;
  let response = params.response;

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

  // prevent invalid change types from being entered via custom prompts
  if (!response.type || !isValidChangeType(response.type)) {
    console.error(`Prompt response contains invalid change type "${response.type}"`);
    return;
  }

  return {
    ...(response as Required<ChangePromptResponse>),
    packageName: pkg,
    email: email || 'email not defined',
    dependentChangeType: options.dependentChangeType || (response.type === 'none' ? 'none' : 'patch'),
  };
}
