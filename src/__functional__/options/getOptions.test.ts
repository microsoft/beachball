import { describe, expect, it, beforeAll, afterEach, afterAll } from '@jest/globals';
import fs from 'fs-extra';
import { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getOptions } from '../../options/getOptions';

const baseArgv = ['node.exe', 'bin.js'];

describe('getOptions', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository;

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
  });

  afterEach(() => {
    repo.git(['clean', '-fdx']);
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('uses the branch name defined in beachball.config.js', () => {
    const config = inDirectory(repo.rootPath, () => {
      fs.writeFileSync('beachball.config.js', 'module.exports = { branch: "origin/foo" };');
      return getOptions(baseArgv);
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('--config overrides configuration path', () => {
    const config = inDirectory(repo.rootPath, () => {
      fs.writeFileSync('beachball.config.js', 'module.exports = { branch: "origin/main" };');
      fs.writeFileSync('alternate.config.js', 'module.exports = { branch: "origin/foo" };');
      return getOptions([...baseArgv, '--config', 'alternate.config.js']);
    });
    expect(config.branch).toEqual('origin/foo');
  });
});

const inDirectory = <T>(directory: string, cb: () => T): T => {
  const originalDirectory = process.cwd();
  process.chdir(directory);
  try {
    return cb();
  } finally {
    process.chdir(originalDirectory);
  }
};
