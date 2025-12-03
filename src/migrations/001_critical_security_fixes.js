// ✅ CRITICAL SECURITY FIXES - Migration Script
// Run this migration to apply all security fixes to existing users
// This migration addresses all 8 critical audit findings

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { addPasswordToHistory, calculatePasswordExpiry } = require('../utils/passwordSecurity');
const { sendEmail } = require('../utils/sendEmail');

/**
 * Migration: Apply Critical Security Fixes to Existing Users
 *
 * This migration performs the following:
 * 1. Enable 2FA for all users (set twoFactorSetupRequired flag)
 * 2. Initialize password history with current password
 * 3. Set password expiry dates (90 days from now)
 * 4. Clear any account lockouts and reset failed attempts
 * 5. Update system settings to enforce 2FA globally
 * 6. Send notification emails to all affected users
 */

async function runMigration() {
  console.log('==========================================');
  console.log('CRITICAL SECURITY FIXES MIGRATION');
  console.log('==========================================\n');

  try {
    // Step 1: Update System Settings
    console.log('Step 1: Updating System Settings...');
    const settings = await SystemSettings.getSettings();
    settings.require2FA = true;
    await settings.save();
    console.log('✅ System settings updated: 2FA now mandatory globally\n');

    // Step 2: Get all users
    console.log('Step 2: Fetching all users...');
    const users = await User.find({}).select('+password');
    console.log(`Found ${users.length} users to migrate\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Step 3: Process each user
    console.log('Step 3: Processing users...\n');

    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email || user.organizationEmail || user.username}`);

        // 3.1: Enable 2FA setup requirement (don't force enable yet, require setup flow)
        if (!user.twoFactorEnabled) {
          user.twoFactorSetupRequired = true;
          console.log('  → 2FA setup required flag set');
        } else {
          console.log('  → 2FA already enabled');
        }

        // 3.2: Initialize password history with current password
        if (!user.passwordHistory || user.passwordHistory.length === 0) {
          user.passwordHistory = [{
            hash: user.password, // Current password hash
            changedAt: user.passwordLastChanged || new Date()
          }];
          console.log('  → Password history initialized');
        } else {
          console.log('  → Password history already exists');
        }

        // 3.3: Set password expiry (90 days from last change or now)
        if (!user.passwordExpiresAt) {
          const lastChanged = user.passwordLastChanged || new Date();
          user.passwordExpiresAt = calculatePasswordExpiry(user.passwordExpiryDays || 90);
          user.passwordLastChanged = lastChanged;
          console.log(`  → Password expiry set to: ${user.passwordExpiresAt.toISOString()}`);
        } else {
          console.log('  → Password expiry already set');
        }

        // 3.4: Clear account lockouts and reset failed attempts
        if (user.accountStatus === 'locked' || user.failedAttempts > 0) {
          user.accountStatus = 'active';
          user.lockedUntil = null;
          user.failedAttempts = 0;
          console.log('  → Account unlocked and failed attempts reset');
        }

        // 3.5: Ensure password expiry days is set
        if (!user.passwordExpiryDays) {
          user.passwordExpiryDays = 90;
        }

        // 3.6: Ensure max password history is set
        if (!user.maxPasswordHistory) {
          user.maxPasswordHistory = 5;
        }

        // Save user
        await user.save();
        successCount++;
        console.log('  ✅ User migrated successfully\n');

        // 3.7: Send notification email
        try {
          const userEmail = user.email || user.organizationEmail;
          if (userEmail) {
            await sendEmail({
              to: userEmail,
              subject: 'Important Security Updates - Action Required',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">Important Security Updates</h2>

                  <p>Hello ${user.firstName || user.organizationName || 'User'},</p>

                  <p>We've implemented critical security enhancements to protect your account:</p>

                  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1f2937;">What's Changed:</h3>
                    <ul style="line-height: 1.8;">
                      ${!user.twoFactorEnabled ? '<li><strong>Two-Factor Authentication (2FA) is now mandatory</strong> - You will be required to set up 2FA on your next login</li>' : ''}
                      <li><strong>Password Requirements Updated</strong> - Passwords must now be at least 12 characters</li>
                      <li><strong>Password Expiry</strong> - Your password will expire in 90 days and must be changed</li>
                      <li><strong>Password History</strong> - You cannot reuse your last 5 passwords</li>
                      <li><strong>Enhanced Account Protection</strong> - Accounts are temporarily locked after 5 failed login attempts</li>
                    </ul>
                  </div>

                  ${!user.twoFactorEnabled ? `
                  <div style="background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">⚠️ Action Required</h3>
                    <p style="margin-bottom: 0; color: #78350f;">You must set up Two-Factor Authentication on your next login. This is mandatory for all users.</p>
                  </div>
                  ` : ''}

                  <div style="background-color: #e0f2fe; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #075985;">📅 Password Expiry Notice</h3>
                    <p style="margin-bottom: 0; color: #0c4a6e;">Your current password will expire on <strong>${user.passwordExpiresAt.toLocaleDateString()}</strong>. You'll receive reminders as this date approaches.</p>
                  </div>

                  <h3 style="color: #1f2937;">Why These Changes?</h3>
                  <p>These security enhancements are based on industry best practices and compliance requirements to ensure the highest level of protection for your account and data.</p>

                  <h3 style="color: #1f2937;">Need Help?</h3>
                  <p>If you have questions or need assistance, please contact our support team.</p>

                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                  <p style="color: #6b7280; font-size: 12px;">
                    This is an automated security notification. Please do not reply to this email.
                  </p>
                </div>
              `
            });
            console.log('  📧 Notification email sent\n');
          }
        } catch (emailError) {
          console.error(`  ⚠️ Failed to send notification email: ${emailError.message}\n`);
          // Don't fail the migration if email fails
        }

      } catch (userError) {
        errorCount++;
        errors.push({
          user: user.email || user.organizationEmail || user.username,
          error: userError.message
        });
        console.error(`  ❌ Error migrating user: ${userError.message}\n`);
      }
    }

    // Step 4: Summary
    console.log('==========================================');
    console.log('MIGRATION SUMMARY');
    console.log('==========================================');
    console.log(`Total users: ${users.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log('==========================================\n');

    if (errors.length > 0) {
      console.log('ERRORS:');
      errors.forEach(({ user, error }) => {
        console.log(`  - ${user}: ${error}`);
      });
      console.log('\n');
    }

    console.log('✅ Migration completed!\n');
    console.log('Next Steps:');
    console.log('1. Users without 2FA will be prompted to set it up on next login');
    console.log('2. Password expiry warnings will be sent at 30, 14, 7, and 1 day(s) before expiry');
    console.log('3. Users will be required to change passwords that have expired');
    console.log('4. Account lockout policies are now active (5 failed attempts = 30-minute lockout)');
    console.log('5. CAPTCHA will be required after 3 failed login attempts\n');

    return {
      success: true,
      totalUsers: users.length,
      successCount,
      errorCount,
      errors
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback function (if needed)
 * WARNING: This will revert security enhancements - use with caution
 */
async function rollbackMigration() {
  console.log('==========================================');
  console.log('ROLLING BACK SECURITY FIXES MIGRATION');
  console.log('WARNING: This removes security enhancements!');
  console.log('==========================================\n');

  try {
    const users = await User.find({});

    for (const user of users) {
      user.twoFactorSetupRequired = false;
      user.passwordHistory = [];
      user.passwordExpiresAt = null;
      user.accountStatus = 'active';
      user.lockedUntil = null;
      user.failedAttempts = 0;
      await user.save();
    }

    // Update system settings
    const settings = await SystemSettings.getSettings();
    settings.require2FA = false;
    await settings.save();

    console.log('✅ Rollback completed\n');
    return { success: true };

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();

  const command = process.argv[2];

  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/huduma-hub')
    .then(async () => {
      console.log('✅ Connected to MongoDB\n');

      if (command === 'rollback') {
        await rollbackMigration();
      } else {
        await runMigration();
      }

      await mongoose.connection.close();
      console.log('✅ Database connection closed\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  rollbackMigration
};
