import { initMockLogs } from '../__fixtures__/mockLogs';
import { testPackageInfo, testTag } from '../__fixtures__/package';
import { Registry } from '../__fixtures__/registry';
import { packagePublish } from '../packageManager/packagePublish';
import { npm } from '../packageManager/npm';

describe('packageManager', () => {
  let registry: Registry;

  initMockLogs();

  beforeAll(() => {
    registry = new Registry();
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  describe('packagePublish', () => {
    beforeEach(async () => {
      await registry.reset();
    });

    it('can publish', async () => {
      const publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
      expect(publishResult.success).toBeTruthy();

      const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfo.name, '--json']);
      expect(showResult.success).toBeTruthy();

      const show = JSON.parse(showResult.stdout);
      expect(show.name).toEqual(testPackageInfo.name);
      expect(show['dist-tags'][testTag]).toEqual(testPackageInfo.version);
      expect(show.versions.length).toEqual(1);
      expect(show.versions[0]).toEqual(testPackageInfo.version);
    });

    it('errors on republish', async () => {
      let publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
      expect(publishResult.success).toBeTruthy();

      publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
      expect(publishResult.success).toBeFalsy();
    });

    it('publish with no tag publishes latest', async () => {
      const publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
      expect(publishResult.success).toBeTruthy();

      const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfo.name, '--json']);
      expect(showResult.success).toBeTruthy();

      const show = JSON.parse(showResult.stdout);
      expect(show.name).toEqual(testPackageInfo.name);
      expect(show['dist-tags']['latest']).toEqual(testPackageInfo.version);
      expect(show.versions.length).toEqual(1);
      expect(show.versions[0]).toEqual(testPackageInfo.version);
    });

    it('publish package with defaultNpmTag publishes as defaultNpmTag', async () => {
      const testPackageInfoWithDefaultNpmTag = {
        ...testPackageInfo,
        combinedOptions: {
          gitTags: true,
          tag: null,
          defaultNpmTag: testTag,
          disallowedChangeTypes: null,
        },
      };
      const publishResult = await packagePublish(testPackageInfoWithDefaultNpmTag, registry.getUrl(), '', '');
      expect(publishResult.success).toBeTruthy();

      const showResult = npm([
        '--registry',
        registry.getUrl(),
        'show',
        testPackageInfoWithDefaultNpmTag.name,
        '--json',
      ]);
      expect(showResult.success).toBeTruthy();

      const show = JSON.parse(showResult.stdout);
      expect(show.name).toEqual(testPackageInfoWithDefaultNpmTag.name);
      expect(show['dist-tags'][testTag]).toEqual(testPackageInfoWithDefaultNpmTag.version);
      expect(show.versions.length).toEqual(1);
      expect(show.versions[0]).toEqual(testPackageInfoWithDefaultNpmTag.version);
    });

    it('publish with specified tag overrides defaultNpmTag', async () => {
      const testPackageInfoWithDefaultNpmTag = {
        ...testPackageInfo,
        combinedOptions: {
          gitTags: true,
          tag: testTag,
          defaultNpmTag: 'thisShouldNotBeUsed',
          disallowedChangeTypes: null,
        },
      };
      const publishResult = await packagePublish(testPackageInfoWithDefaultNpmTag, registry.getUrl(), '', '');
      expect(publishResult.success).toBeTruthy();

      const showResult = npm([
        '--registry',
        registry.getUrl(),
        'show',
        testPackageInfoWithDefaultNpmTag.name,
        '--json',
      ]);
      expect(showResult.success).toBeTruthy();

      const show = JSON.parse(showResult.stdout);
      expect(show.name).toEqual(testPackageInfoWithDefaultNpmTag.name);
      expect(show['dist-tags'][testTag]).toEqual(testPackageInfoWithDefaultNpmTag.version);
      expect(show.versions.length).toEqual(1);
      expect(show.versions[0]).toEqual(testPackageInfoWithDefaultNpmTag.version);
    });
  });
});
