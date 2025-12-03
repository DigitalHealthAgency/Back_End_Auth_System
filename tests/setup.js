// ✅ TEST SETUP - Runs before each test file
// Configures environment and global mocks

require('dotenv').config({ path: '.env.test' });

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test configuration
global.testConfig = {
  jwtSecret: 'test_jwt_secret_key_for_testing_only',
  bcryptRounds: 4, // Lower rounds for faster tests
  mongoUri: process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/huduma-hub-test'
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = global.testConfig.jwtSecret;
process.env.MONGO_URI = global.testConfig.mongoUri;
process.env.RESEND_API_KEY = 'test_resend_key';
process.env.RECAPTCHA_SECRET_KEY = 'test_recaptcha_secret';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_key';
process.env.CLOUDINARY_API_SECRET = 'test_secret';

// Console suppression during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Global test utilities
global.testUtils = {
  // Generate random email
  randomEmail: () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,

  // Generate random phone
  randomPhone: () => `+25471${Math.floor(1000000 + Math.random() * 9000000)}`,

  // Generate random username
  randomUsername: () => `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,

  // Wait helper
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Deep clone
  clone: (obj) => JSON.parse(JSON.stringify(obj))
};

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
