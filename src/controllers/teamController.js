//  DHA TEAM MANAGEMENT CONTROLLER
// FR-TEAM-MGMT-001: Multi-user organizational management
// Handles team member invitations, role assignments, and access management

const { TeamMember, INTERNAL_ROLES, HIERARCHY_LEVELS } = require('../models/TeamMember');
const User = require('../models/User');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

/**
 * ========================================
 * TEAM MEMBER INVITATION
 * ========================================
 */

/**
 * Invite a new team member
 * POST /api/team/invite
 */
exports.inviteTeamMember = async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      internalRole,
      department,
      title,
      notes
    } = req.body;

    const inviterId = req.user._id;
    const organizationId = req.user._id; // Assuming user is organization owner

    // Validate internal role
    if (!Object.values(INTERNAL_ROLES).includes(internalRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid internal role',
        validRoles: Object.values(INTERNAL_ROLES)
      });
    }

    // Check if inviter has permission to invite
    if (req.user.type !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can invite team members'
      });
    }

    // Check if user already exists
    let invitedUser = await User.findOne({ email });

    if (!invitedUser) {
      // Create new user account
      invitedUser = new User({
        type: 'individual',
        email,
        firstName,
        lastName,
        organizationRegistrationNumber: req.user.registrationNumber,
        accountStatus: 'pending_verification',
        role: 'vendor_developer', // Default system role
        firstTimeSetup: true
      });

      await invitedUser.save();
    } else {
      // Check if user is already a team member
      const existingMember = await TeamMember.findOne({
        organizationId,
        userId: invitedUser._id,
        status: { $in: ['pending', 'active'] }
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'User is already a team member or has a pending invitation'
        });
      }
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create team member record
    const teamMember = new TeamMember({
      organizationId,
      userId: invitedUser._id,
      internalRole,
      status: 'pending',
      invitedBy: inviterId,
      invitationToken,
      invitationExpiresAt,
      department,
      title,
      notes
    });

    await teamMember.save();

    // Send invitation email
    const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation/${invitationToken}`;

    await sendEmail({
      to: email,
      subject: `Team Invitation from ${req.user.organizationName}`,
      template: 'team-invitation',
      data: {
        organizationName: req.user.organizationName,
        inviterName: `${req.user.firstName} ${req.user.lastName}`,
        internalRole,
        invitationLink,
        expiresAt: invitationExpiresAt
      }
    });

    res.status(201).json({
      success: true,
      message: 'Team member invited successfully',
      data: {
        teamMember: {
          id: teamMember._id,
          email,
          firstName,
          lastName,
          internalRole,
          status: teamMember.status,
          invitedAt: teamMember.invitedAt,
          expiresAt: invitationExpiresAt
        }
      }
    });
  } catch (error) {
    console.error('Invite team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invite team member',
      error: error.message
    });
  }
};

/**
 * Accept team invitation
 * POST /api/team/accept/:token
 */
exports.acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    // Find team member by invitation token
    const teamMember = await TeamMember.findOne({
      invitationToken: token,
      status: 'pending'
    }).populate('organizationId', 'organizationName');

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    // Check if invitation is expired
    if (teamMember.isInvitationExpired) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired'
      });
    }

    // Accept invitation
    await teamMember.acceptInvitation();

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        organizationName: teamMember.organizationId.organizationName,
        internalRole: teamMember.internalRole
      }
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation',
      error: error.message
    });
  }
};

/**
 * ========================================
 * TEAM MEMBER MANAGEMENT
 * ========================================
 */

/**
 * Get all team members
 * GET /api/team/members
 */
exports.getTeamMembers = async (req, res) => {
  try {
    const organizationId = req.user._id;

    const members = await TeamMember.getActiveMembers(organizationId);

    res.status(200).json({
      success: true,
      data: {
        members,
        count: members.length
      }
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve team members',
      error: error.message
    });
  }
};

/**
 * Get pending invitations
 * GET /api/team/invitations/pending
 */
exports.getPendingInvitations = async (req, res) => {
  try {
    const organizationId = req.user._id;

    const invitations = await TeamMember.getPendingInvitations(organizationId);

    res.status(200).json({
      success: true,
      data: {
        invitations,
        count: invitations.length
      }
    });
  } catch (error) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending invitations',
      error: error.message
    });
  }
};

/**
 * Update team member role
 * PATCH /api/team/members/:memberId/role
 */
exports.updateMemberRole = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { internalRole } = req.body;
    const organizationId = req.user._id;

    // Validate internal role
    if (!Object.values(INTERNAL_ROLES).includes(internalRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid internal role',
        validRoles: Object.values(INTERNAL_ROLES)
      });
    }

    // Find team member
    const teamMember = await TeamMember.findOne({
      _id: memberId,
      organizationId,
      status: 'active'
    });

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Update role
    teamMember.internalRole = internalRole;
    await teamMember.save();

    res.status(200).json({
      success: true,
      message: 'Team member role updated successfully',
      data: {
        memberId: teamMember._id,
        internalRole: teamMember.internalRole,
        hierarchyLevel: teamMember.hierarchyLevel,
        permissions: teamMember.permissions
      }
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member role',
      error: error.message
    });
  }
};

/**
 * Update team member permissions
 * PATCH /api/team/members/:memberId/permissions
 */
exports.updateMemberPermissions = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { permissions } = req.body;
    const organizationId = req.user._id;

    // Find team member
    const teamMember = await TeamMember.findOne({
      _id: memberId,
      organizationId,
      status: 'active'
    });

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Update permissions
    teamMember.permissions = {
      ...teamMember.permissions,
      ...permissions
    };

    await teamMember.save();

    res.status(200).json({
      success: true,
      message: 'Team member permissions updated successfully',
      data: {
        memberId: teamMember._id,
        permissions: teamMember.permissions
      }
    });
  } catch (error) {
    console.error('Update member permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member permissions',
      error: error.message
    });
  }
};

/**
 * ========================================
 * TEAM MEMBER REVOCATION
 * ========================================
 */

/**
 * Revoke team member access
 * POST /api/team/members/:memberId/revoke
 */
exports.revokeMemberAccess = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { reason } = req.body;
    const organizationId = req.user._id;
    const revokedBy = req.user._id;

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Revocation reason is required (minimum 10 characters)'
      });
    }

    // Find team member
    const teamMember = await TeamMember.findOne({
      _id: memberId,
      organizationId
    }).populate('userId', 'firstName lastName email');

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    if (teamMember.status === 'revoked') {
      return res.status(400).json({
        success: false,
        message: 'Team member access is already revoked'
      });
    }

    // Revoke access
    await teamMember.revokeAccess(revokedBy, reason);

    // Send notification email
    await sendEmail({
      to: teamMember.userId.email,
      subject: 'Team Access Revoked',
      template: 'access-revoked',
      data: {
        organizationName: req.user.organizationName,
        reason,
        revokedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Team member access revoked successfully',
      data: {
        memberId: teamMember._id,
        status: teamMember.status,
        revokedAt: teamMember.revokedAt
      }
    });
  } catch (error) {
    console.error('Revoke member access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke team member access',
      error: error.message
    });
  }
};

/**
 * Remove team member (delete)
 * DELETE /api/team/members/:memberId
 */
exports.removeMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const organizationId = req.user._id;

    // Find and delete team member
    const teamMember = await TeamMember.findOneAndDelete({
      _id: memberId,
      organizationId
    });

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove team member',
      error: error.message
    });
  }
};

/**
 * ========================================
 * TEAM HIERARCHY
 * ========================================
 */

/**
 * Get team hierarchy
 * GET /api/team/hierarchy
 */
exports.getTeamHierarchy = async (req, res) => {
  try {
    const organizationId = req.user._id;

    const members = await TeamMember.find({
      organizationId,
      status: 'active'
    })
      .populate('userId', 'firstName lastName email')
      .sort({ hierarchyLevel: 1, createdAt: 1 });

    // Group by hierarchy level
    const hierarchy = {
      owner: [],
      admin: [],
      lead: [],
      member: [],
      viewer: []
    };

    members.forEach(member => {
      const levelName = Object.keys(HIERARCHY_LEVELS).find(
        key => HIERARCHY_LEVELS[key] === member.hierarchyLevel
      )?.toLowerCase();

      if (levelName && hierarchy[levelName]) {
        hierarchy[levelName].push({
          id: member._id,
          user: member.userId,
          internalRole: member.internalRole,
          department: member.department,
          title: member.title
        });
      }
    });

    res.status(200).json({
      success: true,
      data: { hierarchy }
    });
  } catch (error) {
    console.error('Get team hierarchy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve team hierarchy',
      error: error.message
    });
  }
};

/**
 * Get team member details
 * GET /api/team/members/:memberId
 */
exports.getMemberDetails = async (req, res) => {
  try {
    const { memberId } = req.params;
    const organizationId = req.user._id;

    const member = await TeamMember.findOne({
      _id: memberId,
      organizationId
    })
      .populate('userId', 'firstName lastName email phone role accountStatus')
      .populate('invitedBy', 'firstName lastName')
      .populate('revokedBy', 'firstName lastName');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { member }
    });
  } catch (error) {
    console.error('Get member details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve team member details',
      error: error.message
    });
  }
};
