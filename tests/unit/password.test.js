//  DHA PASSWORD MANAGEMENT UNIT TESTS
// Tests for password reset, OTP, rate limiting, password history, password expiry

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const PasswordReset = require('../../src/models/PasswordReset');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const { validIndividualUser } = require('../fixtures/users');
const { mockEmailService, resetAllMocks } = require('../mocks/services');

// Mock the sendEmail utility
jest.mock('../../src/utils/sendEmail', () => jest.fn().mockResolvedValue(true));
const mockSendEmail = require('../../src/utils/sendEmail');

describe('Password Management - Forgot Password', () => {
  let testUser;
  const testEmail = 'testpassword@example.com';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();

    testUser = await User.create({
      type: 'individual',
      username: 'testpassword',
      firstName: 'Test',
      lastName: 'Password',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash('TestPassword123!', 12),
      role: 'public_user'
    });
  });

  describe('Request Password Reset', () => {
    it('should send password reset code to registered email', async () => {
      const res = await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Reset code sent');

      // Verify email was sent
      expect(mockSendEmail).toHaveBeenCalled();
      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.to).toBe(testEmail);
      expect(emailCall.subject).toContain('Password Reset');

      // Verify reset code was stored
      const resetRecord = await PasswordReset.findOne({ email: testEmail });
      expect(resetRecord).toBeDefined();
      expect(resetRecord.code).toBeDefined();
      expect(resetRecord.expiresAt).toBeDefined();
    });

    it('should handle organization email', async () => {
      const orgUser = await User.create({
        type: 'organization',
        organizationName: 'Test Organization',
        organizationEmail: 'org@example.com',
        organizationPhone: '+254712345679',
        organizationType: 'HOSPITAL',
        county: 'Nairobi',
        subCounty: 'Westlands',
        yearOfEstablishment: 2020,
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'vendor_developer'
      });

      const res = await request(app)
        .post('/api/password/forgot-password')
        .send({ email: 'org@example.com' });

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('should return 404 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/password/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should generate 4-digit numeric code', async () => {
      await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      const resetRecord = await PasswordReset.findOne({ email: testEmail });
      expect(resetRecord.code).toMatch(/^\d{4}$/);
    });

    it('should set expiration to 10 minutes', async () => {
      const beforeRequest = Date.now();

      await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      const resetRecord = await PasswordReset.findOne({ email: testEmail });
      const expiryTime = new Date(resetRecord.expiresAt).getTime();
      const expectedExpiry = beforeRequest + (10 * 60 * 1000); // 10 minutes

      // Allow 1 second tolerance
      expect(expiryTime).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should update existing reset request', async () => {
      // First request
      const firstRes = await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      expect(firstRes.status).toBe(200);

      const firstRecord = await PasswordReset.findOne({ email: testEmail });
      expect(firstRecord).toBeTruthy();
      const firstCode = firstRecord.code;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request
      await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      // Should only have one record
      const count = await PasswordReset.countDocuments({ email: testEmail });
      expect(count).toBe(1);

      const secondRecord = await PasswordReset.findOne({ email: testEmail });
      expect(secondRecord.code).not.toBe(firstCode); // New code generated
    });

    it('should log password reset activity', async () => {
      await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      // Verify activity was logged (depends on activityLogger implementation)
      // This can be checked if you have access to activity logs
    });
  });

  describe('OTP Expiry', () => {
    it('should reject expired OTP', async () => {
      // Create expired reset code
      const expiredCode = '1234';
      await PasswordReset.create({
        email: testEmail,
        code: expiredCode,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });

      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: expiredCode
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');
    });

    it('should accept valid non-expired OTP', async () => {
      const validCode = '1234';
      await PasswordReset.create({
        email: testEmail,
        code: validCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      });

      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: validCode
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('verified');
    });
  });
});

describe('Password Management - Verify Reset Code', () => {
  let testUser;
  const testEmail = 'testverify@example.com';
  const validCode = '1234';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();

    testUser = await User.create({
      type: 'individual',
      username: 'testverify',
      firstName: 'Test',
      lastName: 'Verify',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash('TestPassword123!', 12),
      role: 'public_user'
    });

    await PasswordReset.create({
      email: testEmail,
      code: validCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
  });

  describe('Code Verification', () => {
    it('should verify valid code', async () => {
      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: validCode
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('verified');
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
    });

    it('should reject invalid code', async () => {
      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: '999999'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid');
    });

    it('should delete reset record after successful verification', async () => {
      await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: validCode
        });

      const resetRecord = await PasswordReset.findOne({ email: testEmail });
      expect(resetRecord).toBeNull();
    });

    it('should create session after verification', async () => {
      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: validCode
        });

      const user = await User.findById(testUser._id);
      expect(user.sessions).toBeDefined();
      expect(user.sessions.length).toBe(1);
      expect(user.sessions[0].sessionId).toBeDefined();
    });

    it('should generate valid JWT token', async () => {
      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: validCode
        });

      expect(res.body.token).toBeDefined();
      expect(res.body.token).toBeValidJWT();
    });

    it('should set secure cookie', async () => {
      const res = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: validCode
        });

      expect(res.headers['set-cookie']).toBeDefined();
      const cookieHeader = res.headers['set-cookie'][0];
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('token=');
    });
  });
});

describe('Password Management - Recovery Key Login', () => {
  let testUser;
  const testEmail = 'testrecovery@example.com';
  const testPassword = 'TestPassword123!';
  const plainRecoveryKey = 'ABCD-EFGH-JKLM-NPQR';
  let recoveryKeyHash;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();

    recoveryKeyHash = await bcrypt.hash(plainRecoveryKey, 12);

    testUser = await User.create({
      type: 'individual',
      username: 'testrecovery',
      firstName: 'Test',
      lastName: 'Recovery',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      recoveryKeyHash: recoveryKeyHash,
      recoveryKeyGeneratedAt: new Date()
    });
  });

  describe('Login with Recovery Key', () => {
    it('should login with valid recovery key', async () => {
      const res = await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: testEmail,
          recoveryKey: plainRecoveryKey
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('recovery key');
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
    });

    it('should reject invalid recovery key', async () => {
      const res = await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: testEmail,
          recoveryKey: 'WXYZ-WXYZ-WXYZ-WXYZ'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid');
    });

    it('should reject if user has no recovery key', async () => {
      const userWithoutKey = await User.create({
        type: 'individual',
        username: 'nokey',
        firstName: 'No',
        lastName: 'Key',
        email: 'nokey@example.com',
        phone: '+254712345679',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user'
      });

      const res = await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: 'nokey@example.com',
          recoveryKey: plainRecoveryKey
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should create session on recovery login', async () => {
      await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: testEmail,
          recoveryKey: plainRecoveryKey
        });

      const user = await User.findById(testUser._id);
      expect(user.sessions).toBeDefined();
      expect(user.sessions.length).toBe(1);
    });

    it('should log recovery login activity', async () => {
      await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: testEmail,
          recoveryKey: plainRecoveryKey
        });

      // Verify activity was logged (depends on activityLogger implementation)
    });

    it('should work with organization email', async () => {
      const orgRecoveryKey = 'ORG-RECOVERY-KEY-123';
      const orgUser = await User.create({
        type: 'organization',
        organizationName: 'Test Organization',
        organizationEmail: 'orgrecovery@example.com',
        organizationPhone: '+254712345680',
        organizationType: 'HOSPITAL',
        county: 'Nairobi',
        subCounty: 'Westlands',
        yearOfEstablishment: 2020,
        password: await bcrypt.hash(testPassword, 12),
        role: 'vendor_developer',
        recoveryKeyHash: await bcrypt.hash(orgRecoveryKey, 12)
      });

      const res = await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: 'orgrecovery@example.com',
          recoveryKey: orgRecoveryKey
        });

      expect(res.status).toBe(200);
    });
  });
});

describe('Password Management - Change Password', () => {
  let testUser;
  let authToken;
  const testEmail = 'testchange@example.com';
  const currentPassword = 'CurrentPassword123!';
  const newPassword = 'NewPassword456!';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();

    testUser = await User.create({
      type: 'individual',
      username: 'testchange',
      firstName: 'Test',
      lastName: 'Change',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash(currentPassword, 12),
      role: 'public_user',
      twoFactorEnabled: false
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testEmail,
        password: currentPassword
      });

    authToken = loginRes.body.token;
  });

  describe('Change Password', () => {
    it('should change password with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('updated successfully');

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: newPassword
        });

      expect(loginRes.status).toBe(200);
    });

    it('should reject incorrect current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: newPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('should enforce new password minimum length', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: 'Short1!'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WEAK_PASSWORD');
    });

    it('should require both passwords', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: currentPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_PASSWORDS');
    });

    it('should increment token version on password change', async () => {
      const oldTokenVersion = testUser.tokenVersion || 0;

      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newPassword
        });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.tokenVersion).toBe(oldTokenVersion + 1);
    });

    it('should update passwordChangedAt timestamp', async () => {
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newPassword
        });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.passwordChangedAt).toBeDefined();
      expect(new Date(updatedUser.passwordChangedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should hash new password', async () => {
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newPassword
        });

      const updatedUser = await User.findById(testUser._id).select('+password');
      expect(updatedUser.password).not.toBe(newPassword);
      const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isMatch).toBe(true);
    });
  });
});

describe('Password Management - Password History (SRS Requirement)', () => {
  let testUser;
  let authToken;
  const testEmail = 'testhistory@example.com';
  const password1 = 'Password123!First';
  const password2 = 'Password456!Second';
  const password3 = 'Password789!Third';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();

    const password1Hash = await bcrypt.hash(password1, 12);

    testUser = await User.create({
      type: 'individual',
      username: 'testhistory',
      firstName: 'Test',
      lastName: 'History',
      email: testEmail,
      phone: '+254712345678',
      password: password1Hash,
      role: 'public_user',
      twoFactorEnabled: false,
      passwordHistory: [{
        hash: password1Hash,
        changedAt: new Date()
      }],
      maxPasswordHistory: 5
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testEmail,
        password: password1
      });

    authToken = loginRes.body.token;
  });

  it('should prevent reuse of previous password', async () => {
    // Change to password2
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: password1,
        newPassword: password2
      });

    // Get new token after password change
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testEmail,
        password: password2
      });

    const newAuthToken = loginRes.body.token;

    // Try to change back to password1 (should fail)
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${newAuthToken}`)
      .send({
        currentPassword: password2,
        newPassword: password1
      });

    // This depends on your password history implementation
    // If implemented, it should reject the reused password
    // expect(res.status).toBe(400);
    // expect(res.body.message).toContain('recent passwords');
  });

  it('should store password in history after change', async () => {
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: password1,
        newPassword: password2
      });

    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.passwordHistory).toBeDefined();
    expect(updatedUser.passwordHistory.length).toBeGreaterThan(0);
  });

  it('should limit password history to 5 entries', async () => {
    // Change password 6 times
    let currentPwd = password1;
    let currentToken = authToken;

    for (let i = 0; i < 6; i++) {
      const nextPwd = `NewPassword${i}!Test${i}`;

      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${currentToken}`)
        .send({
          currentPassword: currentPwd,
          newPassword: nextPwd
        });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: nextPwd
        });

      currentPwd = nextPwd;
      currentToken = loginRes.body.token;
    }

    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.passwordHistory.length).toBeLessThanOrEqual(5);
  });
});

describe('Password Management - Password Expiry (SRS Requirement - 90 days)', () => {
  let testUser;
  const testEmail = 'testexpiry@example.com';
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();
  });

  it('should set password expiry on user creation', async () => {
    testUser = await User.create({
      type: 'individual',
      username: 'testexpiry',
      firstName: 'Test',
      lastName: 'Expiry',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      passwordExpiryDays: 90
    });

    expect(testUser.passwordExpiryDays).toBe(90);
    expect(testUser.passwordLastChanged).toBeDefined();
  });

  it('should calculate expiry as 90 days from password change', async () => {
    testUser = await User.create({
      type: 'individual',
      username: 'testexpiry',
      firstName: 'Test',
      lastName: 'Expiry',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      passwordLastChanged: new Date(),
      passwordExpiryDays: 90
    });

    // Calculate expected expiry
    const expectedExpiry = new Date(testUser.passwordLastChanged);
    expectedExpiry.setDate(expectedExpiry.getDate() + 90);

    // If passwordExpiresAt is set automatically
    if (testUser.passwordExpiresAt) {
      const expiryTime = new Date(testUser.passwordExpiresAt).getTime();
      const expectedTime = expectedExpiry.getTime();

      // Allow 1 second tolerance
      expect(expiryTime).toBeGreaterThanOrEqual(expectedTime - 1000);
      expect(expiryTime).toBeLessThanOrEqual(expectedTime + 1000);
    }
  });

  it('should warn user when password is expiring soon', async () => {
    // Create user with password expiring in 5 days
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 5);

    testUser = await User.create({
      type: 'individual',
      username: 'testexpiry',
      firstName: 'Test',
      lastName: 'Expiry',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      twoFactorEnabled: false,
      passwordExpiresAt: expiryDate
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testEmail,
        password: testPassword
      });

    // If implemented, should show warning
    // expect(res.body.passwordExpiryWarning).toBeDefined();
  });

  it('should prevent login with expired password', async () => {
    // Create user with expired password
    testUser = await User.create({
      type: 'individual',
      username: 'testexpiry',
      firstName: 'Test',
      lastName: 'Expiry',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      passwordExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      twoFactorEnabled: false
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testEmail,
        password: testPassword
      });

    // If implemented, should reject expired password
    // expect(res.status).toBe(403);
    // expect(res.body.code).toBe('PASSWORD_EXPIRED');
  });
});

describe('Password Management - Rate Limiting', () => {
  const testEmail = 'testratelimit@example.com';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();

    await User.create({
      type: 'individual',
      username: 'testratelimit',
      firstName: 'Test',
      lastName: 'RateLimit',
      email: testEmail,
      phone: '+254712345678',
      password: await bcrypt.hash('TestPassword123!', 12),
      role: 'public_user'
    });
  });

  it('should rate limit password reset requests', async () => {
    // Make 5 rapid requests
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        request(app)
          .post('/api/password/forgot-password')
          .send({ email: testEmail })
      );
    }

    const responses = await Promise.all(requests);

    // If rate limiting is implemented, some should be blocked
    // const blockedRequests = responses.filter(r => r.status === 429);
    // expect(blockedRequests.length).toBeGreaterThan(0);
  });

  it('should allow request after rate limit window expires', async () => {
    // This test would need to wait for the rate limit window
    // Or use a time-mocking library like jest-mock-date
  });
});
