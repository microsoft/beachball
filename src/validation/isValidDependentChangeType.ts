import { SortedChangeTypes } from '../changefile/changeTypes';
import type { ChangeType } from '../types/ChangeInfo';

/**
 * Returns whether `dependentChangeType` is valid and not disallowed.
 * Note that `'patch'` is always allowed.
 */
export function isValidDependentChangeType(
  dependentChangeType: ChangeType,
  disallowedChangeTypes: ReadonlyArray<ChangeType> | null
): boolean {
  if (dependentChangeType === 'patch') {
    // patch is always allowed as a dependentChangeType
    return true;
  }

  return SortedChangeTypes.includes(dependentChangeType) && !disallowedChangeTypes?.includes(dependentChangeType);
}
