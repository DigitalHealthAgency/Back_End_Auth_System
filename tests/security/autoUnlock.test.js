//  DHA AUTO-UNLOCK TESTS
// SRS Requirement: FR-AUTH-003 (Automatic unlock after 30 minutes)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const SecurityEvent = require('../../src/models/securityEvent');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Account Auto-Unlock Security', () => {
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

  describe('Auto-Unlock After 30 Minutes', () => {
    it('should automatically unlock account after lockedUntil time has passed', async () => {
      // Lock account with expired lock time (1 minute in past)
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      testUser.lockedUntil = new Date(Date.now() - 1 * 60 * 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      // Attempt login with correct password
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
      expect(user.lockedUntil).toBeUndefined();
      expect(user.accountStatus).toBe('active');
      expect(user.suspended).toBe(false);
    });

    it('should still block login if lockedUntil time has not passed', async () => {
      // Lock account with 29 minutes remaining
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + 29 * 60 * 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.remainingMinutes).toBeGreaterThan(28);
    });

    it('should unlock account exactly at 30-minute mark', async () => {
      // Lock account with lock time expiring right now
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now());
      testUser.failedAttempts = 5;
      await testUser.save();

      // Wait 1 second to ensure we're past the lock time
      await new Promise(resolve => setTimeout(resolve, 1000));

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
      expect(user.failedAttempts).toBe(0);
    });
  });

  describe('Auto-Unlock Behavior', () => {
    it('should reset all lockout-related fields on successful unlock', async () => {
      // Lock account with expired time
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      testUser.lockedUntil = new Date(Date.now() - 1 * 60 * 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
      expect(user.lockedUntil).toBeUndefined();
      expect(user.accountStatus).toBe('active');
      expect(user.suspended).toBe(false);
    });

    it('should allow login immediately after auto-unlock', async () => {
      // Lock account with expired time
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      // First login should succeed (auto-unlock)
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res1.status).toBe(200);

      // Second login should also succeed
      const res2 = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res2.status).toBe(200);
    });

    it('should not unlock if wrong password is provided after lockout expires', async () => {
      // Lock account with expired time
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      // Try to login with wrong password - should start new attempt counter
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Remaining Time Calculation', () => {
    it('should accurately calculate remaining minutes', async () => {
      const remainingMinutes = 25;
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + remainingMinutes * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.remainingMinutes).toBeGreaterThan(24);
      expect(res.body.remainingMinutes).toBeLessThanOrEqual(25);
    });

    it('should round up remaining minutes', async () => {
      // 10 seconds remaining should show as 1 minute
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + 10 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.remainingMinutes).toBe(1);
    });
  });

  describe('Security Event Logging', () => {
    it('should log successful unlock event', async () => {
      // Lock account with expired time
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      // Check that failed attempts reset event was logged
      const events = await SecurityEvent.find({
        user: testUser._id,
        action: 'Failed Attempts Reset'
      });

      expect(events.length).toBeGreaterThan(0);
    });

    it('should log failed login attempt on locked account', async () => {
      // Lock account that hasn\'t expired
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + 20 * 60 * 1000);
      await testUser.save();

      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      const events = await SecurityEvent.find({
        user: testUser._id,
        action: 'Login Attempt on Locked Account'
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].severity).toBe('high');
    });
  });

  describe('Multiple Lock-Unlock Cycles', () => {
    it('should handle multiple lock-unlock cycles correctly', async () => {
      // First cycle: Lock and unlock
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      const res1 = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: testPassword });
      expect(res1.status).toBe(200);

      // Make 5 failed attempts to lock again
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      let user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.failedAttempts).toBe(5);

      // Wait for lock to expire (simulate)
      user.lockedUntil = new Date(Date.now() - 1000);
      await user.save();

      // Second unlock
      const res2 = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: testPassword });
      expect(res2.status).toBe(200);

      user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
      expect(user.failedAttempts).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle lockedUntil being null', async () => {
      testUser.accountStatus = 'active';
      testUser.lockedUntil = null;
      testUser.failedAttempts = 0;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
    });

    it('should handle invalid lockedUntil dates', async () => {
      testUser.accountStatus = 'active';
      testUser.lockedUntil = undefined;
      testUser.failedAttempts = 0;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
    });

    it('should handle account locked far in future', async () => {
      // Lock for 24 hours (way more than 30 minutes)
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.remainingMinutes).toBeGreaterThan(1400); // ~24 hours
    });
  });

  describe('Organization Account Auto-Unlock', () => {
    let orgUser;

    beforeEach(async () => {
      orgUser = await User.create({
        type: 'organization',
        organizationName: 'Test Org',
        organizationType: 'HOSPITAL',
        county: 'Nairobi',
        subCounty: 'Westlands',
        organizationEmail: 'org@example.com',
        organizationPhone: '+254712345679',
        yearOfEstablishment: 2020,
        password: await bcrypt.hash(testPassword, 12),
        role: 'vendor_developer',
        accountStatus: 'active',
        failedAttempts: 0
      });
    });

    it('should auto-unlock organization accounts after 30 minutes', async () => {
      // Lock org account with expired time
      orgUser.accountStatus = 'suspended';
      orgUser.lockedUntil = new Date(Date.now() - 1000);
      orgUser.failedAttempts = 5;
      await orgUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'org@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);

      const user = await User.findById(orgUser._id);
      expect(user.accountStatus).toBe('active');
      expect(user.failedAttempts).toBe(0);
    });
  });
});
