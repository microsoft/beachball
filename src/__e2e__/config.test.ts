import fs from 'fs-extra';
import { RepositoryFactory } from '../fixtures/repository';
import * as process from 'process';
import { promisify } from 'util';
import { getOptions } from '../options/getOptions';

const writeFileAsync = promisify(fs.writeFile);

describe('config', () => {
  it('uses the branch name defined in beachball.config.js', async () => {
    const repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    const repo = await repositoryFactory.cloneRepository();
    const config = await inDirectory(repo.root!, async () => {
      await writeConfig('module.exports = { branch: "origin/main" };');
      return getOptions();
    });
    expect(config.branch).toEqual('origin/main');
  });
});

const writeConfig = async (contents: string) => {
  await writeFileAsync('beachball.config.js', contents);
};

const inDirectory = async <T>(directory: string, cb: () => T): Promise<T> => {
  const originalDirectory = process.cwd();
  process.chdir(directory);
  try {
    return await cb();
  } finally {
    process.chdir(originalDirectory);
  }
};
