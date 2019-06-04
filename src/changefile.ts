import prompts from 'prompts';
import { getRecentCommitMessages } from './git';

export async function promptForChange() {
  const recentMessages = getRecentCommitMessages() || [];

  const response = await prompts({
    type: 'autocomplete',
    name: 'description',
    message: 'Describe your changes',
    suggest: input => {
      return Promise.resolve(recentMessages.find(msg => msg.startsWith(input)) || input);
    }
  });

  console.log(response); // => { value: 24 }
}

promptForChange();
