import type prompts from 'prompts';

export interface DefaultPrompt {
  changeType: prompts.PromptObject<string> | undefined;
  description: prompts.PromptObject<string> | undefined;
}

/** Options for customizing change files and the change file prompt. */
export interface ChangeFileOptions {
  /**
   * Customize or add questions in the change file prompt (can be used to add custom fields).
   */
  changePrompt?(defaultPrompt: DefaultPrompt, pkgName: string): prompts.PromptObject[];

  /**
   * Whether to include the `git user.email` in the change file, if available.
   * If false, the email field is omitted from the change file.
   * @default true
   */
  // The default is handled in packages/beachball/src/commands/change.ts instead of in
  // getDefaultOptions, since it's only used in one place and this prevents needing to
  // handle deep options merging.
  includeEmail?: boolean;
}
