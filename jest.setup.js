const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Load test environment variables
require('./testEnv.js');

// Reset modules before each test
beforeEach(() => {
  jest.resetModules();
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
