import { acceptedKeys, performPublishConfigOverrides } from '../../publish/performPublishConfigOverrides';
import { PackageInfos } from '../../types/PackageInfo';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('perform publishConfig overrides', () => {
  function createFixture(publishConfig: any = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beachball-publishConfig'));
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

    return { packageInfos, tmpDir };
  }

  function cleanUp(tmpDir: string) {
    fs.rmdirSync(tmpDir, { recursive: true });
  }

  it('overrides accepted keys', () => {
    const { packageInfos, tmpDir } = createFixture({
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
    });

    const original = JSON.parse(fs.readFileSync(packageInfos['foo'].packageJsonPath, 'utf-8'));

    expect(original.main).toBe('src/index.ts');
    expect(original.types).toBeUndefined();

    performPublishConfigOverrides(['foo'], packageInfos);

    const modified = JSON.parse(fs.readFileSync(packageInfos['foo'].packageJsonPath, 'utf-8'));

    expect(modified.main).toBe('lib/index.js');
    expect(modified.types).toBe('lib/index.d.ts');
    expect(modified.publishConfig.main).toBeUndefined();
    expect(modified.publishConfig.types).toBeUndefined();

    cleanUp(tmpDir);
  });

  it('should always at least accept types, main, and module', () => {
    expect(acceptedKeys).toContain('main');
    expect(acceptedKeys).toContain('module');
    expect(acceptedKeys).toContain('types');
  });
});
