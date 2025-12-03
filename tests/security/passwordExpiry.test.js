// ✅ CRITICAL SECURITY FIX TEST: Password Expiry
// Tests for SRS Requirement FR-AUTH-003 (90-day password expiry)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const {
  isPasswordExpired,
  getDaysUntilExpiry,
  shouldSendExpiryWarning,
  calculatePasswordExpiry
} = require('../../src/utils/passwordSecurity');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Password Expiry Security Tests', () => {
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

    // Create test user with password expiry
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
      passwordExpiresAt: calculatePasswordExpiry(90),
      passwordLastChanged: new Date(),
      passwordExpiryDays: 90,
      accountStatus: 'active'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'test@example.com',
        password: 'ValidPassword123!'
      });

    authToken = loginRes.body.token;
  });

  describe('Password Expiry Enforcement', () => {
    it('should block login with expired password', async () => {
      // Set password as expired (1 day ago)
      testUser.passwordExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSWORD_EXPIRED');
      expect(res.body.requiresPasswordChange).toBe(true);
      expect(res.body.passwordExpired).toBe(true);
      expect(res.body.changePasswordUrl).toBe('/api/auth/change-password');
    });

    it('should allow login with valid non-expired password', async () => {
      // Set password expiry to 30 days from now
      testUser.passwordExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should block API access with expired password', async () => {
      // Set password as expired
      testUser.passwordExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSWORD_EXPIRED');
      expect(res.body.requiresPasswordChange).toBe(true);
    });

    it('should allow password change endpoint with expired password', async () => {
      // Set password as expired
      testUser.passwordExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'ValidPassword123!',
          newPassword: 'NewValidPassword456!'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('success');
    });

    it('should update password expiry after password change', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'ValidPassword123!',
          newPassword: 'NewValidPassword456!'
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      const expectedExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance
      expect(Math.abs(user.passwordExpiresAt - expectedExpiry)).toBeLessThan(60000);
      expect(user.passwordLastChanged).toBeDefined();
    });
  });

  describe('Password Expiry Warnings', () => {
    it('should add warning headers when password expires in 30 days', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('30');
    });

    it('should add warning headers when password expires in 14 days', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('14');
    });

    it('should add warning headers when password expires in 7 days', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('7');
    });

    it('should add warning headers when password expires in 1 day', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('1');
    });

    it('should not add warning headers when password expires in 20 days', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBeUndefined();
    });
  });

  describe('Password Expiry Utility Functions', () => {
    it('isPasswordExpired should return true for expired password', () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isPasswordExpired(expiredDate)).toBe(true);
    });

    it('isPasswordExpired should return false for valid password', () => {
      const validDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(isPasswordExpired(validDate)).toBe(false);
    });

    it('isPasswordExpired should return false for null date', () => {
      expect(isPasswordExpired(null)).toBe(false);
    });

    it('getDaysUntilExpiry should calculate correct days', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const days = getDaysUntilExpiry(futureDate);
      expect(days).toBe(30);
    });

    it('getDaysUntilExpiry should return negative for expired passwords', () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const days = getDaysUntilExpiry(pastDate);
      expect(days).toBeLessThan(0);
    });

    it('getDaysUntilExpiry should return null for null date', () => {
      expect(getDaysUntilExpiry(null)).toBe(null);
    });

    it('calculatePasswordExpiry should calculate correct expiry date', () => {
      const expiryDate = calculatePasswordExpiry(90);
      const expectedDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance
      expect(Math.abs(expiryDate - expectedDate)).toBeLessThan(60000);
    });

    it('shouldSendExpiryWarning should return true for warning thresholds', () => {
      const dates = [30, 14, 7, 1];

      dates.forEach(days => {
        const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const result = shouldSendExpiryWarning(futureDate);
        expect(result.shouldWarn).toBe(true);
        expect(result.daysRemaining).toBe(days);
      });
    });

    it('shouldSendExpiryWarning should return false for non-warning days', () => {
      const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      const result = shouldSendExpiryWarning(futureDate);
      expect(result.shouldWarn).toBe(false);
      expect(result.daysRemaining).toBe(20);
    });
  });

  describe('Registration with Password Expiry', () => {
    it('should set password expiry on registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@example.com',
          phone: '+254712345679',
          password: 'NewUserPassword123!',
          receiveSystemAlerts: false
        });

      expect(res.status).toBe(201);

      const user = await User.findOne({ email: 'newuser@example.com' });
      expect(user.passwordExpiresAt).toBeDefined();
      expect(user.passwordLastChanged).toBeDefined();
      expect(user.passwordExpiryDays).toBe(90);

      // Should expire in approximately 90 days
      const expectedExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      expect(Math.abs(user.passwordExpiresAt - expectedExpiry)).toBeLessThan(60000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing passwordExpiresAt field', async () => {
      testUser.passwordExpiresAt = null;
      await testUser.save();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should handle custom expiry days', async () => {
      testUser.passwordExpiryDays = 30;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'ValidPassword123!',
          newPassword: 'NewValidPassword456!'
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      const expectedExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Should use custom expiry days
      expect(Math.abs(user.passwordExpiresAt - expectedExpiry)).toBeLessThan(60000);
    });
  });
});
