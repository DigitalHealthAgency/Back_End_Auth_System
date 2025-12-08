const mongoose = require('mongoose');

// Increase timeout for all tests
jest.setTimeout(120000);

// Suppress mongoose deprecation warnings in tests
mongoose.set('strictQuery', false);

// Clean up after each test
afterEach(async () => {
  // Clear all timers
  jest.clearAllTimers();
});

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
