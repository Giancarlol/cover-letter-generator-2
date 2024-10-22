export default {
  preset: 'ts-jest',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: [
    '@testing-library/jest-dom/extend-expect',
    './jest.setup.js'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  projects: [
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.(ts|tsx)'],
    },
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.js'],
    },
  ],
};
