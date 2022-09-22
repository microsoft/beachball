import prompts from 'prompts';

export interface DefaultPrompt {
  changeType: prompts.PromptObject<string> | undefined;
  description: prompts.PromptObject<string> | undefined;
}

/**
 * Options for customizing change file prompt.
 * The package name is provided so that the prompt can be customized by package if desired.
 */
export interface ChangeFilePromptOptions {
  changePrompt?(defaultPrompt: DefaultPrompt, pkg: string): prompts.PromptObject[];
}
