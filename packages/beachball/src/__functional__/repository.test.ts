import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import { defaultBranchName, defaultRemoteName } from '../__fixtures__/gitDefaults';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';

describe('Repository.getRemoteRefs', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository;

  initMockLogs();

  beforeEach(() => {
    repositoryFactory = new RepositoryFactory('single');
    repo = repositoryFactory.cloneRepository();
  });

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
  });

  it('returns branch names mapped to their commit hashes', () => {
    const originalHash = repo.getCurrentHash();
    repo.git(['push', defaultRemoteName, 'HEAD:refs/heads/feature']);
    repo.commitChange('README', 'updated');
    repo.push();

    const branchHash = repo.getCurrentHash();
    expect(branchHash).not.toBe(originalHash);
    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: branchHash, feature: originalHash },
    });
  });

  it('returns lightweight tag names mapped to their target hashes', () => {
    const hash = repo.getCurrentHash();
    repo.git(['tag', 'lightweight']);
    repo.git(['push', defaultRemoteName, 'refs/tags/lightweight']);

    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: hash },
      tags: { lightweight: hash },
    });
  });

  it('returns annotated tag target hashes instead of tag object hashes', () => {
    const tagTargetHash = repo.getCurrentHash();

    repo.git(['tag', '-a', 'annotated', '-m', 'annotated tag']);
    repo.commitChange('README', 'updated');
    repo.git(['push', '--tags', defaultRemoteName, `HEAD:${defaultBranchName}`]);

    const branchHash = repo.getCurrentHash();
    expect(branchHash).not.toBe(tagTargetHash);
    expect(repo.git(['rev-parse', 'refs/tags/annotated']).stdout.trim()).not.toBe(tagTargetHash);

    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: branchHash },
      tags: { annotated: tagTargetHash },
    });
  });

  it('preserves namespaced branch names', () => {
    const hash = repo.getCurrentHash();
    repo.git(['push', defaultRemoteName, 'HEAD:refs/heads/feature/topic']);

    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: hash, 'feature/topic': hash },
    });
  });

  it('preserves namespaced tag names', () => {
    const hash = repo.getCurrentHash();

    repo.git(['tag', '-a', 'release/v1', '-m', 'release tag']);
    repo.git(['push', defaultRemoteName, 'refs/tags/release/v1']);

    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: hash },
      tags: { 'release/v1': hash },
    });
  });

  it('excludes refs outside branches and tags', () => {
    const hash = repo.getCurrentHash();
    repo.git(['push', defaultRemoteName, 'HEAD:refs/custom/build']);

    expect(repo.getRemoteRefs()).toEqual({
      branches: { [defaultBranchName]: hash },
    });
  });
});
