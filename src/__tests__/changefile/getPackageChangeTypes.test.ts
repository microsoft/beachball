import { getAllowedChangeType } from '../../changefile/getPackageChangeTypes';

describe('getAllowedChangeTypes', () => {
  it('should calculate the correct allowed change type giving several disallowed change types', () => {
    const changeType = getAllowedChangeType('major', ['major', 'minor']);
    expect(changeType).toBe('patch');
  });

  it('can handle prerelease only case', () => {
    const changeType = getAllowedChangeType('patch', ['major', 'minor', 'patch']);
    expect(changeType).toBe('prerelease');
  });
});
