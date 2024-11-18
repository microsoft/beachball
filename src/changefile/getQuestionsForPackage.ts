import prompts from 'prompts';
import semver from 'semver';
import { ChangeType } from '../types/ChangeInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeTypeDescriptions, DefaultPrompt } from '../types/ChangeFilePrompt';
import { getDisallowedChangeTypes } from './getDisallowedChangeTypes';
import { PackageGroups, PackageInfos } from '../types/PackageInfo';
import { PrereleaseChangeTypes } from './changeTypes';

const defaultChangeTypeDescriptions: Required<ChangeTypeDescriptions> = {
  prerelease: 'bump prerelease version',
  // TODO: these pre* types are included for completeness but currently won't be shown
  prepatch: 'bump to prerelease of the next patch version',
  preminor: 'bump to prerelease of the next minor version',
  premajor: 'bump to prerelease of the next major version',
  patch: {
    general: 'bug fixes; no API changes',
    v0: 'bug fixes; new features; backwards-compatible API changes (ok in patches for version < 1)',
  },
  minor: {
    general: 'new feature; backwards-compatible API changes',
    v0: 'breaking changes; major feature (ok in minors for version < 1)',
  },
  none: 'this change does not affect the published package in any way',
  major: {
    general: 'breaking changes; major feature',
    v0: 'official release',
  },
};

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
    changeType: !options.type && changeTypePrompt.choices!.length > 1 ? changeTypePrompt : undefined,
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
}): prompts.PromptObject<string> | undefined {
  const { pkg, packageInfos, packageGroups, options } = params;
  const packageInfo = packageInfos[pkg];

  const disallowedChangeTypes = getDisallowedChangeTypes(pkg, packageInfos, packageGroups) || [];

  if (options.type && disallowedChangeTypes.includes(options.type as ChangeType)) {
    console.error(`Change type "${options.type}" is not allowed for package "${pkg}"`);
    return;
  }

  // TODO: conditionally add other prerelease types later
  const omittedChangeTypes = new Set([...disallowedChangeTypes, ...PrereleaseChangeTypes]);
  // if the current version includes a prerelease part, show the prerelease option
  if (semver.prerelease(packageInfo.version)) {
    omittedChangeTypes.add('prerelease');
  }
  const isVersion0 = semver.major(packageInfo.version) === 0;
  // this is used to determine padding length since it's the longest
  const labelPadEnd = getChangeTypeLabel('prerelease').length;

  const changeTypeChoices: prompts.Choice[] = Object.entries(
    packageInfo.combinedOptions.changeFilePrompt?.changeTypeDescriptions || defaultChangeTypeDescriptions
  )
    .filter(([changeType]) => !omittedChangeTypes.has(changeType as ChangeType))
    .map(([changeType, descriptions]): prompts.Choice => {
      const label = getChangeTypeLabel(changeType);
      // use the appropriate message for 0.x or >= 1.x (if different)
      const description =
        typeof descriptions === 'string' ? descriptions : isVersion0 ? descriptions.v0 : descriptions.general;
      return {
        value: changeType,
        title: ` ${label.padEnd(labelPadEnd)} - ${description}`,
      };
    });

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

function getChangeTypeLabel(changeType: string): string {
  // bold formatting
  return `[1m${changeType[0].toUpperCase() + changeType.slice(1)}[22m`;
}

function getDescriptionPrompt(recentMessages: string[]): prompts.PromptObject<string> {
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
    onState: function (this: any, state: any) {
      // If there are no suggestions, update the value to match the input, and unset the fallback
      // (this.suggestions may be out of date if the user pasted text ending with a newline, so re-calculate)
      if (!getSuggestions(this.input).length) {
        this.value = this.input;
        this.fallback = '';
      }
    },
  };
}
