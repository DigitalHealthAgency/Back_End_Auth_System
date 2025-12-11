//  DHA ACCOUNT LOCKOUT TESTS
// SRS Requirement: FR-AUTH-003 (Account lockout after 5 failed login attempts)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const SecurityEvent = require('../../src/models/securityEvent');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Account Lockout Security', () => {
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

    // Create test user
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

  describe('Failed Login Attempt Tracking', () => {
    it('should increment failedAttempts on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: wrongPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.failedAttempts).toBe(1);
      expect(res.body.remainingAttempts).toBe(4);

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(1);
    });

    it('should track multiple failed attempts correctly', async () => {
      // First attempt
      let res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });
      expect(res.body.failedAttempts).toBe(1);

      // Second attempt
      res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });
      expect(res.body.failedAttempts).toBe(2);

      // Third attempt
      res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });
      expect(res.body.failedAttempts).toBe(3);

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(3);
    });

    it('should reset failedAttempts on successful login', async () => {
      // Simulate 2 failed attempts
      testUser.failedAttempts = 2;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
      expect(user.lockedUntil).toBeUndefined();
    });
  });

  describe('Account Lockout After 5 Failed Attempts', () => {
    it('should lock account after exactly 5 failed attempts', async () => {
      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      // 5th attempt should lock the account
      const res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.message).toContain('suspended');
      expect(res.body.remainingMinutes).toBe(30);

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(5);
      expect(user.accountStatus).toBe('suspended');
      expect(user.lockedUntil).toBeDefined();
    });

    it('should set lockedUntil to 30 minutes in future', async () => {
      const beforeTime = new Date(Date.now() + 29 * 60 * 1000);

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      const user = await User.findById(testUser._id);
      expect(user.lockedUntil).toBeDefined();

      const afterTime = new Date(Date.now() + 31 * 60 * 1000);
      expect(new Date(user.lockedUntil).getTime()).toBeGreaterThan(beforeTime.getTime());
      expect(new Date(user.lockedUntil).getTime()).toBeLessThan(afterTime.getTime());
    });

    it('should prevent login on locked account even with correct password', async () => {
      // Lock the account
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      testUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.message).toContain('locked');
    });

    it('should log security event when account is locked', async () => {
      // Make 5 failed attempts to lock account
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      const events = await SecurityEvent.find({
        user: testUser._id,
        action: 'Account Suspended Due to Failed Logins'
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].severity).toBe('high');
      expect(events[0].details.failedAttempts).toBe(5);
    });
  });

  describe('Lockout Status Checks', () => {
    it('should return remainingMinutes when attempting to login to locked account', async () => {
      // Lock account with 20 minutes remaining
      testUser.accountStatus = 'suspended';
      testUser.lockedUntil = new Date(Date.now() + 20 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.remainingMinutes).toBeGreaterThan(18);
      expect(res.body.remainingMinutes).toBeLessThanOrEqual(20);
    });

    it('should differentiate between suspended and locked status', async () => {
      // Suspended account (not locked)
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      testUser.lockedUntil = undefined;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.message).toContain('suspended');
    });
  });

  describe('Account Lockout with Different Identifiers', () => {
    it('should lock account when logging in with username', async () => {
      // Make 5 failed attempts using username
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'testuser', password: wrongPassword });
      }

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.failedAttempts).toBe(5);
    });

    it('should lock account when logging in with email', async () => {
      // Make 5 failed attempts using email
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword });
      }

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.failedAttempts).toBe(5);
    });

    it('should track failed attempts consistently across different login identifiers', async () => {
      // Mix username and email attempts
      await request(app)
        .post('/api/auth/login')
        .send({ login: 'testuser', password: wrongPassword });

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: wrongPassword });

      await request(app)
        .post('/api/auth/login')
        .send({ login: 'testuser', password: wrongPassword });

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(3);
    });
  });

  describe('Organization Account Lockout', () => {
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

    it('should lock organization account after 5 failed attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ login: 'org@example.com', password: wrongPassword });
      }

      const user = await User.findById(orgUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.failedAttempts).toBe(5);
      expect(user.lockedUntil).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent login attempts correctly', async () => {
      // Simulate 3 concurrent wrong attempts
      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ login: 'test@example.com', password: wrongPassword })
      );

      await Promise.all(promises);

      const user = await User.findById(testUser._id);
      // Should track at least 3 attempts (might be more due to race conditions)
      expect(user.failedAttempts).toBeGreaterThanOrEqual(3);
    });

    it('should not decrement failedAttempts below 0', async () => {
      testUser.failedAttempts = 0;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
    });
  });
});
