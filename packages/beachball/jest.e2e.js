module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '/__e2e__/.*\\.(test|spec)\\.[jt]sx?$',
};
