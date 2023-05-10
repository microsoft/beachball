import { describe, expect, it, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from '../../__fixtures__/tmpdir';
import { performPublishOverrides } from '../../publish/performPublishOverrides';
import { PackageInfos } from '../../types/PackageInfo';

describe('perform publishConfig overrides', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      fs.removeSync(tmpDir);
      tmpDir = undefined;
    }
  });

  function createFixture(publishConfig: any = {}) {
    tmpDir = tmpdir({ prefix: 'beachball-publishConfig-' });
    const fixturePackageJson = {
      name: 'foo',
      version: '1.0.0',
      main: 'src/index.ts',
      bin: {
        'foo-bin': 'src/foo-bin.js',
      },
      publishConfig,
    };

    const packageInfos: PackageInfos = {
      foo: {
        combinedOptions: {
          defaultNpmTag: 'latest',
          disallowedChangeTypes: [],
          gitTags: true,
          tag: 'latest',
        },
        name: 'foo',
        packageJsonPath: path.join(tmpDir, 'package.json'),
        packageOptions: {},
        private: false,
        version: '1.0.0',
      },
    };

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(fixturePackageJson));

    return packageInfos;
  }

  it('overrides accepted keys', () => {
    const packageInfos = createFixture({
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    });

    const original = JSON.parse(fs.readFileSync(packageInfos['foo'].packageJsonPath, 'utf-8'));

    expect(original.main).toBe('src/index.ts');
    expect(original.types).toBeUndefined();

    performPublishOverrides(['foo'], packageInfos);

    const modified = JSON.parse(fs.readFileSync(packageInfos['foo'].packageJsonPath, 'utf-8'));

    expect(modified.main).toBe('lib/index.js');
    expect(modified.types).toBe('lib/index.d.ts');
    expect(modified.publishConfig.main).toBeUndefined();
    expect(modified.publishConfig.types).toBeUndefined();
  });

  it('uses values on packageJson root as fallback values when present', () => {
    const packageInfos = createFixture({
      main: 'lib/index.js',
    });

    const original = JSON.parse(fs.readFileSync(packageInfos['foo'].packageJsonPath, 'utf-8'));

    expect(original.main).toBe('src/index.ts');
    expect(original.bin).toStrictEqual({ 'foo-bin': 'src/foo-bin.js' });
    expect(original.files).toBeUndefined();

    performPublishOverrides(['foo'], packageInfos);

    const modified = JSON.parse(fs.readFileSync(packageInfos['foo'].packageJsonPath, 'utf-8'));

    expect(modified.main).toBe('lib/index.js');
    expect(modified.bin).toStrictEqual({ 'foo-bin': 'src/foo-bin.js' });
    expect(modified.files).toBeUndefined();
    expect(modified.publishConfig.main).toBeUndefined();
    expect(modified.publishConfig.bin).toBeUndefined();
    expect(modified.publishConfig.files).toBeUndefined();
  });
});

describe('perform workspace version overrides', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      fs.removeSync(tmpDir);
      tmpDir = undefined;
    }
  });

  function createFixture(dependencyVersion: string) {
    tmpDir = tmpdir({ prefix: 'beachball-publishConfig-' });
    fs.mkdirSync(path.join(tmpDir, 'foo'));
    fs.mkdirSync(path.join(tmpDir, 'bar'));

    const fooPackageJson = {
      name: 'foo',
      version: '1.0.0',
    };

    const barPackageJson = {
      name: 'bar',
      version: '2.0.0',
      dependencies: {
        foo: dependencyVersion,
      },
    };

    fs.writeFileSync(path.join(tmpDir, 'foo', 'package.json'), JSON.stringify(fooPackageJson));
    fs.writeFileSync(path.join(tmpDir, 'bar', 'package.json'), JSON.stringify(barPackageJson));

    const packageInfos: PackageInfos = {
      foo: {
        combinedOptions: {
          defaultNpmTag: 'latest',
          disallowedChangeTypes: [],
          gitTags: true,
          tag: 'latest',
        },
        name: 'foo',
        packageJsonPath: path.join(tmpDir, 'foo', 'package.json'),
        packageOptions: {},
        private: false,
        version: '1.0.0',
      },
      bar: {
        combinedOptions: {
          defaultNpmTag: 'latest',
          disallowedChangeTypes: [],
          gitTags: true,
          tag: 'latest',
        },
        name: 'bar',
        packageJsonPath: path.join(tmpDir, 'bar', 'package.json'),
        packageOptions: {},
        private: false,
        dependencies: { foo: dependencyVersion },
        version: '2.0.0',
      },
    };

    return packageInfos;
  }

  it.each([
    ['workspace:*', '1.0.0'],
    ['workspace:~', '~1.0.0'],
    ['workspace:^', '^1.0.0'],
    ['workspace:~1.0.0', '~1.0.0'],
    ['workspace:^1.0.0', '^1.0.0'],
  ])('overrides %s dependency versions during publishing', (dependencyVersion, expectedPublishVersion) => {
    const packageInfos = createFixture(dependencyVersion);

    const original = JSON.parse(fs.readFileSync(packageInfos['bar'].packageJsonPath, 'utf-8'));
    expect(original.dependencies.foo).toBe(dependencyVersion);

    performPublishOverrides(['bar'], packageInfos);

    const modified = JSON.parse(fs.readFileSync(packageInfos['bar'].packageJsonPath, 'utf-8'));
    expect(modified.dependencies.foo).toBe(expectedPublishVersion);
  });
});
