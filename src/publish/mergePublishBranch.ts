import { git } from '../git';

export function mergePublishBranch(publishBranch: string, branch: string, message: string, cwd: string) {
  let result: ReturnType<typeof git>;
  let mergeSteps = [
    ['add', '.'],
    ['commit', '-m', message],
    ['checkout', branch],
    ['merge', '-X', 'ours', publishBranch],
    ['branch', '-D', publishBranch],
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
