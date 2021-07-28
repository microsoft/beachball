module.exports = {
  reporters: ['<rootDir>/jest.reporter.js', '@jest/reporters/build/SummaryReporter'],
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '/__e2e__/.*\\.(test|spec)\\.[jt]sx?$',
};
