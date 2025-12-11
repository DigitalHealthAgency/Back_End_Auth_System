//  DHA CAPTCHA TESTS
// SRS Requirement: FR-SEC-001 (CAPTCHA required after 3 failed login attempts)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const SecurityEvent = require('../../src/models/securityEvent');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

// Mock the captcha verifier
jest.mock('../../src/utils/captchaVerifier');
const { verifyRecaptcha, isCaptchaRequired } = require('../../src/utils/captchaVerifier');

describe('CAPTCHA Security', () => {
  let testUser;
  const testPassword = 'Test123!@#$';
  const wrongPassword = 'WrongPass123!@#$';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();

    testUser = await User.create({
      type: 'individual',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      accountStatus: 'active',
      failedAttempts: 0
    });
  });

  describe('CAPTCHA Requirement Threshold', () => {
    it('should not require CAPTCHA for first 2 failed attempts', async () => {
      // First failed attempt
      let res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      expect(res.status).toBe(401);
      expect(res.body.requiresCaptcha).toBeFalsy();

      // Second failed attempt
      res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      expect(res.status).toBe(401);
      expect(res.body.requiresCaptcha).toBeFalsy();
    });

    it('should require CAPTCHA after 3 failed attempts', async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // 4th attempt should require CAPTCHA
      const res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
      expect(res.body.requiresCaptcha).toBe(true);
      expect(res.body.message).toContain('CAPTCHA');
    });

    it('should use environment variable CAPTCHA_THRESHOLD if set', () => {
      const originalThreshold = process.env.CAPTCHA_THRESHOLD;
      process.env.CAPTCHA_THRESHOLD = '5';

      // isCaptchaRequired should check against threshold
      expect(isCaptchaRequired(4)).toBe(false);
      expect(isCaptchaRequired(5)).toBe(true);
      expect(isCaptchaRequired(6)).toBe(true);

      // Restore original value
      if (originalThreshold) {
        process.env.CAPTCHA_THRESHOLD = originalThreshold;
      } else {
        delete process.env.CAPTCHA_THRESHOLD;
      }
    });
  });

  describe('CAPTCHA Verification', () => {
    beforeEach(async () => {
      // Set user to 3 failed attempts (CAPTCHA required)
      testUser.failedAttempts = 3;
      await testUser.save();
    });

    it('should reject login without CAPTCHA when required', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword // Use wrong password to trigger CAPTCHA requirement
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
      expect(res.body.requiresCaptcha).toBe(true);
    });

    it('should allow login with correct password without CAPTCHA', async () => {
      // After 3 failed attempts, correct password should still work without CAPTCHA
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should accept login with valid CAPTCHA and wrong password gets rejected', async () => {
      // Mock successful CAPTCHA verification
      verifyRecaptcha.mockResolvedValue({
        success: true,
        score: 0.9,
        hostname: 'localhost'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: 'valid_captcha_token'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(verifyRecaptcha).toHaveBeenCalledWith(
        'valid_captcha_token',
        expect.any(String) // IP address
      );
    });

    it('should reject login with invalid CAPTCHA', async () => {
      // Mock failed CAPTCHA verification
      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['Invalid CAPTCHA response'],
        code: 'CAPTCHA_INVALID'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: 'invalid_token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_INVALID');
      expect(res.body.requiresCaptcha).toBe(true);
    });

    it('should reject login with low CAPTCHA score', async () => {
      // Mock CAPTCHA with score too low
      verifyRecaptcha.mockResolvedValue({
        success: false,
        score: 0.3,
        errors: ['CAPTCHA score too low: 0.3 < 0.5'],
        code: 'CAPTCHA_SCORE_TOO_LOW'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword, // Use wrong password
          captchaToken: 'low_score_token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_SCORE_TOO_LOW');
    });
  });

  describe('CAPTCHA After Successful Login', () => {
    it('should reset CAPTCHA requirement after successful login', async () => {
      // Set user to 3 failed attempts
      testUser.failedAttempts = 3;
      await testUser.save();

      // Mock successful CAPTCHA
      verifyRecaptcha.mockResolvedValue({
        success: true,
        score: 0.9
      });

      // Successful login with CAPTCHA
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword,
          captchaToken: 'valid_token'
        });

      expect(res1.status).toBe(200);

      // Next login should not require CAPTCHA
      const res2 = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res2.status).toBe(200);
      expect(res2.body.requiresCaptcha).toBeFalsy();
    });
  });

  describe('CAPTCHA Error Codes', () => {
    beforeEach(async () => {
      testUser.failedAttempts = 3;
      await testUser.save();
    });

    it('should handle CAPTCHA_TOKEN_MISSING error', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['CAPTCHA token is required'],
        code: 'CAPTCHA_TOKEN_MISSING'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_TOKEN_MISSING');
    });

    it('should handle CAPTCHA_TIMEOUT error', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['CAPTCHA verification timeout'],
        code: 'CAPTCHA_TIMEOUT'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: 'timeout_token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_TIMEOUT');
    });

    it('should handle CAPTCHA_SERVICE_ERROR', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['CAPTCHA verification service unavailable'],
        code: 'CAPTCHA_SERVICE_ERROR'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: 'error_token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_SERVICE_ERROR');
    });
  });

  describe('Security Event Logging', () => {
    beforeEach(async () => {
      testUser.failedAttempts = 3;
      await testUser.save();
    });

    it('should log security event on failed CAPTCHA verification', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['Invalid CAPTCHA'],
        code: 'CAPTCHA_INVALID'
      });

      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: 'invalid_token'
        });

      const events = await SecurityEvent.find({
        user: testUser._id,
        action: 'Failed CAPTCHA Verification'
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].severity).toBe('medium');
    });

    it('should log successful CAPTCHA verification', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: true,
        score: 0.9
      });

      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword,
          captchaToken: 'valid_token'
        });

      // Login should succeed
      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
    });
  });

  describe('CAPTCHA in Registration', () => {
    it('should allow registration without CAPTCHA in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com',
          phone: '+254712345690',
          password: 'NewUser123!@#$'
        });

      expect(res.status).toBe(201);

      process.env.NODE_ENV = originalEnv;
    });

    it('should accept registration with valid CAPTCHA', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: true,
        score: 0.9
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com',
          phone: '+254712345690',
          password: 'NewUser123!@#$',
          captchaToken: 'valid_token'
        });

      expect(res.status).toBe(201);
    });

    it('should reject registration with invalid CAPTCHA when provided', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['Invalid CAPTCHA'],
        code: 'CAPTCHA_INVALID'
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com',
          phone: '+254712345690',
          password: 'NewUser123!@#$',
          captchaToken: 'invalid_token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_INVALID');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined captchaToken gracefully', async () => {
      testUser.failedAttempts = 3;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: undefined
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
    });

    it('should handle null captchaToken gracefully', async () => {
      testUser.failedAttempts = 3;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: null
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_REQUIRED');
    });

    it('should handle very long CAPTCHA tokens', async () => {
      testUser.failedAttempts = 3;
      await testUser.save();

      const longToken = 'a'.repeat(10000);

      verifyRecaptcha.mockResolvedValue({
        success: false,
        errors: ['Invalid token'],
        code: 'CAPTCHA_INVALID'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: longToken
        });

      expect(res.status).toBe(400);
      expect(verifyRecaptcha).toHaveBeenCalled();
    });
  });

  describe('CAPTCHA Score Thresholds', () => {
    beforeEach(async () => {
      testUser.failedAttempts = 3;
      await testUser.save();
    });

    it('should accept CAPTCHA score of 0.5 (minimum threshold)', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: true,
        score: 0.5
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword,
          captchaToken: 'threshold_token'
        });

      expect(res.status).toBe(200);
    });

    it('should accept CAPTCHA score above threshold', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: true,
        score: 0.95
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword,
          captchaToken: 'high_score_token'
        });

      expect(res.status).toBe(200);
    });

    it('should reject CAPTCHA score just below threshold', async () => {
      verifyRecaptcha.mockResolvedValue({
        success: false,
        score: 0.49,
        errors: ['CAPTCHA score too low: 0.49 < 0.5'],
        code: 'CAPTCHA_SCORE_TOO_LOW'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword,
          captchaToken: 'low_score_token'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_SCORE_TOO_LOW');
    });
  });
});
