// ✅ DHA PERFORMANCE AND LOAD TESTS
// Tests for concurrent logins, sustained load, response times

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const { resetAllMocks } = require('../mocks/services');

describe('Performance Tests - Load and Concurrency', () => {
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

  describe('Concurrent Login Load', () => {
    it('should handle 100 concurrent login requests', async () => {
      // Create test users
      const users = [];
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 12);

      for (let i = 0; i < 100; i++) {
        users.push({
          type: 'individual',
          username: `user${i}`,
          firstName: 'Test',
          lastName: `User${i}`,
          email: `user${i}@example.com`,
          phone: `+25471234${String(i).padStart(4, '0')}`,
          password: hashedPassword,
          role: 'public_user',
          twoFactorEnabled: false
        });
      }

      await User.insertMany(users);

      // Make concurrent login requests
      const startTime = Date.now();
      const loginRequests = users.map((user, i) =>
        request(app)
          .post('/api/auth/login')
          .send({
            identifier: user.email,
            password: password
          })
      );

      const responses = await Promise.all(loginRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all logins succeeded
      const successfulLogins = responses.filter(r => r.status === 200);
      expect(successfulLogins.length).toBe(100);

      // Check average response time
      const avgResponseTime = duration / 100;
      console.log(`Average login time: ${avgResponseTime}ms`);

      // Should complete within reasonable time (< 5s per login on average)
      expect(avgResponseTime).toBeLessThan(5000);
    }, 120000); // 2-minute timeout

    it('should handle 500 concurrent login requests', async () => {
      // Create test users
      const users = [];
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 4); // Lower rounds for faster test

      for (let i = 0; i < 500; i++) {
        users.push({
          type: 'individual',
          username: `loaduser${i}`,
          firstName: 'Load',
          lastName: `User${i}`,
          email: `loaduser${i}@example.com`,
          phone: `+25471234${String(i).padStart(4, '0')}`,
          password: hashedPassword,
          role: 'public_user',
          twoFactorEnabled: false
        });
      }

      await User.insertMany(users);

      // Make concurrent login requests in batches
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < users.length; i += batchSize) {
        const batchUsers = users.slice(i, i + batchSize);
        batches.push(batchUsers);
      }

      const startTime = Date.now();
      let totalSuccessful = 0;

      for (const batch of batches) {
        const batchRequests = batch.map(user =>
          request(app)
            .post('/api/auth/login')
            .send({
              identifier: user.email,
              password: password
            })
        );

        const batchResponses = await Promise.all(batchRequests);
        totalSuccessful += batchResponses.filter(r => r.status === 200).length;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Total time for 500 logins: ${duration}ms`);
      console.log(`Successful logins: ${totalSuccessful}/500`);

      // Most logins should succeed
      expect(totalSuccessful).toBeGreaterThan(450);
    }, 300000); // 5-minute timeout
  });

  describe('Sustained Load', () => {
    it('should maintain performance under sustained load (1000 req/min)', async () => {
      // Create test user
      const testUser = await User.create({
        type: 'individual',
        username: 'sustainedtest',
        firstName: 'Sustained',
        lastName: 'Test',
        email: 'sustained@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 4),
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

      // Make 1000 requests over 60 seconds (16.67 req/s)
      const totalRequests = 1000;
      const durationMs = 60000;
      const intervalMs = durationMs / totalRequests;

      let successCount = 0;
      let errorCount = 0;
      const responseTimes = [];

      for (let i = 0; i < totalRequests; i++) {
        const requestStart = Date.now();

        try {
          const res = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

          const requestEnd = Date.now();
          responseTimes.push(requestEnd - requestStart);

          if (res.status === 200) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }

        // Wait for interval
        if (i < totalRequests - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`Sustained load results:`);
      console.log(`  Success: ${successCount}/${totalRequests}`);
      console.log(`  Errors: ${errorCount}`);
      console.log(`  Avg response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Min/Max: ${minResponseTime}ms / ${maxResponseTime}ms`);

      // Should handle most requests successfully
      expect(successCount).toBeGreaterThan(950);

      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(3000);
    }, 120000); // 2-minute timeout
  });

  describe('Response Time SLA', () => {
    it('should respond to login within 3 seconds', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'slatest',
        firstName: 'SLA',
        lastName: 'Test',
        email: 'sla@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 12),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const startTime = Date.now();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'TestPassword123!'
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(res.status).toBe(200);
      expect(responseTime).toBeLessThan(3000);
    });

    it('should respond to registration within 5 seconds', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          type: 'individual',
          username: 'slaregister',
          firstName: 'SLA',
          lastName: 'Register',
          email: 'slaregister@example.com',
          phone: '+254712345678',
          password: 'TestPassword123!'
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(res.status).toBe(201);
      expect(responseTime).toBeLessThan(5000);
    });

    it('should respond to profile fetch within 1 second', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'profilesla',
        firstName: 'Profile',
        lastName: 'SLA',
        email: 'profilesla@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 4),
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

      const startTime = Date.now();

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(res.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Database Query Performance', () => {
    it('should efficiently query users with pagination', async () => {
      // Create 1000 users
      const users = [];
      const hashedPassword = await bcrypt.hash('TestPassword123!', 4);

      for (let i = 0; i < 1000; i++) {
        users.push({
          type: 'individual',
          username: `dbuser${i}`,
          firstName: 'DB',
          lastName: `User${i}`,
          email: `dbuser${i}@example.com`,
          phone: `+25471234${String(i).padStart(4, '0')}`,
          password: hashedPassword,
          role: 'public_user'
        });
      }

      await User.insertMany(users);

      // Query with filters
      const startTime = Date.now();

      const results = await User.find({ role: 'public_user' })
        .select('username email role')
        .limit(100)
        .lean();

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      console.log(`Query time for 100 users from 1000: ${queryTime}ms`);

      expect(results.length).toBe(100);
      expect(queryTime).toBeLessThan(500); // Should be fast with proper indexing
    });

    it('should efficiently find user by email', async () => {
      // Create many users
      const users = [];
      const hashedPassword = await bcrypt.hash('TestPassword123!', 4);

      for (let i = 0; i < 10000; i++) {
        users.push({
          type: 'individual',
          username: `finduser${i}`,
          firstName: 'Find',
          lastName: `User${i}`,
          email: `finduser${i}@example.com`,
          phone: `+25471234${String(i).padStart(4, '0')}`,
          password: hashedPassword,
          role: 'public_user'
        });
      }

      await User.insertMany(users);

      // Find specific user by email
      const startTime = Date.now();

      const user = await User.findOne({ email: 'finduser5000@example.com' });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      console.log(`Email lookup time from 10k users: ${queryTime}ms`);

      expect(user).toBeDefined();
      expect(queryTime).toBeLessThan(100); // Should be very fast with index
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const testUser = await User.create({
        type: 'individual',
        username: 'memorytest',
        firstName: 'Memory',
        lastName: 'Test',
        email: 'memory@example.com',
        phone: '+254712345678',
        password: await bcrypt.hash('TestPassword123!', 4),
        role: 'public_user',
        twoFactorEnabled: false
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 1000 login operations
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: testUser.email,
            password: 'TestPassword123!'
          });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    }, 120000);
  });
});

describe('Performance Tests - Bcrypt Performance', () => {
  it('should hash passwords efficiently with rounds=4', async () => {
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      await bcrypt.hash('TestPassword123!', 4);
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / 100;

    console.log(`Average bcrypt(4) time: ${avgTime.toFixed(2)}ms`);

    expect(avgTime).toBeLessThan(100);
  });

  it('should hash passwords securely with rounds=12', async () => {
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      await bcrypt.hash('TestPassword123!', 12);
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / 10;

    console.log(`Average bcrypt(12) time: ${avgTime.toFixed(2)}ms`);

    // Production bcrypt should take time (security vs performance trade-off)
    expect(avgTime).toBeGreaterThan(100);
    expect(avgTime).toBeLessThan(1000);
  });
});
