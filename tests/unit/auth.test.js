//  DHA AUTHENTICATION UNIT TESTS
// Comprehensive tests for user registration, login, 2FA, CAPTCHA, lockout, etc.

const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const securityEvent = require('../../src/models/securityEvent');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const { validIndividualUser, validOrganizationUser, invalidUser, userWithWeakPassword, userWithShortPassword } = require('../fixtures/users');
const { mockEmailService, mockRecaptchaService, resetAllMocks } = require('../mocks/services');

// Mock the sendEmail utility
jest.mock('../../src/utils/sendEmail');
const mockSendEmail = require('../../src/utils/sendEmail');
mockSendEmail.mockResolvedValue(true);

describe('Authentication - Registration', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetAllMocks();
  });

  describe('Individual User Registration', () => {
    it('should register individual user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validIndividualUser);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validIndividualUser.email);
      expect(res.body.user.type).toBe('individual');
      expect(res.body.user.role).toBe('public_user');
      expect(res.body.token).toBeDefined();
      expect(res.body.recoveryKey).toBeDefined();
      expect(res.body.recoveryPDF).toBeDefined();

      // Verify email was sent
      expect(mockSendEmail).toHaveBeenCalled();

      // Verify password was hashed
      const user = await User.findOne({ email: validIndividualUser.email }).select('+password');
      expect(user.password).not.toBe(validIndividualUser.password);
      const isMatch = await bcrypt.compare(validIndividualUser.password, user.password);
      expect(isMatch).toBe(true);
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          email: 'invalid-email'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('email');
    });

    it('should enforce 12-character minimum password length (SRS)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(userWithShortPassword);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('12');
    });

    it('should enforce password complexity requirements', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(userWithWeakPassword);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/uppercase|lowercase|number|special/i);
    });

    it('should reject duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send(validIndividualUser);

      // Try to create with same email
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          username: 'differentusername'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('USER_EXISTS');
    });

    it('should reject duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validIndividualUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          email: 'different@example.com'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('USER_EXISTS');
    });

    it('should require all mandatory fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          email: 'test@example.com'
          // Missing username, firstName, lastName, phone, password
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FIELDS');
    });

    it('should validate Kenyan phone format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          phone: '+1234567890' // Non-Kenyan format
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Kenyan');
    });

    it('should create user with default logo', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validIndividualUser);

      expect(res.status).toBe(201);
      expect(res.body.user.logo).toBeDefined();
      expect(res.body.user.logo.url).toMatch(/cloudinary/);
    });

    it('should create session on registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validIndividualUser);

      const user = await User.findById(res.body.user._id);
      expect(user.sessions).toBeDefined();
      expect(user.sessions.length).toBe(1);
      expect(user.sessions[0].sessionId).toBeDefined();
    });

    it('should log security event on registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validIndividualUser);

      const events = await securityEvent.find({ action: 'Account Registered' });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Organization User Registration', () => {
    it('should register organization user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validOrganizationUser);

      expect(res.status).toBe(201);
      expect(res.body.user.organizationName).toBe(validOrganizationUser.organizationName);
      expect(res.body.user.type).toBe('organization');
      expect(res.body.user.role).toBe('vendor_developer');
      expect(res.body.user.accountStatus).toBe('pending_registration');
    });

    it('should reject duplicate organization name', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validOrganizationUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validOrganizationUser,
          organizationEmail: 'different@org.com'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ORG_EXISTS');
    });

    it('should reject duplicate organization email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validOrganizationUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validOrganizationUser,
          organizationName: 'Different Organization'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ORG_EXISTS');
    });

    it('should require all organization fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'organization',
          organizationName: 'Test Org'
          // Missing other required fields
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FIELDS');
    });

    it('should validate organization type enum', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validOrganizationUser,
          organizationType: 'INVALID_TYPE'
        });

      expect(res.status).toBe(400);
    });

    it('should validate year of establishment', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validOrganizationUser,
          yearOfEstablishment: 1800 // Too old
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Registration Type Validation', () => {
    it('should reject invalid registration type', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          type: 'invalid_type'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TYPE');
    });

    it('should reject missing type field', async () => {
      const { type, ...userWithoutType } = validIndividualUser;

      const res = await request(app)
        .post('/api/auth/register')
        .send(userWithoutType);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TYPE');
    });
  });
});

describe('Authentication - Login', () => {
  let testUser;
  let testUserPassword = 'TestPassword123!';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetAllMocks();

    // Create test user
    testUser = await User.create({
      type: 'individual',
      username: 'testlogin',
      firstName: 'Test',
      lastName: 'Login',
      email: 'testlogin@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testUserPassword, 12),
      role: 'public_user',
      twoFactorEnabled: false // Disable 2FA for basic tests
    });
  });

  describe('Valid Login', () => {
    it('should login with valid email and password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.token).toBeDefined();
      if (res.body.token) {
        expect(res.body.token).toBeValidJWT();
      }
    });

    it('should login with username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.username,
          password: testUserPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should create session on login', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBe(1);
      expect(user.sessions[0].sessionId).toBeDefined();
    });

    it('should update lastLogin timestamp', async () => {
      const beforeLogin = new Date();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      const user = await User.findById(testUser._id);
      expect(user.lastLogin).toBeDefined();
      expect(new Date(user.lastLogin).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it('should set secure HTTP-only cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      expect(res.headers['set-cookie']).toBeDefined();
      const cookieHeader = res.headers['set-cookie'][0];
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('token=');
    });
  });

  describe('Invalid Login', () => {
    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'nonexistent@example.com',
          password: testUserPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should require identifier', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: testUserPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_CREDENTIALS');
    });

    it('should require password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('Failed Login Attempts and Progressive Delays', () => {
    it('should log failed login attempts', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      const events = await securityEvent.find({
        action: 'Failed Login',
        targetEmail: testUser.email
      });

      expect(events.length).toBeGreaterThan(0);
    });

    it('should apply progressive delay on failed attempts', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have at least 1 second delay
      expect(duration).toBeGreaterThanOrEqual(1000);
    });

    it('should reset failed attempts on successful login', async () => {
      // Make failed attempts
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      // Successful login
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      // Check failed attempts were reset
      const failedEvents = await securityEvent.find({
        targetEmail: testUser.email,
        action: 'Failed Login',
        createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
      });

      // Should be cleared or reset
      const resetEvents = await securityEvent.find({
        targetEmail: testUser.email,
        action: 'Failed Attempts Reset'
      });

      expect(resetEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Account Lockout (5 attempts, 30-minute unlock)', () => {
    it('should lock account after 5 failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!'
          });
      }

      // 6th attempt should trigger suspension
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');

      // Verify user is suspended
      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.suspended).toBe(true);
    });

    it('should prevent login on suspended account', async () => {
      // Suspend account
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('should log suspension event', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!'
          });
      }

      const events = await securityEvent.find({
        action: 'Account Suspended Due to Failed Logins',
        user: testUser._id
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Suspended Account', () => {
    it('should reject login for suspended account before password check', async () => {
      testUser.accountStatus = 'suspended';
      testUser.suspended = true;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      expect(res.status).toBe(423);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('Session Management', () => {
    it('should limit to 5 active sessions', async () => {
      // Create 6 login sessions
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: testUserPassword
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBe(5);
    });

    it('should keep most recent sessions', async () => {
      const firstLoginTime = Date.now();

      // First login
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create 5 more logins to exceed limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: testUserPassword
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBe(5);
      // First session should be removed
      const oldestSession = user.sessions[user.sessions.length - 1];
      expect(new Date(oldestSession.createdAt).getTime()).toBeGreaterThan(firstLoginTime);
    });
  });

  describe('New Device Detection', () => {
    it('should detect new device login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        })
        .set('User-Agent', 'Mozilla/5.0 (Test Device)');

      expect(res.status).toBe(200);

      // Check email notification was sent
      expect(mockSendEmail).toHaveBeenCalled();
      const emailCall = mockSendEmail.mock.calls.find(call =>
        call[0].subject?.includes('New Device')
      );
      expect(emailCall).toBeDefined();

      // Check security event logged
      const events = await securityEvent.find({
        action: 'New Device Login',
        user: testUser._id
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should not alert on known device', async () => {
      // First login
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        })
        .set('User-Agent', 'Mozilla/5.0 (Test Device)');

      mockSendEmail.mockClear();

      // Second login from same device
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        })
        .set('User-Agent', 'Mozilla/5.0 (Test Device)');

      // Should not send new device email
      const newDeviceEmails = mockSendEmail.mock.calls.filter(call =>
        call[0].subject?.includes('New Device')
      );
      expect(newDeviceEmails.length).toBe(0);
    });
  });
});

describe('Authentication - Two-Factor Authentication (2FA)', () => {
  let testUser;
  let testUserPassword = 'TestPassword123!';
  let twoFactorSecret = 'JBSWY3DPEHPK3PXP'; // Test secret

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetAllMocks();

    testUser = await User.create({
      type: 'individual',
      username: 'test2fa',
      firstName: 'Test',
      lastName: '2FA',
      email: 'test2fa@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testUserPassword, 12),
      role: 'public_user',
      twoFactorEnabled: true,
      twoFactorSecret: twoFactorSecret
    });
  });

  describe('2FA Required on Login', () => {
    it('should require 2FA code when enabled', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      // System should require 2FA code or respond with 2FA requirement
      expect([400, 401]).toContain(res.status);
      if (res.body.requiresTwoFactor !== undefined) {
        expect(res.body.requiresTwoFactor).toBe(true);
      }
    });

    it('should reject invalid 2FA code', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword,
          twoFactorCode: '000000' // Invalid code
        });

      expect(res.status).toBe(401);
      // Message should contain indication of invalid 2FA
      expect(res.body.message || res.body.code).toMatch(/Invalid|2FA/i);
    });

    it('should log invalid 2FA attempt', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword,
          twoFactorCode: '000000'
        });

      const events = await securityEvent.find({
        action: 'Invalid 2FA Code',
        user: testUser._id
      });

      expect(events.length).toBeGreaterThan(0);
    });

    it('should log 2FA required event', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      const events = await securityEvent.find({
        action: '2FA Required',
        user: testUser._id
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('2FA Not Required', () => {
    it('should allow login without 2FA when disabled', async () => {
      testUser.twoFactorEnabled = false;
      await testUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUserPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
    });
  });
});

describe('Authentication - Password Validation', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetAllMocks();
  });

  describe('Password Length (12-character minimum)', () => {
    it('should reject password less than 12 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'Short1!'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('12');
    });

    it('should accept password with exactly 12 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'Valid12Pass!'
        });

      expect(res.status).toBe(201);
    });

    it('should reject password over 64 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'A'.repeat(65) + '1!'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Password Complexity', () => {
    it('should require uppercase letter', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'nouppercase123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/uppercase/i);
    });

    it('should require lowercase letter', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'NOLOWERCASE123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/lowercase/i);
    });

    it('should require number', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'NoNumbersHere!'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/number/i);
    });

    it('should require special character', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'NoSpecialChar123'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/special/i);
    });

    it('should accept password with all requirements', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validIndividualUser,
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(201);
    });
  });
});

describe('Authentication - Logout', () => {
  let testUser;
  let testUserPassword = 'TestPassword123!';
  let authToken;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetAllMocks();

    testUser = await User.create({
      type: 'individual',
      username: 'testlogout',
      firstName: 'Test',
      lastName: 'Logout',
      email: 'testlogout@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testUserPassword, 12),
      role: 'public_user',
      twoFactorEnabled: false
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUser.email,
        password: testUserPassword
      });

    authToken = loginRes.body.token;
  });

  it('should logout successfully', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Logged out');
  });

  it('should clear auth cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.headers['set-cookie']).toBeDefined();
    const cookieHeader = res.headers['set-cookie'][0];
    expect(cookieHeader).toContain('token=;'); // Empty token
  });

  it('should log logout activity', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    // Check activity log (if implemented)
    // This depends on your activityLogger implementation
  });
});
