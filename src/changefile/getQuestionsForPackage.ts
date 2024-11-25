import prompts from 'prompts';
import semver from 'semver';
import { ChangeType } from '../types/ChangeInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { DefaultPrompt } from '../types/ChangeFilePrompt';
import { getDisallowedChangeTypes } from './getDisallowedChangeTypes';
import { PackageGroups, PackageInfos } from '../types/PackageInfo';

/**
 * Build the list of questions to ask the user for this package.
 * Also validates the options and returns undefined if there's an issue.
 */
export function getQuestionsForPackage(params: {
  pkg: string;
  packageInfos: PackageInfos;
  packageGroups: PackageGroups;
  options: Pick<BeachballOptions, 'message' | 'type'>;
  recentMessages: string[];
}): prompts.PromptObject[] | undefined {
  const { pkg, packageInfos, options, recentMessages } = params;
  const packageInfo = packageInfos[pkg];

  const changeTypePrompt = getChangeTypePrompt(params);
  if (!changeTypePrompt) {
    return;
  }

  const defaultPrompt: DefaultPrompt = {
    changeType: !options.type && changeTypePrompt.choices.length > 1 ? changeTypePrompt : undefined,
    description: !options.message ? getDescriptionPrompt(recentMessages) : undefined,
  };

  const questions =
    packageInfo.combinedOptions.changeFilePrompt?.changePrompt?.(defaultPrompt, pkg) || Object.values(defaultPrompt);

  return questions.filter((q): q is prompts.PromptObject => !!q);
}

function getChangeTypePrompt(params: {
  pkg: string;
  packageInfos: PackageInfos;
  packageGroups: PackageGroups;
  options: Pick<BeachballOptions, 'type'>;
}): (prompts.PromptObject & Required<Pick<prompts.PromptObject, 'choices'>>) | undefined {
  const { pkg, packageInfos, packageGroups, options } = params;
  const packageInfo = packageInfos[pkg];

  const disallowedChangeTypes = getDisallowedChangeTypes(pkg, packageInfos, packageGroups) || [];

  if (options.type && disallowedChangeTypes.includes(options.type)) {
    console.error(`Change type "${options.type}" is not allowed for package "${pkg}"`);
    return;
  }

  const showPrereleaseOption = !!semver.prerelease(packageInfo.version);
  const changeTypeChoices: prompts.Choice[] = [
    ...(showPrereleaseOption ? [{ value: 'prerelease', title: ' [1mPrerelease[22m - bump prerelease version' }] : []),
    { value: 'patch', title: ' [1mPatch[22m      - bug fixes; no API changes.' },
    { value: 'minor', title: ' [1mMinor[22m      - small feature; backwards compatible API changes.' },
    {
      value: 'none',
      title: ' [1mNone[22m       - this change does not affect the published package in any way.',
    },
    { value: 'major', title: ' [1mMajor[22m      - major feature; breaking changes.' },
  ].filter(choice => !disallowedChangeTypes?.includes(choice.value as ChangeType));

  if (!changeTypeChoices.length) {
    console.error(`No valid change types available for package "${pkg}"`);
    return;
  }

  return {
    type: 'select',
    name: 'type',
    message: 'Change type',
    choices: changeTypeChoices,
  };
}

function getDescriptionPrompt(recentMessages: string[]): prompts.PromptObject {
  // Do case-insensitive filtering of recent commit messages
  const recentMessageChoices: prompts.Choice[] = recentMessages.map(msg => ({ title: msg }));
  const getSuggestions = (input: string) =>
    input
      ? recentMessageChoices.filter(({ title }) => title.toLowerCase().startsWith(input.toLowerCase()))
      : recentMessageChoices;

  return {
    type: 'autocomplete',
    name: 'comment',
    message: 'Describe changes (type or choose one)',
    choices: recentMessageChoices,
    suggest: (input: string) => Promise.resolve(getSuggestions(input)),
    // prompts doesn't have proper support for "freeform" input (value not in the list), and the
    // previously implemented hack of adding the input to the returned list from `suggest`
    // no longer works. So this new hack adds the current input as the fallback.
    // https://github.com/terkelg/prompts/issues/131
    onState: function (this: { input: string; value: string; fallback: string }) {
      // If there are no suggestions, update the value to match the input, and unset the fallback
      // (this.suggestions may be out of date if the user pasted text ending with a newline, so re-calculate)
      if (!getSuggestions(this.input).length) {
        this.value = this.input;
        this.fallback = '';
      }
    },
  };
}
