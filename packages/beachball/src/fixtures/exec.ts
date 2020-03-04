import { exec as nativeExec } from 'child_process';

export interface PsResult {
  stderr: string;
  status: Error | null;
  stdout: string;
}

export function exec(command: string): Promise<PsResult> {
  return new Promise(function(resolve, reject) {
    nativeExec(command, (status, stdout, stderr) => {
      const result = {
        stderr,
        stdout,
        status,
      };
      if (status) {
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
}

export async function runCommands(commands: string[]): Promise<void> {
  for (let i = 0; i < commands.length; i++) {
    try {
      await exec(commands[i]);
    } catch (e) {
      console.error('runCommands failed:');
      console.error(e.stdout);
      console.error(e.stderr);
      console.error(e);
      console.error(e.message);
      throw e;
    }
  }
}

export async function runInDirectory(targetDirectory: string, commands: string[]) {
  const originalDirectory = process.cwd();
  process.chdir(targetDirectory);
  await runCommands(commands);
  process.chdir(originalDirectory);
}
