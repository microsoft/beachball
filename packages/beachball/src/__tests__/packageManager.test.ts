import { Registry } from '../fixtures/registry';
import { testPackageInfo, testTag } from '../fixtures/package';
import { npm, packagePublish } from '../packageManager';

describe('packageManager', () => {
  let registry: Registry;

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

    it('can publish', () => {
      const publishResult = packagePublish(testPackageInfo, registry.getUrl(), '', testTag, '');
      expect(publishResult.success).toBeTruthy();

      const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfo.name, '--json']);
      expect(showResult.success).toBeTruthy();

      const show = JSON.parse(showResult.stdout);
      expect(show.name).toEqual(testPackageInfo.name);
      expect(show['dist-tags'][testTag]).toEqual(testPackageInfo.version);
      expect(show.versions.length).toEqual(1);
      expect(show.versions[0]).toEqual(testPackageInfo.version);
    });

    it('errors on republish', () => {
      let publishResult = packagePublish(testPackageInfo, registry.getUrl(), '', testTag, '');
      expect(publishResult.success).toBeTruthy();

      publishResult = packagePublish(testPackageInfo, registry.getUrl(), '', testTag, '');
      expect(publishResult.success).toBeFalsy();
    });
  });
});
