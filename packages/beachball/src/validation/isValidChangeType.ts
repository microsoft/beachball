export function isValidChangeType(changeType: string) {
  return ['patch', 'major', 'minor', 'prerelease'].includes(changeType);
}
