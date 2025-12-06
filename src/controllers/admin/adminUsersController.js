// src/controllers/admin/adminUsersController.js
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../../utils/sendEmail');

/**
 * Generate a temporary password for new users
 */
const generateTemporaryPassword = () => {
  // Generate a secure random password
  return crypto.randomBytes(12).toString('base64').slice(0, 12);
};

/**
 * Send welcome email with credentials using Resend API
 */
const sendWelcomeEmail = async (email, username, temporaryPassword, role) => {
  try {
    console.log(`[EMAIL] Sending welcome email to ${email} using Resend API...`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .credentials { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #0066cc; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to DHA Digital Health System</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your account has been created in the Digital Health Authority (DHA) system. You can now access the system with the following credentials:</p>

            <div class="credentials">
              <p><strong>Login URL:</strong> ${process.env.FRONTEND_URL || 'http://localhost:8080/login'}</p>
              <p><strong>Email/Username:</strong> ${username || email}</p>
              <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
              <p><strong>Role:</strong> ${role}</p>
            </div>

            <p><strong>⚠️ Important Security Instructions:</strong></p>
            <ul>
              <li>You must change your password upon first login</li>
              <li>Do not share your password with anyone</li>
              <li>Keep your credentials secure</li>
              <li>This temporary password expires in 7 days</li>
            </ul>

            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:8080/login'}" class="button">Login to DHA System</a>
            </p>

            <p>If you have any questions or need assistance, please contact your system administrator.</p>
          </div>
          <div class="footer">
            <p>Digital Health Authority, Kenya</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: email,
      subject: 'Welcome to DHA Digital Health System',
      html: emailHtml,
    });

    if (result.success === false) {
      console.error('[EMAIL] ❌ Failed to send welcome email:', result.message);
      return false;
    }

    console.log(`[EMAIL] ✅ Welcome email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send welcome email:', error.message);
    console.error('[EMAIL] Error details:', error);
    return false;
  }
};

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin only
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { organizationName: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      query.role = role;
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        query.accountStatus = 'active';
        query.suspended = false;
      } else if (status === 'inactive') {
        query.accountStatus = { $in: ['pending', 'inactive'] };
      } else if (status === 'suspended') {
        query.suspended = true;
      } else if (status === 'pending') {
        query.accountStatus = 'pending';
      }
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-password -twoFactorSecret -recoveryKeyHash')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await User.countDocuments(query);

    // Transform users for frontend
    const transformedUsers = users.map(user => ({
      id: user._id,
      username: user.username || user.email,
      email: user.email || user.organizationEmail,
      type: user.type,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationName: user.organizationName,
      organizationType: user.organizationType,
      phone: user.phone || user.organizationPhone,
      county: user.county,
      subCounty: user.subCounty,
      role: user.role,
      status: user.suspended ? 'suspended' : (user.accountStatus === 'active' ? 'active' : user.accountStatus === 'pending' ? 'pending' : 'inactive'),
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorEnabled || false,
    }));

    res.status(200).json({
      success: true,
      users: transformedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user
 * @access  Admin only
 */
exports.createUser = async (req, res) => {
  const adminUserId = req.user?._id;
  const adminEmail = req.user?.email;

  console.log(`[USER CREATION] Admin ${adminEmail} (${adminUserId}) initiated user creation`);
  console.log('[USER CREATION] Request body:', JSON.stringify(req.body, null, 2));

  try {
    const {
      type,
      email,
      username,
      firstName,
      lastName,
      phone,
      role,
      organizationName,
      organizationType,
      county,
      subCounty,
    } = req.body;

    // Validation
    if (!type || !email || !role) {
      console.log('[USER CREATION] Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Type, email, and role are required',
      });
    }

    if (type === 'individual' && (!firstName || !lastName || !username)) {
      console.log('[USER CREATION] Validation failed: Missing individual user fields');
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and username are required for individual users',
      });
    }

    if (type === 'organization' && !organizationName) {
      console.log('[USER CREATION] Validation failed: Missing organization name');
      return res.status(400).json({
        success: false,
        message: 'Organization name is required for organization users',
      });
    }

    console.log(`[USER CREATION] Validation passed for ${type} user: ${email}`);

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email },
        ...(username ? [{ username }] : []),
      ],
    });

    if (existingUser) {
      console.log(`[USER CREATION] User already exists: ${email} or ${username}`);
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists',
      });
    }

    console.log('[USER CREATION] No existing user found, proceeding with creation');

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    console.log(`[USER CREATION] Generated temporary password for ${email}`);
    console.log(`[USER CREATION] Temporary password (for logging only): ${temporaryPassword}`);

    // Create user object
    const userData = {
      type,
      email,
      password: hashedPassword,
      role,
      accountStatus: 'active', // User can login immediately
      emailVerified: true, // Admin-created users are pre-verified
      requirePasswordChange: true, // Force password change on first login
      temporaryPasswordExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      lastUpdated: new Date(),
    };

    console.log('[USER CREATION] User data prepared:', {
      type,
      email,
      role,
      accountStatus: userData.accountStatus,
      emailVerified: userData.emailVerified,
      requirePasswordChange: userData.requirePasswordChange,
    });

    // Add individual-specific fields
    if (type === 'individual') {
      userData.firstName = firstName;
      userData.lastName = lastName;
      userData.username = username;
      userData.phone = phone;
    }

    // Add organization-specific fields
    if (type === 'organization') {
      userData.organizationName = organizationName;
      userData.organizationType = organizationType;
      userData.organizationEmail = email;
      userData.organizationPhone = phone;
      userData.county = county;
      userData.subCounty = subCounty;
    }

    // Create user
    console.log('[USER CREATION] Creating user in database...');
    const newUser = new User(userData);
    await newUser.save();

    console.log(`[USER CREATION] ✅ User created successfully in database: ${newUser._id}`);
    console.log(`[USER CREATION] User details - Email: ${newUser.email}, Role: ${newUser.role}, Type: ${newUser.type}`);

    // Send welcome email with credentials
    console.log(`[USER CREATION] Attempting to send welcome email to ${email}...`);
    const emailSent = await sendWelcomeEmail(
      email,
      username || email,
      temporaryPassword,
      role
    );

    if (emailSent) {
      console.log(`[USER CREATION] ✅ Welcome email sent successfully to ${email}`);
    } else {
      console.log(`[USER CREATION] ⚠️ Failed to send welcome email to ${email} - SMTP not configured`);
      console.log(`[USER CREATION] Temporary password for ${email}: ${temporaryPassword}`);
    }

    console.log(`[USER CREATION] === CREATION SUMMARY ===`);
    console.log(`[USER CREATION] Admin: ${adminEmail}`);
    console.log(`[USER CREATION] New User: ${email} (${newUser._id})`);
    console.log(`[USER CREATION] Role: ${role}`);
    console.log(`[USER CREATION] Type: ${type}`);
    console.log(`[USER CREATION] Temporary Password: ${temporaryPassword}`);
    console.log(`[USER CREATION] Email Sent: ${emailSent ? 'YES' : 'NO'}`);
    console.log(`[USER CREATION] Account Status: ${newUser.accountStatus}`);
    console.log(`[USER CREATION] Can Login: YES (immediately)`);
    console.log(`[USER CREATION] Requires Password Change: YES (on first login)`);
    console.log(`[USER CREATION] Password Expires: ${userData.temporaryPasswordExpiry}`);
    console.log(`[USER CREATION] =========================`);

    res.status(201).json({
      success: true,
      message: `User created successfully. ${emailSent ? 'Welcome email sent.' : 'Failed to send welcome email - please provide credentials manually.'}`,
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        type: newUser.type,
      },
      temporaryPassword: emailSent ? undefined : temporaryPassword, // Only return password if email failed
    });
  } catch (error) {
    console.error('[USER CREATION] ❌ ERROR:', error.message);
    console.error('[USER CREATION] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single user by ID
 * @access  Admin only
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password -twoFactorSecret -recoveryKeyHash')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Update user status (activate/suspend/deactivate)
 * @access  Admin only
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const updateData = {};

    if (status === 'suspended') {
      updateData.suspended = true;
      updateData.accountStatus = 'active'; // Keep account active but suspended
    } else {
      updateData.suspended = false;
      updateData.accountStatus = status;
    }

    updateData.lastUpdated = new Date();

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, select: '-password -twoFactorSecret -recoveryKeyHash' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      user,
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user
 * @access  Admin only
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
