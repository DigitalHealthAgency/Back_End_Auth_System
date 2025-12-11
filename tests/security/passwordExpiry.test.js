//  DHA PASSWORD EXPIRY TESTS
// SRS Requirement: FR-AUTH-003 (Password expires after 90 days)

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const {
  calculatePasswordExpiry,
  isPasswordExpired,
  getDaysUntilExpiry
} = require('../../src/utils/passwordSecurity');

// Helper to generate JWT token
const generateToken = (userId, twoFactorConfirmed = true) => {
  return jwt.sign(
    { id: userId, twoFactorConfirmed },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '24h', issuer: 'Prezio', audience: 'prezio-users' }
  );
};

describe('Password Expiry Security', () => {
  let testUser;
  let authToken;
  const testPassword = 'Test123!@#$';

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
      passwordExpiresAt: calculatePasswordExpiry(90),
      passwordLastChanged: new Date(),
      passwordExpiryDays: 90
    });

    authToken = generateToken(testUser._id);
  });

  describe('Password Expiry Calculation', () => {
    it('should set password expiry to 90 days on registration', async () => {
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

      const user = await User.findOne({ email: 'new@example.com' });
      expect(user.passwordExpiresAt).toBeDefined();

      // Check that expiry is approximately 90 days from now
      const daysUntilExpiry = getDaysUntilExpiry(user.passwordExpiresAt);
      expect(daysUntilExpiry).toBeGreaterThan(89);
      expect(daysUntilExpiry).toBeLessThanOrEqual(90);
    });

    it('should calculate correct expiry date', () => {
      const expiryDate = calculatePasswordExpiry(90);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 90);

      // Allow 1 second difference for execution time
      const diff = Math.abs(expiryDate.getTime() - expectedDate.getTime());
      expect(diff).toBeLessThan(2000);
    });

    it('should correctly detect expired passwords', () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      expect(isPasswordExpired(expiredDate)).toBe(true);

      const futureDate = new Date(Date.now() + 1000); // 1 second in future
      expect(isPasswordExpired(futureDate)).toBe(false);

      expect(isPasswordExpired(null)).toBe(false);
      expect(isPasswordExpired(undefined)).toBe(false);
    });

    it('should calculate days until expiry correctly', () => {
      const date30DaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const days = getDaysUntilExpiry(date30DaysOut);

      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThanOrEqual(30);
    });
  });

  describe('Expired Password Login Prevention', () => {
    it('should block login with expired password', async () => {
      // Set password to expired (1 day ago)
      testUser.passwordExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSWORD_EXPIRED');
      expect(res.body.requiresPasswordChange).toBe(true);
      expect(res.body.passwordExpired).toBe(true);
    });

    it('should provide expiry information in error response', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.body.expiryDate).toBeDefined();
      expect(res.body.daysOverdue).toBe(1);
    });

    it('should allow login with non-expired password', async () => {
      // Set password to expire in 30 days
      testUser.passwordExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('Password Expiry Warnings', () => {
    it('should not warn when password has >30 days until expiry', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBeUndefined();
    });

    it('should warn at 30 days before expiry', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('30');
    });

    it('should warn at 14 days before expiry', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('14');
    });

    it('should warn at 7 days before expiry', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('7');
    });

    it('should warn at 1 day before expiry', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.headers['x-password-expiry-warning']).toBe('true');
      expect(res.headers['x-password-days-remaining']).toBe('1');
    });

    it('should not warn at non-threshold days', async () => {
      // 15 days (not a threshold)
      testUser.passwordExpiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.headers['x-password-expiry-warning']).toBeUndefined();
    });
  });

  describe('Password Change Resetting Expiry', () => {
    it('should reset password expiry when password is changed', async () => {
      // Set password to expire soon
      testUser.passwordExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'NewPassword123!@#$'
        });

      expect(res.status).toBe(200);

      const user = await User.findById(testUser._id);
      expect(user.passwordExpiresAt).toBeDefined();

      // New expiry should be ~90 days from now
      const daysUntilExpiry = getDaysUntilExpiry(user.passwordExpiresAt);
      expect(daysUntilExpiry).toBeGreaterThan(89);
      expect(daysUntilExpiry).toBeLessThanOrEqual(90);
    });

    it('should update passwordLastChanged on password change', async () => {
      const beforeChange = new Date();

      authToken = generateToken(testUser._id);

      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'NewPassword123!@#$'
        });

      const user = await User.findById(testUser._id);
      expect(user.passwordLastChanged).toBeDefined();
      expect(new Date(user.passwordLastChanged).getTime()).toBeGreaterThanOrEqual(beforeChange.getTime());
    });
  });

  describe('Password Reset and Expiry', () => {
    it('should set new expiry date after password reset', async () => {
      // Request password reset
      await request(app)
        .post('/api/password/forgot')
        .send({ email: 'test@example.com' });

      const user = await User.findById(testUser._id);
      const resetToken = user.passwordResetToken;

      // Reset password
      const res = await request(app)
        .post('/api/password/reset')
        .send({
          token: resetToken,
          password: 'ResetPassword123!@#$'
        });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.passwordExpiresAt).toBeDefined();

      const daysUntilExpiry = getDaysUntilExpiry(updatedUser.passwordExpiresAt);
      expect(daysUntilExpiry).toBeGreaterThan(89);
      expect(daysUntilExpiry).toBeLessThanOrEqual(90);
    });
  });

  describe('Organization Account Password Expiry', () => {
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
        passwordExpiresAt: calculatePasswordExpiry(90),
        passwordExpiryDays: 90
      });
    });

    it('should apply 90-day expiry to organization accounts', async () => {
      const daysUntilExpiry = getDaysUntilExpiry(orgUser.passwordExpiresAt);
      expect(daysUntilExpiry).toBeGreaterThan(89);
      expect(daysUntilExpiry).toBeLessThanOrEqual(90);
    });

    it('should block expired organization account login', async () => {
      orgUser.passwordExpiresAt = new Date(Date.now() - 1000);
      await orgUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'org@example.com',
          password: testPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSWORD_EXPIRED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing passwordExpiresAt gracefully', async () => {
      testUser.passwordExpiresAt = undefined;
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should handle null passwordExpiresAt', async () => {
      testUser.passwordExpiresAt = null;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
    });

    it('should handle very old expiry dates', async () => {
      testUser.passwordExpiresAt = new Date('2020-01-01');
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSWORD_EXPIRED');
      expect(res.body.daysOverdue).toBeGreaterThan(1000);
    });

    it('should handle far future expiry dates', async () => {
      testUser.passwordExpiresAt = new Date('2099-12-31');
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: testPassword
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Custom Expiry Days', () => {
    it('should respect custom passwordExpiryDays setting', async () => {
      // Create user with 30-day expiry
      const customUser = await User.create({
        type: 'individual',
        username: 'customuser',
        firstName: 'Custom',
        lastName: 'User',
        email: 'custom@example.com',
        phone: '+254712345691',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        accountStatus: 'active',
        passwordExpiresAt: calculatePasswordExpiry(30),
        passwordExpiryDays: 30
      });

      const daysUntilExpiry = getDaysUntilExpiry(customUser.passwordExpiresAt);
      expect(daysUntilExpiry).toBeGreaterThan(29);
      expect(daysUntilExpiry).toBeLessThanOrEqual(30);
    });
  });

  describe('Password Expiry Middleware Skip Routes', () => {
    it('should allow access to change-password route even with expired password', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() - 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'NewPassword123!@#$'
        });

      expect(res.status).toBe(200);
    });

    it('should allow logout with expired password', async () => {
      testUser.passwordExpiresAt = new Date(Date.now() - 1000);
      await testUser.save();

      authToken = generateToken(testUser._id);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
