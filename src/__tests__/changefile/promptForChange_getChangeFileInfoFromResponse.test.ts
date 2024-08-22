import { describe, expect, it } from '@jest/globals';
import { _getChangeFileInfoFromResponse } from '../../changefile/promptForChange';
import { initMockLogs } from '../../__fixtures__/mockLogs';

/**
 * This covers the last part of `promptForChange`: translating the user's responses into a `ChangeFileInfo`.
 */
describe('promptForChange _getChangeFileInfoFromResponse', () => {
  /** Package name used in the tests */
  const pkg = 'foo';
  const comment = 'message';
  const defaultParams: Omit<Parameters<typeof _getChangeFileInfoFromResponse>[0], 'response'> = {
    pkg,
    options: { message: '' },
    email: null,
  };

  const logs = initMockLogs();

  it('works in normal case', () => {
    const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { comment, type: 'patch' } });
    expect(change).toEqual({
      type: 'patch',
      comment,
      packageName: pkg,
      email: 'email not defined',
      dependentChangeType: 'patch',
    });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('uses dependentChangeType none if response.type is none', () => {
    const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { comment, type: 'none' } });
    expect(change).toMatchObject({ type: 'none', dependentChangeType: 'none' });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  it('defaults to options.type if response.type is missing', () => {
    const change = _getChangeFileInfoFromResponse({
      ...defaultParams,
      response: { comment },
      options: { type: 'minor', message: '' },
    });
    expect(change).toMatchObject({ type: 'minor', dependentChangeType: 'patch' });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  // this is somewhat debatable
  it('prefers response.type over options.type', () => {
    const change = _getChangeFileInfoFromResponse({
      ...defaultParams,
      response: { type: 'patch', comment },
      options: { type: 'minor', message: '' },
    });
    expect(change).toMatchObject({ type: 'patch' });
  });

  it('warns and defaults to none if response.type and options.type are unspecified', () => {
    const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { comment } });
    expect(change).toMatchObject({ type: 'none', dependentChangeType: 'none' });
    expect(logs.mocks.log).toHaveBeenCalledTimes(2);
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`
        "WARN: change type 'none' assumed by default
        (Not what you intended? Check the repo-level and package-level beachball configs.)"
      `);
  });

  it('defaults to options.message if response.comment is missing', () => {
    const change = _getChangeFileInfoFromResponse({
      ...defaultParams,
      response: { type: 'patch' },
      options: { message: comment },
    });
    expect(change).toMatchObject({ comment });
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });

  // this is somewhat debatable
  it('prefers response.message over options.message', () => {
    const change = _getChangeFileInfoFromResponse({
      ...defaultParams,
      response: { type: 'patch', comment: 'response message' },
      options: { message: comment },
    });
    expect(change).toMatchObject({ comment: 'response message' });
  });

  it('uses options.dependentChangeType if provided', () => {
    const change = _getChangeFileInfoFromResponse({
      ...defaultParams,
      response: { type: 'patch', comment },
      options: { dependentChangeType: 'minor', message: '' },
    });
    expect(change).toMatchObject({ dependentChangeType: 'minor' });
  });

  it('returns error if response.type is invalid', () => {
    const change = _getChangeFileInfoFromResponse({ ...defaultParams, response: { type: 'invalid' as any } });
    expect(change).toBeUndefined();
    expect(logs.mocks.error).toHaveBeenCalledTimes(1);
    expect(logs.mocks.error).toHaveBeenCalledWith('Prompt response contains invalid change type "invalid"');
  });

  // This is an important scenario for some people who customize the change prompt
  it('preserves extra properties on the returned object', () => {
    const change = _getChangeFileInfoFromResponse({
      ...defaultParams,
      response: { comment, type: 'patch', extra: 'extra' } as any,
    });
    expect(change).toMatchObject({ extra: 'extra' });
  });
});
