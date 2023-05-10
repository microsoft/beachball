// @ts-check
const { jest, afterAll } = require('@jest/globals');

jest.spyOn(process, 'exit').mockImplementation(code => {
  throw new Error(`process.exit called with code ${code}`);
});

afterAll(() => {
  jest.restoreAllMocks();
});
