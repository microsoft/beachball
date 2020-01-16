import { RepositoryFactory, Repository } from '../fixtures/repository';
import { isChangeFileNeeded } from '../validation/isChangeFileNeeded';

describe('validation', () => {
  let repositoryFactory: RepositoryFactory;
  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  describe('isChangeFileNeeded', () => {
    let repository: Repository;

    beforeEach(async () => {
      repository = await repositoryFactory.cloneRepository();
    });

    it('is false when no changes have been made', async () => {
      const result = isChangeFileNeeded('origin/master', repository.rootPath, false);
      expect(result).toBeFalsy();
    });

    it('is true when changes exist in a new branch', async () => {
      await repository.branch('feature-0');
      await repository.commitChange('myFilename');
      const result = isChangeFileNeeded('origin/master', repository.rootPath, false);
      expect(result).toBeTruthy();
    });

    it('is false when changes are CHANGELOG files', async () => {
      await repository.branch('feature-0');
      await repository.commitChange('CHANGELOG.md');
      const result = isChangeFileNeeded('origin/master', repository.rootPath, false);
      expect(result).toBeFalsy();
    });

    it('throws if the remote is invalid', async () => {
      await repository.setRemoteUrl('origin', 'file:///__nonexistent');
      await repository.branch('feature-0');
      await repository.commitChange('CHANGELOG.md');

      expect(() => {
        isChangeFileNeeded('origin/master', repository.rootPath, true);
      }).toThrow();
    });
  });
});
