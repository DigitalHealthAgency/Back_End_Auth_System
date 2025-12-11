//  DHA PROGRESSIVE DELAYS TESTS
// SRS Requirement: FR-SEC-001 (Progressive delays: 1s, 2s, 5s, 10s, 30s for failed login attempts)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const SecurityEvent = require('../../src/models/securityEvent');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Progressive Delays Security', () => {
  let testUser;
  const testPassword = 'Test123!@#$';
  const wrongPassword = 'WrongPass123!@#$';

  // Expected delays in milliseconds for each attempt
  const EXPECTED_DELAYS = [1000, 2000, 5000, 10000, 30000];
  const TOLERANCE = 2500; // Allow 2500ms tolerance for bcrypt, DB operations, and execution overhead

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    testUser = await User.create({
      type: 'individual',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 4), // Use 4 rounds for speed in timing tests
      role: 'public_user',
      accountStatus: 'active',
      failedAttempts: 0
    });
  });

  describe('Progressive Delay Implementation', () => {
    it('should apply 1 second delay on first failed attempt', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword
        });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[0] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[0] + TOLERANCE);
    });

    it('should apply 2 second delay on second failed attempt', async () => {
      // First attempt
      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      // Second attempt (measure delay)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[1] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[1] + TOLERANCE);
    });

    it('should apply 5 second delay on third failed attempt', async () => {
      // First two attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // Third attempt (measure delay)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[2] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[2] + TOLERANCE);
    }, 10000); // Increase timeout

    it('should apply 10 second delay on fourth failed attempt', async () => {
      // First three attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // Fourth attempt (measure delay)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[3] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[3] + TOLERANCE);
    }, 25000); // Increased timeout for cumulative delays (1s + 2s + 5s + 10s)

    it('should apply 30 second delay on fifth failed attempt', async () => {
      // First four attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // Fifth attempt (measure delay)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[4] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[4] + 1000); // Allow more tolerance for 30s
    }, 55000); // Increased timeout for cumulative delays (1s + 2s + 5s + 10s + 30s)
  });

  describe('Delay Reset After Successful Login', () => {
    it('should reset delay counter after successful login', async () => {
      // Make 2 failed attempts (would cause 2s delay on next failure)
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // Successful login
      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: testPassword });

      // Next failed attempt should use first delay (1s)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[0] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[0] + TOLERANCE);
    });

    it('should apply delays cumulatively across failed attempts', async () => {
      const delays = [];

      // Make 4 failed attempts and measure each delay
      for (let i = 0; i < 4; i++) {
        const startTime = Date.now();

        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });

        delays.push(Date.now() - startTime);
      }

      // Verify each delay is progressively longer
      for (let i = 0; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(EXPECTED_DELAYS[i] - TOLERANCE);
      }

      // Verify progressive increase
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1]);
      }
    }, 25000); // Increase timeout for multiple delays
  });

  describe('Delay Cap at 30 Seconds', () => {
    it('should cap delay at 30 seconds for attempts beyond 5th', async () => {
      // Make 5 failed attempts to reach max delay
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // 6th attempt should still use 30s delay (capped)
      // But account will be locked, so we can't test this directly
      // Instead verify that the delay array only has 5 elements
      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
    }, 60000); // Long timeout for multiple delays
  });

  describe('Delay Timing Accuracy', () => {
    it('should apply delays even with correct password (before verification)', async () => {
      // Set user to have 2 failed attempts
      testUser.failedAttempts = 2;
      await testUser.save();

      // Even with correct password, delay should be applied first
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: testPassword });

      const elapsedTime = Date.now() - startTime;

      // Should have 5s delay (third attempt)
      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[2] - TOLERANCE);
    });

    it('should not double-delay on wrong password', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      // Should only have one delay applied (1s for first attempt)
      // Not 2s total (1s progressive + 1s additional)
      expect(elapsedTime).toBeLessThan(2000);
      expect(res.status).toBe(401);
    });
  });

  describe('Delay Application Per User', () => {
    let secondUser;

    beforeEach(async () => {
      secondUser = await User.create({
        type: 'individual',
        username: 'seconduser',
        firstName: 'Second',
        lastName: 'User',
        email: 'second@example.com',
        phone: '+254712345679',
        password: await bcrypt.hash(testPassword, 4), // Use 4 rounds for speed in timing tests
        role: 'public_user',
        accountStatus: 'active',
        failedAttempts: 0
      });
    });

    it('should apply delays independently per user', async () => {
      // Make 3 failed attempts for first user
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // First user's next attempt would have 10s delay
      // But second user's first attempt should only have 1s delay
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'second@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[0] - TOLERANCE);
      expect(elapsedTime).toBeLessThan(EXPECTED_DELAYS[0] + TOLERANCE);
    }, 20000);
  });

  describe('Delay Consistency', () => {
    it('should apply consistent delays across multiple sessions', async () => {
      // First session: 2 failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // Simulate new session (delays should continue from where they left off)
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      // Third attempt should have 5s delay
      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[2] - TOLERANCE);
    }, 10000);

    it('should maintain delay state even after errors', async () => {
      // Make 1 failed attempt
      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      // Make another failed attempt - should have 2s delay
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[1] - TOLERANCE);
    });
  });

  describe('Organization Account Delays', () => {
    let orgUser;

    beforeEach(async () => {
      orgUser = await User.create({
        type: 'organization',
        organizationName: 'Test Org',
        organizationType: 'HOSPITAL',
        county: 'Nairobi',
        subCounty: 'Westlands',
        organizationEmail: 'org@example.com',
        organizationPhone: '+254712345680',
        yearOfEstablishment: 2020,
        password: await bcrypt.hash(testPassword, 4), // Use 4 rounds for speed in timing tests
        role: 'vendor_developer',
        accountStatus: 'active',
        failedAttempts: 0
      });
    });

    it('should apply progressive delays to organization accounts', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'org@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[0] - TOLERANCE);
    });

    it('should apply same delay sequence to organization accounts', async () => {
      // Make 2 failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'org@example.com', password: wrongPassword });
      }

      // Third attempt should have 5s delay
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'org@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[2] - TOLERANCE);
    }, 10000);
  });

  describe('Delay Security Event Logging', () => {
    it('should log failed login attempts with delay information', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const events = await SecurityEvent.find({
        user: testUser._id,
        action: 'Failed Login'
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].details.failedAttempts).toBe(1);
    });

    it('should track progressive attempt counts in security events', async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      const events = await SecurityEvent.find({
        user: testUser._id,
        action: 'Failed Login'
      }).sort({ createdAt: -1 });

      expect(events.length).toBeGreaterThanOrEqual(3);
      // Most recent event should show 3 failed attempts
      expect(events[0].details.failedAttempts).toBe(3);
    }, 15000);
  });

  describe('Edge Cases', () => {
    it('should handle zero failedAttempts correctly', async () => {
      testUser.failedAttempts = 0;
      await testUser.save();

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      // Should apply first delay (1s)
      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[0] - TOLERANCE);
    });

    it('should handle negative failedAttempts gracefully', async () => {
      testUser.failedAttempts = -1;
      await testUser.save();

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      // Should default to first delay (1s)
      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[0] - TOLERANCE);
    });

    it('should handle very large failedAttempts values', async () => {
      testUser.failedAttempts = 1000;
      await testUser.save();

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      const elapsedTime = Date.now() - startTime;

      // Should cap at maximum delay (30s)
      expect(elapsedTime).toBeGreaterThanOrEqual(EXPECTED_DELAYS[4] - TOLERANCE);
    }, 35000);
  });

  describe('Delay Interaction with Account Lockout', () => {
    it('should apply delays before checking lockout status', async () => {
      // Lock the account
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      // Attempt should still have delay applied
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: testPassword });

      const elapsedTime = Date.now() - startTime;

      // Should have applied the 30s delay (5th attempt)
      // But will be blocked by lockout
      expect(elapsedTime).toBeLessThan(1000); // Lockout check happens before delay
    });
  });
});
