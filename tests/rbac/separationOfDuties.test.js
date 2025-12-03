// ✅ DHA SEPARATION OF DUTIES TESTS
// Tests for conflict of interest and workflow separation

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Application = require('../../src/models/Application');
const { connectDB, disconnectDB, clearDatabase } = require('../helpers/db');

describe('Separation of Duties', () => {
  let vendorUser, certificationOfficer, committeeUser, testingLabUser, adminUser;
  let vendorToken, officerToken, committeeToken, labToken, adminToken;
  let testApplication;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create users with different roles
    vendorUser = await User.create({
      type: 'organization',
      organizationName: 'Test Vendor',
      organizationEmail: 'vendor@test.com',
      organizationPhone: '+254712345678',
      yearOfEstablishment: 2020,
      password: await bcrypt.hash('VendorPass123!', 12),
      role: 'vendor_developer',
      organizationId: new mongoose.Types.ObjectId()
    });

    certificationOfficer = await User.create({
      type: 'individual',
      username: 'officer',
      firstName: 'Cert',
      lastName: 'Officer',
      email: 'officer@dha.gov.ke',
      phone: '+254712345679',
      password: await bcrypt.hash('OfficerPass123!', 12),
      role: 'dha_certification_officer'
    });

    committeeUser = await User.create({
      type: 'individual',
      username: 'committee',
      firstName: 'Committee',
      lastName: 'Member',
      email: 'committee@dha.gov.ke',
      phone: '+254712345680',
      password: await bcrypt.hash('CommitteePass123!', 12),
      role: 'certification_committee_member'
    });

    testingLabUser = await User.create({
      type: 'individual',
      username: 'lab',
      firstName: 'Lab',
      lastName: 'Staff',
      email: 'lab@testlab.com',
      phone: '+254712345681',
      password: await bcrypt.hash('LabPass123!', 12),
      role: 'testing_lab_staff',
      labId: new mongoose.Types.ObjectId()
    });

    adminUser = await User.create({
      type: 'individual',
      username: 'admin',
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@dha.gov.ke',
      phone: '+254712345682',
      password: await bcrypt.hash('AdminPass123!', 12),
      role: 'dha_system_administrator'
    });

    // Get auth tokens
    vendorToken = generateToken(vendorUser._id, false);
    officerToken = generateToken(certificationOfficer._id, false);
    committeeToken = generateToken(committeeUser._id, false);
    labToken = generateToken(testingLabUser._id, false);
    adminToken = generateToken(adminUser._id, false);

    // Create test application
    testApplication = await Application.create({
      organizationId: vendorUser.organizationId,
      createdBy: vendorUser._id,
      title: 'Test Health System',
      status: 'submitted',
      teamMembers: [{
        userId: vendorUser._id,
        role: 'developer',
        joinedAt: new Date()
      }]
    });
  });

  describe('Self-Approval Prevention', () => {
    it('should prevent vendor from approving own application', async () => {
      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-001');
      expect(res.body.details.violation).toBe('self_approval');
    });

    it('should prevent user from approving application from same organization', async () => {
      // Create another vendor from same organization
      const vendorColleague = await User.create({
        type: 'organization',
        organizationName: 'Test Vendor',
        organizationEmail: 'vendor2@test.com',
        organizationPhone: '+254712345683',
        yearOfEstablishment: 2020,
        password: await bcrypt.hash('VendorPass123!', 12),
        role: 'vendor_developer',
        organizationId: vendorUser.organizationId // Same organization
      });

      const colleagueToken = generateToken(vendorColleague._id, false);

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${colleagueToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-001');
      expect(res.body.details.violation).toBe('organization_conflict');
    });

    it('should allow certification officer to approve application from different organization', async () => {
      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send();

      // Should pass SOD check (may fail for other reasons like missing tests)
      expect(res.status).not.toBe(403);
      expect(res.body.code).not.toBe('SOD-001');
    });
  });

  describe('Conflict of Interest', () => {
    it('should require conflict of interest declaration before voting', async () => {
      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/vote`)
        .set('Authorization', `Bearer ${committeeToken}`)
        .send({ vote: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-002');
      expect(res.body.details.requiresDeclaration).toBe(true);
    });

    it('should prevent voting if conflict declared', async () => {
      // Declare conflict of interest
      await ConflictOfInterest.create({
        userId: committeeUser._id,
        applicationId: testApplication._id,
        hasConflict: true,
        conflictType: 'financial_interest',
        details: 'Former employee',
        status: 'active'
      });

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/vote`)
        .set('Authorization', `Bearer ${committeeToken}`)
        .send({ vote: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-002');
      expect(res.body.details.mustAbstain).toBe(true);
    });

    it('should allow voting if no conflict declared', async () => {
      // Declare no conflict
      await ConflictOfInterest.create({
        userId: committeeUser._id,
        applicationId: testApplication._id,
        hasConflict: false,
        details: 'No conflicts',
        status: 'active'
      });

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/vote`)
        .set('Authorization', `Bearer ${committeeToken}`)
        .send({ vote: 'approve' });

      // Should pass COI check (may fail for other reasons)
      expect(res.status).not.toBe(403);
      expect(res.body.code).not.toBe('SOD-002');
    });
  });

  describe('Testing Lab Assignment', () => {
    it('should prevent testing lab from accessing unassigned tests', async () => {
      const unassignedTest = await Test.create({
        applicationId: testApplication._id,
        testType: 'api_compliance',
        status: 'pending',
        assignedTo: new mongoose.Types.ObjectId() // Different user
      });

      const res = await request(app)
        .get(`/api/tests/${unassignedTest._id}`)
        .set('Authorization', `Bearer ${labToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-003');
      expect(res.body.details.violation).toBe('unassigned_access');
    });

    it('should allow testing lab to access assigned tests', async () => {
      const assignedTest = await Test.create({
        applicationId: testApplication._id,
        testType: 'api_compliance',
        status: 'pending',
        assignedTo: testingLabUser._id
      });

      const res = await request(app)
        .get(`/api/tests/${assignedTest._id}`)
        .set('Authorization', `Bearer ${labToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Workflow Separation', () => {
    it('should prevent user from both submitting and approving', async () => {
      // Update application to show vendor also tried to review
      testApplication.reviewedBy = vendorUser._id;
      await testApplication.save();

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-004');
      expect(res.body.details.violation).toBe('workflow_conflict');
    });

    it('should prevent same user from reviewing and approving', async () => {
      testApplication.reviewedBy = certificationOfficer._id;
      await testApplication.save();

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-004');
      expect(res.body.details.previousStep).toBe('review');
      expect(res.body.details.attemptedStep).toBe('approval');
    });
  });

  describe('Vendor Review Prevention', () => {
    it('should prevent vendor from accessing review functions', async () => {
      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/review`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ comments: 'Review comments' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-005');
      expect(res.body.details.violation).toBe('vendor_review_restriction');
    });

    it('should prevent vendor from executing tests', async () => {
      const test = await Test.create({
        applicationId: testApplication._id,
        testType: 'api_compliance',
        status: 'pending'
      });

      const res = await request(app)
        .post(`/api/tests/${test._id}/execute`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-005');
    });
  });

  describe('Admin Approval Prevention', () => {
    it('should prevent system administrator from approving applications', async () => {
      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-006');
      expect(res.body.details.violation).toBe('admin_approval_restriction');
    });

    it('should allow system administrator to manage users', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'individual',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@test.com',
          phone: '+254712345690',
          password: 'NewUserPass123!',
          role: 'public_user'
        });

      expect(res.status).not.toBe(403);
    });
  });

  describe('Multiple Reviewers Requirement', () => {
    it('should prevent approval without minimum reviewers', async () => {
      // Only 1 review
      await Review.create({
        applicationId: testApplication._id,
        reviewerId: certificationOfficer._id,
        status: 'completed',
        recommendation: 'approve'
      });

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${committeeToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOD-007');
      expect(res.body.details.current).toBe(1);
      expect(res.body.details.required).toBe(2);
    });

    it('should allow approval with minimum reviewers', async () => {
      // Create 2 reviews
      const officer2 = await User.create({
        type: 'individual',
        username: 'officer2',
        firstName: 'Second',
        lastName: 'Officer',
        email: 'officer2@dha.gov.ke',
        phone: '+254712345691',
        password: await bcrypt.hash('OfficerPass123!', 12),
        role: 'dha_certification_officer'
      });

      await Review.create({
        applicationId: testApplication._id,
        reviewerId: certificationOfficer._id,
        status: 'completed',
        recommendation: 'approve'
      });

      await Review.create({
        applicationId: testApplication._id,
        reviewerId: officer2._id,
        status: 'completed',
        recommendation: 'approve'
      });

      const res = await request(app)
        .post(`/api/applications/${testApplication._id}/approve`)
        .set('Authorization', `Bearer ${committeeToken}`)
        .send();

      // Should pass SOD check (may fail for other reasons)
      expect(res.status).not.toBe(403);
      expect(res.body.code).not.toBe('SOD-007');
    });
  });
});
