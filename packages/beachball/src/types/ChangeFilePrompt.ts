import prompts from 'prompts';

export interface DefaultPrompt {
  changeType: prompts.PromptObject<string> | undefined;
  description: prompts.PromptObject<string> | undefined;
}

/**
 * Options for customizing change file prompt.
 */
export interface ChangeFilePromptOptions {
  changePrompt?(defaultPrompt: DefaultPrompt): prompts.PromptObject[];
}
