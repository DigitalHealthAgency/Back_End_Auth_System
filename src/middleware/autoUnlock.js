// ✅ CRITICAL SECURITY FIX: Automatic Account Unlock
// SRS Requirements: FR-SEC-003 (Account Lockout Management)
// Automatically unlocks accounts after 30-minute lockout period

const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { logsecurityEvent } = require('../controllers/admin/securityController');

/**
 * Middleware to automatically unlock accounts after lockout period expires
 * Should run before authentication checks
 */
const autoUnlockMiddleware = async (req, res, next) => {
  try {
    // Extract identifier from request
    const identifier = req.body.identifier || req.body.email || req.body.username;

    if (!identifier) {
      return next(); // No identifier, continue
    }

    // Find user by identifier
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { organizationName: identifier },
        { organizationEmail: identifier }
      ]
    });

    if (!user) {
      return next(); // User not found, continue
    }

    // Check if account is locked
    if (user.accountStatus === 'locked' && user.lockedUntil) {
      const now = new Date();

      // If lockout period has expired, automatically unlock
      if (user.lockedUntil < now) {
        const wasLockedSince = user.lockedUntil;

        // Unlock account
        user.accountStatus = 'active';
        user.lockedUntil = null;
        user.failedAttempts = 0;
        await user.save();

        // Log the auto-unlock event
        await logsecurityEvent({
          userId: user._id,
          action: 'Account Auto-Unlocked',
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: {
            wasLockedUntil: wasLockedSince,
            unlockedAt: now,
            reason: 'Automatic unlock after 30-minute lockout period'
          }
        });

        // Send notification email
        try {
          await sendEmail({
            to: user.email || user.organizationEmail,
            subject: 'Account Unlocked - Kenya DHA',
            html: `
              <h2>Account Unlocked</h2>
              <p>Hello ${user.firstName || user.organizationName},</p>
              <p>Your account has been automatically unlocked after the 30-minute lockout period.</p>
              <p>Your account was locked due to multiple failed login attempts for security reasons.</p>
              <p><strong>Security Reminder:</strong></p>
              <ul>
                <li>If this was you, you can now log in normally</li>
                <li>If this wasn't you, please change your password immediately</li>
                <li>Enable 2FA for additional security</li>
              </ul>
              <p>If you need assistance, please contact support.</p>
              <br>
              <p>Best regards,<br>Kenya DHA Security Team</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send unlock notification:', emailError);
          // Don't fail the request if email fails
        }

        console.log(`✅ Account auto-unlocked: ${user.email || user.organizationEmail}`);
      }
    }

    next();
  } catch (error) {
    console.error('Auto-unlock middleware error:', error);
    // Don't block the request if auto-unlock fails
    next();
  }
};

/**
 * Scheduled job to unlock all expired lockouts (backup to middleware)
 * Should run every 5 minutes via cron
 */
const unlockExpiredAccountsJob = async () => {
  try {
    const now = new Date();

    // Find all locked accounts with expired lockout periods
    const lockedUsers = await User.find({
      accountStatus: 'locked',
      lockedUntil: { $lt: now, $ne: null }
    });

    if (lockedUsers.length === 0) {
      console.log('[Auto-Unlock Job] No expired lockouts found');
      return { unlockedCount: 0 };
    }

    console.log(`[Auto-Unlock Job] Found ${lockedUsers.length} expired lockouts`);

    let unlockedCount = 0;

    for (const user of lockedUsers) {
      try {
        // Unlock account
        user.accountStatus = 'active';
        user.lockedUntil = null;
        user.failedAttempts = 0;
        await user.save();

        // Log the unlock
        await logsecurityEvent({
          userId: user._id,
          action: 'Account Auto-Unlocked (Job)',
          ip: 'system',
          device: 'Scheduled Job',
          details: {
            wasLockedUntil: user.lockedUntil,
            unlockedAt: now,
            reason: 'Automatic unlock by scheduled job'
          }
        });

        // Send notification
        try {
          await sendEmail({
            to: user.email || user.organizationEmail,
            subject: 'Account Unlocked - Kenya DHA',
            html: `
              <h2>Account Unlocked</h2>
              <p>Hello ${user.firstName || user.organizationName},</p>
              <p>Your account has been automatically unlocked.</p>
              <p>You can now log in normally.</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send unlock email:', emailError);
        }

        unlockedCount++;
      } catch (error) {
        console.error(`Failed to unlock user ${user._id}:`, error);
      }
    }

    console.log(`[Auto-Unlock Job] Successfully unlocked ${unlockedCount} accounts`);
    return { unlockedCount };

  } catch (error) {
    console.error('[Auto-Unlock Job] Error:', error);
    return { unlockedCount: 0, error: error.message };
  }
};

module.exports = {
  autoUnlockMiddleware,
  unlockExpiredAccountsJob
};
