// src/utils/safeCron.js

const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { createCronErrorEmail } = require('../utils/emailTemplates');

module.exports = function safeCron(jobName, task) {
  return async () => {
    try {
      console.log(`⏰ [${jobName}] Starting...`);
      await task();
      console.log(`✅ [${jobName}] Completed successfully.`);
    } catch (err) {
      console.error(`❌ [${jobName}] Failed:`, err);
      
      // Send email notification to admin users
      try {
        // Find all users with admin role
        const adminUsers = await User.find({ role: 'admin' });
        
        if (adminUsers && adminUsers.length > 0) {
          const timestamp = new Date();
          
          // Send error notification to each admin
          for (const admin of adminUsers) {
            await sendEmail({
              to: admin.email,
              subject: `🚨 Cron Job Error: ${jobName}`,
              html: createCronErrorEmail(jobName, err, timestamp)
            });
            console.log(`📩 Error notification sent to admin: ${admin.email}`);
          }
        } else {
          console.log('⚠️ No admin users found to send error notification');
        }
      } catch (emailErr) {
        // If email sending fails, log this separately to avoid supressing the original error
        console.error('❌ Failed to send error notification email:', emailErr);
      }
    }
  };
};