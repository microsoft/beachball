import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import { prepareChangelogPaths } from '../../changelog/prepareChangelogPaths';
import { createTestFileStructure } from '../../__fixtures__/createTestFileStructure';

describe('prepareChangelogPaths', () => {
  let consoleLogMock: jest.SpiedFunction<typeof console.log>;
  let consoleWarnMock: jest.SpiedFunction<typeof console.warn>;
  let tempDir: string | undefined;
  const fakeDir = slash(path.resolve('/faketmpdir'));
  const hashRegexp = /^[0-9a-f]{8}$/;

  /** Wrapper that calls `prepareChangelogPaths` and converts the result to forward slashes */
  function prepareChangelogPathsWrapper(options: Parameters<typeof prepareChangelogPaths>[0]) {
    const paths = prepareChangelogPaths(options);
    if (paths.md) paths.md = slash(paths.md);
    if (paths.json) paths.json = slash(paths.json);
    return paths;
  }

  function slash(str: string) {
    return str.replace(/\\/g, '/');
  }

  beforeAll(() => {
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnMock.mockClear();
    tempDir && removeTempDir(tempDir);
    tempDir = undefined;
  });

  it('returns empty paths if generateChangelog is false', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: false, changelog: {} },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({});
  });

  it('returns default paths if generateChangelog is true (hashFilenames unset)', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({ md: `${fakeDir}/CHANGELOG.md`, json: `${fakeDir}/CHANGELOG.json` });
  });

  it('returns only default md path if generateChangelog is "md" (hashFilenames unset)', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'md' },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({ md: `${fakeDir}/CHANGELOG.md` });
  });

  it('returns only default json path if generateChangelog is "json" (hashFilenames unset)', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'json' },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({ json: `${fakeDir}/CHANGELOG.json` });
  });

  it('returns new hashed paths if hashFilenames is true and no files exist', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({
      md: `${fakeDir}/CHANGELOG-${paths.hash}.md`,
      json: `${fakeDir}/CHANGELOG-${paths.hash}.json`,
      hash: expect.stringMatching(hashRegexp),
    });
  });

  it('returns new hashed md path if hashFilenames is true and generateChangelog is "md"', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'md', changelog: { hashFilenames: true } },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({
      md: `${fakeDir}/CHANGELOG-${paths.hash}.md`,
      hash: expect.stringMatching(hashRegexp),
    });
  });

  it('returns new hashed json path if hashFilenames is true and generateChangelog is "json"', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'json', changelog: { hashFilenames: true } },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({
      json: `${fakeDir}/CHANGELOG-${paths.hash}.json`,
      hash: expect.stringMatching(hashRegexp),
    });
  });

  it('detects existing hashed files if hashFilenames is true', () => {
    const hash = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${hash}.md`]: 'existing md',
      [`CHANGELOG-${hash}.json`]: {},
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${hash}.md`,
      json: `${tempDir}/CHANGELOG-${hash}.json`,
      hash,
    });
  });

  it('detects hash from existing md file if hashFilenames is true', () => {
    // only the md file is present, but its hash will be used for both files
    const hash = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${hash}.md`]: 'existing md',
    });

    const pathsWithBoth = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(pathsWithBoth).toEqual({
      md: `${tempDir}/CHANGELOG-${hash}.md`,
      json: `${tempDir}/CHANGELOG-${hash}.json`,
      hash,
    });
  });

  it('detects hash from existing json file if hashFilenames is true', () => {
    // only the json file is present, but its hash will be used for both files
    const hash = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${hash}.json`]: {},
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${hash}.md`,
      json: `${tempDir}/CHANGELOG-${hash}.json`,
      hash,
    });
  });

  it('uses newer hash if hashFilenames is true and md/json files have different hashes', async () => {
    const hashJson = 'abcdef34';
    const hashMd = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${hashJson}.json`]: {},
    });
    // ensure different timestamps by waiting 1ms
    await new Promise(resolve => setTimeout(resolve, 1));
    fs.writeFileSync(path.join(tempDir, `CHANGELOG-${hashMd}.md`), 'existing md');

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: tempDir,
    });
    // md hash is preferred for both files because the file is newer
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${hashMd}.md`,
      json: `${tempDir}/CHANGELOG-${hashMd}.json`,
      hash: hashMd,
    });
    expect(consoleWarnMock).toHaveBeenCalledWith(expect.stringContaining('Found changelog files with multiple hashes'));
  });

  it('uses newest hash if hashFilenames is true and there are multiple hashed files', async () => {
    const lastHash = 'abcdef12';
    tempDir = createTestFileStructure({
      'CHANGELOG-12345678.md': 'existing md',
      'CHANGELOG-abcd40ef.md': 'existing md',
    });
    // ensure different timestamps by waiting 1ms
    await new Promise(resolve => setTimeout(resolve, 1));
    fs.writeFileSync(path.join(tempDir, `CHANGELOG-${lastHash}.md`), 'existing md');

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${lastHash}.md`,
      json: `${tempDir}/CHANGELOG-${lastHash}.json`,
      hash: lastHash,
    });
    expect(consoleWarnMock).toHaveBeenCalledWith(expect.stringContaining('Found changelog files with multiple hashes'));
  });

  it('migrates existing non-hashed file to hashed path', () => {
    tempDir = createTestFileStructure({
      'CHANGELOG.md': 'existing md',
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { hashFilenames: true } },
      changelogAbsDir: tempDir,
    });

    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${paths.hash}.md`,
      json: `${tempDir}/CHANGELOG-${paths.hash}.json`,
      hash: expect.stringMatching(hashRegexp),
    });
    expect(fs.existsSync(`${tempDir}/CHANGELOG.md`)).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('existing md');

    expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Renamed existing non-hashed changelog file'));
  });

  it('migrates existing hashed file to non-hashed path', () => {
    const hashedName = 'CHANGELOG-abcdef08.md';
    tempDir = createTestFileStructure({
      [hashedName]: 'existing md',
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true },
      changelogAbsDir: tempDir,
    });

    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG.md`,
      json: `${tempDir}/CHANGELOG.json`,
    });

    expect(fs.existsSync(`${tempDir}/${hashedName}`)).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('existing md');

    expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Renamed existing hashed changelog file'));
  });
});
