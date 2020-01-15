import { VersionGroupOptions } from '../types/BeachballOptions';

export function isValidGroupOptions(groups: VersionGroupOptions[]) {
  if (!Array.isArray(groups)) {
    return false;
  }

  for (const group of groups) {
    if (!group.include || !group.name) {
      return false;
    }
  }

  return true;
}
