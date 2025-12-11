const mongoose = require('mongoose');

// Increase timeout for all tests
jest.setTimeout(120000);

// Suppress mongoose deprecation warnings in tests
mongoose.set('strictQuery', false);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test_resend_key';
process.env.RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || 'test_recaptcha_secret';

// Jest matchers extensions
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid email`
        : `expected ${received} to be a valid email`
    };
  },

  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const pass = jwtRegex.test(received);

    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid JWT`
        : `expected ${received} to be a valid JWT`
    };
  },

  toBeValidObjectId(received) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    const pass = objectIdRegex.test(received);

    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid ObjectId`
        : `expected ${received} to be a valid ObjectId`
    };
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear all timers
  jest.clearAllTimers();
});

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
