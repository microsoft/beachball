import prompts from 'prompts';
import { ChangeType } from './ChangeInfo';

export interface DefaultPrompt {
  changeType: prompts.PromptObject<string> | undefined;
  description: prompts.PromptObject<string> | undefined;
}

/**
 * Mapping from change type to custom description.
 * - A string is used for all versions.
 * - An object can be used to provide different descriptions for 0.x versions and versions >= 1.
 * - Omitting a change type means it won't be shown in the prompt.
 */
export type ChangeTypeDescriptions = {
  [k in ChangeType]?:
    | string // Description for all versions
    | {
        /** Description for versions >= 1 */
        general: string;
        /** Description for 0.x versions */
        v0: string;
      };
};

/**
 * Options for customizing change file prompt.
 * The package name is provided so that the prompt can be customized by package if desired.
 */
export interface ChangeFilePromptOptions {
  /**
   * Get custom change file prompt questions.
   * The questions MUST result in an answers object `{ comment: string; type: ChangeType }`.
   * If you just want to customize the descriptions of each change type, use `changeTypeDescriptions`.
   * @param defaultPrompt Default prompt questions
   * @param pkg Package name, so that changelog customizations can be specified at the package level
   */
  changePrompt?(defaultPrompt: DefaultPrompt, pkg: string): prompts.PromptObject[];

  /**
   * Custom descriptions for each change type. This is good for if you only want to customize the
   * descriptions, not the whole prompt.
   *
   * Each description can either be a single string, or one string for 0.x versions (which follow
   * different semver rules) and one string for general use with versions >= 1.
   */
  changeTypeDescriptions?: ChangeTypeDescriptions;
}
