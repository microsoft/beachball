import { getChangePath } from './paths';
import fs from 'fs';
import path from 'path';
import { getChangedPackages } from './getChangedPackages';

export function isChangeFileNeeded(cwd?: string) {
  const changedPackages = getChangedPackages(cwd);
  return changedPackages.length > 0;
}
