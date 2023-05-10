// @ts-check
const { jest } = require('@jest/globals');

jest.spyOn(process, 'exit').mockImplementation(code => {
  throw new Error(`process.exit called with code ${code}`);
});
