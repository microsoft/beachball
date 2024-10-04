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
  const suffixRegexp = /^[0-9a-f]{8}$/;

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

  it('returns default paths if generateChangelog is true (uniqueFilenames unset)', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({ md: `${fakeDir}/CHANGELOG.md`, json: `${fakeDir}/CHANGELOG.json` });
  });

  it('returns only default md path if generateChangelog is "md" (uniqueFilenames unset)', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'md' },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({ md: `${fakeDir}/CHANGELOG.md` });
  });

  it('returns only default json path if generateChangelog is "json" (uniqueFilenames unset)', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'json' },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({ json: `${fakeDir}/CHANGELOG.json` });
  });

  it('returns new suffixed paths if uniqueFilenames is true and no files exist', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({
      md: `${fakeDir}/CHANGELOG-${paths.suffix}.md`,
      json: `${fakeDir}/CHANGELOG-${paths.suffix}.json`,
      suffix: expect.stringMatching(suffixRegexp),
    });
  });

  it('returns new suffixed md path if uniqueFilenames is true and generateChangelog is "md"', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'md', changelog: { uniqueFilenames: true } },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({
      md: `${fakeDir}/CHANGELOG-${paths.suffix}.md`,
      suffix: expect.stringMatching(suffixRegexp),
    });
  });

  it('returns new suffixed json path if uniqueFilenames is true and generateChangelog is "json"', () => {
    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: 'json', changelog: { uniqueFilenames: true } },
      changelogAbsDir: fakeDir,
    });

    expect(paths).toEqual({
      json: `${fakeDir}/CHANGELOG-${paths.suffix}.json`,
      suffix: expect.stringMatching(suffixRegexp),
    });
  });

  it('detects existing suffixed files if uniqueFilenames is true', () => {
    const suffix = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${suffix}.md`]: 'existing md',
      [`CHANGELOG-${suffix}.json`]: {},
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${suffix}.md`,
      json: `${tempDir}/CHANGELOG-${suffix}.json`,
      suffix,
    });
  });

  it('detects suffix from existing md file if uniqueFilenames is true', () => {
    // only the md file is present, but its suffix will be used for both files
    const suffix = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${suffix}.md`]: 'existing md',
    });

    const pathsWithBoth = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(pathsWithBoth).toEqual({
      md: `${tempDir}/CHANGELOG-${suffix}.md`,
      json: `${tempDir}/CHANGELOG-${suffix}.json`,
      suffix,
    });
  });

  it('detects suffix from existing json file if uniqueFilenames is true', () => {
    // only the json file is present, but its suffix will be used for both files
    const suffix = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${suffix}.json`]: {},
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${suffix}.md`,
      json: `${tempDir}/CHANGELOG-${suffix}.json`,
      suffix,
    });
  });

  it('uses newer suffix if uniqueFilenames is true and md/json files have different suffixes', async () => {
    const suffixJson = 'abcdef34';
    const suffixMd = 'abcdef12';
    tempDir = createTestFileStructure({
      [`CHANGELOG-${suffixJson}.json`]: {},
    });
    // ensure different timestamps by waiting 1ms
    await new Promise(resolve => setTimeout(resolve, 1));
    fs.writeFileSync(path.join(tempDir, `CHANGELOG-${suffixMd}.md`), 'existing md');

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
    });
    // md suffix is preferred for both files because the file is newer
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${suffixMd}.md`,
      json: `${tempDir}/CHANGELOG-${suffixMd}.json`,
      suffix: suffixMd,
    });
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Found changelog files with multiple suffixes')
    );
  });

  it('uses newest suffix if uniqueFilenames is true and there are multiple suffixed files', async () => {
    const lastSuffix = 'abcdef12';
    tempDir = createTestFileStructure({
      'CHANGELOG-12345678.md': 'existing md',
      'CHANGELOG-abcd40ef.md': 'existing md',
    });
    // ensure different timestamps by waiting 1ms
    await new Promise(resolve => setTimeout(resolve, 1));
    fs.writeFileSync(path.join(tempDir, `CHANGELOG-${lastSuffix}.md`), 'existing md');

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
    });
    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${lastSuffix}.md`,
      json: `${tempDir}/CHANGELOG-${lastSuffix}.json`,
      suffix: lastSuffix,
    });
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Found changelog files with multiple suffixes')
    );
  });

  it('migrates existing non-suffixed file to suffixed path', () => {
    tempDir = createTestFileStructure({
      'CHANGELOG.md': 'existing md',
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true, changelog: { uniqueFilenames: true } },
      changelogAbsDir: tempDir,
    });

    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG-${paths.suffix}.md`,
      json: `${tempDir}/CHANGELOG-${paths.suffix}.json`,
      suffix: expect.stringMatching(suffixRegexp),
    });
    expect(fs.existsSync(`${tempDir}/CHANGELOG.md`)).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('existing md');

    expect(consoleLogMock).toHaveBeenCalledWith(
      expect.stringContaining('Renamed existing non-suffixed changelog file')
    );
  });

  it('migrates existing suffixed file to non-suffixed path', () => {
    const suffixedName = 'CHANGELOG-abcdef08.md';
    tempDir = createTestFileStructure({
      [suffixedName]: 'existing md',
    });

    const paths = prepareChangelogPathsWrapper({
      options: { generateChangelog: true },
      changelogAbsDir: tempDir,
    });

    expect(paths).toEqual({
      md: `${tempDir}/CHANGELOG.md`,
      json: `${tempDir}/CHANGELOG.json`,
    });

    expect(fs.existsSync(`${tempDir}/${suffixedName}`)).toBe(false);
    expect(fs.readFileSync(paths.md!, 'utf8')).toBe('existing md');

    expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Renamed existing suffixed changelog file'));
  });
});
