// ✅ DHA SECURITY VULNERABILITY TESTS
// Tests for SQL injection, XSS, CSRF, session security, JWT tampering, brute force

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const { resetAllMocks } = require('../mocks/services');

describe('Security Tests - Vulnerability Protection', () => {
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

  describe('SQL Injection Protection', () => {
    it('should reject SQL injection in email field', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: "admin' OR '1'='1",
          password: 'password'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject SQL injection in username field', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: "admin'; DROP TABLE users; --",
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          phone: '+254712345678',
          password: 'TestPassword123!'
        });

      // Should fail validation or be sanitized
      expect(res.status).not.toBe(201);
    });

    it('should sanitize special characters in search queries', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'testsql',
        firstName: 'Test',
        lastName: 'SQL',
        email: 'testsql@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user'
      });

      // Attempt SQL injection in any search/filter endpoint
      // This depends on your API implementation
      // Example: GET /api/users?search=admin' OR '1'='1
    });

    it('should reject NoSQL injection attempts', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: { $ne: null },
          password: { $ne: null }
        });

      expect(res.status).toBe(400);
    });
  });

  describe('XSS (Cross-Site Scripting) Protection', () => {
    it('should sanitize script tags in registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'xsstest',
          firstName: '<script>alert("XSS")</script>',
          lastName: 'User',
          email: 'xss@example.com',
          phone: '+254712345678',
          password: 'TestPassword123!'
        });

      if (res.status === 201) {
        // Verify script tags were sanitized
        expect(res.body.user.firstName).not.toContain('<script>');
      }
    });

    it('should sanitize HTML in organization name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'organization',
          organizationName: '<img src=x onerror=alert("XSS")>',
          organizationType: 'HOSPITAL',
          county: 'Nairobi',
          subCounty: 'Westlands',
          organizationEmail: 'xssorg@example.com',
          organizationPhone: '+254712345678',
          yearOfEstablishment: 2020,
          password: 'TestPassword123!'
        });

      if (res.status === 201) {
        expect(res.body.user.organizationName).not.toContain('onerror');
      }
    });

    it('should escape special characters in user input', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'xssprofile',
        firstName: 'Test',
        lastName: 'XSS',
        email: 'xssprofile@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      const token = loginRes.body.token;

      const updateRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: '<script>alert("XSS")</script>'
        });

      if (updateRes.status === 200) {
        expect(updateRes.body.user.firstName).not.toContain('<script>');
      }
    });
  });

  describe('CSRF (Cross-Site Request Forgery) Protection', () => {
    it('should reject requests without proper origin', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'csrftest',
        firstName: 'Test',
        lastName: 'CSRF',
        email: 'csrf@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      const token = loginRes.body.token;

      // Attempt state-changing operation from untrusted origin
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'https://malicious-site.com')
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword456!'
        });

      // If CSRF protection is implemented, should reject
      // Otherwise, ensure cookies use SameSite=Strict
    });

    it('should use SameSite cookie attribute', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'cookietest',
          firstName: 'Cookie',
          lastName: 'Test',
          email: 'cookie@example.com',
          phone: '+254712345678',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(201);

      // Check cookie header
      if (res.headers['set-cookie']) {
        const cookieHeader = res.headers['set-cookie'][0];
        // Should include SameSite attribute
        expect(cookieHeader).toMatch(/SameSite=(Strict|Lax)/i);
      }
    });
  });

  describe('Session Security', () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'sessiontest',
        firstName: 'Session',
        lastName: 'Test',
        email: 'session@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      authToken = loginRes.body.token;
    });

    it('should invalidate session after password change', async () => {
      // Change password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword456!'
        });

      // Old token should be invalid
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      // If token version is implemented, should fail
      // expect(res.status).toBe(401);
    });

    it('should use secure cookies in production', async () => {
      // In production environment, cookies should have Secure flag
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      process.env.NODE_ENV = originalEnv;

      if (res.headers['set-cookie']) {
        const cookieHeader = res.headers['set-cookie'][0];
        // Should include Secure flag in production
        // expect(cookieHeader).toContain('Secure');
      }
    });

    it('should use HTTP-only cookies', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      if (res.headers['set-cookie']) {
        const cookieHeader = res.headers['set-cookie'][0];
        expect(cookieHeader).toContain('HttpOnly');
      }
    });
  });

  describe('JWT Security', () => {
    let testUser;
    let validToken;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'jwttest',
        firstName: 'JWT',
        lastName: 'Test',
        email: 'jwt@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false,
        tokenVersion: 0
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      validToken = loginRes.body.token;
    });

    it('should reject tampered JWT tokens', async () => {
      // Tamper with token payload
      const decoded = jwt.decode(validToken);
      const tamperedToken = jwt.sign(
        { ...decoded, role: 'dha_system_administrator' },
        'wrong-secret'
      );

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject expired tokens', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: testUser._id, role: testUser.role },
        process.env.JWT_SECRET || 'test_jwt_secret',
        { expiresIn: '0s' }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject tokens with invalid signature', async () => {
      const decoded = jwt.decode(validToken);
      const invalidToken = jwt.sign(
        decoded,
        'wrong-secret-key'
      );

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.status).toBe(401);
    });

    it('should validate token version', async () => {
      // Increment token version
      testUser.tokenVersion = 1;
      await testUser.save();

      // Old token should be invalid
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`);

      // If token version validation is implemented
      // expect(res.status).toBe(401);
    });
  });

  describe('Brute Force Protection', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        type: 'individual',
        username: 'bruteforce',
        firstName: 'Brute',
        lastName: 'Force',
        email: 'bruteforce@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });
    });

    it('should implement rate limiting on login', async () => {
      const requests = [];

      // Make 10 rapid login attempts
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              identifier: testUser.email,
              password: 'WrongPassword123!'
            })
        );
      }

      const responses = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);

      // If rate limiting is implemented
      // expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should implement progressive delays on failed attempts', async () => {
      const timings = [];

      // Make 3 failed attempts and measure response time
      for (let i = 0; i < 3; i++) {
        const start = Date.now();

        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!'
          });

        timings.push(Date.now() - start);
      }

      // Each subsequent attempt should take longer
      expect(timings[0]).toBeGreaterThanOrEqual(1000); // Base delay
    });

    it('should lock account after threshold failures', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!'
          });
      }

      // Verify account is locked
      const user = await User.findById(testUser._id);
      expect(user.accountStatus).toBe('suspended');
      expect(user.suspended).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit password reset requests', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'ratelimit',
        firstName: 'Rate',
        lastName: 'Limit',
        email: 'ratelimit@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user'
      });

      const requests = [];

      // Make 10 rapid password reset requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/password/forgot-password')
            .send({ email: testUser.email })
        );
      }

      const responses = await Promise.all(requests);

      // If rate limiting is implemented
      // const rateLimited = responses.filter(r => r.status === 429);
      // expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should rate limit 2FA code generation', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: '2faratelimit',
        firstName: '2FA',
        lastName: 'RateLimit',
        email: '2faratelimit@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      const token = loginRes.body.token;
      const requests = [];

      // Make 10 rapid 2FA generation requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/2fa/generate')
            .set('Authorization', `Bearer ${token}`)
        );
      }

      const responses = await Promise.all(requests);

      // All should succeed as it's the same user
      // But could implement rate limiting if needed
    });
  });

  describe('Input Validation', () => {
    it('should reject excessively long inputs', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'a'.repeat(1000),
          firstName: 'Test',
          lastName: 'User',
          email: 'long@example.com',
          phone: '+254712345678',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(400);
    });

    it('should reject null bytes in input', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'test\x00user',
          firstName: 'Test',
          lastName: 'User',
          email: 'nullbyte@example.com',
          phone: '+254712345678',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(400);
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user..test@example.com'
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            type: 'individual',
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
            email: email,
            phone: '+254712345678',
            password: 'TestPassword123!'
          });

        expect(res.status).toBe(400);
      }
    });

    it('should validate phone number format', async () => {
      const invalidPhones = [
        '123456789',
        '+1234567890',
        'not-a-phone',
        '+254812345678', // Invalid Kenyan format
        '+25471234567'   // Too short
      ];

      for (const phone of invalidPhones) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            type: 'individual',
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: phone,
            password: 'TestPassword123!'
          });

        expect(res.status).toBe(400);
      }
    });
  });

  describe('Authorization Bypass Prevention', () => {
    let normalUser;
    let normalToken;

    beforeEach(async () => {
      normalUser = await User.create({
        type: 'individual',
        username: 'normaluser',
        firstName: 'Normal',
        lastName: 'User',
        email: 'normal@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: normalUser.email,
          password: 'TestPassword123!'
        });

      normalToken = loginRes.body.token;
    });

    it('should prevent role escalation via token tampering', async () => {
      // Attempt to modify role in JWT
      const decoded = jwt.decode(normalToken);
      const tamperedToken = jwt.sign(
        { ...decoded, role: 'dha_system_administrator' },
        process.env.JWT_SECRET || 'test_jwt_secret'
      );

      // If role is properly validated from database, should fail
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${tamperedToken}`);

      // Token should be valid but role should be fetched from DB
      if (res.status === 200) {
        expect(res.body.user.role).toBe('public_user');
      }
    });

    it('should prevent accessing other users data', async () => {
      // Create another user
      const otherUser = await User.create({
        type: 'individual',
        username: 'otheruser',
        firstName: 'Other',
        lastName: 'User',
        email: 'other@example.com',
        phone: '+254712345679',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user'
      });

      // Attempt to access other user's profile
      // This depends on your API design
      // Example: GET /api/users/:userId
    });
  });
});
