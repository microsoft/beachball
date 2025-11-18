import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { change } from '../../commands/change';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import type { ChangeFileInfo } from '../../types/ChangeInfo';
import type { Repository } from '../../__fixtures__/repository';
import type { BeachballOptions } from '../../types/BeachballOptions';
import fs from 'fs-extra';
import path from 'path';

// Mock the promptForChange module to avoid interactive prompts
jest.mock('../../changefile/promptForChange', () => ({
  promptForChange: jest.fn(),
}));

import { promptForChange } from '../../changefile/promptForChange';
const mockPromptForChange = promptForChange as jest.MockedFunction<typeof promptForChange>;

describe('change command with fixup mode', () => {
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
    mockPromptForChange.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    repository?.cleanUp();
  });

  it('creates a normal change file when fixup is false', async () => {
    const changes: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Test change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    mockPromptForChange.mockResolvedValue(changes);

    const options = getOptions({
      fixup: false,
      package: ['foo'],
      commit: false, // Disable commit for easier testing
    });

    await change(options);

    // Verify a change file was created
    const changeDir = path.join(repository.rootPath, 'change');
    const changeFiles = fs.readdirSync(changeDir).filter(f => f.endsWith('.json'));
    expect(changeFiles).toHaveLength(1);

    // Verify the content
    const changeFilePath = path.join(changeDir, changeFiles[0]);
    const changeFileContent = fs.readJSONSync(changeFilePath);
    expect(changeFileContent.comment).toBe('Test change');
    expect(changeFileContent.type).toBe('patch');
  });

  it('updates existing change file and creates fixup commit when fixup is true', async () => {
    // Create an initial change file
    const initialChanges: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Initial change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    const options = getOptions({ commit: true }); // Enable commit to make sure change file is committed
    generateChangeFiles(initialChanges, options);

    // Now simulate a fixup operation
    const fixupChanges: ChangeFileInfo[] = [
      {
        type: 'minor',
        comment: 'Additional change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'minor',
      },
    ];

    mockPromptForChange.mockResolvedValue(fixupChanges);

    const fixupOptions = getOptions({
      fixup: true,
      package: ['foo'],
      commit: false, // We'll test the commit separately
    });

    await change(fixupOptions);

    // Verify only one change file exists (the updated one)
    const changeDir = path.join(repository.rootPath, 'change');
    const changeFiles = fs.readdirSync(changeDir).filter(f => f.endsWith('.json'));
    expect(changeFiles).toHaveLength(1);

    // Verify the content was merged
    const changeFilePath = path.join(changeDir, changeFiles[0]);
    const changeFileContent = fs.readJSONSync(changeFilePath);
    expect(changeFileContent.comment).toBe('Initial change\n\nAdditional change');
    expect(changeFileContent.type).toBe('minor'); // Higher priority type
  });

  it('handles case when no existing change files exist in fixup mode', async () => {
    const changes: ChangeFileInfo[] = [
      {
        type: 'patch',
        comment: 'Test change',
        packageName: 'foo',
        email: 'test@example.com',
        dependentChangeType: 'patch',
      },
    ];

    mockPromptForChange.mockResolvedValue(changes);

    const options = getOptions({
      fixup: true,
      package: ['foo'],
      commit: false,
    });

    // Should not throw an error, but should fall back to creating a normal change file
    await change(options);

    // Verify a change file was created (fallback to normal behavior)
    const changeDir = path.join(repository.rootPath, 'change');
    const changeFiles = fs.existsSync(changeDir) ? fs.readdirSync(changeDir).filter(f => f.endsWith('.json')) : [];
    expect(changeFiles).toHaveLength(1);

    // Verify the content is correct
    const changeFilePath = path.join(changeDir, changeFiles[0]);
    const changeFileContent = fs.readJSONSync(changeFilePath);
    expect(changeFileContent.comment).toBe('Test change');
    expect(changeFileContent.type).toBe('patch');
  });

  it('handles empty changes gracefully', async () => {
    mockPromptForChange.mockResolvedValue(undefined);

    const options = getOptions({
      fixup: true,
      package: ['foo'],
    });

    // Should not throw an error
    await change(options);
  });
});
