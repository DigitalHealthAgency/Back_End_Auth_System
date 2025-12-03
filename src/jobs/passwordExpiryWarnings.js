// ✅ CRITICAL SECURITY FIX: Password Expiry Warning Job
// Sends email warnings at 30, 14, 7, and 1 day(s) before password expiry

const cron = require('node-cron');
const User = require('../models/User');
const { sendEmail } = require('../utils/sendEmail');
const { getDaysUntilExpiry } = require('../utils/passwordSecurity');
const { logSecurityEvent } = require('../controllers/authController');

const WARNING_THRESHOLDS = [30, 14, 7, 1]; // Days before expiry to send warnings

/**
 * Check all users and send password expiry warnings
 * Runs daily at 9:00 AM
 */
async function sendPasswordExpiryWarnings() {
  console.log('[Password Expiry Job] Starting password expiry warning check...');

  try {
    // Find all active users with password expiry dates
    const users = await User.find({
      accountStatus: 'active',
      passwordExpiresAt: { $exists: true, $ne: null }
    });

    console.log(`[Password Expiry Job] Found ${users.length} users to check`);

    let warningsSent = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const daysRemaining = getDaysUntilExpiry(user.passwordExpiresAt);

        // Skip if password already expired
        if (daysRemaining < 0) {
          continue;
        }

        // Check if we should send warning for this threshold
        if (WARNING_THRESHOLDS.includes(daysRemaining)) {
          const userEmail = user.email || user.organizationEmail;

          if (!userEmail) {
            console.warn(`[Password Expiry Job] User ${user._id} has no email, skipping...`);
            continue;
          }

          // Check if warning already sent today (prevent duplicates)
          const lastWarning = user.lastPasswordExpiryWarning;
          if (lastWarning) {
            const timeSinceLastWarning = Date.now() - lastWarning.getTime();
            const hoursSinceLastWarning = timeSinceLastWarning / (1000 * 60 * 60);

            // Skip if warning sent within last 23 hours
            if (hoursSinceLastWarning < 23) {
              console.log(`[Password Expiry Job] Warning already sent today for ${userEmail}`);
              continue;
            }
          }

          // Send warning email
          await sendPasswordExpiryEmail(user, daysRemaining);

          // Update last warning timestamp
          user.lastPasswordExpiryWarning = new Date();
          await user.save();

          warningsSent++;
          console.log(`[Password Expiry Job] Warning sent to ${userEmail} (${daysRemaining} days remaining)`);

          // Log security event
          await logSecurityEvent({
            user: user._id,
            action: 'Password Expiry Warning Sent',
            severity: 'low',
            ip: 'system',
            device: 'scheduled-job',
            details: {
              daysRemaining,
              passwordExpiresAt: user.passwordExpiresAt,
              warningThreshold: daysRemaining
            }
          });
        }

      } catch (userError) {
        errors++;
        console.error(`[Password Expiry Job] Error processing user ${user._id}:`, userError);
      }
    }

    console.log('[Password Expiry Job] Complete!');
    console.log(`  - Warnings sent: ${warningsSent}`);
    console.log(`  - Errors: ${errors}`);

    return {
      success: true,
      warningsSent,
      errors,
      totalChecked: users.length
    };

  } catch (error) {
    console.error('[Password Expiry Job] Job failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send password expiry warning email to user
 */
async function sendPasswordExpiryEmail(user, daysRemaining) {
  const userName = user.firstName || user.organizationName || 'User';
  const userEmail = user.email || user.organizationEmail;
  const expiryDate = user.passwordExpiresAt.toLocaleDateString();

  // Different urgency levels based on days remaining
  let urgencyColor = '#2563eb'; // Blue
  let urgencyLevel = 'Reminder';

  if (daysRemaining === 1) {
    urgencyColor = '#dc2626'; // Red
    urgencyLevel = 'URGENT';
  } else if (daysRemaining <= 7) {
    urgencyColor = '#ea580c'; // Orange
    urgencyLevel = 'Important';
  } else if (daysRemaining <= 14) {
    urgencyColor = '#f59e0b'; // Amber
    urgencyLevel = 'Notice';
  }

  const subject = daysRemaining === 1
    ? '⚠️ URGENT: Your password expires tomorrow!'
    : `Password Expiry ${urgencyLevel}: ${daysRemaining} days remaining`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}cc 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .warning-box { background: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .days-remaining { font-size: 48px; font-weight: bold; color: ${urgencyColor}; text-align: center; margin: 20px 0; }
        .cta-button { display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 20px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .info-item { background: #f9fafb; padding: 15px; border-radius: 5px; }
        .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
        .info-value { font-size: 16px; color: #111827; font-weight: 500; }
        .footer { background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; font-size: 12px; color: #6b7280; }
        .steps { background: #f9fafb; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .step { display: flex; align-items: flex-start; margin: 15px 0; }
        .step-number { background: ${urgencyColor}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
        .step-text { flex: 1; }
        ul { padding-left: 20px; }
        li { margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Expiry ${urgencyLevel}</h1>
        </div>

        <div class="content">
          <p>Hello ${userName},</p>

          <div class="warning-box">
            <strong style="color: ${urgencyColor};">⚠️ Your password is expiring soon!</strong>
          </div>

          <div class="days-remaining">
            ${daysRemaining}
            <div style="font-size: 16px; color: #6b7280; font-weight: normal; margin-top: 10px;">
              ${daysRemaining === 1 ? 'day remaining' : 'days remaining'}
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Expiry Date</div>
              <div class="info-value">${expiryDate}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Days Remaining</div>
              <div class="info-value">${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}</div>
            </div>
          </div>

          ${daysRemaining === 1 ? `
          <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <strong style="color: #dc2626;">⚠️ URGENT ACTION REQUIRED</strong>
            <p style="margin: 10px 0 0 0; color: #991b1b;">
              Your password expires <strong>tomorrow</strong>. Please change it immediately to avoid account lockout.
            </p>
          </div>
          ` : ''}

          <h3 style="color: #111827; margin-top: 30px;">How to Change Your Password</h3>

          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-text">
                <strong>Log in to your account</strong><br>
                Use your current credentials to access your account
              </div>
            </div>

            <div class="step">
              <div class="step-number">2</div>
              <div class="step-text">
                <strong>Navigate to Settings</strong><br>
                Go to Account Settings → Security → Change Password
              </div>
            </div>

            <div class="step">
              <div class="step-number">3</div>
              <div class="step-text">
                <strong>Create a strong new password</strong><br>
                Must be at least 12 characters with uppercase, lowercase, numbers, and special characters
              </div>
            </div>

            <div class="step">
              <div class="step-number">4</div>
              <div class="step-text">
                <strong>Confirm the change</strong><br>
                Your password will be valid for the next 90 days
              </div>
            </div>
          </div>

          <center>
            <a href="${process.env.FRONTEND_URL}/settings/security" class="cta-button" style="color: white;">
              Change Password Now
            </a>
          </center>

          <h3 style="color: #111827; margin-top: 30px;">Password Requirements</h3>
          <ul style="color: #4b5563;">
            <li><strong>Minimum 12 characters</strong> (security requirement)</li>
            <li>At least one uppercase letter (A-Z)</li>
            <li>At least one lowercase letter (a-z)</li>
            <li>At least one number (0-9)</li>
            <li>At least one special character (!@#$%^&*)</li>
            <li>Cannot reuse your last 5 passwords</li>
          </ul>

          <h3 style="color: #111827; margin-top: 30px;">What happens if my password expires?</h3>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px;">
            <p style="margin: 0; color: #78350f;">
              If your password expires, you will be locked out of your account and required to change it before you can log in again.
              Change it now to avoid any disruption.
            </p>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">Need Help?</h3>
          <p>If you have any questions or need assistance changing your password, please contact our support team.</p>
        </div>

        <div class="footer">
          <p style="margin: 0;">
            This is an automated security notification from your account system.<br>
            Please do not reply to this email.
          </p>
          <p style="margin: 10px 0 0 0;">
            © ${new Date().getFullYear()} Huduma Hub. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: subject,
    html: html
  });
}

/**
 * Schedule the job to run daily at 9:00 AM
 * Cron expression: '0 9 * * *' = At 09:00 every day
 */
function startPasswordExpiryWarningJob() {
  console.log('[Password Expiry Job] Scheduling daily password expiry warning job (9:00 AM)...');

  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Password Expiry Job] Running scheduled password expiry warning check...');
    await sendPasswordExpiryWarnings();
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Africa/Nairobi'
  });

  console.log('[Password Expiry Job] Job scheduled successfully!');
}

/**
 * Manually trigger the job (useful for testing)
 */
async function runPasswordExpiryWarningJobNow() {
  console.log('[Password Expiry Job] Manually triggering password expiry warning job...');
  return await sendPasswordExpiryWarnings();
}

// Auto-start if running as main module
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();

  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/huduma-hub')
    .then(async () => {
      console.log('✅ Connected to MongoDB');
      const result = await runPasswordExpiryWarningJobNow();
      console.log('Result:', result);
      await mongoose.connection.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    });
}

module.exports = {
  startPasswordExpiryWarningJob,
  runPasswordExpiryWarningJobNow,
  sendPasswordExpiryWarnings
};
