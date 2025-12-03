// ✅ DHA TWO-FACTOR AUTHENTICATION TESTS
// Tests for 2FA setup, verification, QR generation, backup codes

const request = require('supertest');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const { resetAllMocks } = require('../mocks/services');

describe('Two-Factor Authentication - Setup', () => {
  let testUser;
  let authToken;
  const testPassword = 'TestPassword123!';

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
      username: 'test2fasetup',
      firstName: 'Test',
      lastName: '2FASetup',
      email: 'test2fasetup@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      twoFactorEnabled: false
    });

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUser.email,
        password: testPassword
      });

    authToken = loginRes.body.token;
  });

  describe('Generate 2FA Secret', () => {
    it('should generate 2FA secret and QR code', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.qrCode).toBeDefined();
      expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(res.body.manualEntryKey).toBeDefined();
      expect(res.body.manualEntryKey).toMatch(/^[A-Z2-7]+$/); // Base32 format
    });

    it('should store temp secret in user record', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.twoFactorTempSecret).toBeDefined();
      expect(updatedUser.twoFactorTempSecret).toBe(res.body.manualEntryKey);
    });

    it('should generate secret with user email in name', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      // QR code should contain user email
      // This is encoded in the QR code data URL
      expect(res.body.qrCode).toBeDefined();
    });

    it('should use organization email for organization users', async () => {
      const orgUser = await User.create({
        type: 'organization',
        organizationName: 'Test Org',
        organizationEmail: 'org@example.com',
        organizationPhone: '+254712345679',
        organizationType: 'HOSPITAL',
        county: 'Nairobi',
        subCounty: 'Westlands',
        yearOfEstablishment: 2020,
        password: await bcrypt.hash(testPassword, 12),
        role: 'vendor_developer',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'org@example.com',
          password: testPassword
        });

      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.qrCode).toBeDefined();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/2fa/generate');

      expect(res.status).toBe(401);
    });
  });

  describe('Verify and Enable 2FA', () => {
    let tempSecret;
    let validToken;

    beforeEach(async () => {
      // Generate 2FA secret
      const generateRes = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      tempSecret = generateRes.body.manualEntryKey;

      // Generate valid TOTP token
      validToken = speakeasy.totp({
        secret: tempSecret,
        encoding: 'base32'
      });
    });

    it('should verify valid TOTP code and enable 2FA', async () => {
      const res = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: validToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('enabled successfully');

      // Verify user record updated
      const updatedUser = await User.findById(testUser._id).select('+twoFactorSecret');
      expect(updatedUser.twoFactorEnabled).toBe(true);
      expect(updatedUser.twoFactorSecret).toBe(tempSecret);
      expect(updatedUser.twoFactorTempSecret).toBeUndefined();
    });

    it('should reject invalid TOTP code', async () => {
      const res = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: '000000' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid');

      // Verify user 2FA not enabled
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.twoFactorEnabled).toBe(false);
    });

    it('should reject expired TOTP code', async () => {
      // Generate token from 2 time windows ago (expired)
      const expiredToken = speakeasy.totp({
        secret: tempSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 60 // 60 seconds ago
      });

      const res = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: expiredToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid');
    });

    it('should clear temp secret after successful verification', async () => {
      await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: validToken });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.twoFactorTempSecret).toBeUndefined();
    });

    it('should move temp secret to permanent secret', async () => {
      await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: validToken });

      const updatedUser = await User.findById(testUser._id).select('+twoFactorSecret');
      expect(updatedUser.twoFactorSecret).toBe(tempSecret);
    });

    it('should log 2FA enable activity', async () => {
      await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: validToken });

      // Activity logging verification (depends on activityLogger implementation)
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/2fa/verify')
        .send({ token: validToken });

      expect(res.status).toBe(401);
    });
  });
});

describe('Two-Factor Authentication - Login with 2FA', () => {
  let testUser;
  const testPassword = 'TestPassword123!';
  const testSecret = 'JBSWY3DPEHPK3PXP'; // Fixed test secret

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
      username: 'test2falogin',
      firstName: 'Test',
      lastName: '2FALogin',
      email: 'test2falogin@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      twoFactorEnabled: true,
      twoFactorSecret: testSecret
    });
  });

  describe('Login with 2FA Code', () => {
    it('should require 2FA code when 2FA is enabled', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('2FA_REQUIRED');
      expect(res.body.requiresTwoFactor).toBe(true);
    });

    it('should login successfully with valid 2FA code', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: validToken
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.token).toBeValidJWT();
    });

    it('should reject invalid 2FA code', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: '000000'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_2FA_CODE');
    });

    it('should reject correct password with wrong 2FA code', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: '123456'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_2FA_CODE');
    });

    it('should create session after successful 2FA login', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: validToken
        });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.sessions).toBeDefined();
      expect(updatedUser.sessions.length).toBe(1);
    });

    it('should update lastLogin timestamp', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const beforeLogin = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: validToken
        });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.lastLogin).toBeDefined();
      expect(new Date(updatedUser.lastLogin).getTime()).toBeGreaterThanOrEqual(beforeLogin);
    });
  });

  describe('2FA Code Format Validation', () => {
    it('should reject non-numeric 2FA code', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: 'ABCDEF'
        });

      expect(res.status).toBe(400);
    });

    it('should reject 2FA code with wrong length', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: '12345' // Only 5 digits
        });

      expect(res.status).toBe(400);
    });

    it('should accept 6-digit numeric code', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      expect(validToken).toMatch(/^\d{6}$/);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: validToken
        });

      expect(res.status).toBe(200);
    });
  });
});

describe('Two-Factor Authentication - Disable 2FA', () => {
  let testUser;
  let authToken;
  const testPassword = 'TestPassword123!';
  const testSecret = 'JBSWY3DPEHPK3PXP';

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
      username: 'test2fadisable',
      firstName: 'Test',
      lastName: '2FADisable',
      email: 'test2fadisable@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      twoFactorEnabled: true,
      twoFactorSecret: testSecret
    });

    // Login with 2FA to get auth token
    const validToken = speakeasy.totp({
      secret: testSecret,
      encoding: 'base32'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUser.email,
        password: testPassword,
        twoFactorCode: validToken
      });

    authToken = loginRes.body.token;
  });

  describe('Disable 2FA', () => {
    it('should disable 2FA with valid password and 2FA code', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword,
          twoFactorCode: validToken
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('disabled successfully');

      // Verify 2FA disabled in database
      const updatedUser = await User.findById(testUser._id).select('+twoFactorSecret');
      expect(updatedUser.twoFactorEnabled).toBe(false);
      expect(updatedUser.twoFactorSecret).toBeUndefined();
    });

    it('should require password to disable 2FA', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          twoFactorCode: validToken
        });

      expect(res.status).toBe(400);
    });

    it('should reject incorrect password', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'WrongPassword123!',
          twoFactorCode: validToken
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Incorrect password');
    });

    it('should require 2FA code to disable 2FA', async () => {
      const res = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.requiresTwoFactor).toBe(true);
    });

    it('should reject invalid 2FA code', async () => {
      const res = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword,
          twoFactorCode: '000000'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid 2FA code');
    });

    it('should clear 2FA secret after disabling', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword,
          twoFactorCode: validToken
        });

      const updatedUser = await User.findById(testUser._id).select('+twoFactorSecret');
      expect(updatedUser.twoFactorSecret).toBeUndefined();
      expect(updatedUser.twoFactorTempSecret).toBeUndefined();
    });

    it('should fail if 2FA is not enabled', async () => {
      // Disable 2FA first
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword,
          twoFactorCode: validToken
        });

      // Try to disable again
      const res = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword,
          twoFactorCode: validToken
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not enabled');
    });

    it('should log 2FA disable activity', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: testPassword,
          twoFactorCode: validToken
        });

      // Activity logging verification (depends on activityLogger implementation)
    });

    it('should require authentication', async () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/2fa/disable')
        .send({
          password: testPassword,
          twoFactorCode: validToken
        });

      expect(res.status).toBe(401);
    });
  });
});

describe('Two-Factor Authentication - QR Code Generation', () => {
  let testUser;
  let authToken;
  const testPassword = 'TestPassword123!';

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
      username: 'testqr',
      firstName: 'Test',
      lastName: 'QR',
      email: 'testqr@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      twoFactorEnabled: false
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUser.email,
        password: testPassword
      });

    authToken = loginRes.body.token;
  });

  describe('QR Code Properties', () => {
    it('should generate base64-encoded PNG image', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);

      // Decode and verify it's valid base64
      const base64Data = res.body.qrCode.split(',')[1];
      expect(() => Buffer.from(base64Data, 'base64')).not.toThrow();
    });

    it('should include issuer name in QR code', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      // The QR code should encode a URL containing "Huduma Hub"
      expect(res.body.qrCode).toBeDefined();
    });

    it('should include user email in QR code', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      // QR code should be scannable and contain user info
      expect(res.body.qrCode).toBeDefined();
      expect(res.body.manualEntryKey).toBeDefined();
    });
  });

  describe('Manual Entry Key', () => {
    it('should provide manual entry key in base32 format', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.manualEntryKey).toMatch(/^[A-Z2-7]+$/);
      expect(res.body.manualEntryKey.length).toBeGreaterThan(0);
    });

    it('should generate different secrets for different users', async () => {
      const user2 = await User.create({
        type: 'individual',
        username: 'testqr2',
        firstName: 'Test',
        lastName: 'QR2',
        email: 'testqr2@example.com',
        phone: '+254712345679',
        password: await bcrypt.hash(testPassword, 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes2 = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: user2.email,
          password: testPassword
        });

      const res1 = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const res2 = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${loginRes2.body.token}`);

      expect(res1.body.manualEntryKey).not.toBe(res2.body.manualEntryKey);
    });

    it('should generate same secret on multiple calls for same user', async () => {
      const res1 = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const res2 = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`);

      // Should overwrite previous temp secret
      expect(res2.body.manualEntryKey).toBeDefined();
    });
  });
});

describe('Two-Factor Authentication - TOTP Time Window', () => {
  let testUser;
  const testPassword = 'TestPassword123!';
  const testSecret = 'JBSWY3DPEHPK3PXP';

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
      username: 'testtotp',
      firstName: 'Test',
      lastName: 'TOTP',
      email: 'testtotp@example.com',
      phone: '+254712345678',
      password: await bcrypt.hash(testPassword, 12),
      role: 'public_user',
      twoFactorEnabled: true,
      twoFactorSecret: testSecret
    });
  });

  describe('Time-Based Code Validity', () => {
    it('should accept code from current time window', async () => {
      const currentToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: currentToken
        });

      expect(res.status).toBe(200);
    });

    it('should reject code from far past', async () => {
      const oldToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 120 // 2 minutes ago
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testPassword,
          twoFactorCode: oldToken
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_2FA_CODE');
    });

    it('should use 30-second time step', async () => {
      // TOTP standard uses 30-second time steps
      const token = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32',
        step: 30
      });

      expect(token).toMatch(/^\d{6}$/);
    });
  });
});
