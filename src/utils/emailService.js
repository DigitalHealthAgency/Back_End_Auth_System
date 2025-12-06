// ✅ DHA EMAIL SERVICE
// Handles email notifications for team invitations and suspension appeals

const nodemailer = require('nodemailer');

/**
 * ========================================
 * EMAIL TRANSPORTER
 * ========================================
 */

// Create email transporter
const createTransporter = () => {
  // Use environment variables for email configuration
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * ========================================
 * EMAIL TEMPLATES
 * ========================================
 */

const emailTemplates = {
  'team-invitation': (data) => ({
    subject: `Team Invitation from ${data.organizationName}`,
    html: `
      <h2>You've been invited to join ${data.organizationName}</h2>
      <p>Hi,</p>
      <p>${data.inviterName} has invited you to join their team as a <strong>${data.internalRole}</strong>.</p>
      <p>Click the link below to accept the invitation:</p>
      <p><a href="${data.invitationLink}">Accept Invitation</a></p>
      <p>This invitation expires on ${new Date(data.expiresAt).toLocaleDateString()}.</p>
      <br>
      <p>Best regards,<br>Kenya Digital Health Agency</p>
    `
  }),

  'access-revoked': (data) => ({
    subject: 'Team Access Revoked',
    html: `
      <h2>Team Access Revoked</h2>
      <p>Hi,</p>
      <p>Your access to ${data.organizationName} has been revoked.</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p><strong>Date:</strong> ${new Date(data.revokedAt).toLocaleDateString()}</p>
      <br>
      <p>If you have questions, please contact the organization administrator.</p>
      <p>Best regards,<br>Kenya Digital Health Agency</p>
    `
  }),

  'appeal-received': (data) => ({
    subject: 'Suspension Appeal Received',
    html: `
      <h2>Your Suspension Appeal Has Been Received</h2>
      <p>Hi ${data.name},</p>
      <p>We have received your suspension appeal.</p>
      <p><strong>Appeal ID:</strong> ${data.appealId}</p>
      <p><strong>Submitted:</strong> ${new Date(data.submittedAt).toLocaleDateString()}</p>
      <p>Our team will review your appeal and respond within 5-7 business days.</p>
      <br>
      <p>Best regards,<br>Kenya Digital Health Agency</p>
    `
  }),

  'appeal-notification-admin': (data) => ({
    subject: 'New Suspension Appeal Submitted',
    html: `
      <h2>New Suspension Appeal</h2>
      <p>A new suspension appeal has been submitted:</p>
      <p><strong>Appeal ID:</strong> ${data.appealId}</p>
      <p><strong>User:</strong> ${data.userName} (${data.userEmail})</p>
      <p><strong>Submitted:</strong> ${new Date(data.submittedAt).toLocaleDateString()}</p>
      <p>Please review the appeal in the admin portal.</p>
      <br>
      <p>Kenya Digital Health Agency</p>
    `
  }),

  'appeal-approved': (data) => ({
    subject: 'Suspension Appeal Approved',
    html: `
      <h2>Your Suspension Appeal Has Been Approved</h2>
      <p>Hi ${data.name},</p>
      <p>Good news! Your suspension appeal has been approved and your account has been reactivated.</p>
      <p><strong>Decision:</strong></p>
      <p>${data.decision}</p>
      <p><strong>Date:</strong> ${new Date(data.approvedAt).toLocaleDateString()}</p>
      <p>You can now log in to your account.</p>
      <br>
      <p>Best regards,<br>Kenya Digital Health Agency</p>
    `
  }),

  'appeal-rejected': (data) => ({
    subject: 'Suspension Appeal Decision',
    html: `
      <h2>Suspension Appeal Decision</h2>
      <p>Hi ${data.name},</p>
      <p>After careful review, your suspension appeal has been rejected.</p>
      <p><strong>Decision:</strong></p>
      <p>${data.decision}</p>
      <p><strong>Date:</strong> ${new Date(data.rejectedAt).toLocaleDateString()}</p>
      <p>If you have further questions, please contact us at support@dha.go.ke.</p>
      <br>
      <p>Best regards,<br>Kenya Digital Health Agency</p>
    `
  }),

  'appeal-communication': (data) => ({
    subject: 'New Message on Your Suspension Appeal',
    html: `
      <h2>New Message on Your Appeal</h2>
      <p>Hi ${data.name},</p>
      <p>There's a new message on your suspension appeal (ID: ${data.appealId}):</p>
      <blockquote>${data.message}</blockquote>
      <p>Log in to your account to view and respond.</p>
      <br>
      <p>Best regards,<br>Kenya Digital Health Agency</p>
    `
  })
};

/**
 * ========================================
 * SEND EMAIL FUNCTION
 * ========================================
 */

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject (optional if using template)
 * @param {string} options.html - Email HTML content (optional if using template)
 * @param {string} options.template - Template name
 * @param {Object} options.data - Template data
 */
const sendEmail = async (options) => {
  try {
    // If email is not configured, log and return
    if (!process.env.SMTP_USER) {
      console.log('[EMAIL] Email not configured. Would send:', {
        to: options.to,
        subject: options.subject || options.template,
        template: options.template
      });
      return { success: true, message: 'Email not configured (dev mode)' };
    }

    const transporter = createTransporter();

    // Get email content from template if specified
    let subject = options.subject;
    let html = options.html;

    if (options.template && emailTemplates[options.template]) {
      const templateContent = emailTemplates[options.template](options.data || {});
      subject = subject || templateContent.subject;
      html = html || templateContent.html;
    }

    // Send email
    const info = await transporter.sendMail({
      from: `Kenya DHA <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: options.to,
      subject,
      html
    });

    console.log('[EMAIL] Message sent:', info.messageId);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('[EMAIL] Send error:', error);
    // Don't throw error - just log it so email failures don't break the app
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

module.exports = {
  sendEmail
};
