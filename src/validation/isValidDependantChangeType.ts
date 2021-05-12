export function isValidDependentChangeType(dependentChangeType: string) {
  return ['patch', 'major', 'minor', 'prerelease', 'none'].includes(dependentChangeType);
}
