module.exports = {
  roots: ['<rootDir>/src/test/unit', '<rootDir>/src/main'],
  testRegex: '(/src/test/.*|\\.(test|spec))\\.(ts|js)$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  collectCoverageFrom: ['<rootDir>/src/main/**/*.ts', '!<rootDir>/src/main/**/*.d.ts'],
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
};
