import { describe, expect, it, beforeAll, afterAll, afterEach, jest, beforeEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { Registry } from '../__fixtures__/registry';
import { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { tmpdir } from '../__fixtures__/tmpdir';
import { sync } from '../commands/sync';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { infoFromPackageJson } from '../monorepo/infoFromPackageJson';
import { packagePublish } from '../packageManager/packagePublish';
import { getDefaultOptions } from '../options/getDefaultOptions';
import { BeachballOptions } from '../types/BeachballOptions';

describe('sync command (e2e)', () => {
  const factory = new RepositoryFactory({
    folders: {
      packages: {
        foopkg: { version: '1.0.0' },
        barpkg: { version: '2.2.0' },
        bazpkg: { version: '3.0.0' },
      },
    },
  });
  let registry: Registry;
  const tempDirs: string[] = [];

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
    const dir = tmpdir();
    tempDirs.push(dir);
    const packageJsonFile = path.join(dir, 'package.json');
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
    registry = new Registry(__filename);
    jest.setTimeout(30000);
    factory.init();
  });

  afterAll(() => {
    registry.stop();
    factory.cleanUp();
  });

  beforeEach(async () => {
    await registry.reset();
  });

  afterEach(async () => {
    factory.reset();
    tempDirs.forEach(dir => fs.removeSync(dir));
    tempDirs.splice(0, tempDirs.length);
  });

  it('can perform a successful sync', async () => {
    const repo = factory.defaultRepo;

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    expect(
      (await packagePublish(packageInfosBeforeSync['foopkg'], { registry: registry.getUrl() })).success
    ).toBeTruthy();
    expect(
      (await packagePublish(packageInfosBeforeSync['barpkg'], { registry: registry.getUrl() })).success
    ).toBeTruthy();

    const newFooInfo = createTempPackage('foopkg', '1.2.0');
    const newBarInfo = createTempPackage('barpkg', '3.0.0');

    expect((await packagePublish(newFooInfo, { registry: registry.getUrl() })).success).toBeTruthy();
    expect((await packagePublish(newBarInfo, { registry: registry.getUrl() })).success).toBeTruthy();

    await sync(getOptions(repo, { tag: '' }));

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['foopkg'].version).toEqual('1.2.0');
    expect(packageInfosAfterSync['barpkg'].version).toEqual('3.0.0');
    expect(packageInfosAfterSync['bazpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync using dist tag', async () => {
    const repo = factory.defaultRepo;

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    expect(
      (await packagePublish(packageInfosBeforeSync['foopkg'], { registry: registry.getUrl() })).success
    ).toBeTruthy();
    expect(
      (await packagePublish(packageInfosBeforeSync['barpkg'], { registry: registry.getUrl() })).success
    ).toBeTruthy();

    const newFooInfo = createTempPackage('foopkg', '2.0.0', 'beta');
    const newBarInfo = createTempPackage('barpkg', '3.0.0', 'latest');

    expect((await packagePublish(newFooInfo, { registry: registry.getUrl() })).success).toBeTruthy();
    expect((await packagePublish(newBarInfo, { registry: registry.getUrl() })).success).toBeTruthy();

    await sync(getOptions(repo, { tag: 'beta' }));

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['foopkg'].version).toEqual('2.0.0');
    expect(packageInfosAfterSync['barpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['bazpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync by forcing dist tag version', async () => {
    const repo = factory.defaultRepo;

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    const foopkg = packageInfosBeforeSync['foopkg'];
    const barpkg = packageInfosBeforeSync['barpkg'];

    foopkg.combinedOptions.tag = 'latest';
    barpkg.combinedOptions.tag = 'latest';

    expect((await packagePublish(foopkg, { registry: registry.getUrl() })).success).toBeTruthy();
    expect((await packagePublish(barpkg, { registry: registry.getUrl() })).success).toBeTruthy();

    const newFooInfo = createTempPackage('foopkg', '1.0.0-1');
    const newBarInfo = createTempPackage('barpkg', '3.0.0');

    newFooInfo.combinedOptions.tag = 'prerelease';
    newBarInfo.combinedOptions.tag = 'latest';

    expect((await packagePublish(newFooInfo, { registry: registry.getUrl() })).success).toBeTruthy();
    expect((await packagePublish(newBarInfo, { registry: registry.getUrl() })).success).toBeTruthy();

    await sync(getOptions(repo, { tag: 'prerelease', forceVersions: true }));

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['foopkg'].version).toEqual('1.0.0-1');
    expect(packageInfosAfterSync['barpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['bazpkg'].version).toEqual('3.0.0');
  });
});
