// src/controllers/vendor/vendorController.js
const User = require('../../models/User');

/**
 * Get vendor dashboard statistics
 * Shows only data for the authenticated vendor's organization
 */
exports.getVendorStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Import models (these would need to be created in your system)
    // For now, returning mock structure with real query patterns

    const stats = {
      activeApplications: 0,
      inProgress: 0,
      certifiedSystems: 0,
      pendingActions: 0,
      teamMembers: 0
    };

    // Query pattern for when Registration model exists:
    // const activeApps = await Registration.countDocuments({
    //   $or: [
    //     { userId },
    //     { organizationId }
    //   ],
    //   status: { $in: ['draft', 'submitted', 'under_review'] }
    // });

    // Query team members
    if (req.user.type === 'organization' && organizationId) {
      const teamCount = await User.countDocuments({
        organizationId,
        accountStatus: 'active'
      });
      stats.teamMembers = teamCount;
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    res.status(500).json({ message: 'Failed to fetch vendor statistics' });
  }
};

/**
 * Get vendor's own applications
 * Filters by userId or organizationId
 */
exports.getVendorApplications = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Query pattern - this will work when Registration model is properly integrated
    const query = {
      $or: [
        { userId },
        ...(organizationId ? [{ organizationId }] : [])
      ]
    };

    // Mock response structure
    const applications = [];
    const total = 0;

    // Real query would be:
    // const applications = await Registration.find(query)
    //   .sort({ createdAt: -1 })
    //   .skip(skip)
    //   .limit(limit)
    //   .populate('assignedOfficerId', 'firstName lastName email')
    //   .lean();
    // const total = await Registration.countDocuments(query);

    res.status(200).json({
      data: applications,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching vendor applications:', error);
    res.status(500).json({ message: 'Failed to fetch applications' });
  }
};

/**
 * Get vendor's team members
 * Only for organization-type users
 */
exports.getVendorTeam = async (req, res) => {
  try {
    if (req.user.type !== 'organization') {
      return res.status(400).json({
        message: 'Team management is only available for organization accounts'
      });
    }

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID not found' });
    }

    const teamMembers = await User.find({
      organizationId,
      accountStatus: { $ne: 'deleted' }
    })
      .select('firstName lastName email role accountStatus type createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const formattedTeam = teamMembers.map(member => ({
      id: member._id.toString(),
      name: `${member.firstName} ${member.lastName}`,
      email: member.email,
      role: member.role,
      status: member.accountStatus,
      type: member.type,
      joinedAt: member.createdAt
    }));

    res.status(200).json({
      data: formattedTeam,
      total: formattedTeam.length
    });
  } catch (error) {
    console.error('Error fetching vendor team:', error);
    res.status(500).json({ message: 'Failed to fetch team members' });
  }
};

/**
 * Get vendor's documents
 * Filters by userId or organizationId
 */
exports.getVendorDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    const applicationId = req.query.applicationId;

    const query = {
      $or: [
        { userId },
        ...(organizationId ? [{ organizationId }] : [])
      ]
    };

    if (applicationId) {
      query.applicationId = applicationId;
    }

    // Mock response - real implementation would query Document model
    const documents = [];
    // const documents = await Document.find(query)
    //   .sort({ uploadedAt: -1 })
    //   .lean();

    res.status(200).json({
      data: documents,
      total: documents.length
    });
  } catch (error) {
    console.error('Error fetching vendor documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
};

/**
 * Get test status for vendor's application
 * Only if the application belongs to this vendor
 */
exports.getTestStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // First, verify this application belongs to the vendor
    // const application = await Registration.findOne({
    //   _id: applicationId,
    //   $or: [{ userId }, { organizationId }]
    // });

    // if (!application) {
    //   return res.status(404).json({ message: 'Application not found or access denied' });
    // }

    // Mock response structure
    const testStatus = {
      applicationId,
      testingPhase: 'not_started',
      assignedLab: null,
      testCases: {
        total: 0,
        passed: 0,
        failed: 0,
        inProgress: 0
      },
      report: null
    };

    // Real query:
    // const tests = await Test.find({ applicationId })
    //   .populate('assignedLabId', 'name')
    //   .lean();

    res.status(200).json(testStatus);
  } catch (error) {
    console.error('Error fetching test status:', error);
    res.status(500).json({ message: 'Failed to fetch test status' });
  }
};

/**
 * Get vendor's certificates
 * Only for certified applications
 */
exports.getVendorCertificates = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Mock response - real implementation would query Certificate model
    const certificates = [];
    // const certificates = await Certificate.find({
    //   $or: [{ userId }, { organizationId }],
    //   status: 'active'
    // })
    //   .sort({ issuedAt: -1 })
    //   .lean();

    res.status(200).json({
      data: certificates,
      total: certificates.length
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ message: 'Failed to fetch certificates' });
  }
};

/**
 * Create new application
 * Associates with the authenticated vendor
 */
exports.createApplication = async (req, res) => {
  try {
    const { systemName, systemType, version, description } = req.body;

    if (!systemName || !systemType) {
      return res.status(400).json({
        message: 'System name and type are required'
      });
    }

    // Create application
    // const newApplication = await Registration.create({
    //   userId: req.user._id,
    //   organizationId: req.user.organizationId,
    //   systemName,
    //   systemType,
    //   version,
    //   description,
    //   status: 'draft',
    //   createdAt: new Date()
    // });

    res.status(201).json({
      success: true,
      message: 'Application created successfully',
      data: {
        id: 'mock-id',
        systemName,
        status: 'draft'
      }
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ message: 'Failed to create application' });
  }
};

/**
 * Get vendor's payment history
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Mock response - real implementation would query Payment model
    const payments = [];
    // const payments = await Payment.find({
    //   $or: [{ userId }, { organizationId }]
    // })
    //   .sort({ paidAt: -1 })
    //   .lean();

    res.status(200).json({
      data: payments,
      total: payments.length
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
};

/**
 * Get notifications for vendor
 */
exports.getVendorNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // Mock response - real implementation would query Notification model
    const notifications = [
      {
        id: '1',
        type: 'action_required',
        title: 'Upload API documentation',
        message: 'Your EMR Pro application requires API documentation',
        priority: 'high',
        read: false,
        createdAt: new Date()
      },
      {
        id: '2',
        type: 'status_update',
        title: 'EMR moved to testing',
        message: 'Your application EMR Pro has been moved to testing phase',
        priority: 'medium',
        read: false,
        createdAt: new Date(Date.now() - 3600000)
      },
      {
        id: '3',
        type: 'success',
        title: 'LabManager certified!',
        message: 'Congratulations! LabManager v1.5 has been certified',
        priority: 'low',
        read: true,
        createdAt: new Date(Date.now() - 86400000)
      }
    ];

    // Real query:
    // const notifications = await Notification.find({ userId })
    //   .sort({ createdAt: -1 })
    //   .limit(20)
    //   .lean();

    res.status(200).json({
      data: notifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};
