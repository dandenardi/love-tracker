module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  clearMocks: true,
};
