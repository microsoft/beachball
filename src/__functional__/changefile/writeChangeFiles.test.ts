import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import type { ChangeFileInfo, ChangeInfoMultiple } from '../../types/ChangeInfo';
import { writeChangeFiles } from '../../changefile/writeChangeFiles';
import { getChangeFiles } from '../../__fixtures__/changeFiles';
import { listAllTrackedFiles } from 'workspace-tools';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import type { Repository } from '../../__fixtures__/repository';

const uuidRegex = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/;
const uuidGeneric = '00000000-0000-0000-0000-000000000000';

function cleanChangeFilePaths(root: string, changeFiles: string[]) {
  root = root.replace(/\\/g, '/');
  return changeFiles.map(changeFile =>
    changeFile.replace(/\\/g, '/').replace(root, '').replace(uuidRegex, uuidGeneric).replace(/^\//, '')
  );
}

describe('writeChangeFiles', () => {
  let monorepoFactory: RepositoryFactory;
  let repo: Repository;

  initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      ...options,
    };
  }

  beforeAll(() => {
    // These tests can share the same repo factories because they don't push to origin
    // (the actual tests run against a clone)
    monorepoFactory = new RepositoryFactory('monorepo');
    repo = monorepoFactory.cloneRepository();
  });

  afterEach(() => {
    repo?.resetAndClean();
  });

  afterAll(() => {
    monorepoFactory.cleanUp();
  });

  it('writes individual change files', () => {
    const previousHead = repo.getCurrentHash();
    const options = getOptions();

    writeChangeFiles([{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[], options);

    const expectedFiles = [`change/bar-${uuidGeneric}.json`, `change/foo-${uuidGeneric}.json`];

    // change files are created
    const changeFiles = getChangeFiles(options);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFiles);

    // and tracked
    const trackedFiles = listAllTrackedFiles(['change/*'], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFiles);

    // and committed
    expect(repo.getCurrentHash()).not.toEqual(previousHead);

    // also verify contents of one file
    const changeFileContents = fs.readJSONSync(changeFiles[0]) as ChangeFileInfo;
    expect(changeFileContents).toEqual({ packageName: 'bar' });
  });

  it('respects changeDir option', () => {
    const testChangeDir = 'myChangeDir';
    const options = getOptions({ changeDir: testChangeDir });

    writeChangeFiles([{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[], options);

    const expectedFiles = [`${testChangeDir}/bar-${uuidGeneric}.json`, `${testChangeDir}/foo-${uuidGeneric}.json`];

    // change files are created
    const changeFiles = getChangeFiles(options);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFiles);

    // and tracked
    const trackedFiles = listAllTrackedFiles([`${testChangeDir}/*`], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFiles);
  });

  it('respects commit=false', () => {
    const previousHead = repo.getCurrentHash();

    const options = getOptions({ commit: false });

    writeChangeFiles([{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[], options);

    const expectedFiles = [`change/bar-${uuidGeneric}.json`, `change/foo-${uuidGeneric}.json`];

    // change files are created
    const changeFiles = getChangeFiles(options);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFiles);

    // and tracked
    const trackedFiles = listAllTrackedFiles(['change/*'], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFiles);

    // but NOT committed
    expect(repo.getCurrentHash()).toEqual(previousHead);
  });

  it('writes grouped change files', () => {
    const options = getOptions({
      groupChanges: true,
    });

    writeChangeFiles([{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[], options);

    const expectedFile = [`change/change-${uuidGeneric}.json`];

    const changeFiles = getChangeFiles(options);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFile);

    const trackedFiles = listAllTrackedFiles(['change/*'], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFile);

    const changeFileContents = fs.readJSONSync(changeFiles[0]) as ChangeInfoMultiple;
    expect(changeFileContents).toEqual({
      changes: [{ packageName: 'foo' }, { packageName: 'bar' }],
    });
  });
});
