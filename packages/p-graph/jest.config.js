module.exports = {
  preset: "ts-jest",
  modulePathIgnorePatterns: ["<rootDir>/lib"],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
};
