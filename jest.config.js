module.exports = {
  roots: ['<rootDir>/src'],
  reporters: ['default', 'github-actions'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 60000,
  testMatch: ['**/{__tests__,__functional__,__e2e__}/**/*.test.ts'],
};
