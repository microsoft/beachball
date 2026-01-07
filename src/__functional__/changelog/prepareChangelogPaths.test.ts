import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import { prepareChangelogPaths } from '../../changelog/prepareChangelogPaths';
import { createTestFileStructure } from '../../__fixtures__/createTestFileStructure';

describe('prepareChangelogPaths', () => {
  let consoleLogMock: jest.SpiedFunction<typeof console.log>;
  let tempDir: string | undefined;

  const fakeDir = path.resolve('/faketmpdir');
  const packageName = 'test';
  /** This is the beginning of the md5 hash digest of "test" */
  const testHash = '098f6bcd';

  beforeAll(() => {
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    // there will be a bunch of ignorable warnings because /faketmpdir doesn't exist
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogMock.mockClear();
    tempDir && removeTempDir(tempDir);
    tempDir = undefined;
  });

  it('returns empty paths if generateChangelog is false', () => {
    const paths = prepareChangelogPaths({
      options: { generateChangelog: false, changelog: {} },
      changelogAbsDir: fakeDir,
      packageName,
    });

    expect(paths).toEqual({});
  });

  it('returns default paths if generateChangelog is true (uniqueFilenames unset)', () => {
    const paths = prepareChangelogPaths({
      options: { generateChangelog: true },
      changelogAbsDir: fakeDir,
      packageName,
    });

    expect(paths).toEqual({
      md: path.join(fakeDir, 'CHANGELOG.md'),
      json: path.join(fakeDir, 'CHANGELOG.json'),
    });
  });

  it('returns only default md path if generateChangelog is "md" (uniqueFilenames unset)', () => {
    const paths = prepareChangelogPaths({
      options: { generateChangelog: 'md' },
      changelogAbsDir: fakeDir,
      packageName,
    });

    expect(paths).toEqual({ md: path.join(fakeDir, 'CHANGELOG.md') });
  });

  it('returns only default json path if generateChangelog is "json" (uniqueFilenames unset)', () => {
    const paths = prepareChangelogPaths({
      options: { generateChangelog: 'json' },
      changelogAbsDir: fakeDir,
      packageName,
    });

    expect(paths).toEqual({ json: path.join(fakeDir, 'CHANGELOG.json') });
  });

  it('returns new paths with hashes if uniqueFilenames is true and no files exist', () => {
    const options = {
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: fakeDir,
    };

    const paths = prepareChangelogPaths({ ...options, packageName: 'test' });

    expect(paths).toEqual({
      md: path.join(fakeDir, `CHANGELOG-${testHash}.md`),
      json: path.join(fakeDir, `CHANGELOG-${testHash}.json`),
    });

    // hash is based on package name, not path or anything else
    const otherPaths = prepareChangelogPaths({ ...options, packageName: 'other' });

    expect(otherPaths).toEqual({
      md: path.join(fakeDir, 'CHANGELOG-795f3202.md'),
      json: path.join(fakeDir, 'CHANGELOG-795f3202.json'),
    });
  });

  it('returns new md path with hash if uniqueFilenames is true and generateChangelog is "md"', () => {
    const paths = prepareChangelogPaths({
      options: { generateChangelog: 'md', changelog: { uniqueFilenames: true } },
      changelogAbsDir: fakeDir,
      packageName,
    });

    expect(paths).toEqual({
      md: path.join(fakeDir, `CHANGELOG-${testHash}.md`),
    });
  });

  it('returns new json path with hash if uniqueFilenames is true and generateChangelog is "json"', () => {
    const paths = prepareChangelogPaths({
      options: { generateChangelog: 'json', changelog: { uniqueFilenames: true } },
      changelogAbsDir: fakeDir,
      packageName,
    });

    expect(paths).toEqual({
      json: path.join(fakeDir, `CHANGELOG-${testHash}.json`),
    });
  });

  it('migrates existing non-hash file to path with hash (uniqueFilenames false to true)', () => {
    tempDir = createTestFileStructure({
      'CHANGELOG.md': 'existing md',
      'CHANGELOG.json': {},
    });

    const paths = prepareChangelogPaths({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
      packageName,
    });

    expect(paths).toEqual({
      md: path.join(tempDir, `CHANGELOG-${testHash}.md`),
      json: path.join(tempDir, `CHANGELOG-${testHash}.json`),
    });

    expect(fs.existsSync(path.join(tempDir, 'CHANGELOG.md'))).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('existing md');

    expect(fs.existsSync(path.join(tempDir, 'CHANGELOG.json'))).toBe(false);
    expect(fs.readFileSync(paths.json!, 'utf8')).toBe('{}');

    expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Renamed existing changelog file'));
    expect(consoleLogMock).toHaveBeenCalledTimes(2);
  });

  it('migrates existing path with hash to non-hash path (uniqueFilenames true to false)', () => {
    const oldName = 'CHANGELOG-abcdef08';
    tempDir = createTestFileStructure({
      [`${oldName}.md`]: 'existing md',
      [`${oldName}.json`]: {},
    });

    const paths = prepareChangelogPaths({
      options: { generateChangelog: true },
      changelogAbsDir: tempDir,
      packageName,
    });

    expect(paths).toEqual({
      md: path.join(tempDir, 'CHANGELOG.md'),
      json: path.join(tempDir, 'CHANGELOG.json'),
    });

    expect(fs.existsSync(path.join(tempDir, `${oldName}.md`))).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('existing md');

    expect(fs.existsSync(path.join(tempDir, `${oldName}.json`))).toBe(false);
    expect(fs.readFileSync(paths.json!, 'utf8')).toBe('{}');

    expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Renamed existing changelog file'));
    expect(consoleLogMock).toHaveBeenCalledTimes(2);
  });

  it('renames newest file if uniqueFilenames is true and there are multiple files with hashes', async () => {
    const file1 = 'CHANGELOG-12345678.md';
    const file2 = 'CHANGELOG-fbcd40ef.md';
    const lastHash = 'abcdef12';
    tempDir = createTestFileStructure({
      [file1]: 'md 1',
      [file2]: 'md 2',
    });
    // ensure different timestamps by waiting 5ms
    await new Promise(resolve => setTimeout(resolve, 5));
    fs.writeFileSync(path.join(tempDir, `CHANGELOG-${lastHash}.md`), 'last md');

    const paths = prepareChangelogPaths({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
      packageName,
    });

    // Paths use the actual hash of "test"
    expect(paths).toEqual({
      md: path.join(tempDir, `CHANGELOG-${testHash}.md`),
      json: path.join(tempDir, `CHANGELOG-${testHash}.json`),
    });

    // The most recently modified file is renamed
    expect(fs.existsSync(path.join(tempDir, `CHANGELOG-${lastHash}.md`))).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('last md');

    expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Renamed existing changelog file'));
    expect(consoleLogMock).toHaveBeenCalledTimes(1);

    // The other files are untouched
    expect(fs.readFileSync(path.join(tempDir, file1), 'utf8')).toBe('md 1');
    expect(fs.readFileSync(path.join(tempDir, file2), 'utf8')).toBe('md 2');
  });
});
