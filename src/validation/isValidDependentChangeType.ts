import { SortedChangeTypes } from '../changefile/changeTypes';
import type { ChangeType } from '../types/ChangeInfo';

export function isValidDependentChangeType(
  dependentChangeType: ChangeType,
  disallowedChangeTypes: ChangeType[] | null
): boolean {
  // patch is always allowed as a dependentChangeType
  const disallowedDependentChangeTypes: ChangeType[] = (disallowedChangeTypes || []).filter(t => t !== 'patch');

  return (
    SortedChangeTypes.includes(dependentChangeType) && !disallowedDependentChangeTypes.includes(dependentChangeType)
  );
}
