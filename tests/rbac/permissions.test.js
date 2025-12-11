//  DHA RBAC PERMISSION TESTS
// Tests for permission matrix and authorization logic

const { hasPermission, getRolePermissions, getResourceActions, isVendorRole, isDHARole, canApproveCertifications } = require('../../src/config/permissions');

describe('DHA RBAC Permission System', () => {
  describe('Role Permissions', () => {
    it('should return permissions for vendor_developer role', () => {
      const permissions = getRolePermissions('vendor_developer');

      expect(permissions).toBeDefined();
      expect(permissions.applications).toBeDefined();
      expect(permissions.applications.actions).toContain('create');
      expect(permissions.applications.actions).toContain('read');
      expect(permissions.applications.actions).toContain('update');
      expect(permissions.applications.scope).toBe('own');
    });

    it('should return permissions for dha_system_administrator role', () => {
      const permissions = getRolePermissions('dha_system_administrator');

      expect(permissions).toBeDefined();
      expect(permissions.users.actions).toContain('create');
      expect(permissions.users.actions).toContain('delete');
      expect(permissions.audit_logs).toBeDefined();
      expect(permissions.restrictions.cannot_approve).toBe(true);
    });

    it('should return permissions for testing_lab_staff role', () => {
      const permissions = getRolePermissions('testing_lab_staff');

      expect(permissions).toBeDefined();
      expect(permissions.tests.actions).toContain('execute');
      expect(permissions.applications.scope).toBe('assigned');
      expect(permissions.restrictions.cannot_approve).toBe(true);
    });

    it('should return null for invalid role', () => {
      const permissions = getRolePermissions('invalid_role');
      expect(permissions).toBeNull();
    });
  });

  describe('Permission Checking', () => {
    it('should allow vendor_developer to create applications', () => {
      const result = hasPermission('vendor_developer', 'applications', 'create');

      expect(result.allowed).toBe(true);
    });

    it('should NOT allow vendor_developer to approve applications', () => {
      const result = hasPermission('vendor_developer', 'applications', 'approve');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('should allow dha_certification_officer to approve applications', () => {
      const result = hasPermission('dha_certification_officer', 'applications', 'approve');

      expect(result.allowed).toBe(true);
    });

    it('should NOT allow dha_system_administrator to approve applications', () => {
      const result = hasPermission('dha_system_administrator', 'applications', 'approve');

      expect(result.allowed).toBe(false);
    });

    it('should allow testing_lab_staff to execute tests', () => {
      const result = hasPermission('testing_lab_staff', 'tests', 'execute');

      expect(result.allowed).toBe(true);
    });

    it('should NOT allow testing_lab_staff to approve applications', () => {
      const result = hasPermission('testing_lab_staff', 'applications', 'approve');

      expect(result.allowed).toBe(false);
    });

    it('should allow public_user to read registry', () => {
      const result = hasPermission('public_user', 'registry', 'read');

      expect(result.allowed).toBe(true);
    });

    it('should NOT allow public_user to create applications', () => {
      const result = hasPermission('public_user', 'applications', 'create');

      expect(result.allowed).toBe(false);
    });
  });

  describe('Resource Actions', () => {
    it('should return correct actions for vendor_developer on applications', () => {
      const actions = getResourceActions('vendor_developer', 'applications');

      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).not.toContain('delete');
      expect(actions).not.toContain('approve');
    });

    it('should return correct actions for dha_certification_officer on applications', () => {
      const actions = getResourceActions('dha_certification_officer', 'applications');

      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('approve');
      expect(actions).toContain('reject');
    });

    it('should return empty array for invalid resource', () => {
      const actions = getResourceActions('vendor_developer', 'invalid_resource');

      expect(actions).toEqual([]);
    });
  });

  describe('Role Classification', () => {
    it('should correctly identify vendor roles', () => {
      expect(isVendorRole('vendor_developer')).toBe(true);
      expect(isVendorRole('vendor_technical_lead')).toBe(true);
      expect(isVendorRole('vendor_compliance_officer')).toBe(true);
      expect(isVendorRole('dha_system_administrator')).toBe(false);
      expect(isVendorRole('public_user')).toBe(false);
    });

    it('should correctly identify DHA staff roles', () => {
      expect(isDHARole('dha_system_administrator')).toBe(true);
      expect(isDHARole('dha_certification_officer')).toBe(true);
      expect(isDHARole('vendor_developer')).toBe(false);
      expect(isDHARole('testing_lab_staff')).toBe(false);
    });

    it('should correctly identify approval-capable roles', () => {
      expect(canApproveCertifications('certification_committee_member')).toBe(true);
      expect(canApproveCertifications('dha_certification_officer')).toBe(false);
      expect(canApproveCertifications('dha_system_administrator')).toBe(false);
      expect(canApproveCertifications('vendor_developer')).toBe(false);
    });
  });

  describe('Scope Restrictions', () => {
    it('should enforce own scope for vendor roles', () => {
      const result = hasPermission('vendor_developer', 'applications', 'read', {
        checkScope: true,
        isOwner: false
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('own');
    });

    it('should allow access when ownership verified', () => {
      const result = hasPermission('vendor_developer', 'applications', 'read', {
        checkScope: true,
        isOwner: true
      });

      expect(result.allowed).toBe(true);
    });

    it('should enforce assigned scope for testing lab', () => {
      const result = hasPermission('testing_lab_staff', 'tests', 'execute', {
        checkScope: true,
        isAssigned: false
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('assigned');
    });
  });

  describe('Nested Permissions', () => {
    it('should handle nested document permissions for technical lead', () => {
      const permissions = getRolePermissions('vendor_technical_lead');

      expect(permissions.documents.technical).toBeDefined();
      expect(permissions.documents.technical.actions).toContain('create');
      expect(permissions.documents.technical.actions).toContain('delete');
      expect(permissions.documents.compliance.actions).toContain('read');
      expect(permissions.documents.compliance.actions).not.toContain('delete');
    });

    it('should handle nested document permissions for compliance officer', () => {
      const permissions = getRolePermissions('vendor_compliance_officer');

      expect(permissions.documents.compliance).toBeDefined();
      expect(permissions.documents.compliance.actions).toContain('create');
      expect(permissions.documents.compliance.actions).toContain('delete');
      expect(permissions.documents.technical.actions).toContain('read');
      expect(permissions.documents.technical.actions).not.toContain('delete');
    });
  });

  describe('Permission Conditions', () => {
    it('should define conditions for application creation', () => {
      const permissions = getRolePermissions('vendor_developer');

      expect(permissions.applications.conditions).toBeDefined();
      expect(permissions.applications.conditions.create).toBeDefined();
      expect(permissions.applications.conditions.create.max_draft_applications).toBe(5);
    });

    it('should define conditions for application approval', () => {
      const permissions = getRolePermissions('dha_certification_officer');

      expect(permissions.applications.conditions).toBeDefined();
      expect(permissions.applications.conditions.approve).toBeDefined();
      expect(permissions.applications.conditions.approve.require_all_tests_passed).toBe(true);
    });
  });

  describe('Role Restrictions', () => {
    it('should define restrictions for system administrator', () => {
      const permissions = getRolePermissions('dha_system_administrator');

      expect(permissions.restrictions).toBeDefined();
      expect(permissions.restrictions.cannot_approve).toBe(true);
      expect(permissions.restrictions.cannot_vote).toBe(true);
    });

    it('should define restrictions for testing lab staff', () => {
      const permissions = getRolePermissions('testing_lab_staff');

      expect(permissions.restrictions).toBeDefined();
      expect(permissions.restrictions.cannot_approve).toBe(true);
      expect(permissions.restrictions.cannot_access_business_docs).toBe(true);
    });

    it('should define restrictions for committee members', () => {
      const permissions = getRolePermissions('certification_committee_member');

      expect(permissions.restrictions).toBeDefined();
      expect(permissions.restrictions.cannot_conduct_reviews).toBe(true);
      expect(permissions.restrictions.must_declare_conflicts).toBe(true);
    });
  });

  describe('All 9 Roles Coverage', () => {
    const allRoles = [
      'vendor_developer',
      'vendor_technical_lead',
      'vendor_compliance_officer',
      'dha_system_administrator',
      'dha_certification_officer',
      'testing_lab_staff',
      'certification_committee_member',
      'county_health_officer',
      'public_user'
    ];

    allRoles.forEach(role => {
      it(`should have complete permission definition for ${role}`, () => {
        const permissions = getRolePermissions(role);

        expect(permissions).toBeDefined();
        expect(permissions).not.toBeNull();
        expect(typeof permissions).toBe('object');
      });
    });

    it('should have unique permission sets for each role', () => {
      const permissionSets = allRoles.map(role => JSON.stringify(getRolePermissions(role)));
      const uniqueSets = new Set(permissionSets);

      expect(uniqueSets.size).toBe(allRoles.length);
    });
  });
});
