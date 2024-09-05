import { ChangeType } from '../types/ChangeInfo';

export function isValidDependentChangeType(
  dependentChangeType: ChangeType,
  disallowedChangeTypes: ChangeType[] | null
): boolean {
  // patch is always allowed as a dependentChangeType
  const disallowedDependentChangeTypes = (disallowedChangeTypes || []).filter(t => t !== 'patch');

  return (
    ['patch', 'major', 'minor', 'prerelease', 'prepatch', 'praminor', 'premajor', 'none'].includes(
      dependentChangeType
    ) && !disallowedDependentChangeTypes.includes(dependentChangeType)
  );
}
