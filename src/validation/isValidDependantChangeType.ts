import { ChangeType } from '../types/ChangeInfo';

export function isValidDependentChangeType(
  dependentChangeType: ChangeType,
  disallwedDependentChangeTypes: ChangeType[] | null
) {
  return (
    ['patch', 'major', 'minor', 'prerelease', 'none'].includes(dependentChangeType) &&
    !disallwedDependentChangeTypes?.includes(dependentChangeType)
  );
}
