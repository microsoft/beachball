import { BeachballOptions } from '../../types/BeachballOptions';
import { areOptionsValid } from '../../validation/areOptionsValid';
import { mockLogs } from '../../fixtures/mockLogs';

describe('areOptionsValid', () => {
  let logs: ReturnType<typeof mockLogs>;

  beforeEach(() => {
    logs = mockLogs();
  });

  afterEach(() => {
    logs.restore();
  });

  it('validates authType', () => {
    expect(areOptionsValid({ authType: 'no' as any } as BeachballOptions, { allowFilesystem: false })).toBe(false);
    expect(logs.error).toHaveBeenCalledTimes(1);
    expect(logs.error.mock.calls[0][0]).toMatch('auth type');
  });

  it('validates dependentChangeType', () => {
    expect(areOptionsValid({ dependentChangeType: 'no' as any } as BeachballOptions, { allowFilesystem: false })).toBe(
      false
    );
    expect(logs.error).toHaveBeenCalledTimes(1);
    expect(logs.error.mock.calls[0][0]).toMatch('dependent change type');
  });

  it('validates change type', () => {
    expect(areOptionsValid({ type: 'no' as any } as BeachballOptions, { allowFilesystem: false })).toBe(false);
    expect(logs.error).toHaveBeenCalledTimes(1);
    expect(logs.error.mock.calls[0][0]).toMatch('change type');
  });

  it('validates changelog groups', () => {
    expect(
      areOptionsValid(
        { changelog: { groups: [{ changelogPath: '...', include: '...' }] as any[] } } as BeachballOptions,
        { allowFilesystem: false }
      )
    ).toBe(false);
    expect(logs.error).toHaveBeenCalledTimes(1);
    expect(logs.error.mock.calls[0][0]).toMatch('masterPackageName');

    expect(
      areOptionsValid(
        { changelog: { groups: [{ masterPackageName: 'whatever', include: '...' }] as any[] } } as BeachballOptions,
        { allowFilesystem: false }
      )
    ).toBe(false);
    expect(logs.error).toHaveBeenCalledTimes(2);
    expect(logs.error.mock.calls[1][0]).toMatch('changelogPath');

    expect(
      areOptionsValid(
        {
          changelog: { groups: [{ masterPackageName: 'whatever', changelogPath: '...' }] as any[] },
        } as BeachballOptions,
        { allowFilesystem: false }
      )
    ).toBe(false);
    expect(logs.error).toHaveBeenCalledTimes(3);
    expect(logs.error.mock.calls[2][0]).toMatch('include');
  });
});
