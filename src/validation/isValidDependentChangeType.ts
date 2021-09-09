import { ChangeType } from '../types/ChangeInfo';
import { isValidChangeType } from './isValidChangeType';

export function isValidDependentChangeType(
  dependentChangeType: ChangeType,
  disallowedChangeTypes: ChangeType[] | null
) {
  // patch is always allowed as a dependentChangeType
  const disallowedDependentChangeTypes = (disallowedChangeTypes || []).filter(t => t !== 'patch');
  return isValidChangeType(dependentChangeType, disallowedDependentChangeTypes);
}
