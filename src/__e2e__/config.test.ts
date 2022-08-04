import fs from 'fs-extra';
import { RepositoryFactory } from '../__fixtures__/repository';
import { getOptions } from '../options/getOptions';

const baseArgv = ['node.exe', 'bin.js'];

describe('config', () => {
  it('uses the branch name defined in beachball.config.js', () => {
    const repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.root!, () => {
      writeConfig('module.exports = { branch: "origin/main" };');
      return getOptions(baseArgv);
    });
    expect(config.branch).toEqual('origin/main');
  });
});

it('--config overrides configuration path', () => {
  const repositoryFactory = new RepositoryFactory();
  repositoryFactory.create();
  const repo = repositoryFactory.cloneRepository();
  const config = inDirectory(repo.root!, () => {
    writeConfig('module.exports = { branch: "origin/main" };');
    fs.writeFileSync('alternate.config.js', 'module.exports = { branch: "origin/foo" };');
    return getOptions([...baseArgv, '--config', 'alternate.config.js']);
  });
  expect(config.branch).toEqual('origin/foo');
});

const writeConfig = (contents: string) => {
  fs.writeFileSync('beachball.config.js', contents);
};

const inDirectory = <T>(directory: string, cb: () => T): T => {
  const originalDirectory = process.cwd();
  process.chdir(directory);
  try {
    return cb();
  } finally {
    process.chdir(originalDirectory);
  }
};
