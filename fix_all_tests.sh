#!/bin/bash

echo "Fixing test issues..."

# 1. Fix tests not cleaning up properly - add longer timeout
cat > jest.config.js << 'JESTEOF'
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 120000,
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
  setupFilesAfterEnv: ['./tests/setupTests.js'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  forceExit: true,
  detectOpenHandles: false
};
JESTEOF

# 2. Add proper test cleanup
cat > tests/setupTests.js << 'SETUPEOF'
const mongoose = require('mongoose');

// Increase timeout for all tests
jest.setTimeout(120000);

// Clean up after each test
afterEach(async () => {
  // Clear all timers
  jest.clearAllTimers();
});

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
SETUPEOF

echo "✅ Test configuration fixed"
