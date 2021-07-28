import fs from 'fs-extra';
import { RepositoryFactory } from '../fixtures/repository';
import { getOptions } from '../options/getOptions';

const baseArgv = ['node.exe', 'bin.js'];

describe('config', () => {
  it('uses the branch name defined in beachball.config.js', async () => {
    const repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    const config = await inDirectory(repo.root!, async () => {
      await writeConfig('module.exports = { branch: "origin/main" };');
      return getOptions(baseArgv);
    });
    expect(config.branch).toEqual('origin/main');
  });
});

it('--config overrides configuration path', async () => {
  const repositoryFactory = new RepositoryFactory();
  repositoryFactory.create();
  const repo = repositoryFactory.cloneRepository();
  const config = await inDirectory(repo.root!, async () => {
    await writeConfig('module.exports = { branch: "origin/main" };');
    await fs.writeFile('alternate.config.js', 'module.exports = { branch: "origin/foo" };');
    return getOptions([...baseArgv, '--config', 'alternate.config.js']);
  });
  expect(config.branch).toEqual('origin/foo');
});

const writeConfig = async (contents: string) => {
  await fs.writeFile('beachball.config.js', contents);
};

const inDirectory = async <T>(directory: string, cb: () => Promise<T>): Promise<T> => {
  const originalDirectory = process.cwd();
  process.chdir(directory);
  try {
    return await cb();
  } finally {
    process.chdir(originalDirectory);
  }
};
