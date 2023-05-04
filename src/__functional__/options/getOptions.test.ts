import { describe, expect, it, beforeAll, afterEach, afterAll } from '@jest/globals';
import fs from 'fs-extra';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getOptions } from '../../options/getOptions';

const baseArgv = ['node.exe', 'bin.js'];

describe('getOptions', () => {
  const factory = new RepositoryFactory('single');
  let repoRoot: string;

  beforeAll(() => {
    factory.init();
    repoRoot = factory.defaultRepo.rootPath;
  });

  afterEach(() => {
    factory.reset();
  });

  afterAll(() => {
    factory.cleanUp();
  });

  it('uses the branch name defined in beachball.config.js', () => {
    const config = inDirectory(repoRoot, () => {
      fs.writeFileSync('beachball.config.js', 'module.exports = { branch: "origin/foo" };');
      return getOptions(baseArgv);
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('--config overrides configuration path', () => {
    const config = inDirectory(repoRoot, () => {
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
