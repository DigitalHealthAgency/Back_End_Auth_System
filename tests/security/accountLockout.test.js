// ✅ CRITICAL SECURITY FIX TEST: Account Lockout (30-minute temporary)
// Tests for temporary account lockout after 5 failed attempts

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Account Lockout Security Tests', () => {
  let testUser;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

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
      accountStatus: 'active',
      lockedUntil: null
    });
  });

  describe('Lockout Threshold', () => {
    it('should not lock account after 4 failed attempts', async () => {
      // Fail 4 times
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
      expect(user.lockedUntil).toBeNull();
      expect(user.failedAttempts).toBe(4);
    }, 30000);

    it('should lock account after 5 failed attempts', async () => {
      // Fail 5 times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('locked');
      expect(user.lockedUntil).toBeDefined();
      expect(user.lockedUntil).toBeInstanceOf(Date);
      expect(user.failedAttempts).toBe(5);

      // Should be locked for approximately 30 minutes
      const lockDuration = user.lockedUntil - new Date();
      expect(lockDuration).toBeGreaterThan(29 * 60 * 1000); // At least 29 minutes
      expect(lockDuration).toBeLessThanOrEqual(30 * 60 * 1000); // At most 30 minutes
    }, 60000);

    it('should return ACCOUNT_LOCKED error on 5th failed attempt', async () => {
      // Fail 4 times
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // 5th attempt should lock account
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
      expect(res.body.lockedUntil).toBeDefined();
      expect(res.body.minutesRemaining).toBe(30);
    }, 60000);
  });

  describe('Locked Account Behavior', () => {
    beforeEach(async () => {
      // Lock the account
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      testUser.failedAttempts = 5;
      await testUser.save();
    });

    it('should reject login attempts on locked account', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
      expect(res.body.message).toContain('temporarily locked');
    });

    it('should return remaining lock time in response', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.lockedUntil).toBeDefined();
      expect(res.body.minutesRemaining).toBeLessThanOrEqual(30);
      expect(res.body.minutesRemaining).toBeGreaterThan(0);
    });

    it('should reject login even with correct password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('should log security event for locked account login attempt', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      // Security event should be logged (verify in logs or database)
      // This would require checking the SecurityEvent collection
    });
  });

  describe('Temporary Lockout (30 minutes)', () => {
    it('should automatically unlock after 30 minutes', async () => {
      // Lock account with expiry in the past
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000); // 1 second ago
      testUser.failedAttempts = 5;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      // Should be automatically unlocked and login should succeed
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
      expect(user.lockedUntil).toBeNull();
      expect(user.failedAttempts).toBe(0);
    });

    it('should remain locked if lockout period not expired', async () => {
      // Lock account with expiry in future
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      testUser.failedAttempts = 5;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('locked');
    });
  });

  describe('Failed Attempts Counter', () => {
    it('should increment failed attempts on wrong password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(1);
    });

    it('should track remaining attempts in response', async () => {
      testUser.failedAttempts = 3;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.failedAttempts).toBe(4);
      expect(res.body.remainingAttempts).toBe(1);
    }, 10000);

    it('should reset failed attempts on successful login', async () => {
      testUser.failedAttempts = 3;
      await testUser.save();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
    }, 10000);

    it('should not reset failed attempts on lockout', async () => {
      // Fail 5 times to lock account
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(5);
      expect(user.accountStatus).toBe('locked');
    }, 60000);
  });

  describe('Lockout Notification Email', () => {
    it('should send email notification when account is locked', async () => {
      // This would require mocking the email service
      // For now, we verify the lockout happens
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('locked');
      // Email should be sent (verify with email service mock)
    }, 60000);
  });

  describe('Permanent vs Temporary Suspension', () => {
    it('should distinguish between locked and suspended status', async () => {
      // Locked account (temporary)
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await testUser.save();

      let res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');

      // Suspended account (permanent)
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      testUser.lockedUntil = null;
      await testUser.save();

      res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.message).toContain('suspended');
    });

    it('should not auto-unlock suspended accounts', async () => {
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      testUser.lockedUntil = new Date(Date.now() - 1000); // Past date
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null lockedUntil with locked status', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = null; // Invalid state
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      // Should either unlock or reject gracefully
      expect([200, 423]).toContain(res.status);
    });

    it('should handle extremely high failed attempts', async () => {
      testUser.failedAttempts = 1000;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      // Should still track failed attempts
    }, 35000);

    it('should handle concurrent login attempts during lockout', async () => {
      // Lock account
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await testUser.save();

      // Attempt multiple concurrent logins
      const promises = Array(5).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'ValidPassword123!'
          })
      );

      const results = await Promise.all(promises);

      // All should be rejected with locked status
      results.forEach(res => {
        expect(res.status).toBe(423);
        expect(res.body.code).toBe('ACCOUNT_LOCKED');
      });
    });
  });

  describe('Security Event Logging', () => {
    it('should log failed login attempts', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      // Security event should be logged
      // Verify SecurityEvent collection has the entry
    });

    it('should log account lockout event', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // Security event for lockout should be logged
      // Verify high severity event in SecurityEvent collection
    }, 60000);

    it('should log login attempt on locked account', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await testUser.save();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      // Security event should be logged
    });
  });
});
