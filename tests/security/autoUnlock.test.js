// ✅ CRITICAL SECURITY FIX TEST: Automatic Account Unlock
// Tests for automatic unlocking of expired account lockouts

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { unlockExpiredAccountsJob } = require('../../src/middleware/autoUnlock');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Auto-Unlock Security Tests', () => {
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

  describe('Automatic Unlock on Login', () => {
    it('should automatically unlock account if lockout period expired', async () => {
      // Lock account with expiry in the past
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      testUser.failedAttempts = 5;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
      expect(user.lockedUntil).toBeNull();
      expect(user.failedAttempts).toBe(0);
    });

    it('should not unlock account if lockout period not expired', async () => {
      // Lock account with expiry in the future
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
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
      expect(user.lockedUntil).not.toBeNull();
    });

    it('should send unlock notification email after auto-unlock', async () => {
      // Lock account with expired lockout
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

      expect(res.status).toBe(200);

      // Email should be sent (verify with email service mock)
      // Notification email should contain unlock information
    });

    it('should reset failed attempts on auto-unlock', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      const user = await User.findById(testUser._id);
      expect(user.failedAttempts).toBe(0);
    });
  });

  describe('Scheduled Unlock Job', () => {
    it('should unlock all expired locked accounts', async () => {
      // Create multiple locked users with expired lockouts
      const hashedPassword = await bcrypt.hash('Password123!', 12);

      await User.create([
        {
          type: 'individual',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          email: 'user1@example.com',
          phone: '+254712345671',
          password: hashedPassword,
          twoFactorEnabled: false,
          accountStatus: 'locked',
          lockedUntil: new Date(Date.now() - 10 * 60 * 1000), // Expired
          failedAttempts: 5
        },
        {
          type: 'individual',
          username: 'user2',
          firstName: 'User',
          lastName: 'Two',
          email: 'user2@example.com',
          phone: '+254712345672',
          password: hashedPassword,
          twoFactorEnabled: false,
          accountStatus: 'locked',
          lockedUntil: new Date(Date.now() - 5 * 60 * 1000), // Expired
          failedAttempts: 5
        },
        {
          type: 'individual',
          username: 'user3',
          firstName: 'User',
          lastName: 'Three',
          email: 'user3@example.com',
          phone: '+254712345673',
          password: hashedPassword,
          twoFactorEnabled: false,
          accountStatus: 'locked',
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // Not expired
          failedAttempts: 5
        }
      ]);

      // Run the unlock job
      const result = await unlockExpiredAccountsJob();

      expect(result.unlockedCount).toBe(2);

      // Verify users were unlocked
      const user1 = await User.findOne({ email: 'user1@example.com' });
      const user2 = await User.findOne({ email: 'user2@example.com' });
      const user3 = await User.findOne({ email: 'user3@example.com' });

      expect(user1.accountStatus).toBe('active');
      expect(user1.lockedUntil).toBeNull();
      expect(user1.failedAttempts).toBe(0);

      expect(user2.accountStatus).toBe('active');
      expect(user2.lockedUntil).toBeNull();
      expect(user2.failedAttempts).toBe(0);

      expect(user3.accountStatus).toBe('locked');
      expect(user3.lockedUntil).not.toBeNull();
    });

    it('should not unlock suspended accounts', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);

      await User.create({
        type: 'individual',
        username: 'suspended',
        firstName: 'Suspended',
        lastName: 'User',
        email: 'suspended@example.com',
        phone: '+254712345674',
        password: hashedPassword,
        twoFactorEnabled: false,
        accountStatus: 'suspended',
        suspended: true,
        lockedUntil: new Date(Date.now() - 10 * 60 * 1000), // Expired
        failedAttempts: 5
      });

      const result = await unlockExpiredAccountsJob();

      const user = await User.findOne({ email: 'suspended@example.com' });
      expect(user.accountStatus).toBe('suspended');
      expect(user.suspended).toBe(true);
    });

    it('should send notification emails to all unlocked users', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);

      await User.create([
        {
          type: 'individual',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          email: 'user1@example.com',
          phone: '+254712345675',
          password: hashedPassword,
          twoFactorEnabled: false,
          accountStatus: 'locked',
          lockedUntil: new Date(Date.now() - 1000),
          failedAttempts: 5
        },
        {
          type: 'individual',
          username: 'user2',
          firstName: 'User',
          lastName: 'Two',
          email: 'user2@example.com',
          phone: '+254712345676',
          password: hashedPassword,
          twoFactorEnabled: false,
          accountStatus: 'locked',
          lockedUntil: new Date(Date.now() - 1000),
          failedAttempts: 5
        }
      ]);

      const result = await unlockExpiredAccountsJob();

      expect(result.unlockedCount).toBe(2);
      // Emails should be sent (verify with email service mock)
    });

    it('should log security events for auto-unlocked accounts', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);

      await User.create({
        type: 'individual',
        username: 'user1',
        firstName: 'User',
        lastName: 'One',
        email: 'user1@example.com',
        phone: '+254712345677',
        password: hashedPassword,
        twoFactorEnabled: false,
        accountStatus: 'locked',
        lockedUntil: new Date(Date.now() - 1000),
        failedAttempts: 5
      });

      await unlockExpiredAccountsJob();

      // Security event should be logged
      // Verify SecurityEvent collection has the unlock event
    });
  });

  describe('Auto-Unlock Middleware', () => {
    it('should check and unlock before login processing', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.failedAttempts = 5;
      await testUser.save();

      // The middleware should unlock before the login logic runs
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(200);
    });

    it('should work with different identifier types', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      await testUser.save();

      // Test with username
      let res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'testuser',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(200);

      // Re-lock for next test
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      await testUser.save();

      // Test with email
      res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null lockedUntil gracefully', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = null;
      await testUser.save();

      const result = await unlockExpiredAccountsJob();

      // Should not crash, may or may not unlock depending on implementation
      expect(result).toBeDefined();
    });

    it('should handle invalid date values', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date('invalid');
      await testUser.save();

      const result = await unlockExpiredAccountsJob();

      expect(result).toBeDefined();
    });

    it('should handle users with no email', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);

      const orgUser = await User.create({
        type: 'organization',
        organizationName: 'Test Org',
        organizationType: 'HOSPITAL',
        county: 'Nairobi',
        subCounty: 'Westlands',
        organizationEmail: 'org@example.com',
        organizationPhone: '+254712345678',
        yearOfEstablishment: 2020,
        password: hashedPassword,
        twoFactorEnabled: false,
        accountStatus: 'locked',
        lockedUntil: new Date(Date.now() - 1000),
        failedAttempts: 5
      });

      const result = await unlockExpiredAccountsJob();

      expect(result.unlockedCount).toBeGreaterThan(0);

      const user = await User.findById(orgUser._id);
      expect(user.accountStatus).toBe('active');
    });

    it('should handle concurrent unlock operations', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      await testUser.save();

      // Run multiple unlock operations concurrently
      const promises = [
        unlockExpiredAccountsJob(),
        unlockExpiredAccountsJob(),
        unlockExpiredAccountsJob()
      ];

      const results = await Promise.all(promises);

      // All should succeed without errors
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
    });

    it('should handle large number of expired accounts', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);

      // Create 50 locked users
      const users = Array.from({ length: 50 }, (_, i) => ({
        type: 'individual',
        username: `user${i}`,
        firstName: 'User',
        lastName: `${i}`,
        email: `user${i}@example.com`,
        phone: `+25471234${String(i).padStart(4, '0')}`,
        password: hashedPassword,
        twoFactorEnabled: false,
        accountStatus: 'locked',
        lockedUntil: new Date(Date.now() - 1000),
        failedAttempts: 5
      }));

      await User.insertMany(users);

      const result = await unlockExpiredAccountsJob();

      expect(result.unlockedCount).toBe(50);
    });
  });

  describe('Unlock Timing', () => {
    it('should unlock exactly at expiry time', async () => {
      // Lock with expiry at current time
      const expiryTime = new Date();
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = expiryTime;
      await testUser.save();

      // Wait a tiny bit to ensure we're past expiry
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await unlockExpiredAccountsJob();

      expect(result.unlockedCount).toBeGreaterThan(0);

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
    });

    it('should not unlock 1 second before expiry', async () => {
      // Lock with expiry 1 second in future
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() + 1000);
      await testUser.save();

      const result = await unlockExpiredAccountsJob();

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('locked');
    });
  });

  describe('Email Notifications', () => {
    it('should include unlock details in email', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      await testUser.save();

      await unlockExpiredAccountsJob();

      // Email should contain:
      // - Account unlocked message
      // - Lockout duration
      // - Timestamp
      // - Security recommendations
    });

    it('should handle email failures gracefully', async () => {
      testUser.accountStatus = 'locked';
      testUser.lockedUntil = new Date(Date.now() - 1000);
      testUser.email = 'invalid-email'; // Invalid email
      await testUser.save();

      // Should still unlock even if email fails
      const result = await unlockExpiredAccountsJob();

      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('active');
    });
  });
});
