// DHA SECURITY ADMIN TESTS
// Tests for Security Access Module endpoints

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const SecurityEvent = require('../../src/models/securityEvent');
const ActivityLog = require('../../src/models/ActivityLog');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/sendEmail');

describe('Security Admin API', () => {
  let adminToken;
  let adminUser;
  let testUser;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    const hashedPassword = await bcrypt.hash('AdminPass123!', 10);

    adminUser = await User.create({
      type: 'individual',
      email: 'admin@dha.go.ke',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      password: hashedPassword,
      role: 'dha_system_administrator',
      accountStatus: 'active',
      emailVerified: true
    });

    testUser = await User.create({
      type: 'individual',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      password: hashedPassword,
      role: 'public_user',
      accountStatus: 'active',
      emailVerified: true,
      twoFactorEnabled: true
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin@dha.go.ke',
        password: 'AdminPass123!'
      });

    adminToken = loginRes.body.token;
  });

  describe('GET /api/admin/security/stats - Security Statistics', () => {
    it('should return comprehensive security statistics', async () => {
      // Create security events
      await SecurityEvent.create({
        action: 'Failed Login',
        targetEmail: 'test@example.com',
        ip: '192.168.1.1',
        createdAt: new Date()
      });

      await SecurityEvent.create({
        action: 'IP Blocked',
        ip: '192.168.1.100',
        metadata: { blocked: true }
      });

      const res = await request(app)
        .get('/api/admin/security/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.failedLogins24h).toBeGreaterThanOrEqual(1);
      expect(res.body.data.activeSessions).toBeDefined();
      expect(res.body.data.blockedIPsCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.twoFactorCompliance).toBe(50); // 1 out of 2 users
      expect(res.body.data.totalUsers).toBe(2);
      expect(res.body.data.accountLockouts).toBe(0);
      expect(res.body.data.suspiciousActivities).toBeDefined();
    });

    it('should calculate 2FA compliance correctly', async () => {
      // Add more users without 2FA
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      await User.create({
        type: 'individual',
        email: 'user2@example.com',
        password: hashedPassword,
        role: 'public_user',
        accountStatus: 'active',
        twoFactorEnabled: false
      });

      await User.create({
        type: 'individual',
        email: 'user3@example.com',
        password: hashedPassword,
        role: 'public_user',
        accountStatus: 'active',
        twoFactorEnabled: false
      });

      const res = await request(app)
        .get('/api/admin/security/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalUsers).toBe(4);
      expect(res.body.data.usersWithTwoFactor).toBe(1);
      expect(res.body.data.twoFactorCompliance).toBe(25); // 1 out of 4
    });
  });

  describe('GET /api/admin/security/failed-logins - Failed Logins', () => {
    beforeEach(async () => {
      // Create multiple failed login attempts
      for (let i = 0; i < 25; i++) {
        await SecurityEvent.create({
          user: i % 2 === 0 ? testUser._id : null,
          action: 'Failed Login',
          targetEmail: `test${i}@example.com`,
          ip: `192.168.1.${i}`,
          device: 'Chrome',
          createdAt: new Date(Date.now() - i * 60000) // Spread over time
        });
      }
    });

    it('should return paginated failed logins', async () => {
      const res = await request(app)
        .get('/api/admin/security/failed-logins?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(10);
      expect(res.body.total).toBe(25);
      expect(res.body.pages).toBe(3);
      expect(res.body.page).toBe(1);
    });

    it('should search failed logins by email', async () => {
      const res = await request(app)
        .get('/api/admin/security/failed-logins?search=test5@example.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].email).toContain('test5');
    });

    it('should search failed logins by IP', async () => {
      const res = await request(app)
        .get('/api/admin/security/failed-logins?search=192.168.1.10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].ipAddress).toContain('192.168.1.10');
    });
  });

  describe('GET /api/admin/security/sessions - Active Sessions', () => {
    it('should return all active sessions', async () => {
      // Add sessions to users
      testUser.sessions = [
        {
          sessionId: 'session-1',
          ip: '192.168.1.50',
          device: 'Chrome on Windows',
          location: 'Nairobi',
          createdAt: new Date()
        }
      ];
      await testUser.save();

      adminUser.sessions = [
        {
          sessionId: 'session-2',
          ip: '192.168.1.51',
          device: 'Firefox on MacOS',
          location: 'Mombasa',
          createdAt: new Date()
        }
      ];
      await adminUser.save();

      const res = await request(app)
        .get('/api/admin/security/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3); // 2 manually added + 1 from admin login
      expect(res.body.total).toBe(3);
    });

    it('should search sessions by user email', async () => {
      testUser.sessions = [{
        sessionId: 'test-session',
        ip: '192.168.1.1',
        device: 'Chrome',
        createdAt: new Date()
      }];
      await testUser.save();

      const res = await request(app)
        .get('/api/admin/security/sessions?search=test@example.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const session = res.body.data.find(s => s.email === 'test@example.com');
      expect(session).toBeDefined();
    });

    it('should determine session status based on age', async () => {
      const now = new Date();
      testUser.sessions = [
        {
          sessionId: 'active-session',
          ip: '192.168.1.1',
          device: 'Chrome',
          createdAt: new Date(now - 10 * 60 * 1000) // 10 minutes ago
        },
        {
          sessionId: 'idle-session',
          ip: '192.168.1.2',
          device: 'Firefox',
          createdAt: new Date(now - 45 * 60 * 1000) // 45 minutes ago
        }
      ];
      await testUser.save();

      const res = await request(app)
        .get('/api/admin/security/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      const activeSession = res.body.data.find(s => s.id === 'active-session');
      const idleSession = res.body.data.find(s => s.id === 'idle-session');

      expect(activeSession.status).toBe('active');
      expect(idleSession.status).toBe('idle');
    });
  });

  describe('DELETE /api/admin/security/sessions/:sessionId - Terminate Session', () => {
    it('should terminate a user session', async () => {
      testUser.sessions = [{
        sessionId: 'session-to-terminate',
        ip: '192.168.1.1',
        device: 'Chrome',
        createdAt: new Date()
      }];
      await testUser.save();

      const res = await request(app)
        .delete('/api/admin/security/sessions/session-to-terminate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify session was removed
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.sessions.length).toBe(0);

      // Verify security event was created
      const securityEvent = await SecurityEvent.findOne({
        action: 'session_terminated_by_admin'
      });
      expect(securityEvent).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const res = await request(app)
        .delete('/api/admin/security/sessions/fake-session-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/security/blocked-ips - Blocked IPs', () => {
    it('should return all blocked IPs', async () => {
      await SecurityEvent.create([
        {
          action: 'ip_blocked',
          ip: '192.168.1.100',
          metadata: {
            ipAddress: '192.168.1.100',
            reason: 'Brute force attack',
            blocked: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          timestamp: new Date()
        },
        {
          action: 'ip_blocked',
          ip: '192.168.1.101',
          metadata: {
            ipAddress: '192.168.1.101',
            reason: 'Multiple failed attempts',
            blocked: true
          },
          timestamp: new Date()
        }
      ]);

      const res = await request(app)
        .get('/api/admin/security/blocked-ips')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(2);

      const blockedIP = res.body.data[0];
      expect(blockedIP.ipAddress).toBeDefined();
      expect(blockedIP.reason).toBeDefined();
      expect(blockedIP.blockedAt).toBeDefined();
    });

    it('should differentiate between permanent and temporary blocks', async () => {
      await SecurityEvent.create([
        {
          action: 'ip_blocked',
          ip: '192.168.1.100',
          metadata: {
            ipAddress: '192.168.1.100',
            blocked: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          timestamp: new Date()
        },
        {
          action: 'ip_blocked',
          ip: '192.168.1.101',
          metadata: {
            ipAddress: '192.168.1.101',
            blocked: true
          },
          timestamp: new Date()
        }
      ]);

      const res = await request(app)
        .get('/api/admin/security/blocked-ips')
        .set('Authorization', `Bearer ${adminToken}`);

      const temporaryBlock = res.body.data.find(ip => ip.ipAddress === '192.168.1.100');
      const permanentBlock = res.body.data.find(ip => ip.ipAddress === '192.168.1.101');

      expect(temporaryBlock.permanent).toBe(false);
      expect(temporaryBlock.expiresAt).toBeDefined();
      expect(permanentBlock.permanent).toBe(true);
    });
  });

  describe('DELETE /api/admin/security/blocked-ips/:ipAddress - Unblock IP', () => {
    it('should unblock an IP address', async () => {
      await SecurityEvent.create({
        action: 'ip_blocked',
        ip: '192.168.1.100',
        metadata: {
          ipAddress: '192.168.1.100',
          blocked: true
        }
      });

      const res = await request(app)
        .delete('/api/admin/security/blocked-ips/192.168.1.100')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('192.168.1.100');

      // Verify unblock event was created
      const unblockEvent = await SecurityEvent.findOne({
        action: 'ip_unblocked'
      });
      expect(unblockEvent).toBeDefined();
      expect(unblockEvent.metadata.unblockedIP).toBe('192.168.1.100');
    });
  });

  describe('Whitelisted IPs Management', () => {
    describe('GET /api/admin/security/whitelisted-ips', () => {
      it('should return all whitelisted IPs', async () => {
        await SecurityEvent.create([
          {
            action: 'ip_whitelisted',
            ip: '10.0.0.1',
            adminId: adminUser._id,
            metadata: {
              ipAddress: '10.0.0.1',
              description: 'DHA Office',
              whitelisted: true
            },
            timestamp: new Date()
          },
          {
            action: 'ip_whitelisted',
            ip: '10.0.0.2',
            adminId: adminUser._id,
            metadata: {
              ipAddress: '10.0.0.2',
              description: 'Testing Lab',
              whitelisted: true
            },
            timestamp: new Date()
          }
        ]);

        const res = await request(app)
          .get('/api/admin/security/whitelisted-ips')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(2);
        expect(res.body.data[0].ipAddress).toBeDefined();
        expect(res.body.data[0].description).toBeDefined();
      });
    });

    describe('POST /api/admin/security/whitelisted-ips', () => {
      it('should add IP to whitelist', async () => {
        const res = await request(app)
          .post('/api/admin/security/whitelisted-ips')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ipAddress: '10.0.0.1',
            description: 'DHA Main Office'
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.ipAddress).toBe('10.0.0.1');
        expect(res.body.data.description).toBe('DHA Main Office');

        // Verify event was created
        const event = await SecurityEvent.findOne({
          action: 'ip_whitelisted',
          'metadata.ipAddress': '10.0.0.1'
        });
        expect(event).toBeDefined();
      });

      it('should fail without IP address', async () => {
        const res = await request(app)
          .post('/api/admin/security/whitelisted-ips')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            description: 'Test'
          });

        expect(res.status).toBe(400);
      });

      it('should prevent duplicate whitelisting', async () => {
        await SecurityEvent.create({
          action: 'ip_whitelisted',
          ip: '10.0.0.1',
          adminId: adminUser._id,
          metadata: {
            ipAddress: '10.0.0.1',
            whitelisted: true
          }
        });

        const res = await request(app)
          .post('/api/admin/security/whitelisted-ips')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ipAddress: '10.0.0.1',
            description: 'Duplicate'
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('already whitelisted');
      });
    });

    describe('DELETE /api/admin/security/whitelisted-ips/:id', () => {
      it('should remove IP from whitelist', async () => {
        const whitelistEvent = await SecurityEvent.create({
          action: 'ip_whitelisted',
          ip: '10.0.0.1',
          adminId: adminUser._id,
          metadata: {
            ipAddress: '10.0.0.1',
            whitelisted: true
          }
        });

        const res = await request(app)
          .delete(`/api/admin/security/whitelisted-ips/${whitelistEvent._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify removal event was created
        const removalEvent = await SecurityEvent.findOne({
          action: 'ip_whitelist_removed'
        });
        expect(removalEvent).toBeDefined();
      });
    });
  });

  describe('GET /api/admin/security/suspicious-activities - Suspicious Activities', () => {
    beforeEach(async () => {
      await SecurityEvent.create([
        {
          action: 'Suspicious Activity Detected',
          user: testUser._id,
          ip: '192.168.1.1',
          device: 'Chrome',
          createdAt: new Date()
        },
        {
          action: 'Multiple Failed Attempts',
          targetEmail: 'hacker@bad.com',
          ip: '192.168.1.100',
          device: 'Unknown',
          createdAt: new Date()
        },
        {
          action: 'IP Blocked',
          ip: '192.168.1.101',
          device: 'Unknown',
          createdAt: new Date()
        }
      ]);
    });

    it('should return all suspicious activities', async () => {
      const res = await request(app)
        .get('/api/admin/security/suspicious-activities')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total).toBe(3);
      expect(res.body.stats.recent24h).toBe(3);
    });

    it('should assign severity levels to activities', async () => {
      const res = await request(app)
        .get('/api/admin/security/suspicious-activities')
        .set('Authorization', `Bearer ${adminToken}`);

      const ipBlockedEvent = res.body.data.find(e => e.action === 'IP Blocked');
      const suspiciousEvent = res.body.data.find(e => e.action === 'Suspicious Activity Detected');

      expect(ipBlockedEvent.severity).toBe('critical');
      expect(suspiciousEvent.severity).toBe('high');
    });

    it('should support pagination', async () => {
      // Create more events
      for (let i = 0; i < 30; i++) {
        await SecurityEvent.create({
          action: 'Suspicious Activity Detected',
          ip: `192.168.1.${i}`,
          device: 'Chrome'
        });
      }

      const res = await request(app)
        .get('/api/admin/security/suspicious-activities?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(10);
      expect(res.body.pagination.pages).toBeGreaterThan(1);
    });
  });

  describe('GET /api/admin/security/audit-logs - Audit Logs', () => {
    beforeEach(async () => {
      await ActivityLog.create([
        {
          user: adminUser._id,
          action: 'ADMIN_UPDATE_USER_ROLE',
          description: 'Updated user role',
          ip: '192.168.1.1',
          createdAt: new Date()
        },
        {
          user: testUser._id,
          action: 'LOGIN',
          description: 'User logged in',
          ip: '192.168.1.2',
          createdAt: new Date()
        },
        {
          user: testUser._id,
          action: 'PROFILE_UPDATE',
          description: 'Updated profile',
          ip: '192.168.1.2',
          createdAt: new Date()
        }
      ]);
    });

    it('should return paginated audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/security/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
    });

    it('should filter by action type', async () => {
      const res = await request(app)
        .get('/api/admin/security/audit-logs?action=LOGIN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].action).toBe('LOGIN');
    });

    it('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const res = await request(app)
        .get(`/api/admin/security/audit-logs?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });

    it('should assign severity to audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/security/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      const roleUpdate = res.body.data.find(l => l.action === 'ADMIN_UPDATE_USER_ROLE');
      const login = res.body.data.find(l => l.action === 'LOGIN');

      expect(roleUpdate.severity).toBe('high');
      expect(login.severity).toBe('low');
    });
  });

  describe('GET /api/admin/security/audit-logs/:id - Audit Log Details', () => {
    it('should return detailed audit log information', async () => {
      const auditLog = await ActivityLog.create({
        user: adminUser._id,
        action: 'ADMIN_UPDATE_USER_ROLE',
        description: 'Updated user role from public_user to vendor_developer',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: {
          targetUserId: testUser._id,
          previousRole: 'public_user',
          newRole: 'vendor_developer'
        }
      });

      const res = await request(app)
        .get(`/api/admin/security/audit-logs/${auditLog._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(auditLog._id.toString());
      expect(res.body.data.action).toBe('ADMIN_UPDATE_USER_ROLE');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@dha.go.ke');
      expect(res.body.data.details).toBeDefined();
      expect(res.body.data.severity).toBe('high');
    });

    it('should return 404 for non-existent audit log', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/security/audit-logs/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/security/export - Export Security Logs', () => {
    it('should export security logs as CSV', async () => {
      await SecurityEvent.create([
        {
          user: testUser._id,
          action: 'Failed Login',
          ip: '192.168.1.1',
          device: 'Chrome',
          reason: 'Invalid password'
        },
        {
          action: 'ip_blocked',
          ip: '192.168.1.100',
          device: 'Unknown',
          reason: 'Brute force'
        }
      ]);

      const res = await request(app)
        .get('/api/admin/security/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('Timestamp');
      expect(res.text).toContain('Action');
    });

    it('should filter export by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await SecurityEvent.create({
        action: 'Failed Login',
        ip: '192.168.1.1',
        timestamp: new Date()
      });

      const res = await request(app)
        .get(`/api/admin/security/export?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    });
  });
});
