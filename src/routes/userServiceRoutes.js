const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route GET /api/users/:id
 * @desc Get user by ID (for microservice communication)
 * @access Internal Service
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify this is a service-to-service request
    const serviceHeader = req.headers['x-service-request'];
    if (!serviceHeader) {
      return res.status(401).json({
        success: false,
        message: 'Service authentication required'
      });
    }

    const user = await User.findById(id).select('-password -twoFactorSecret -recoveryKeyHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/users/batch
 * @desc Get multiple users by IDs (for microservice communication)
 * @access Internal Service
 */
router.post('/batch', async (req, res) => {
  try {
    const { userIds } = req.body;

    // Verify this is a service-to-service request
    const serviceHeader = req.headers['x-service-request'];
    if (!serviceHeader) {
      return res.status(401).json({
        success: false,
        message: 'Service authentication required'
      });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required'
      });
    }

    const users = await User.find({
      _id: { $in: userIds }
    }).select('-password -twoFactorSecret -recoveryKeyHash');

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Get users batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/users/:id/snapshot
 * @desc Get user snapshot for audit purposes (for microservice communication)
 * @access Internal Service
 */
router.get('/:id/snapshot', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify this is a service-to-service request
    const serviceHeader = req.headers['x-service-request'];
    if (!serviceHeader) {
      return res.status(401).json({
        success: false,
        message: 'Service authentication required'
      });
    }

    const user = await User.findById(id).select('-password -twoFactorSecret -recoveryKeyHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create snapshot format
    const snapshot = {
      userId: user._id,
      email: user.email || user.organizationEmail || 'no-email@system.local',
      name: user.name || user.organizationName || 
            (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
      role: user.role || 'user',
      phone: user.phone || user.organizationPhone,
      organizationName: user.organizationName,
      organizationType: user.organizationType,
      accountType: user.type || 'user',
      accountStatus: user.accountStatus,
      snapshotAt: new Date()
    };

    res.json({
      success: true,
      data: snapshot
    });

  } catch (error) {
    console.error('Get user snapshot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user snapshot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/users/:id/validate
 * @desc Validate user exists and is active (for microservice communication)
 * @access Internal Service
 */
router.get('/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify this is a service-to-service request
    const serviceHeader = req.headers['x-service-request'];
    if (!serviceHeader) {
      return res.status(401).json({
        success: false,
        message: 'Service authentication required'
      });
    }

    const user = await User.findById(id).select('accountStatus suspended type');
    
    if (!user) {
      return res.json({
        success: true,
        data: {
          isValid: false,
          reason: 'User not found'
        }
      });
    }

    const isValid = !user.suspended && 
                   user.accountStatus !== 'cancelled' && 
                   user.accountStatus !== 'suspended';

    res.json({
      success: true,
      data: {
        isValid,
        accountStatus: user.accountStatus,
        suspended: user.suspended,
        accountType: user.type
      }
    });

  } catch (error) {
    console.error('Validate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PATCH /api/users/:id/status
 * @desc Update user account status (for microservice communication)
 * @access Internal Service
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { accountStatus, registrationNumber, organizationStatus } = req.body;

    // Verify this is a service-to-service request
    const serviceHeader = req.headers['x-service-request'];
    if (!serviceHeader) {
      return res.status(401).json({
        success: false,
        message: 'Service authentication required'
      });
    }

    // Validate status values
    const validStatuses = ['pending', 'active', 'suspended', 'cancelled', 'pending_registration', 'submitted', 'under_review', 'clarification', 'approved', 'rejected', 'certified'];
    if (accountStatus && !validStatuses.includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account status'
      });
    }

    const updateData = {};
    if (accountStatus) updateData.accountStatus = accountStatus;
    if (registrationNumber) updateData.registrationNumber = registrationNumber;
    if (organizationStatus) updateData.organizationStatus = organizationStatus;
    
    updateData.lastUpdated = new Date();

    const user = await User.findByIdAndUpdate(
      id, 
      updateData,
      { new: true, select: 'accountStatus organizationStatus registrationNumber lastUpdated email name' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: user._id,
        accountStatus: user.accountStatus,
        organizationStatus: user.organizationStatus,
        registrationNumber: user.registrationNumber,
        lastUpdated: user.lastUpdated
      },
      message: 'User status updated successfully'
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
