import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publish } from '../commands/publish';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import type { ChangeFileInfo } from '../types/ChangeInfo';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { PackageJson } from '../types/PackageInfo';
import { getParsedOptions } from '../options/getOptions';
import { readJson } from '../object/readJson';

describe('publish command (git)', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository | undefined;

  initMockLogs();

  function getOptionsAndPackages(cwd?: string) {
    cwd ??= repo!.rootPath;
    const parsedOptions = getParsedOptions({
      cwd,
      argv: ['node', 'beachball', 'publish', '--yes', '--package', 'foo'],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        registry: 'http://localhost:99999/',
        message: 'apply package updates',
        publish: false,
        bumpDeps: false,
        tag: 'latest',
        access: 'public',
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    return { packageInfos, options: parsedOptions.options, parsedOptions };
  }

  beforeEach(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterEach(() => {
    repositoryFactory.cleanUp();
    repo = undefined;
  });

  it('can perform a successful git push', async () => {
    repo = repositoryFactory.cloneRepository();

    const { options, packageInfos } = getOptionsAndPackages();
    generateChangeFiles(['foo'], options);
    repo.push();

    await publish(options, packageInfos);

    const newRepo = repositoryFactory.cloneRepository();

    const packageJson = readJson<PackageJson>(newRepo.pathTo('package.json'));

    expect(packageJson.version).toBe('1.1.0');
  });

  it('can handle a merge when there are change files present', async () => {
    // 1. clone a new repo1, write a change file in repo1
    const repo1 = repositoryFactory.cloneRepository();
    const { options: options1, packageInfos: packageInfos1 } = getOptionsAndPackages(repo1.rootPath);
    generateChangeFiles(['foo'], options1);
    repo1.push();

    // 2. simulate the start of a publish from repo1
    const publishBranch = 'publish_test';
    repo1.checkout('-b', publishBranch);

    const bumpInfo = gatherBumpInfo(options1, packageInfos1);

    // 3. Meanwhile, in repo2, also create a new change file
    const repo2 = repositoryFactory.cloneRepository();
    generateChangeFiles(['foo2'], { ...options1, path: repo2.rootPath });
    repo2.push();

    // 4. Pretend to continue on with repo1's publish
    await bumpAndPush(bumpInfo, publishBranch, options1);

    // 5. In a brand new cloned repo, make assertions
    const newRepo = repositoryFactory.cloneRepository();
    const changeFiles = getChangeFiles({ ...options1, path: newRepo.rootPath });
    expect(changeFiles).toHaveLength(1);
    const changeFileContent = readJson<ChangeFileInfo>(changeFiles[0]);
    expect(changeFileContent.packageName).toBe('foo2');
  });
});
