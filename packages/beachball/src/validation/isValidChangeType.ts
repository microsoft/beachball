export function isValidChangeType(changeType: string) {
  return ['patch', 'major', 'minor', 'prerelease', 'none'].includes(changeType);
}
