// ✅ CRITICAL SECURITY FIX TEST: Password History
// Tests for SRS Requirement FR-AUTH-003 (Password cannot be reused - last 5 passwords)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { isPasswordInHistory, addPasswordToHistory } = require('../../src/utils/passwordSecurity');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Password History Security Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create test user with password history
    const hashedPassword = await bcrypt.hash('OldPassword123!', 12);
    testUser = await User.create({
      type: 'individual',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+254712345678',
      password: hashedPassword,
      twoFactorEnabled: false, // Disable for testing
      passwordHistory: [
        { hash: hashedPassword, changedAt: new Date() }
      ],
      maxPasswordHistory: 5,
      accountStatus: 'active'
    });

    // Get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'test@example.com',
        password: 'OldPassword123!'
      });

    authToken = loginRes.body.token;
  });

  describe('Password History Tracking', () => {
    it('should prevent reusing current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!' // Same password
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_IN_HISTORY');
      expect(res.body.message).toContain('recently');
    });

    it('should prevent reusing password from history', async () => {
      // First password change
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!'
        });

      // Get new token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'NewPassword456!'
        });

      const newToken = loginRes.body.token;

      // Try to change back to old password
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          currentPassword: 'NewPassword456!',
          newPassword: 'OldPassword123!' // Old password
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_IN_HISTORY');
    });

    it('should allow reusing password after 5 changes', async () => {
      const passwords = [
        'OldPassword123!', // Current
        'NewPassword456!',
        'AnotherPass789!',
        'YetAnotherPass012!',
        'FifthPassword345!',
        'SixthPassword678!'
      ];

      let currentToken = authToken;
      let currentPassword = passwords[0];

      // Change password 5 times
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${currentToken}`)
          .send({
            currentPassword: currentPassword,
            newPassword: passwords[i]
          });

        // Get new token
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: passwords[i]
          });

        currentToken = loginRes.body.token;
        currentPassword = passwords[i];
      }

      // Now try to use the original password (should be allowed)
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${currentToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: 'OldPassword123!' // Should be allowed now
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('success');
    });

    it('should maintain password history with correct timestamps', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!'
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id).select('+passwordHistory');
      expect(user.passwordHistory).toHaveLength(2);
      expect(user.passwordHistory[0].changedAt).toBeInstanceOf(Date);
      expect(user.passwordHistory[1].changedAt).toBeInstanceOf(Date);
    });

    it('should limit password history to maxPasswordHistory', async () => {
      const passwords = [
        'NewPassword1!',
        'NewPassword2!',
        'NewPassword3!',
        'NewPassword4!',
        'NewPassword5!',
        'NewPassword6!',
        'NewPassword7!'
      ];

      let currentToken = authToken;
      let currentPassword = 'OldPassword123!';

      // Change password 7 times
      for (const newPassword of passwords) {
        await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${currentToken}`)
          .send({
            currentPassword: currentPassword,
            newPassword: newPassword
          });

        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'test@example.com',
            password: newPassword
          });

        currentToken = loginRes.body.token;
        currentPassword = newPassword;
      }

      const user = await User.findById(testUser._id).select('+passwordHistory');
      expect(user.passwordHistory.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Password History Utility Functions', () => {
    it('isPasswordInHistory should detect matching passwords', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
      const passwordHistory = [
        { hash: hashedPassword, changedAt: new Date() }
      ];

      const isInHistory = await isPasswordInHistory('TestPassword123!', passwordHistory);
      expect(isInHistory).toBe(true);
    });

    it('isPasswordInHistory should return false for non-matching passwords', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
      const passwordHistory = [
        { hash: hashedPassword, changedAt: new Date() }
      ];

      const isInHistory = await isPasswordInHistory('DifferentPassword456!', passwordHistory);
      expect(isInHistory).toBe(false);
    });

    it('addPasswordToHistory should add password at the beginning', () => {
      const user = {
        passwordHistory: [],
        maxPasswordHistory: 5,
        password: 'currentHashedPassword'
      };

      const updatedHistory = addPasswordToHistory(user, user.password);

      expect(updatedHistory).toHaveLength(1);
      expect(updatedHistory[0].hash).toBe('currentHashedPassword');
      expect(updatedHistory[0].changedAt).toBeInstanceOf(Date);
    });

    it('addPasswordToHistory should trim history to maxPasswordHistory', () => {
      const user = {
        passwordHistory: [
          { hash: 'hash1', changedAt: new Date() },
          { hash: 'hash2', changedAt: new Date() },
          { hash: 'hash3', changedAt: new Date() },
          { hash: 'hash4', changedAt: new Date() },
          { hash: 'hash5', changedAt: new Date() }
        ],
        maxPasswordHistory: 5,
        password: 'newHashedPassword'
      };

      const updatedHistory = addPasswordToHistory(user, user.password);

      expect(updatedHistory).toHaveLength(5);
      expect(updatedHistory[0].hash).toBe('newHashedPassword');
      expect(updatedHistory[4].hash).toBe('hash4'); // hash5 should be removed
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty password history', async () => {
      const user = await User.create({
        type: 'individual',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        phone: '+254712345679',
        password: await bcrypt.hash('InitialPassword123!', 12),
        twoFactorEnabled: false,
        passwordHistory: [], // Empty history
        accountStatus: 'active'
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'newuser@example.com',
          password: 'InitialPassword123!'
        });

      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'InitialPassword123!',
          newPassword: 'NewPassword456!'
        });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id).select('+passwordHistory');
      expect(updatedUser.passwordHistory.length).toBeGreaterThan(0);
    });

    it('should handle null password history', async () => {
      const isInHistory = await isPasswordInHistory('TestPassword123!', null);
      expect(isInHistory).toBe(false);
    });

    it('should handle undefined password history', async () => {
      const isInHistory = await isPasswordInHistory('TestPassword123!', undefined);
      expect(isInHistory).toBe(false);
    });
  });
});
