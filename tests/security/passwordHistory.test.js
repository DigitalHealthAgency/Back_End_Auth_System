//  DHA PASSWORD HISTORY TESTS
// SRS Requirement: FR-AUTH-003 (Cannot reuse last 5 passwords)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const {
  isPasswordInHistory,
  addPasswordToHistory
} = require('../../src/utils/passwordSecurity');

// Helper to generate JWT token
const generateToken = (userId, twoFactorConfirmed = true) => {
  return jwt.sign(
    { id: userId, twoFactorConfirmed },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '24h', issuer: 'Prezio', audience: 'prezio-users' }
  );
};

describe('Password History Security', () => {
  let testUser;
  let authToken;
  const passwords = [
    'Password1!@#$',
    'Password2!@#$',
    'Password3!@#$',
    'Password4!@#$',
    'Password5!@#$',
    'Password6!@#$',
    'Password7!@#$'
  ];

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
      password: await bcrypt.hash(passwords[0], 12),
      role: 'public_user',
      accountStatus: 'active',
      passwordHistory: [],
      maxPasswordHistory: 5
    });

    authToken = generateToken(testUser._id);
  });

  describe('Password History Tracking', () => {
    it('should prevent reusing current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[0]
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_IN_HISTORY');
      expect(res.body.message).toContain('recently used');
    });

    it('should add old password to history when changing password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory).toBeDefined();
      expect(user.passwordHistory.length).toBe(1);

      // Verify the old password is in history
      const isInHistory = await bcrypt.compare(passwords[0], user.passwordHistory[0].hash);
      expect(isInHistory).toBe(true);
    });

    it('should prevent reusing password from history', async () => {
      // Change password twice to build history
      authToken = generateToken(testUser._id);

      // Change to password2
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      authToken = generateToken(testUser._id);

      // Change to password3
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[1],
          newPassword: passwords[2]
        });

      authToken = generateToken(testUser._id);

      // Try to change back to password1 (should fail)
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[2],
          newPassword: passwords[0]
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_IN_HISTORY');
    });

    it('should maintain maximum of 5 passwords in history', async () => {
      authToken = generateToken(testUser._id);

      // Change password 6 times
      for (let i = 1; i <= 6; i++) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: passwords[i - 1],
            newPassword: passwords[i]
          });

        authToken = generateToken(testUser._id);
      }

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Password History Limit Enforcement', () => {
    it('should allow reusing password after it drops out of history (6th change)', async () => {
      authToken = generateToken(testUser._id);

      // Change password 5 times (passwords 0-5)
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: passwords[i - 1],
            newPassword: passwords[i]
          });

        authToken = generateToken(testUser._id);
      }

      // Current password is passwords[5]
      // History should contain: passwords[4], [3], [2], [1], [0]

      // Now change to password6
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[5],
          newPassword: passwords[6]
        });

      authToken = generateToken(testUser._id);

      // History now contains: passwords[5], [4], [3], [2], [1]
      // passwords[0] should have dropped out

      // Should now allow reusing passwords[0]
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[6],
          newPassword: passwords[0]
        });

      expect(res.status).toBe(200);
    });

    it('should correctly maintain history order (most recent first)', async () => {
      authToken = generateToken(testUser._id);

      // Change password 3 times
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: passwords[i - 1],
            newPassword: passwords[i]
          });

        authToken = generateToken(testUser._id);
      }

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory.length).toBe(3);

      // Verify order: most recent password first
      const isPassword2First = await bcrypt.compare(passwords[2], user.passwordHistory[0].hash);
      const isPassword1Second = await bcrypt.compare(passwords[1], user.passwordHistory[1].hash);
      const isPassword0Third = await bcrypt.compare(passwords[0], user.passwordHistory[2].hash);

      expect(isPassword2First).toBe(true);
      expect(isPassword1Second).toBe(true);
      expect(isPassword0Third).toBe(true);
    });
  });

  describe('Password History Utilities', () => {
    it('should detect password in history correctly', async () => {
      const passwordHash = await bcrypt.hash('TestPassword123!@#$', 12);
      const history = [{
        hash: passwordHash,
        changedAt: new Date()
      }];

      const isInHistory = await isPasswordInHistory('TestPassword123!@#$', history);
      expect(isInHistory).toBe(true);

      const isNotInHistory = await isPasswordInHistory('DifferentPassword123!@#$', history);
      expect(isNotInHistory).toBe(false);
    });

    it('should handle empty password history', async () => {
      const isInHistory = await isPasswordInHistory('AnyPassword123!@#$', []);
      expect(isInHistory).toBe(false);
    });

    it('should add password to history correctly', async () => {
      const user = {
        passwordHistory: [],
        maxPasswordHistory: 5
      };

      const passwordHash = await bcrypt.hash('TestPassword123!@#$', 12);
      const updatedHistory = addPasswordToHistory(user, passwordHash);

      expect(updatedHistory.length).toBe(1);
      expect(updatedHistory[0].hash).toBe(passwordHash);
      expect(updatedHistory[0].changedAt).toBeDefined();
    });

    it('should trim history to maxPasswordHistory', async () => {
      const user = {
        passwordHistory: [],
        maxPasswordHistory: 3
      };

      // Add 5 passwords
      for (let i = 0; i < 5; i++) {
        const hash = await bcrypt.hash(`Password${i}`, 12);
        user.passwordHistory = addPasswordToHistory(user, hash);
      }

      expect(user.passwordHistory.length).toBe(3);
    });
  });

  describe('Password History Timestamps', () => {
    it('should record changedAt timestamp for each password in history', async () => {
      authToken = generateToken(testUser._id);

      const beforeChange = new Date();

      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory[0].changedAt).toBeDefined();
      expect(new Date(user.passwordHistory[0].changedAt).getTime())
        .toBeGreaterThanOrEqual(beforeChange.getTime());
    });

    it('should maintain timestamps for all passwords in history', async () => {
      authToken = generateToken(testUser._id);

      // Change password 3 times
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: passwords[i - 1],
            newPassword: passwords[i]
          });

        authToken = generateToken(testUser._id);

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory.length).toBe(3);

      // All entries should have timestamps
      user.passwordHistory.forEach(entry => {
        expect(entry.changedAt).toBeDefined();
      });

      // Timestamps should be in descending order (most recent first)
      for (let i = 0; i < user.passwordHistory.length - 1; i++) {
        expect(new Date(user.passwordHistory[i].changedAt).getTime())
          .toBeGreaterThanOrEqual(new Date(user.passwordHistory[i + 1].changedAt).getTime());
      }
    });
  });

  describe('Password History During Password Reset', () => {
    it('should prevent reusing historical password during reset', async () => {
      // Change password once to add to history
      authToken = generateToken(testUser._id);
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      // Request password reset
      await request(app)
        .post('/api/password/forgot')
        .send({ email: 'test@example.com' });

      const user = await User.findById(testUser._id);
      const resetToken = user.passwordResetToken;

      // Try to reset to a password in history
      const res = await request(app)
        .post('/api/password/reset')
        .send({
          token: resetToken,
          password: passwords[0]
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_IN_HISTORY');
    });

    it('should add old password to history during reset', async () => {
      // Request password reset
      await request(app)
        .post('/api/password/forgot')
        .send({ email: 'test@example.com' });

      const userBefore = await User.findById(testUser._id);
      const resetToken = userBefore.passwordResetToken;
      const historyLengthBefore = userBefore.passwordHistory.length;

      // Reset to new password
      const res = await request(app)
        .post('/api/password/reset')
        .send({
          token: resetToken,
          password: passwords[1]
        });

      expect(res.status).toBe(200);

      const userAfter = await User.findById(testUser._id);
      expect(userAfter.passwordHistory.length).toBe(historyLengthBefore + 1);
    });
  });

  describe('Organization Account Password History', () => {
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
        password: await bcrypt.hash(passwords[0], 12),
        role: 'vendor_developer',
        accountStatus: 'active',
        passwordHistory: [],
        maxPasswordHistory: 5
      });
    });

    it('should enforce password history for organization accounts', async () => {
      authToken = generateToken(orgUser._id);

      // Change password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      authToken = generateToken(orgUser._id);

      // Try to change back to old password
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[1],
          newPassword: passwords[0]
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_IN_HISTORY');
    });

    it('should maintain separate password history for each organization', async () => {
      const org2User = await User.create({
        type: 'organization',
        organizationName: 'Test Org 2',
        organizationType: 'CLINIC',
        county: 'Mombasa',
        subCounty: 'Mvita',
        organizationEmail: 'org2@example.com',
        organizationPhone: '+254712345680',
        yearOfEstablishment: 2021,
        password: await bcrypt.hash(passwords[0], 12),
        role: 'vendor_developer',
        accountStatus: 'active',
        passwordHistory: []
      });

      // Change password for org1
      authToken = generateToken(orgUser._id);
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      // Change password for org2 to same new password (should work - different history)
      const org2Token = generateToken(org2User._id);
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${org2Token}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no password history', async () => {
      testUser.passwordHistory = undefined;
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory).toBeDefined();
      expect(user.passwordHistory.length).toBe(1);
    });

    it('should handle corrupted password history gracefully', async () => {
      testUser.passwordHistory = [
        { hash: 'corrupted_hash', changedAt: new Date() }
      ];
      await testUser.save();

      authToken = generateToken(testUser._id);

      // Should still work - corrupted entry won't match
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      expect(res.status).toBe(200);
    });

    it('should handle maxPasswordHistory of 0', async () => {
      testUser.maxPasswordHistory = 0;
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: passwords[0],
          newPassword: passwords[1]
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory.length).toBe(0);
    });

    it('should handle very large maxPasswordHistory values', async () => {
      testUser.maxPasswordHistory = 100;
      await testUser.save();

      authToken = generateToken(testUser._id);

      // Change password 10 times
      for (let i = 1; i <= 6; i++) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: passwords[i - 1],
            newPassword: passwords[i]
          });

        authToken = generateToken(testUser._id);
      }

      const user = await User.findById(testUser._id);
      expect(user.passwordHistory.length).toBe(6);
    });
  });
});
