module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testRegex: '/__tests__/.*\\.(test|spec)\\.ts$',
  testTimeout: 60000,
};
