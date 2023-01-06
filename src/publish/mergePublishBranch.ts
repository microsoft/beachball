import { git, GitProcessOutput } from 'workspace-tools';
import { BeachballOptions } from '../types/BeachballOptions';

export async function mergePublishBranch(
  publishBranch: string,
  branch: string,
  message: string,
  cwd: string,
  options: BeachballOptions
) {
  await precommitHook(options);

  let result: GitProcessOutput;
  let mergeSteps = [
    ['add', '.'],
    ['commit', '-m', message, '--no-verify'],
    ['checkout', branch],
    ['merge', '-X', 'ours', publishBranch],
  ];

  for (let index = 0; index < mergeSteps.length; index++) {
    const step = mergeSteps[index];
    result = git(step, { cwd });
    if (!result.success) {
      console.error(`mergePublishBranch (${index + 1} / ${mergeSteps.length}) - trying to run "git ${step.join(' ')}"`);
      console.error(result.stdout && result.stdout.toString().trim());
      console.error(result.stderr && result.stderr.toString().trim());
      return result;
    }
  }
  return result!;
}

/** Calls the `precommit` hook specified in `options` */
async function precommitHook(options: BeachballOptions) {
  const hook = options.hooks?.precommit;
  if (!hook) {
    return;
  }

  await hook(options.path);
}
