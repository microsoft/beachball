import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';
import { npmAsync } from '../packageManager/npm';

type NpmShowResult = {
  versions?: string[];
  'dist-tags'?: Record<string, string>;
};

/** Mapping from package name to value to return from npm show */
type NpmShowMockData = Record<string, NpmShowResult>;

/**
 * Mock the `npm show` command for `npmAsync` calls.
 * Other commands could potentially be mocked in the future.
 */
export function initNpmAsyncMock() {
  const npmSpy = npmAsync as jest.MockedFunction<typeof npmAsync>;
  if (!npmSpy.mock) {
    throw new Error('npmAsync() is not currently mocked');
  }

  let showData: NpmShowMockData | undefined;

  beforeAll(() => {
    npmSpy.mockImplementation(args => {
      if (args[0] !== 'show') throw new Error('unrecognized npm command: ' + args.join(' '));
      if (!showData) throw new Error('npm show called before npmMock.setShowData()');

      const packageName = args.slice(-1)[0];
      const data = showData[packageName];
      const stdout = data ? JSON.stringify(data) : '';

      return Promise.resolve({ stdout, success: !!data }) as ReturnType<typeof npmAsync>;
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
