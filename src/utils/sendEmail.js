const { Resend } = require('resend');
const EmailLog = require('../models/EmailLog');

// Initialize Resend client only if API key is available
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else if (process.env.NODE_ENV !== 'test') {
  console.warn(' RESEND_API_KEY not found. Email functionality will be disabled.');
}

// Define a default sender if environment variable is missing
const DEFAULT_FROM = process.env.FROM_EMAIL || 'Kenya Digital Health Agency <noreply@dha.go.ke>';

const sendEmail = async ({ to, subject, text, html }) => {
  // Check if Resend client is available
  if (!resend) {
    // Only warn in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      console.warn(' Email service not configured. Skipping email send.');
    }
    return { success: false, message: 'Email service not configured' };
  }

  //console.log('Sending email with Resend:');
  //console.log('- From:', DEFAULT_FROM);
  //console.log('- To:', to);
  //console.log('- Subject:', subject);

  const msg = {
    from: DEFAULT_FROM,
    to,
    subject,
    text: text || '',
    html: html || ''
  };

  try {
    const response = await resend.emails.send(msg);

    await EmailLog.create({
      to,
      subject,
      type: 'System',
      status: 'sent'
    });

    //console.log(`📩 Email sent successfully to ${to}`);
    return response;
  } catch (error) {
    console.error(` Email failed to send: ${error.message}`);
    if (error.details) {
      console.error('Error details:', error.details);
    }
    throw error;
  }
};

module.exports = sendEmail;