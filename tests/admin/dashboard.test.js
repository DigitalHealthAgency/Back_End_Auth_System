// DHA ADMIN DASHBOARD TESTS
// Comprehensive tests for System Administrator Dashboard functionality

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const SecurityEvent = require('../../src/models/securityEvent');
const ActivityLog = require('../../src/models/ActivityLog');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const bcrypt = require('bcryptjs');

// Mock email service
jest.mock('../../src/utils/sendEmail');
const mockSendEmail = require('../../src/utils/sendEmail');
mockSendEmail.mockResolvedValue({ success: true });

describe('Admin Dashboard API', () => {
  let adminToken;
  let adminUser;
  let regularUser;
  let vendorUser;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create admin user
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
      emailVerified: true,
      twoFactorEnabled: false
    });

    // Create regular user
    regularUser = await User.create({
      type: 'individual',
      email: 'user@example.com',
      username: 'regularuser',
      firstName: 'Regular',
      lastName: 'User',
      password: hashedPassword,
      role: 'public_user',
      accountStatus: 'active',
      emailVerified: true,
      twoFactorEnabled: false
    });

    // Create vendor user
    vendorUser = await User.create({
      type: 'individual',
      email: 'vendor@example.com',
      username: 'vendor',
      firstName: 'Vendor',
      lastName: 'User',
      password: hashedPassword,
      role: 'vendor_developer',
      accountStatus: 'active',
      emailVerified: true,
      twoFactorEnabled: true
    });

    // Login as admin to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin@dha.go.ke',
        password: 'AdminPass123!'
      });

    adminToken = loginRes.body.token;
  });

  describe('GET /api/admin/dashboard/metrics - Dashboard Metrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      // Create some security events
      await SecurityEvent.create({
        action: 'Failed Login',
        targetEmail: 'test@example.com',
        ip: '192.168.1.1',
        device: 'Chrome',
        createdAt: new Date()
      });

      await SecurityEvent.create({
        action: 'Suspicious Activity Detected',
        targetEmail: 'test@example.com',
        ip: '192.168.1.1',
        device: 'Chrome',
        createdAt: new Date()
      });

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalUsers).toBe(3);
      expect(res.body.data.activeSessions).toBeDefined();
      expect(res.body.data.securityAlerts).toBeGreaterThanOrEqual(1);
      expect(res.body.data.failedLogins24h).toBeGreaterThanOrEqual(1);
      expect(res.body.data.userStats).toBeDefined();
      expect(res.body.data.userStats.total).toBe(3);
      expect(res.body.data.userStats.active).toBe(3);
      expect(res.body.data.roleDistribution).toBeDefined();
      expect(Array.isArray(res.body.data.roleDistribution)).toBe(true);
    });

    it('should return 2FA compliance percentage', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.twoFactorCompliance).toBeDefined();
      expect(typeof res.body.data.twoFactorCompliance).toBe('number');
      expect(res.body.data.usersWithTwoFactor).toBe(1); // Only vendor user has 2FA
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/metrics');

      expect(res.status).toBe(401);
    });

    it('should fail with non-admin user', async () => {
      // Login as regular user
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'user@example.com',
          password: 'AdminPass123!'
        });

      const userToken = loginRes.body.token;

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/dashboard/failed-logins/:id - Failed Login Details', () => {
    it('should return detailed failed login information', async () => {
      const failedLogin = await SecurityEvent.create({
        action: 'Failed Login',
        targetEmail: 'test@example.com',
        ip: '192.168.1.1',
        device: 'Chrome on Windows',
        userAgent: 'Mozilla/5.0',
        reason: 'Invalid password',
        details: { attemptCount: 1 }
      });

      const res = await request(app)
        .get(`/api/admin/dashboard/failed-logins/${failedLogin._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(failedLogin._id.toString());
      expect(res.body.data.targetEmail).toBe('test@example.com');
      expect(res.body.data.ipAddress).toBe('192.168.1.1');
      expect(res.body.data.device).toBe('Chrome on Windows');
      expect(res.body.data.reason).toBe('Invalid password');
    });

    it('should return 404 for non-existent failed login', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/dashboard/failed-logins/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/dashboard/sessions/:sessionId - Session Details', () => {
    it('should return detailed session information', async () => {
      // Add a session to vendor user
      vendorUser.sessions = [{
        sessionId: 'test-session-123',
        ip: '192.168.1.10',
        device: 'Chrome on MacOS',
        userAgent: 'Mozilla/5.0',
        location: 'Nairobi, Kenya',
        createdAt: new Date()
      }];
      await vendorUser.save();

      const res = await request(app)
        .get('/api/admin/dashboard/sessions/test-session-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe('test-session-123');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('vendor@example.com');
      expect(res.body.data.ipAddress).toBe('192.168.1.10');
      expect(res.body.data.device).toBe('Chrome on MacOS');
    });

    it('should return 404 for non-existent session', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/sessions/fake-session-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/dashboard/blocked-ips/:id - Blocked IP Details', () => {
    it('should return detailed blocked IP information', async () => {
      const blockedEvent = await SecurityEvent.create({
        action: 'ip_blocked',
        ip: '192.168.1.100',
        metadata: {
          ipAddress: '192.168.1.100',
          reason: 'Brute force attack detected',
          blocked: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        timestamp: new Date()
      });

      const res = await request(app)
        .get(`/api/admin/dashboard/blocked-ips/${blockedEvent._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.ipAddress).toBe('192.168.1.100');
      expect(res.body.data.reason).toBe('Brute force attack detected');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.relatedEvents).toBeDefined();
    });
  });

  describe('GET /api/admin/dashboard/users/:userId/activity - User Activity', () => {
    it('should return user activity history', async () => {
      // Create some activity logs
      await ActivityLog.create({
        user: vendorUser._id,
        action: 'LOGIN',
        description: 'User logged in',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      await ActivityLog.create({
        user: vendorUser._id,
        action: 'PROFILE_UPDATE',
        description: 'User updated profile',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      const res = await request(app)
        .get(`/api/admin/dashboard/users/${vendorUser._id}/activity`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('vendor@example.com');
      expect(res.body.data.activities).toBeDefined();
      expect(Array.isArray(res.body.data.activities)).toBe(true);
      expect(res.body.data.activities.length).toBe(2);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      // Create 60 activity logs
      for (let i = 0; i < 60; i++) {
        await ActivityLog.create({
          user: vendorUser._id,
          action: 'LOGIN',
          description: `Activity ${i}`,
          ip: '192.168.1.1'
        });
      }

      const res = await request(app)
        .get(`/api/admin/dashboard/users/${vendorUser._id}/activity?page=2&limit=20`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.activities.length).toBe(20);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.total).toBe(60);
      expect(res.body.data.pagination.pages).toBe(3);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/dashboard/users/${fakeId}/activity`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/dashboard/permissions/matrix - Permission Matrix', () => {
    it('should return complete permission matrix', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/permissions/matrix')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.roles).toBeDefined();
      expect(Array.isArray(res.body.data.roles)).toBe(true);
      expect(res.body.data.allPermissions).toBeDefined();
      expect(Array.isArray(res.body.data.allPermissions)).toBe(true);
      expect(res.body.data.permissionCategories).toBeDefined();

      // Check that roles have proper structure
      const firstRole = res.body.data.roles[0];
      expect(firstRole.role).toBeDefined();
      expect(firstRole.displayName).toBeDefined();
      expect(firstRole.permissions).toBeDefined();
      expect(firstRole.permissionCount).toBeDefined();
    });
  });

  describe('GET /api/admin/dashboard/permissions/roles/:role - Role Details', () => {
    it('should return role details with permissions', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/permissions/roles/dha_system_administrator')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.role).toBe('dha_system_administrator');
      expect(res.body.data.displayName).toBe('DHA System Administrator');
      expect(res.body.data.permissions).toBeDefined();
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      expect(res.body.data.permissionCount).toBeGreaterThan(0);
      expect(res.body.data.userCount).toBe(1); // Only admin user
      expect(res.body.data.description).toBeDefined();
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/permissions/roles/fake_role')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/dashboard/users/:userId/assign-role - Assign Role with Confirmation', () => {
    it('should assign role with reason and create audit log', async () => {
      const res = await request(app)
        .post(`/api/admin/dashboard/users/${regularUser._id}/assign-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'vendor_developer',
          reason: 'User approved for vendor access'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Role assigned successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.previousRole).toBe('public_user');
      expect(res.body.data.newRole).toBe('vendor_developer');
      expect(res.body.data.reason).toBe('User approved for vendor access');

      // Verify user was updated
      const updatedUser = await User.findById(regularUser._id);
      expect(updatedUser.role).toBe('vendor_developer');

      // Verify audit log was created
      const auditLog = await ActivityLog.findOne({
        action: 'ADMIN_UPDATE_USER_ROLE',
        'details.targetUserId': regularUser._id.toString()
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.description).toContain('User approved for vendor access');
    });

    it('should fail without reason', async () => {
      const res = await request(app)
        .post(`/api/admin/dashboard/users/${regularUser._id}/assign-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'vendor_developer'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Reason for role change is required');
    });

    it('should fail with empty reason', async () => {
      const res = await request(app)
        .post(`/api/admin/dashboard/users/${regularUser._id}/assign-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'vendor_developer',
          reason: '   '
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Reason for role change is required');
    });

    it('should fail with invalid role', async () => {
      const res = await request(app)
        .post(`/api/admin/dashboard/users/${regularUser._id}/assign-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'invalid_role',
          reason: 'Test reason'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid role');
    });

    it('should fail for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/admin/dashboard/users/${fakeId}/assign-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'vendor_developer',
          reason: 'Test reason'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('Role Distribution in Dashboard Metrics', () => {
    it('should accurately count users per role', async () => {
      // Create additional users with different roles
      const hashedPassword = await bcrypt.hash('Test123!', 10);

      await User.create({
        type: 'individual',
        email: 'cert@dha.go.ke',
        username: 'certuser',
        firstName: 'Cert',
        lastName: 'User',
        password: hashedPassword,
        role: 'dha_certification_officer',
        accountStatus: 'active',
        emailVerified: true
      });

      await User.create({
        type: 'individual',
        email: 'public@example.com',
        username: 'public',
        firstName: 'Public',
        lastName: 'User',
        password: hashedPassword,
        role: 'public_user',
        accountStatus: 'active',
        emailVerified: true
      });

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const roleDistribution = res.body.data.roleDistribution;

      // Find specific role counts
      const publicUsers = roleDistribution.find(r => r.role === 'public_user');
      const adminUsers = roleDistribution.find(r => r.role === 'dha_system_administrator');
      const vendorUsers = roleDistribution.find(r => r.role === 'vendor_developer');
      const certUsers = roleDistribution.find(r => r.role === 'dha_certification_officer');

      expect(publicUsers.count).toBe(2); // regularUser + new public user
      expect(adminUsers.count).toBe(1);
      expect(vendorUsers.count).toBe(1);
      expect(certUsers.count).toBe(1);
    });
  });

  describe('Security Events in Dashboard', () => {
    it('should include recent security events', async () => {
      // Create various security events
      await SecurityEvent.create([
        {
          user: vendorUser._id,
          action: 'Failed Login',
          ip: '192.168.1.1',
          device: 'Chrome',
          createdAt: new Date()
        },
        {
          user: regularUser._id,
          action: 'Suspicious Activity Detected',
          ip: '192.168.1.2',
          device: 'Firefox',
          createdAt: new Date()
        },
        {
          action: 'IP Blocked',
          targetEmail: 'hacker@bad.com',
          ip: '192.168.1.100',
          device: 'Unknown',
          createdAt: new Date()
        }
      ]);

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recentSecurityEvents).toBeDefined();
      expect(Array.isArray(res.body.data.recentSecurityEvents)).toBe(true);
      expect(res.body.data.recentSecurityEvents.length).toBeGreaterThan(0);

      const events = res.body.data.recentSecurityEvents;
      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('action');
      expect(events[0]).toHaveProperty('user');
      expect(events[0]).toHaveProperty('ip');
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0]).toHaveProperty('severity');
    });

    it('should classify security event severity correctly', async () => {
      await SecurityEvent.create([
        {
          action: 'IP Blocked',
          ip: '192.168.1.100',
          device: 'Unknown'
        },
        {
          action: 'Multiple Failed Attempts',
          ip: '192.168.1.101',
          device: 'Chrome'
        },
        {
          action: 'Failed Login',
          ip: '192.168.1.102',
          device: 'Firefox'
        }
      ]);

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      const events = res.body.data.recentSecurityEvents;
      const blockedEvent = events.find(e => e.action === 'IP Blocked');
      const multipleFailedEvent = events.find(e => e.action === 'Multiple Failed Attempts');
      const failedLoginEvent = events.find(e => e.action === 'Failed Login');

      expect(blockedEvent.severity).toBe('critical');
      expect(multipleFailedEvent.severity).toBe('high');
      expect(failedLoginEvent.severity).toBe('medium');
    });
  });

  describe('Account Lockouts in Dashboard', () => {
    it('should count currently locked accounts', async () => {
      // Lock a user account
      const futureTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      regularUser.lockedUntil = futureTime;
      regularUser.failedLoginAttempts = 5;
      await regularUser.save();

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accountLockouts).toBe(1);
    });

    it('should not count expired lockouts', async () => {
      // Set lockout to past time
      const pastTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      regularUser.lockedUntil = pastTime;
      await regularUser.save();

      const res = await request(app)
        .get('/api/admin/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accountLockouts).toBe(0);
    });
  });
});
