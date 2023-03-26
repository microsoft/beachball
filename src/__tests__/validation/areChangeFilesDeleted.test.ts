import { areChangeFilesDeleted } from '../../validation/areChangeFilesDeleted';
import { BeachballOptions } from '../../types/BeachballOptions';
import { findProjectRoot, getChangePath } from '../../paths';
import { getChangesBetweenRefs } from 'workspace-tools';

jest.mock('workspace-tools',() => ({
  getChangesBetweenRefs: jest.fn().mockReturnValue(['file1.json', 'file2.json'])
}));

jest.mock('../../paths', () => ({
  findProjectRoot: jest.fn().mockReturnValue('/'),
  getChangePath: jest.fn().mockReturnValue('/change')
}));

const options = {
  branch: 'test',
  cwd: '/'
} as unknown as BeachballOptions;

test('return true when change files have been deleted or renamed', () => {
  const changeFilesDeleted = areChangeFilesDeleted(options);
  expect(getChangesBetweenRefs).toBeCalled();
  expect(findProjectRoot).toBeCalled();
  expect(getChangePath).toBeCalled();
  expect(changeFilesDeleted).toBe(true);
});

test('return false when change files have not been deleted or renamed', () => {
  (getChangesBetweenRefs as jest.Mock).mockReturnValue([]);
  const changeFilesDeleted = areChangeFilesDeleted(options);
  expect(getChangesBetweenRefs).toBeCalled();
  expect(findProjectRoot).toBeCalled();
  expect(getChangePath).toBeCalled();
  expect(changeFilesDeleted).toBe(false);
});