// ✅ CRITICAL SECURITY FIX TEST: Progressive Delays
// Tests for progressive delay enforcement (1s, 2s, 5s, 10s, 30s)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Progressive Delays Security Tests', () => {
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
      accountStatus: 'active'
    });
  });

  describe('Delay Timing', () => {
    it('should apply 1 second delay after first failed attempt', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be approximately 1000ms (allow 200ms tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(1000);
      expect(elapsed).toBeLessThan(1200);
    });

    it('should apply 2 second delay after second failed attempt', async () => {
      // First failed attempt
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      // Second failed attempt
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be approximately 2000ms (allow 200ms tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(2000);
      expect(elapsed).toBeLessThan(2200);
    });

    it('should apply 5 second delay after third failed attempt', async () => {
      // First two failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // Third failed attempt
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be approximately 5000ms (allow 200ms tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(5000);
      expect(elapsed).toBeLessThan(5200);
    });

    it('should apply 10 second delay after fourth failed attempt', async () => {
      // First three failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // Fourth failed attempt
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be approximately 10000ms (allow 300ms tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(10000);
      expect(elapsed).toBeLessThan(10300);
    }, 15000); // Increase timeout for this test

    it('should apply 30 second delay after fifth failed attempt', async () => {
      // First four failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // Fifth failed attempt
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be approximately 30000ms (allow 500ms tolerance)
      // Note: This may trigger account lockout as well
      expect(elapsed).toBeGreaterThanOrEqual(30000);
      expect(elapsed).toBeLessThan(30500);
    }, 35000); // Increase timeout for this test
  });

  describe('Delay Progression', () => {
    it('should maintain maximum delay for attempts beyond 5', async () => {
      // Set failed attempts to 10
      testUser.failedAttempts = 10;
      testUser.accountStatus = 'active'; // Ensure not locked for test
      testUser.lockedUntil = null;
      await testUser.save();

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should still apply maximum 30 second delay
      expect(elapsed).toBeGreaterThanOrEqual(30000);
      expect(elapsed).toBeLessThan(30500);
    }, 35000);

    it('should apply delays in correct sequence', async () => {
      const expectedDelays = [1000, 2000, 5000, 10000, 30000];
      const tolerance = 500;

      for (let i = 0; i < expectedDelays.length; i++) {
        const startTime = Date.now();

        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });

        const endTime = Date.now();
        const elapsed = endTime - startTime;

        expect(elapsed).toBeGreaterThanOrEqual(expectedDelays[i]);
        expect(elapsed).toBeLessThan(expectedDelays[i] + tolerance);
      }
    }, 60000); // Increase timeout for full sequence
  });

  describe('Delay Reset on Successful Login', () => {
    it('should reset delays after successful login', async () => {
      // Fail twice to increase delay
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: 'WrongPassword123!'
          });
      }

      // Successful login (should reset failed attempts)
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      // Next failed attempt should have base delay (1s)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be back to 1 second delay
      expect(elapsed).toBeGreaterThanOrEqual(1000);
      expect(elapsed).toBeLessThan(1200);
    });
  });

  describe('Delays Apply to All Login Attempts', () => {
    it('should apply delay even with correct password', async () => {
      // Set failed attempts
      testUser.failedAttempts = 2;
      await testUser.save();

      const startTime = Date.now();

      // Login with correct password
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should still apply delay based on previous failed attempts
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });

    it('should apply base delay even for first attempt with correct password', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should apply base 1 second delay
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Delays Prevent Brute Force Attacks', () => {
    it('should make rapid password guessing infeasible', async () => {
      const passwords = [
        'Password1!',
        'Password2!',
        'Password3!',
        'Password4!',
        'Password5!'
      ];

      const startTime = Date.now();

      for (const password of passwords) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: password
          });
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Total time should be: 1s + 2s + 5s + 10s + 30s = 48s minimum
      expect(elapsed).toBeGreaterThanOrEqual(48000);
    }, 55000); // Increase timeout
  });

  describe('Concurrent Request Handling', () => {
    it('should apply delays independently to different users', async () => {
      // Create second user
      const hashedPassword = await bcrypt.hash('ValidPassword456!', 12);
      await User.create({
        type: 'individual',
        username: 'testuser2',
        firstName: 'Test',
        lastName: 'User2',
        email: 'test2@example.com',
        phone: '+254712345670',
        password: hashedPassword,
        twoFactorEnabled: false,
        failedAttempts: 0,
        accountStatus: 'active'
      });

      // Fail login for first user (should add delay)
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      // Second user should have base delay (not affected by first user's failures)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test2@example.com',
          password: 'WrongPassword456!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should have base 1 second delay (not influenced by other user)
      expect(elapsed).toBeGreaterThanOrEqual(1000);
      expect(elapsed).toBeLessThan(1200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative failed attempts gracefully', async () => {
      testUser.failedAttempts = -1;
      await testUser.save();

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should still apply base delay
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });

    it('should handle extremely high failed attempts', async () => {
      testUser.failedAttempts = 1000;
      testUser.accountStatus = 'active';
      testUser.lockedUntil = null;
      await testUser.save();

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should cap at maximum 30 second delay
      expect(elapsed).toBeGreaterThanOrEqual(30000);
      expect(elapsed).toBeLessThan(30500);
    }, 35000);

    it('should apply delay even when user not found', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'nonexistent@example.com',
          password: 'SomePassword123!'
        });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should apply delay to prevent user enumeration
      expect(elapsed).toBeGreaterThanOrEqual(1500); // Different delay for not found
    });
  });
});
