import { RepositoryFactory, Repository } from "./fixtures/repository";
import { isChangeFileNeeded } from "./validation";

describe("validation", () => {
  let repositoryFactory: RepositoryFactory;
  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  describe("isChangeFileNeeded", () => {
    let repository: Repository;

    beforeEach(async () => {
      repository = await repositoryFactory.cloneRepository();
    });

    it("is false when no changes have been made", async () => {
      const result = isChangeFileNeeded(
        "origin/master",
        repository.rootPath,
        false
      );
      expect(result).toBeFalsy();
    });

    it("is true when changes exist in a new branch", async () => {
      await repository.branch("feature-0");
      await repository.commitChange("myFilename");
      const result = isChangeFileNeeded(
        "origin/master",
        repository.rootPath,
        false
      );
      expect(result).toBeTruthy();
    });
  });
});
