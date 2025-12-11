// DHA ADMIN USERS MANAGEMENT TESTS
// Tests for User Management Module endpoints

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const ActivityLog = require('../../src/models/ActivityLog');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');
const bcrypt = require('bcryptjs');

// Mock email service
jest.mock('../../src/utils/sendEmail');
const mockSendEmail = require('../../src/utils/sendEmail');

describe('Admin Users Management API', () => {
  let adminToken;
  let adminUser;
  let testUser1;
  let testUser2;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue({ success: true });

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

    testUser1 = await User.create({
      type: 'individual',
      email: 'user1@example.com',
      username: 'user1',
      firstName: 'Test',
      lastName: 'User One',
      password: hashedPassword,
      role: 'public_user',
      accountStatus: 'active',
      emailVerified: true,
      twoFactorEnabled: false
    });

    testUser2 = await User.create({
      type: 'organization',
      email: 'org@example.com',
      organizationEmail: 'org@example.com',
      organizationName: 'Test Organization',
      organizationPhone: '+254700000000',
      organizationType: 'HOSPITAL',
      password: hashedPassword,
      role: 'vendor_developer',
      accountStatus: 'pending_verification',
      emailVerified: false,
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

  describe('GET /api/admin/users - Get All Users', () => {
    it('should return paginated list of all users', async () => {
      const res = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.users).toBeDefined();
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBe(3);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.activeUsers).toBe(2);
      expect(res.body.data.pendingUsers).toBe(1);
      expect(res.body.data.twoFactorUsers).toBe(1);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter users by role', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=vendor_developer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBe(1);
      expect(res.body.data.users[0].role).toBe('vendor_developer');
    });

    it('should filter users by status', async () => {
      const res = await request(app)
        .get('/api/admin/users?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBe(1);
      expect(res.body.data.users[0].status).toBe('pending');
    });

    it('should search users by email', async () => {
      const res = await request(app)
        .get('/api/admin/users?search=user1@example.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.users[0].email).toBe('user1@example.com');
    });

    it('should search users by name', async () => {
      const res = await request(app)
        .get('/api/admin/users?search=Test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      const testUser = res.body.data.users.find(u => u.firstName === 'Test');
      expect(testUser).toBeDefined();
    });

    it('should search users by organization name', async () => {
      const res = await request(app)
        .get('/api/admin/users?search=Test Organization')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.users[0].organizationName).toBe('Test Organization');
    });

    it('should return user stats', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.activeUsers).toBe(2);
      expect(res.body.data.pendingUsers).toBe(1);
      expect(res.body.data.twoFactorUsers).toBe(1);
    });

    it('should handle suspended users correctly', async () => {
      testUser1.suspended = true;
      await testUser1.save();

      const res = await request(app)
        .get('/api/admin/users?status=suspended')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBe(1);
      expect(res.body.data.users[0].status).toBe('suspended');
    });
  });

  describe('GET /api/admin/users/:id - Get User by ID', () => {
    it('should return user details', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${testUser1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('user1@example.com');
      expect(res.body.user.firstName).toBe('Test');
      expect(res.body.user.lastName).toBe('User One');
      expect(res.body.user.role).toBe('public_user');
      expect(res.body.user.password).toBeUndefined(); // Should not include password
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should not include sensitive fields', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${testUser1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.twoFactorSecret).toBeUndefined();
      expect(res.body.user.recoveryKeyHash).toBeUndefined();
    });
  });

  describe('POST /api/admin/users - Create User', () => {
    it('should create individual user and send welcome email', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'individual',
          email: 'newuser@example.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          phone: '+254712345678',
          role: 'vendor_developer'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('newuser@example.com');
      expect(res.body.user.role).toBe('vendor_developer');

      // Verify user was created in database
      const createdUser = await User.findOne({ email: 'newuser@example.com' });
      expect(createdUser).toBeDefined();
      expect(createdUser.accountStatus).toBe('active');
      expect(createdUser.emailVerified).toBe(true);
      expect(createdUser.requirePasswordChange).toBe(true);

      // Verify email was sent
      expect(mockSendEmail).toHaveBeenCalled();

      // Verify activity log was created
      const activityLog = await ActivityLog.findOne({
        action: 'USER_CREATED'
      });
      expect(activityLog).toBeDefined();
    });

    it('should create organization user', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'organization',
          email: 'neworg@example.com',
          organizationName: 'New Organization',
          organizationType: 'CLINIC',
          phone: '+254700000000',
          county: 'Nairobi',
          subCounty: 'Westlands',
          role: 'vendor_developer'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('neworg@example.com');

      const createdUser = await User.findOne({ email: 'neworg@example.com' });
      expect(createdUser).toBeDefined();
      expect(createdUser.type).toBe('organization');
      expect(createdUser.organizationName).toBe('New Organization');
    });

    it('should fail without required fields', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'individual',
          email: 'test@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should fail with duplicate email', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'individual',
          email: 'user1@example.com',
          username: 'differentuser',
          firstName: 'Test',
          lastName: 'User',
          role: 'public_user'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });

    it('should fail with duplicate username', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'individual',
          email: 'different@example.com',
          username: 'user1',
          firstName: 'Test',
          lastName: 'User',
          role: 'public_user'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('PATCH /api/admin/users/:id/status - Update User Status', () => {
    it('should suspend a user', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.suspended).toBe(true);

      // Verify user was updated
      const updatedUser = await User.findById(testUser1._id);
      expect(updatedUser.suspended).toBe(true);

      // Verify activity log
      const activityLog = await ActivityLog.findOne({
        action: 'USER_STATUS_UPDATED'
      });
      expect(activityLog).toBeDefined();
    });

    it('should activate a suspended user', async () => {
      testUser1.suspended = true;
      await testUser1.save();

      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.user.suspended).toBe(false);
      expect(res.body.user.accountStatus).toBe('active');
    });

    it('should set user to pending status', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'pending' });

      expect(res.status).toBe(200);
      expect(res.body.user.accountStatus).toBe('pending');
    });

    it('should fail with invalid status', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/admin/users/${fakeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/users/:id/role - Update User Role', () => {
    it('should update user role', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'vendor_developer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('vendor_developer');
      expect(res.body.user.previousRole).toBe('public_user');

      // Verify user was updated
      const updatedUser = await User.findById(testUser1._id);
      expect(updatedUser.role).toBe('vendor_developer');

      // Verify activity log
      const activityLog = await ActivityLog.findOne({
        action: 'USER_ROLE_UPDATED'
      });
      expect(activityLog).toBeDefined();
    });

    it('should fail with invalid role', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid role');
    });

    it('should fail without role', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUser1._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/users/:id - Delete User', () => {
    it('should delete user', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${testUser1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify user was deleted
      const deletedUser = await User.findById(testUser1._id);
      expect(deletedUser).toBeNull();

      // Verify activity log
      const activityLog = await ActivityLog.findOne({
        action: 'USER_DELETED'
      });
      expect(activityLog).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/users/export - Export Users', () => {
    it('should export users to CSV', async () => {
      const res = await request(app)
        .get('/api/admin/users/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('Email');
      expect(res.text).toContain('Name');
      expect(res.text).toContain('Role');
      expect(res.text).toContain('user1@example.com');
    });

    it('should filter export by role', async () => {
      const res = await request(app)
        .get('/api/admin/users/export?role=vendor_developer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('org@example.com');
      expect(res.text).not.toContain('user1@example.com');
    });

    it('should filter export by status', async () => {
      const res = await request(app)
        .get('/api/admin/users/export?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('org@example.com');
    });

    it('should create activity log for export', async () => {
      await request(app)
        .get('/api/admin/users/export')
        .set('Authorization', `Bearer ${adminToken}`);

      const activityLog = await ActivityLog.findOne({
        action: 'USERS_EXPORTED'
      });
      expect(activityLog).toBeDefined();
    });
  });

  describe('Authorization Tests', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/users');

      expect(res.status).toBe(401);
    });

    it('should fail with non-admin user', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'user1@example.com',
          password: 'AdminPass123!'
        });

      const userToken = loginRes.body.token;

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Edge Cases', () => {
    it('should handle pagination correctly', async () => {
      // Create 25 users
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      for (let i = 0; i < 25; i++) {
        await User.create({
          type: 'individual',
          email: `testuser${i}@example.com`,
          username: `testuser${i}`,
          firstName: 'Test',
          lastName: `User ${i}`,
          password: hashedPassword,
          role: 'public_user',
          accountStatus: 'active',
          emailVerified: true
        });
      }

      const res1 = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res1.body.pagination.page).toBe(1);
      expect(res1.body.pagination.pages).toBe(3);
      expect(res1.body.data.users.length).toBe(10);

      const res2 = await request(app)
        .get('/api/admin/users?page=3&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.body.pagination.page).toBe(3);
      expect(res2.body.data.users.length).toBe(8); // 28 total - 20 from first 2 pages = 8
    });

    it('should handle users without roles', async () => {
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      await User.create({
        type: 'individual',
        email: 'norole@example.com',
        username: 'norole',
        firstName: 'No',
        lastName: 'Role',
        password: hashedPassword,
        accountStatus: 'active',
        emailVerified: true
      });

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const userWithoutRole = res.body.data.users.find(u => u.email === 'norole@example.com');
      expect(userWithoutRole).toBeDefined();
    });
  });
});
