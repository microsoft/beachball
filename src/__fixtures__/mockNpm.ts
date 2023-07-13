import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';
import { NpmShowResult } from '../packageManager/listPackageVersions';
import { npm, NpmResult } from '../packageManager/npm';

/** Mapping from package name to value to return from npm show */
type NpmShowMockData = Record<string, Partial<NpmShowResult>>;

/**
 * Mock the `npm show` command for `npm` calls.
 * Other commands could potentially be mocked in the future.
 *
 * This should be called at the top level of tests because it handles its own setup/teardown
 * (and resetting between tests) using lifecycle functions.
 */
export function initNpmMock() {
  const npmSpy = npm as jest.MockedFunction<typeof npm>;
  if (!npmSpy.mock) {
    throw new Error(
      'npm() is not currently mocked (you must call jest.mock() for <pathTo>/packageManager/npm in your test)'
    );
  }

  let showData: NpmShowMockData | undefined;

  beforeAll(() => {
    npmSpy.mockImplementation(args => {
      if (args[0] !== 'show') throw new Error('unrecognized npm command: ' + args.join(' '));
      if (!showData) throw new Error('npm show called before npmMock.setShowData()');

      const packageName = args.slice(-1)[0];
      const data = showData[packageName];
      const stdout = data ? JSON.stringify(data) : '';

      return Promise.resolve({ stdout, success: !!data } as NpmResult);
    });
  });

  afterEach(() => {
    showData = undefined;
    npmSpy.mockClear();
  });

  afterAll(() => {
    npmSpy.mockRestore();
  });

  return {
    spy: npmSpy,
    setShowData: (data: NpmShowMockData) => {
      showData = data;
    },
  };
}
