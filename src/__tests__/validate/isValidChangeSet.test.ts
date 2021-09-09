import { isValidChangeSet } from '../../validation/isValidChangeSet';
import { mockLogs } from '../../fixtures/mockLogs';
import { PackageInfo } from '../../types/PackageInfo';
import { ChangeInfo } from '../../types/ChangeInfo';

// Note that this doesn't have any test cases with disallowedChangeTypes specified in groups
// because that's adequately covered by the tests for getDisallowedChangeTypes

describe('isValidChangeSet', () => {
  let logs: ReturnType<typeof mockLogs>;

  beforeEach(() => {
    logs = mockLogs();
  });

  afterEach(() => {
    logs.restore();
  });

  it('is valid with no changes', () => {
    expect(isValidChangeSet(new Map(), {}, {})).toBe(true);
  });

  it('is invalid if change.type or change.dependentChangeType is unspecified', () => {
    expect(
      isValidChangeSet(
        new Map([['foo-1.json', { packageName: 'foo' } as ChangeInfo]]),
        { foo: { combinedOptions: { disallowedChangeTypes: null } } as PackageInfo },
        {}
      )
    ).toBe(false);
    expect(logs.messages).toHaveLength(2);
    expect(logs.error).toHaveBeenCalledTimes(2);
    expect(logs.error.mock.calls[0][0]).toMatch('invalid change type');
    expect(logs.error.mock.calls[1][0]).toMatch('invalid dependentChangeType');
  });

  it('is valid with no disallowedChangeTypes', () => {
    expect(
      isValidChangeSet(
        new Map([['foo-1.json', { packageName: 'foo', type: 'major', dependentChangeType: 'patch' } as ChangeInfo]]),
        { foo: { combinedOptions: { disallowedChangeTypes: null } } as PackageInfo },
        {}
      )
    ).toBe(true);
    expect(logs.messages).toHaveLength(0);
  });

  it('is valid if not violating disallowedChangeTypes', () => {
    expect(
      isValidChangeSet(
        new Map([['foo-1.json', { packageName: 'foo', type: 'minor', dependentChangeType: 'patch' } as ChangeInfo]]),
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        {}
      )
    ).toBe(true);
    expect(logs.messages).toHaveLength(0);
  });

  it('is invalid if change.type is in disallowedChangeTypes', () => {
    expect(
      isValidChangeSet(
        new Map([['foo-1.json', { packageName: 'foo', type: 'major', dependentChangeType: 'patch' } as ChangeInfo]]),
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        {}
      )
    ).toBe(false);
    expect(logs.messages).toHaveLength(1);
    expect(logs.error).toHaveBeenCalledTimes(1);
    expect(logs.error.mock.calls[0][0]).toMatch('invalid change type');
  });

  it('is invalid if change.dependentChangeType is in disallowedChangeTypes', () => {
    expect(
      isValidChangeSet(
        new Map([['foo-1.json', { packageName: 'foo', type: 'minor', dependentChangeType: 'major' } as ChangeInfo]]),
        { foo: { combinedOptions: { disallowedChangeTypes: ['major'] } } as PackageInfo },
        {}
      )
    ).toBe(false);
    expect(logs.messages).toHaveLength(1);
    expect(logs.error).toHaveBeenCalledTimes(1);
    expect(logs.error.mock.calls[0][0]).toMatch('invalid dependentChangeType');
  });

  it('always allows patch in dependentChangeTypes', () => {
    expect(
      isValidChangeSet(
        new Map([
          // This is what an actual prerelease change file looks like
          ['foo-1.json', { packageName: 'foo', type: 'prerelease', dependentChangeType: 'patch' } as ChangeInfo],
        ]),
        { foo: { combinedOptions: { disallowedChangeTypes: ['major', 'minor', 'patch'] } } as PackageInfo },
        {}
      )
    ).toBe(true);
    expect(logs.messages).toHaveLength(0);
  });
});
