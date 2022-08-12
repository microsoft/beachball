import fs from 'fs-extra';
import path from 'path';
import * as tmp from 'tmp';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { Registry } from '../__fixtures__/registry';
import { Repository, RepositoryFactory } from '../__fixtures__/repository';
import { sync } from '../commands/sync';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { infoFromPackageJson } from '../monorepo/infoFromPackageJson';
import { packagePublish } from '../packageManager/packagePublish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import { BeachballOptions } from '../types/BeachballOptions';

function createRepoPackage(repo: Repository, name: string, version: string) {
  const packageJson = {
    name: name,
    version: version,
  };

  repo.commitChange(`packages/${name}/package.json`, JSON.stringify(packageJson));
}

describe('sync command (e2e)', () => {
  let repositoryFactory: RepositoryFactory;
  let registry: Registry;
  const tempDirs: tmp.DirResult[] = [];

  initMockLogs();

  function getOptions(repo: Repository, overrides?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      branch: defaultRemoteBranchName,
      path: repo.rootPath,
      registry: registry.getUrl(),
      command: 'sync',
      publish: false,
      bumpDeps: false,
      push: false,
      gitTags: false,
      yes: true,
      access: 'public',
      bump: false,
      generateChangelog: false,
      dependentChangeType: null,
      ...overrides,
    };
  }

  function createTempPackage(name: string, version: string, tag: string = 'latest') {
    const dir = tmp.dirSync({ unsafeCleanup: true });
    tempDirs.push(dir);
    const packageJsonFile = path.join(dir.name, 'package.json');
    const packageJson: any = {
      name: name,
      version: version,
      beachball: {
        tag,
      },
    };

    fs.writeJSONSync(packageJsonFile, packageJson, { spaces: 2 });
    return infoFromPackageJson(packageJson, packageJsonFile);
  }

  beforeAll(() => {
    registry = new Registry();
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  beforeEach(async () => {
    repositoryFactory = new RepositoryFactory();
    await registry.reset();
  });

  afterEach(() => {
    repositoryFactory.cleanUp();
    tempDirs.forEach(dir => dir.removeCallback());
    tempDirs.splice(0, tempDirs.length);
  });

  it('can perform a successful sync', async () => {
    const repo = repositoryFactory.cloneRepository();

    createRepoPackage(repo, 'foopkg', '1.0.0');
    createRepoPackage(repo, 'barpkg', '2.2.0');
    createRepoPackage(repo, 'bazpkg', '3.0.0');

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    expect((await packagePublish(packageInfosBeforeSync['foopkg'], registry.getUrl(), '', '')).success).toBeTruthy();
    expect((await packagePublish(packageInfosBeforeSync['barpkg'], registry.getUrl(), '', '')).success).toBeTruthy();

    const newFooInfo = createTempPackage('foopkg', '1.2.0');
    const newBarInfo = createTempPackage('barpkg', '3.0.0');

    expect((await packagePublish(newFooInfo, registry.getUrl(), '', '')).success).toBeTruthy();
    expect((await packagePublish(newBarInfo, registry.getUrl(), '', '')).success).toBeTruthy();

    await sync(getOptions(repo, { tag: '' }));

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['foopkg'].version).toEqual('1.2.0');
    expect(packageInfosAfterSync['barpkg'].version).toEqual('3.0.0');
    expect(packageInfosAfterSync['bazpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync using dist tag', async () => {
    const repo = repositoryFactory.cloneRepository();

    createRepoPackage(repo, 'apkg', '1.0.0');
    createRepoPackage(repo, 'bpkg', '2.2.0');
    createRepoPackage(repo, 'cpkg', '3.0.0');

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    expect((await packagePublish(packageInfosBeforeSync['apkg'], registry.getUrl(), '', '')).success).toBeTruthy();
    expect((await packagePublish(packageInfosBeforeSync['bpkg'], registry.getUrl(), '', '')).success).toBeTruthy();

    const newFooInfo = createTempPackage('apkg', '2.0.0', 'beta');
    const newBarInfo = createTempPackage('bpkg', '3.0.0', 'latest');

    expect((await packagePublish(newFooInfo, registry.getUrl(), '', '')).success).toBeTruthy();
    expect((await packagePublish(newBarInfo, registry.getUrl(), '', '')).success).toBeTruthy();

    await sync(getOptions(repo, { tag: 'beta' }));

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['apkg'].version).toEqual('2.0.0');
    expect(packageInfosAfterSync['bpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['cpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync by forcing dist tag version', async () => {
    const repo = repositoryFactory.cloneRepository();

    createRepoPackage(repo, 'epkg', '1.0.0');
    createRepoPackage(repo, 'fpkg', '2.2.0');
    createRepoPackage(repo, 'gpkg', '3.0.0');

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    const epkg = packageInfosBeforeSync['epkg'];
    const fpkg = packageInfosBeforeSync['fpkg'];

    epkg.combinedOptions.tag = 'latest';
    fpkg.combinedOptions.tag = 'latest';

    expect((await packagePublish(epkg, registry.getUrl(), '', '')).success).toBeTruthy();
    expect((await packagePublish(fpkg, registry.getUrl(), '', '')).success).toBeTruthy();

    const newFooInfo = createTempPackage('epkg', '1.0.0-1');
    const newBarInfo = createTempPackage('fpkg', '3.0.0');

    newFooInfo.combinedOptions.tag = 'prerelease';
    newBarInfo.combinedOptions.tag = 'latest';

    expect((await packagePublish(newFooInfo, registry.getUrl(), '', '')).success).toBeTruthy();
    expect((await packagePublish(newBarInfo, registry.getUrl(), '', '')).success).toBeTruthy();

    await sync(getOptions(repo, { tag: 'prerelease', forceVersions: true }));

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['epkg'].version).toEqual('1.0.0-1');
    expect(packageInfosAfterSync['fpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['gpkg'].version).toEqual('3.0.0');
  });
});
