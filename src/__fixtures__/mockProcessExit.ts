import { afterAll, beforeAll, jest } from '@jest/globals';

/**
 * Set up `beforeAll` to throw an error if `process.exit()` is called.
 * (This should be called in the `describe()` body.)
 */
export function mockProcessExit() {
  beforeAll(() => {
    // throw if validate() fails
    jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
}
