// ✅ DHA INTEGRATION TESTS - END-TO-END FLOWS
// Tests for complete user journeys across multiple endpoints

const request = require('supertest');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const app = require('../../src/app');
const User = require('../../src/models/User');
const PasswordReset = require('../../src/models/PasswordReset');
const securityEvent = require('../../src/models/securityEvent');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const { resetAllMocks } = require('../mocks/services');

describe('Integration Tests - Complete User Journeys', () => {
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

  describe('Journey: Registration → Login → 2FA Setup → Logout', () => {
    const userData = {
      type: 'individual',
      username: 'journeyuser',
      firstName: 'Journey',
      lastName: 'User',
      email: 'journey@example.com',
      phone: '+254712345678',
      password: 'JourneyPassword123!'
    };

    it('should complete full registration and 2FA setup journey', async () => {
      // Step 1: Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.user).toBeDefined();
      expect(registerRes.body.token).toBeDefined();
      expect(registerRes.body.recoveryKey).toBeDefined();

      const userId = registerRes.body.user._id;
      const firstToken = registerRes.body.token;

      // Step 2: Generate 2FA Secret
      const generate2FARes = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${firstToken}`);

      expect(generate2FARes.status).toBe(200);
      expect(generate2FARes.body.qrCode).toBeDefined();
      expect(generate2FARes.body.manualEntryKey).toBeDefined();

      const tempSecret = generate2FARes.body.manualEntryKey;

      // Step 3: Verify and Enable 2FA
      const totpCode = speakeasy.totp({
        secret: tempSecret,
        encoding: 'base32'
      });

      const verify2FARes = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ token: totpCode });

      expect(verify2FARes.status).toBe(200);
      expect(verify2FARes.body.message).toContain('enabled successfully');

      // Step 4: Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${firstToken}`);

      expect(logoutRes.status).toBe(200);

      // Step 5: Login with 2FA
      const newTotpCode = speakeasy.totp({
        secret: tempSecret,
        encoding: 'base32'
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: userData.email,
          password: userData.password,
          twoFactorCode: newTotpCode
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user._id).toBe(userId);
      expect(loginRes.body.user.twoFactorEnabled).toBe(true);
    });
  });

  describe('Journey: Password Reset Flow', () => {
    const testEmail = 'resetuser@example.com';
    const testPassword = 'OriginalPassword123!';
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'resetuser',
        firstName: 'Reset',
        lastName: 'User',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });
    });

    it('should complete password reset journey', async () => {
      // Step 1: Request password reset
      const forgotRes = await request(app)
        .post('/api/password/forgot-password')
        .send({ email: testEmail });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.message).toContain('Reset code sent');

      // Step 2: Get reset code from database
      const resetRecord = await PasswordReset.findOne({ email: testEmail });
      expect(resetRecord).toBeDefined();
      const resetCode = resetRecord.code;

      // Step 3: Verify code
      const verifyRes = await request(app)
        .post('/api/password/verify-code')
        .send({
          email: testEmail,
          code: resetCode
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeDefined();

      const resetToken = verifyRes.body.token;

      // Step 4: Change password
      const newPassword = 'NewPassword456!';
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${resetToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: newPassword
        });

      expect(changeRes.status).toBe(200);

      // Step 5: Verify can login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: newPassword
        });

      expect(loginRes.status).toBe(200);

      // Step 6: Verify cannot login with old password
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword
        });

      expect(oldLoginRes.status).toBe(401);
    });
  });

  describe('Journey: Account Lockout → Auto Unlock', () => {
    const testEmail = 'lockoutuser@example.com';
    const testPassword = 'LockoutPassword123!';
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'lockoutuser',
        firstName: 'Lockout',
        lastName: 'User',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });
    });

    it('should lock account after 5 failed attempts and prevent login', async () => {
      // Step 1: Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testEmail,
            password: 'WrongPassword123!'
          });
      }

      // Step 2: Verify account is suspended
      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.suspended).toBe(true);

      // Step 3: Verify cannot login even with correct password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword
        });

      expect(loginRes.status).toBe(423);
      expect(loginRes.body.code).toBe('ACCOUNT_SUSPENDED');

      // Step 4: Verify security event logged
      const events = await securityEvent.find({
        action: 'Account Suspended Due to Failed Logins',
        user: testUser._id
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Journey: Recovery Key Login', () => {
    const testEmail = 'recoveryuser@example.com';
    const testPassword = 'RecoveryPassword123!';
    let testUser;
    let recoveryKey;

    beforeEach(async () => {
      recoveryKey = 'RECOVERY-KEY-ABC-123-XYZ-789';

      testUser = await User.create({
        type: 'individual',
        username: 'recoveryuser',
        firstName: 'Recovery',
        lastName: 'User',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        recoveryKeyHash: await bcrypt.hash(recoveryKey, 12),
        twoFactorEnabled: false
      });
    });

    it('should login with recovery key when password forgotten', async () => {
      // Step 1: Login with recovery key
      const recoveryLoginRes = await request(app)
        .post('/api/password/recovery-login')
        .send({
          email: testEmail,
          recoveryKey: recoveryKey
        });

      expect(recoveryLoginRes.status).toBe(200);
      expect(recoveryLoginRes.body.token).toBeDefined();
      expect(recoveryLoginRes.body.user).toBeDefined();

      const recoveryToken = recoveryLoginRes.body.token;

      // Step 2: Change password using recovery token
      const newPassword = 'NewRecoveryPassword456!';
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${recoveryToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: newPassword
        });

      expect(changeRes.status).toBe(200);

      // Step 3: Verify can login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: newPassword
        });

      expect(loginRes.status).toBe(200);
    });
  });

  describe('Journey: Organization Registration → Application Submission', () => {
    const orgData = {
      type: 'organization',
      organizationName: 'Test Health System',
      organizationType: 'HOSPITAL',
      county: 'Nairobi',
      subCounty: 'Westlands',
      organizationEmail: 'testorg@healthsystem.com',
      organizationPhone: '+254712345678',
      yearOfEstablishment: 2020,
      password: 'OrgPassword123!'
    };

    it('should complete organization registration and verification', async () => {
      // Step 1: Register organization
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(orgData);

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.user).toBeDefined();
      expect(registerRes.body.user.organizationName).toBe(orgData.organizationName);
      expect(registerRes.body.user.accountStatus).toBe('pending_registration');
      expect(registerRes.body.user.role).toBe('vendor_developer');

      const orgToken = registerRes.body.token;

      // Step 2: Get profile
      const profileRes = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${orgToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user.organizationName).toBe(orgData.organizationName);

      // Step 3: Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${orgToken}`);

      expect(logoutRes.status).toBe(200);

      // Step 4: Re-login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: orgData.organizationEmail,
          password: orgData.password
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.organizationEmail).toBe(orgData.organizationEmail);
    });
  });

  describe('Journey: Multiple Sessions Management', () => {
    const testEmail = 'multisession@example.com';
    const testPassword = 'MultiSession123!';
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'multisession',
        firstName: 'Multi',
        lastName: 'Session',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });
    });

    it('should maintain max 5 active sessions', async () => {
      const tokens = [];

      // Create 7 sessions
      for (let i = 0; i < 7; i++) {
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testEmail,
            password: testPassword
          });

        expect(loginRes.status).toBe(200);
        tokens.push(loginRes.body.token);
      }

      // Verify only 5 sessions exist
      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBe(5);

      // Verify most recent sessions are kept
      const latestToken = tokens[tokens.length - 1];
      const profileRes = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${latestToken}`);

      expect(profileRes.status).toBe(200);
    });
  });

  describe('Journey: Profile Update Flow', () => {
    const testEmail = 'profileupdate@example.com';
    const testPassword = 'ProfileUpdate123!';
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'profileupdate',
        firstName: 'Profile',
        lastName: 'Update',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword
        });

      authToken = loginRes.body.token;
    });

    it('should update profile and verify changes', async () => {
      // Step 1: Get initial profile
      const initialProfileRes = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(initialProfileRes.status).toBe(200);
      expect(initialProfileRes.body.user.firstName).toBe('Profile');

      // Step 2: Update profile
      const updateRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+254712345679'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.user.firstName).toBe('Updated');
      expect(updateRes.body.user.lastName).toBe('Name');

      // Step 3: Verify changes persisted
      const updatedProfileRes = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedProfileRes.status).toBe(200);
      expect(updatedProfileRes.body.user.firstName).toBe('Updated');
      expect(updatedProfileRes.body.user.phone).toBe('+254712345679');
    });
  });

  describe('Journey: 2FA Disable and Re-enable', () => {
    const testEmail = '2facycle@example.com';
    const testPassword = '2FACycle123!';
    let testUser;
    let authToken;
    let twoFactorSecret;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: '2facycle',
        firstName: '2FA',
        lastName: 'Cycle',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword
        });

      authToken = loginRes.body.token;
    });

    it('should enable, disable, and re-enable 2FA', async () => {
      // Step 1: Generate and enable 2FA
      const generateRes = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(generateRes.status).toBe(200);
      twoFactorSecret = generateRes.body.manualEntryKey;

      const totpCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const enableRes = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: totpCode });

      expect(enableRes.status).toBe(200);

      // Step 2: Logout and login with 2FA
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      const newTotpCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const loginWith2FARes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword,
          twoFactorCode: newTotpCode
        });

      expect(loginWith2FARes.status).toBe(200);
      const newAuthToken = loginWith2FARes.body.token;

      // Step 3: Disable 2FA
      const disableTotpCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const disableRes = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          password: testPassword,
          twoFactorCode: disableTotpCode
        });

      expect(disableRes.status).toBe(200);

      // Step 4: Verify can login without 2FA
      const loginWithout2FARes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword
        });

      expect(loginWithout2FARes.status).toBe(200);
      expect(loginWithout2FARes.body.user.twoFactorEnabled).toBe(false);

      // Step 5: Re-enable 2FA with new secret
      const reEnableAuthToken = loginWithout2FARes.body.token;

      const reGenerateRes = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${reEnableAuthToken}`);

      expect(reGenerateRes.status).toBe(200);
      const newSecret = reGenerateRes.body.manualEntryKey;

      const newEnableTotpCode = speakeasy.totp({
        secret: newSecret,
        encoding: 'base32'
      });

      const reEnableRes = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${reEnableAuthToken}`)
        .send({ token: newEnableTotpCode });

      expect(reEnableRes.status).toBe(200);

      // Verify 2FA is re-enabled
      const user = await User.findById(testUser._id);
      expect(user.twoFactorEnabled).toBe(true);
    });
  });

  describe('Journey: Failed Login Reset on Success', () => {
    const testEmail = 'failreset@example.com';
    const testPassword = 'FailReset123!';
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'failreset',
        firstName: 'Fail',
        lastName: 'Reset',
        email: testEmail,
        phone: '+254712345678',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });
    });

    it('should reset failed attempts counter on successful login', async () => {
      // Step 1: Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testEmail,
            password: 'WrongPassword123!'
          });
      }

      // Step 2: Verify failed attempts logged
      const failedEvents = await securityEvent.find({
        targetEmail: testEmail,
        action: 'Failed Login'
      });

      expect(failedEvents.length).toBeGreaterThanOrEqual(3);

      // Step 3: Successful login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testEmail,
          password: testPassword
        });

      expect(loginRes.status).toBe(200);

      // Step 4: Verify failed attempts reset event logged
      const resetEvents = await securityEvent.find({
        targetEmail: testEmail,
        action: 'Failed Attempts Reset'
      });

      expect(resetEvents.length).toBeGreaterThan(0);

      // Step 5: Verify recent failed attempts cleared
      const recentFailedEvents = await securityEvent.find({
        targetEmail: testEmail,
        action: 'Failed Login',
        createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
      });

      // Should be cleared or minimal
      expect(recentFailedEvents.length).toBe(0);
    });
  });
});
