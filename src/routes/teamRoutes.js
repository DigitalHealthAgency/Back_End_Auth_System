//  DHA TEAM MANAGEMENT ROUTES
// FR-TEAM-MGMT-001: Multi-user organizational management routes

const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const protect = require('../middleware/authMiddleware');
const { requirePermission, requireRole, auditLog } = require('../middleware/rbac');
const { PERMISSIONS } = require('../constants/roles');

/**
 * ========================================
 * TEAM MEMBER INVITATION ROUTES
 * ========================================
 */

// Invite team member (Vendor organizations only with MANAGE_TEAM_MEMBERS permission)
router.post(
  '/invite',
  protect,
  requirePermission(PERMISSIONS.MANAGE_TEAM_MEMBERS),
  auditLog('INVITE_TEAM_MEMBER'),
  teamController.inviteTeamMember
);

// Accept invitation (Public route with token)
router.post(
  '/accept/:token',
  teamController.acceptInvitation
);

// Get pending invitations
router.get(
  '/invitations/pending',
  protect,
  requirePermission(PERMISSIONS.MANAGE_TEAM_MEMBERS),
  teamController.getPendingInvitations
);

/**
 * ========================================
 * TEAM MEMBER MANAGEMENT ROUTES
 * ========================================
 */

// Get all team members
router.get(
  '/members',
  protect,
  teamController.getTeamMembers
);

// Get team member details
router.get(
  '/members/:memberId',
  protect,
  teamController.getMemberDetails
);

// Update team member role
router.patch(
  '/members/:memberId/role',
  protect,
  requirePermission(PERMISSIONS.MANAGE_TEAM_MEMBERS),
  auditLog('UPDATE_MEMBER_ROLE'),
  teamController.updateMemberRole
);

// Update team member permissions
router.patch(
  '/members/:memberId/permissions',
  protect,
  requirePermission(PERMISSIONS.MANAGE_TEAM_MEMBERS),
  auditLog('UPDATE_MEMBER_PERMISSIONS'),
  teamController.updateMemberPermissions
);

/**
 * ========================================
 * TEAM MEMBER REVOCATION ROUTES
 * ========================================
 */

// Revoke team member access
router.post(
  '/members/:memberId/revoke',
  protect,
  requirePermission(PERMISSIONS.MANAGE_TEAM_MEMBERS),
  auditLog('REVOKE_MEMBER_ACCESS'),
  teamController.revokeMemberAccess
);

// Remove team member (delete)
router.delete(
  '/members/:memberId',
  protect,
  requirePermission(PERMISSIONS.MANAGE_TEAM_MEMBERS),
  auditLog('REMOVE_TEAM_MEMBER'),
  teamController.removeMember
);

/**
 * ========================================
 * TEAM HIERARCHY ROUTES
 * ========================================
 */

// Get team hierarchy
router.get(
  '/hierarchy',
  protect,
  teamController.getTeamHierarchy
);

module.exports = router;
