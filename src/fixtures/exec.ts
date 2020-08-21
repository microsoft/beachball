import { exec as nativeExec } from 'child_process';

export interface PsResult {
  stderr: string;
  error: Error | null;
  stdout: string;
}

export function exec(command: string): Promise<PsResult> {
  return new Promise(function(resolve, reject) {
    nativeExec(command, (error, stdout, stderr) => {
      const result = {
        stderr,
        stdout,
        error,
      };
      if (error) {
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
}

export async function runCommands(commands: string[]): Promise<PsResult[]> {
  const results: PsResult[] = [];
  for (let i = 0; i < commands.length; i++) {
    try {
      results.push(await exec(commands[i]));
    } catch (e) {
      console.error('runCommands failed:', e);
      throw e;
    }
  }
  return results;
}

/**
 * @returns The results of the commands run
 */
export async function runInDirectory(targetDirectory: string, commands: string[]): Promise<PsResult[]> {
  const originalDirectory = process.cwd();
  process.chdir(targetDirectory);
  const results = await runCommands(commands);
  process.chdir(originalDirectory);
  return results;
}
