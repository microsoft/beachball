import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { writeChangeFilesFixup } from '../../changefile/writeChangeFilesFixup';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import type { ChangeFileInfo } from '../../types/ChangeInfo';
import type { Repository } from '../../__fixtures__/repository';
import type { BeachballOptions } from '../../types/BeachballOptions';
import fs from 'fs-extra';
import path from 'path';

describe('writeChangeFilesFixup', () => {
  let repositoryFactory: RepositoryFactory;
  let repository: Repository;

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      path: repository.rootPath,
      ...options,
    };
  }

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  beforeEach(() => {
    repository = repositoryFactory.cloneRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    repository?.cleanUp();
  });

  it('updates the most recent change file and creates a fixup commit', async () => {
    const options = getOptions({ commit: true }); // Ensure change files are committed

    // Create an initial change file and commit it
    const initialChanges: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Initial change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    generateChangeFiles(initialChanges, options);

    // Get the change file path
    const changeFiles = fs.readdirSync(path.join(repository.rootPath, 'change'));
    expect(changeFiles).toHaveLength(1);
    const changeFilePath = path.join(repository.rootPath, 'change', changeFiles[0]);

    // Read the initial change file to verify its content
    const initialChangeFileContent = fs.readJSONSync(changeFilePath);
    expect(initialChangeFileContent.comment).toBe('Initial change');
    expect(initialChangeFileContent.type).toBe('patch');

    // Now create new changes for fixup
    const fixupChanges: ChangeFileInfo[] = [
      {
        type: 'minor',
        comment: 'Additional change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'minor',
      },
    ];

    // Use fixup mode
    const result = await writeChangeFilesFixup(fixupChanges, options);

    // Verify the function returned the path to the updated file
    expect(result).toBe(changeFilePath);

    // Verify the change file was updated with merged content
    const updatedChangeFileContent = fs.readJSONSync(changeFilePath);
    expect(updatedChangeFileContent.comment).toBe('Initial change\n\nAdditional change');
    expect(updatedChangeFileContent.type).toBe('minor'); // Higher severity should be kept
    expect(updatedChangeFileContent.packageName).toBe('foo');

    // Verify a fixup commit was created
    const commitLog = repository.git(['log', '--oneline', '-n', '2']);
    const commits = commitLog.stdout.trim().split('\n');
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatch(/fixup!/);
  });

  it('merges grouped change files correctly', async () => {
    const options = getOptions({ groupChanges: true, commit: true }); // Ensure change files are committed

    // Create an initial grouped change file and commit it
    const initialChanges: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Initial change 1',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
      {
        type: 'patch',
        comment: 'Initial change 2',
        packageName: 'bar',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    generateChangeFiles(initialChanges, options);

    // Get the grouped change file
    const changeFiles = fs.readdirSync(path.join(repository.rootPath, 'change'));
    expect(changeFiles).toHaveLength(1);
    const changeFilePath = path.join(repository.rootPath, 'change', changeFiles[0]);

    // Read initial content
    const initialContent = fs.readJSONSync(changeFilePath);
    expect(initialContent.changes).toHaveLength(2);

    // Create new changes for fixup
    const fixupChanges: ChangeFileInfo[] = [
      {
        type: 'minor',
        comment: 'Additional change',
        packageName: 'baz',
        email: 'test@example.com',
        dependentChangeType: 'minor',
      },
    ];

    // Use fixup mode
    const result = await writeChangeFilesFixup(fixupChanges, options);

    // Verify the result
    expect(result).toBe(changeFilePath);

    // Verify the grouped change file was updated
    const updatedContent = fs.readJSONSync(changeFilePath);
    expect(updatedContent.changes).toHaveLength(3);
    expect(updatedContent.changes[2].comment).toBe('Additional change');
    expect(updatedContent.changes[2].packageName).toBe('baz');
  });

  it('returns null when no change directory exists', async () => {
    const options = getOptions({ path: repository.rootPath });

    // Ensure no change directory exists
    const changePath = path.join(repository.rootPath, 'change');
    if (fs.existsSync(changePath)) {
      fs.removeSync(changePath);
    }

    const changes: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Test change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    const result = await writeChangeFilesFixup(changes, options);
    expect(result).toBeNull();
  });

  it('returns null when no existing change files are found', async () => {
    const options = getOptions({ path: repository.rootPath });

    // Create change directory but no files
    const changePath = path.join(repository.rootPath, 'change');
    fs.ensureDirSync(changePath);

    const changes: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Test change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    const result = await writeChangeFilesFixup(changes, options);
    expect(result).toBeNull();
  });

  it('handles higher change type priority correctly', async () => {
    const options = getOptions({ commit: true }); // Ensure change files are committed

    // Create initial change file with major type and commit it
    const initialChanges: ChangeFileInfo[] = [
      {
        type: 'major',
        comment: 'Breaking change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'major',
      },
    ];

    generateChangeFiles(initialChanges, options);

    // Create fixup with lower priority type
    const fixupChanges: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Small fix',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    const changeFiles = fs.readdirSync(path.join(repository.rootPath, 'change'));
    const changeFilePath = path.join(repository.rootPath, 'change', changeFiles[0]);

    await writeChangeFilesFixup(fixupChanges, options);

    // Verify the major type is preserved
    const updatedContent = fs.readJSONSync(changeFilePath);
    expect(updatedContent.type).toBe('major');
    expect(updatedContent.comment).toBe('Breaking change\n\nSmall fix');
  });

  it('selects first file alphabetically when multiple change files exist in same commit', async () => {
    const options = getOptions({ commit: true });

    // Create multiple change files in a single commit
    const multipleChanges: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Change for zebra package',
        packageName: 'zebra',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
      {
        type: 'patch',
        comment: 'Change for alpha package',
        packageName: 'alpha',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
      {
        type: 'patch',
        comment: 'Change for beta package',
        packageName: 'beta',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    generateChangeFiles(multipleChanges, options);

    // Get all change files - should be 3
    const allChangeFiles = fs.readdirSync(path.join(repository.rootPath, 'change')).filter(f => f.endsWith('.json'));
    expect(allChangeFiles).toHaveLength(3);

    // Sort them to find which should be selected (first alphabetically)
    allChangeFiles.sort();
    const expectedSelectedFile = allChangeFiles[0];

    // Now create a fixup change
    const fixupChanges: ChangeFileInfo[] = [
      {
        type: 'minor',
        comment: 'Additional change',
        packageName: 'any',
        email: 'test@example.com',
        dependentChangeType: 'minor',
      },
    ];

    const result = await writeChangeFilesFixup(fixupChanges, options);

    // Verify it selected the first file alphabetically
    const expectedPath = path.join(repository.rootPath, 'change', expectedSelectedFile);
    expect(result).toBe(expectedPath);

    // Verify the file was updated
    const updatedContent = fs.readJSONSync(expectedPath);
    expect(updatedContent.comment).toContain('Additional change');
  });
});
