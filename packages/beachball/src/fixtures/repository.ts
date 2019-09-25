import { exec as nativeExec } from 'child_process';
import * as process from 'process';
import * as tmp from 'tmp';
import path from 'path';
import * as fs from 'fs-extra';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const removeAsync = promisify(fs.remove);

const packageJson = JSON.stringify({
  name: 'foo',
  version: '1.0.0',
});

async function dirAsync(options: tmp.DirOptions): Promise<tmp.DirResult> {
  return new Promise((resolve, reject) => {
    tmp.dir(options, (err, name, removeCallback) => {
      if (err) {
        reject(err);
      } else {
        resolve({ name, removeCallback });
      }
    });
  });
}

interface PsResult {
  stderr: string;
  status: Error | null;
  stdout: string;
}

function exec(command: string): Promise<PsResult> {
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

async function runCommands(commands: string[]): Promise<void> {
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

async function runInDirectory(targetDirectory: string, commands: string[]) {
  const originalDirectory = process.cwd();
  process.chdir(targetDirectory);
  await runCommands(commands);
  process.chdir(originalDirectory);
}

async function touchAsync(filename: string) {
  const time = new Date();

  try {
    await fs.utimes(filename, time, time);
  } catch (err) {
    await fs.close(await fs.open(filename, 'w'));
  }
}

export class RepositoryFactory {
  root?: tmp.DirResult;

  async create(): Promise<void> {
    const originalDirectory = process.cwd();

    this.root = await dirAsync({ prefix: 'beachball-repository-upstream-' });
    process.chdir(this.root!.name);
    await runCommands(['git init --bare']);

    const tmpRepo = new Repository();
    await tmpRepo.initialize();
    await tmpRepo.cloneFrom(this.root.name);
    await tmpRepo.commitChange('README');

    await writeFileAsync(path.join(tmpRepo.rootPath, 'package.json'), packageJson);
    await tmpRepo.commitChange('package.json');
    await tmpRepo.push('origin', 'HEAD:master');

    process.chdir(originalDirectory);
  }

  async cloneRepository(): Promise<Repository> {
    if (!this.root) {
      throw new Error('Must create before cloning');
    }
    const newRepo = new Repository();
    await newRepo.initialize();
    await newRepo.cloneFrom(this.root.name);
    return newRepo;
  }
}

export class Repository {
  root?: tmp.DirResult;

  async initialize() {
    this.root = await dirAsync({ prefix: 'beachball-repository-cloned-' });
  }

  get rootPath(): string {
    if (!this.root) {
      throw new Error('Must initialize before accessing path');
    }
    return this.root.name;
  }

  async cloneFrom(path: string, originName?: string): Promise<void> {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    await runInDirectory(this.root.name, [
      `git clone ${originName ? '-o ' + originName + ' ' : ''}${path} .`,
      'git config user.email ci@example.com',
      'git config user.name CIUSER',
    ]);
  }

  async commitChange(newFilename: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    await touchAsync(path.join(this.root.name, newFilename));

    await runInDirectory(this.root.name, [`git add ${newFilename}`, `git commit -m '${newFilename}'`]);
  }

  async branch(branchName: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }
    await runInDirectory(this.root.name, [`git checkout -b ${branchName}`]);
  }

  async push(remote: string, branch: string) {
    if (!this.root) {
      throw new Error('Must initialize before push');
    }

    await runInDirectory(this.root.name, [`git push ${remote} ${branch}`]);
  }

  async cleanUp() {
    if (!this.root) {
      throw new Error('Must initialize before clean up');
    }

    await removeAsync(this.root.name);
  }
}
