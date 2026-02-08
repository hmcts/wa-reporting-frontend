module.exports = {
  roots: ['<rootDir>/src/test/routes'],
  testRegex: '(/src/test/.*|\\.(test|spec))\\.(ts|js)$',
  testPathIgnorePatterns: ['<rootDir>/src/test/routes/routeTestUtils.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testTimeout: 30000,
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
};
