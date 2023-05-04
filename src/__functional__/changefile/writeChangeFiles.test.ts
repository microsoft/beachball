import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import { ChangeFileInfo } from '../../types/ChangeInfo';
import { writeChangeFiles } from '../../changefile/writeChangeFiles';
import { getChangeFiles } from '../../__fixtures__/changeFiles';
import { listAllTrackedFiles } from 'workspace-tools';

const uuidRegex = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/;
const uuidGeneric = '00000000-0000-0000-0000-000000000000';

function cleanChangeFilePaths(root: string, changeFiles: string[]) {
  root = root.replace(/\\/g, '/');
  return changeFiles.map(changeFile =>
    changeFile.replace(/\\/g, '/').replace(root, '').replace(uuidRegex, uuidGeneric).replace(/^\//, '')
  );
}

describe('writeChangeFiles', () => {
  const factory = new RepositoryFactory('monorepo');

  initMockLogs();

  beforeAll(() => {
    factory.init();
  });

  afterEach(() => {
    factory.reset();
  });

  afterAll(() => {
    factory.cleanUp();
  });

  it('writes individual change files', () => {
    const repo = factory.defaultRepo;
    const previousHead = repo.getCurrentHash();

    writeChangeFiles({
      changes: [{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[],
      cwd: repo.rootPath,
    });

    const expectedFiles = [`change/bar-${uuidGeneric}.json`, `change/foo-${uuidGeneric}.json`];

    // change files are created
    const changeFiles = getChangeFiles(repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFiles);

    // and tracked
    const trackedFiles = listAllTrackedFiles(['change/*'], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFiles);

    // and committed
    expect(repo.getCurrentHash()).not.toEqual(previousHead);

    // also verify contents of one file
    const changeFileContents = fs.readJSONSync(changeFiles[0]);
    expect(changeFileContents).toEqual({ packageName: 'bar' });
  });

  it('respects commitChangeFiles=false', () => {
    const repo = factory.defaultRepo;
    const previousHead = repo.getCurrentHash();

    writeChangeFiles({
      changes: [{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[],
      cwd: repo.rootPath,
      commitChangeFiles: false,
    });

    const expectedFiles = [`change/bar-${uuidGeneric}.json`, `change/foo-${uuidGeneric}.json`];

    // change files are created
    const changeFiles = getChangeFiles(repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFiles);

    // and tracked
    const trackedFiles = listAllTrackedFiles(['change/*'], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFiles);

    // but NOT committed
    expect(repo.getCurrentHash()).toEqual(previousHead);
  });

  it('writes grouped change files', () => {
    const repo = factory.defaultRepo;

    writeChangeFiles({
      changes: [{ packageName: 'foo' }, { packageName: 'bar' }] as ChangeFileInfo[],
      cwd: repo.rootPath,
      groupChanges: true,
    });

    const expectedFile = [`change/change-${uuidGeneric}.json`];

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, changeFiles)).toEqual(expectedFile);

    const trackedFiles = listAllTrackedFiles(['change/*'], repo.rootPath);
    expect(cleanChangeFilePaths(repo.rootPath, trackedFiles)).toEqual(expectedFile);

    const changeFileContents = fs.readJSONSync(changeFiles[0]);
    expect(changeFileContents).toEqual({
      changes: [{ packageName: 'foo' }, { packageName: 'bar' }],
    });
  });
});
