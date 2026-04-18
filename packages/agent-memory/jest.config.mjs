export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.mjs'],
  maxWorkers: 1,
  clearMocks: true,
  moduleNameMapper: {
    '^node:sqlite$': '<rootDir>/test/shims/node-sqlite-shim.mjs',
  },
  transform: {},
};
