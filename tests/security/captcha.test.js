// ✅ CRITICAL SECURITY FIX TEST: CAPTCHA Verification
// Tests for CAPTCHA requirement after 3 failed login attempts

const request = require('supertest');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { verifyRecaptcha, isCaptchaRequired } = require('../../src/utils/captchaVerifier');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

// Mock axios for Google reCAPTCHA API calls
jest.mock('axios');

describe('CAPTCHA Security Tests', () => {
  let testUser;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();

    // Create test user
    const hashedPassword = await bcrypt.hash('ValidPassword123!', 12);
    testUser = await User.create({
      type: 'individual',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+254712345678',
      password: hashedPassword,
      twoFactorEnabled: false,
      failedAttempts: 0,
      accountStatus: 'active'
    });
  });

  describe('CAPTCHA Requirement Threshold', () => {
    it('should not require CAPTCHA for first 2 failed attempts', async () => {
      // First failed attempt
      let res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.requiresCaptcha).toBeUndefined();

      // Second failed attempt
      res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.requiresCaptcha).toBeUndefined();
    });

    it('should require CAPTCHA after 3 failed attempts', async () => {
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // Fourth attempt should require CAPTCHA
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
      expect(res.body.requiresCaptcha).toBe(true);
      expect(res.body.failedAttempts).toBeGreaterThanOrEqual(3);
    });

    it('should require CAPTCHA for all subsequent attempts after threshold', async () => {
      // Set failed attempts to 5
      testUser.failedAttempts = 5;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
      expect(res.body.requiresCaptcha).toBe(true);
    });
  });

  describe('CAPTCHA Verification', () => {
    beforeEach(async () => {
      // Set failed attempts to 3 to require CAPTCHA
      testUser.failedAttempts = 3;
      await testUser.save();
    });

    it('should accept valid CAPTCHA token', async () => {
      // Mock successful CAPTCHA verification
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.9,
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!',
          captchaToken: 'valid-captcha-token'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(axios.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should reject invalid CAPTCHA token', async () => {
      // Mock failed CAPTCHA verification
      axios.post.mockResolvedValue({
        data: {
          success: false,
          'error-codes': ['invalid-input-response']
        }
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!',
          captchaToken: 'invalid-captcha-token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_INVALID');
      expect(res.body.requiresCaptcha).toBe(true);
    });

    it('should reject CAPTCHA with low score', async () => {
      // Mock CAPTCHA with low score (bot-like behavior)
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.2, // Below threshold
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!',
          captchaToken: 'low-score-token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_SCORE_TOO_LOW');
      expect(res.body.errors).toContain('CAPTCHA score too low');
    });

    it('should reset failed attempts after successful login with CAPTCHA', async () => {
      // Mock successful CAPTCHA
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.9,
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!',
          captchaToken: 'valid-captcha-token'
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
    });
  });

  describe('CAPTCHA Utility Functions', () => {
    it('isCaptchaRequired should return true after threshold', () => {
      expect(isCaptchaRequired(0)).toBe(false);
      expect(isCaptchaRequired(1)).toBe(false);
      expect(isCaptchaRequired(2)).toBe(false);
      expect(isCaptchaRequired(3)).toBe(true);
      expect(isCaptchaRequired(4)).toBe(true);
      expect(isCaptchaRequired(5)).toBe(true);
    });

    it('verifyRecaptcha should handle successful verification', async () => {
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.9,
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });

      const result = await verifyRecaptcha('valid-token', '127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.score).toBe(0.9);
      expect(result.hostname).toBe('localhost');
    });

    it('verifyRecaptcha should handle failed verification', async () => {
      axios.post.mockResolvedValue({
        data: {
          success: false,
          'error-codes': ['invalid-input-response', 'timeout-or-duplicate']
        }
      });

      const result = await verifyRecaptcha('invalid-token', '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('invalid-input-response');
      expect(result.errors).toContain('timeout-or-duplicate');
    });

    it('verifyRecaptcha should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const result = await verifyRecaptcha('token', '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAPTCHA_SERVICE_ERROR');
      expect(result.errors).toContain('CAPTCHA verification service unavailable');
    });

    it('verifyRecaptcha should handle timeout', async () => {
      axios.post.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await verifyRecaptcha('token', '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAPTCHA_TIMEOUT');
    });

    it('verifyRecaptcha should reject low scores', async () => {
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.3,
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });

      const result = await verifyRecaptcha('token', '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAPTCHA_SCORE_TOO_LOW');
      expect(result.score).toBe(0.3);
    });
  });

  describe('CAPTCHA with Different Login Scenarios', () => {
    beforeEach(async () => {
      testUser.failedAttempts = 3;
      await testUser.save();

      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.9,
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });
    });

    it('should require CAPTCHA even with correct password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
          // No captchaToken
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
    });

    it('should verify CAPTCHA before checking password', async () => {
      axios.post.mockResolvedValue({
        data: {
          success: false,
          'error-codes': ['invalid-input-response']
        }
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!',
          captchaToken: 'invalid-token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_INVALID');
      // Should not increment failed attempts since CAPTCHA failed
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing CAPTCHA secret key', async () => {
      const originalKey = process.env.RECAPTCHA_SECRET_KEY;
      delete process.env.RECAPTCHA_SECRET_KEY;

      testUser.failedAttempts = 3;
      await testUser.save();

      const result = await verifyRecaptcha('token');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAPTCHA_NOT_CONFIGURED');

      process.env.RECAPTCHA_SECRET_KEY = originalKey;
    });

    it('should handle custom CAPTCHA threshold from environment', () => {
      const originalThreshold = process.env.CAPTCHA_THRESHOLD;
      process.env.CAPTCHA_THRESHOLD = '5';

      expect(isCaptchaRequired(4)).toBe(false);
      expect(isCaptchaRequired(5)).toBe(true);

      if (originalThreshold) {
        process.env.CAPTCHA_THRESHOLD = originalThreshold;
      } else {
        delete process.env.CAPTCHA_THRESHOLD;
      }
    });

    it('should handle custom minimum score from environment', async () => {
      const originalMinScore = process.env.RECAPTCHA_MIN_SCORE;
      process.env.RECAPTCHA_MIN_SCORE = '0.7';

      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.6, // Below custom threshold
          challenge_ts: '2025-01-01T00:00:00Z',
          hostname: 'localhost'
        }
      });

      const result = await verifyRecaptcha('token');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAPTCHA_SCORE_TOO_LOW');

      if (originalMinScore) {
        process.env.RECAPTCHA_MIN_SCORE = originalMinScore;
      } else {
        delete process.env.RECAPTCHA_MIN_SCORE;
      }
    });
  });
});
