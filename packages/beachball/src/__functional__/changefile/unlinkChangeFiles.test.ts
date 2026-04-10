import { describe, expect, it, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { ChangeSet } from '../../types/ChangeInfo';
import { unlinkChangeFiles } from '../../changefile/unlinkChangeFiles';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { getChangePath } from '../../paths';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';
import { getChange } from '../../__fixtures__/changeFiles';
import { writeJson } from '../../object/writeJson';

// These tests could be done with filesystem method mocks, but it's pretty complicated,
// and testing with the filesystem is fast since it doesn't use git.
describe('unlinkChangeFiles', () => {
  const logs = initMockLogs();
  let root = '';

  /**
   * Create the given change file names and fill default options.
   * The returned `changeSet` includes only the files specified in `inChangeSet`,
   * or all files if `inChangeSet` is not provided.
   */
  function makeFixture(params: {
    /** Change file names (not full paths) to create */
    changeFileNames: string[];
    /** Subset of `changeFileNames` to include in the change set. If not specified, includes all. */
    inChangeSet?: string[];
    options?: Partial<Parameters<typeof unlinkChangeFiles>[1]>;
  }) {
    const { changeFileNames, inChangeSet = changeFileNames } = params;

    root = tmpdir();
    const options: BeachballOptions = {
      ...getDefaultOptions(),
      path: root,
      ...params.options,
    };

    const changePath = getChangePath(options);
    fs.mkdirSync(changePath, { recursive: true });

    const changeSet: ChangeSet = [];
    for (const changeFile of changeFileNames) {
      // The change content doesn't matter here
      const change = getChange('fake');
      writeJson(path.join(changePath, changeFile), change);
      if (inChangeSet.includes(changeFile)) {
        changeSet.push({ changeFile, change });
      }
    }

    return { changeSet, options, changePath };
  }

  afterEach(() => {
    root && removeTempDir(root);
    root = '';
  });

  it('removes change files from change set', () => {
    const { changeSet, options, changePath } = makeFixture({
      changeFileNames: ['change1.json', 'change2.json', 'change3.json'],
      inChangeSet: ['change1.json', 'change2.json'],
    });

    unlinkChangeFiles(changeSet, options);

    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Removing change files:
      - change1.json
      - change2.json"
    `);
    // The file that wasn't in the change set is still there
    const remainingFiles = fs.readdirSync(changePath);
    expect(remainingFiles).toEqual(['change3.json']);
  });

  it('removes change files and deletes folder if empty', () => {
    const { changeSet, options, changePath } = makeFixture({
      changeFileNames: ['change1.json', 'change2.json'],
    });

    unlinkChangeFiles(changeSet, options);

    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Removing change files:
      - change1.json
      - change2.json
      Removing empty change folder"
    `);
    // Whole folder is removed since the change set included all files
    expect(fs.existsSync(changePath)).toBe(false);
  });

  it('does not delete files if keepChangeFiles is true', () => {
    const { changeSet, options, changePath } = makeFixture({
      changeFileNames: ['change1.json', 'change2.json'],
      options: { keepChangeFiles: true },
    });

    unlinkChangeFiles(changeSet, options);

    // No files are removed and nothing is logged
    const remainingFiles = fs.readdirSync(changePath);
    expect(remainingFiles).toEqual(['change1.json', 'change2.json']);
    expect(logs.getMockLines('log')).toEqual('');
  });

  it('does nothing if changeSet is empty', () => {
    const { options, changePath } = makeFixture({
      changeFileNames: [],
    });

    unlinkChangeFiles([], options);

    // If the change set was empty, it doesn't check if the change directory previously existed
    expect(fs.existsSync(changePath)).toBe(true);
  });

  it('respects custom changeDir option', () => {
    const { changeSet, options, changePath } = makeFixture({
      changeFileNames: ['change1.json'],
      options: { changeDir: 'custom/changes' },
    });
    // Also create the default change path to ensure it doesn't get deleted
    const defaultChangePath = getChangePath({ ...getDefaultOptions(), path: root });
    fs.mkdirSync(defaultChangePath, { recursive: true });
    writeJson(path.join(defaultChangePath, 'change1.json'), {});

    unlinkChangeFiles(changeSet, options);

    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Removing change files:
      - change1.json
      Removing empty custom/changes folder"
    `);
    expect(fs.existsSync(changePath)).toBe(false);
    // default change path is untouched
    expect(fs.existsSync(defaultChangePath)).toBe(true);
    expect(fs.readdirSync(defaultChangePath)).toEqual(['change1.json']);
  });

  it("handles change set entries that don't exist", () => {
    const { changeSet, options, changePath } = makeFixture({
      changeFileNames: ['change1.json'],
    });
    // add an extra entry that doesn't exist
    changeSet.push({ changeFile: 'nope.json', change: getChange('fake') });

    unlinkChangeFiles(changeSet, options);

    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Removing change files:
      - change1.json
      - nope.json
      Removing empty change folder"
    `);
    expect(fs.existsSync(changePath)).toBe(false);
  });

  it('leaves extra files not in the changeSet', () => {
    const { changeSet, options, changePath } = makeFixture({
      changeFileNames: ['change1.json', 'extra.json'],
      inChangeSet: ['change1.json'],
    });

    unlinkChangeFiles(changeSet, options);

    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
      "Removing change files:
      - change1.json"
    `);
    expect(fs.existsSync(changePath)).toBe(true);
    const remainingFiles = fs.readdirSync(changePath);
    expect(remainingFiles).toEqual(['extra.json']);
  });
});
