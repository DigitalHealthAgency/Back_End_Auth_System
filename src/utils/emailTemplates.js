// Welcome Email Template
const createWelcomeEmail = (user, plainKey) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Huduma Hub</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
          background-color: #f5f7fa;
        }
        .container {
          max-width: 650px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
        }
        .logo-text {
          font-size: 36px;
          font-weight: bold;
          margin: 0;
          letter-spacing: 1px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .tagline {
          font-size: 14px;
          margin: 8px 0 0 0;
          opacity: 0.9;
          font-weight: 300;
        }
        .content {
          padding: 40px 30px;
          background-color: #ffffff;
        }
        .welcome-badge {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        h1 {
          color: #1e40af;
          margin-top: 10px;
          margin-bottom: 20px;
          font-size: 28px;
        }
        .user-greeting {
          font-size: 18px;
          color: #374151;
          margin-bottom: 25px;
        }
        .platform-intro {
          background-color: #f8fafc;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin: 25px 0;
        }
        .feature-item {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .feature-icon {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .feature-title {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
        }
        .feature-desc {
          font-size: 14px;
          color: #6b7280;
        }
        .key-container {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          text-align: center;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
        }
        .key-title {
          color: #92400e;
          font-weight: 700;
          margin-bottom: 15px;
          font-size: 18px;
        }
        .key {
          font-family: 'Courier New', monospace;
          font-size: 20px;
          letter-spacing: 3px;
          color: #92400e;
          padding: 15px;
          background-color: #fffbeb;
          border-radius: 8px;
          border: 1px solid #fbbf24;
          margin: 15px 0;
          word-break: break-all;
        }
        .key-warning {
          color: #dc2626;
          font-size: 14px;
          font-weight: 600;
          margin-top: 15px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 8px;
          margin: 25px 0;
          font-weight: 600;
          box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .next-steps {
          background-color: #ecfdf5;
          border: 1px solid #10b981;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .next-steps h3 {
          color: #047857;
          margin-top: 0;
          margin-bottom: 15px;
        }
        .steps-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .steps-list li {
          padding: 8px 0;
          padding-left: 30px;
          position: relative;
          color: #065f46;
        }
        .steps-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: bold;
        }
        .help-section {
          background-color: #f1f5f9;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .help-title {
          color: #334155;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .help-text {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
        }
        .contact-info {
          display: flex;
          justify-content: space-around;
          flex-wrap: wrap;
          gap: 15px;
          margin: 20px 0;
        }
        .contact-item {
          background-color: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          text-align: center;
          flex: 1;
          min-width: 200px;
        }
        .footer {
          text-align: center;
          padding: 30px 20px;
          font-size: 13px;
          color: #6b7280;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-top: 1px solid #e5e7eb;
        }
        .footer-logo {
          font-size: 20px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 10px;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #e5e7eb 50%, transparent 100%);
          margin: 30px 0;
        }
        
        @media (max-width: 600px) {
          .content {
            padding: 30px 20px;
          }
          .features-grid {
            grid-template-columns: 1fr;
          }
          .contact-info {
            flex-direction: column;
          }
          .key {
            font-size: 16px;
            letter-spacing: 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">Huduma Hub</h1>
          <p class="tagline">Transforming Kenya's Civil Society Through Digital Inclusion</p>
        </div>
        
        <div class="content">
          <div class="welcome-badge">🎉 Welcome to the Community</div>
          <h1>Your Digital Transformation Journey Begins Now!</h1>
          
          <p class="user-greeting">Hello <strong>${user.name || user.organizationName || user.firstName || 'User'}</strong>,</p>
          
          <div class="platform-intro">
            <p><strong>Welcome to Huduma Hub</strong> - Kenya's premier digital platform for civil society organizations. We're excited to have you join thousands of CBOs, PBOs, and community groups who are transforming their operations through digital innovation.</p>
          </div>
          
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">📋</div>
              <div class="feature-title">Legal Registration</div>
              <div class="feature-desc">Streamlined registration under PBO Act 2024 and Community Groups Registration Act 2022</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">💰</div>
              <div class="feature-title">Financial Management</div>
              <div class="feature-desc">Complete financial tools including budgeting, accounting, and donor reporting</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">👥</div>
              <div class="feature-title">Governance & HR</div>
              <div class="feature-desc">Digital governance tools, board management, and HR systems</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📊</div>
              <div class="feature-title">M&E & Projects</div>
              <div class="feature-desc">Project management with integrated monitoring and evaluation frameworks</div>
            </div>
          </div>
          
          <div class="key-container">
            <p class="key-title">🔐 Your Account Recovery Key</p>
            <div class="key">${plainKey}</div>
            <p class="key-warning">⚠️ IMPORTANT: Store this key securely! You'll need it to recover your account if you lose access.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="https://hudumahub.co.ke/login" class="button">Access Your Dashboard</a>
          </div>
          
          <div class="next-steps">
            <h3>🚀 Get Started in 3 Easy Steps:</h3>
            <ul class="steps-list">
              <li>Complete your organization profile and upload required documents</li>
              <li>Take the digital readiness assessment to unlock personalized training</li>
              <li>Begin your legal registration process or access operational tools</li>
            </ul>
          </div>
          
          <div class="divider"></div>
          
          <div class="help-section">
            <h3 class="help-title">🤝 Need Support?</h3>
            <p class="help-text">Our team is here to help you maximize your experience on Huduma Hub. Whether you need technical assistance, training, or guidance on compliance requirements, we're just a click away.</p>
            
            <div class="contact-info">
              <div class="contact-item">
                <strong>📧 Email Support</strong><br>
                <a href="mailto:support@hudumahub.co.ke" style="color: #3b82f6;">support@hudumahub.co.ke</a>
              </div>
              <div class="contact-item">
                <strong>💬 Live Chat</strong><br>
                Available in your dashboard
              </div>
              <div class="contact-item">
                <strong>📚 Help Center</strong><br>
                Guides, tutorials & FAQs
              </div>
            </div>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af; font-weight: 600;">🎯 Join 10,000+ organizations transforming their operations through Huduma Hub</p>
            <p style="margin: 10px 0 0 0; color: #1e3a8a; font-size: 14px;">Together, we're building a digitally empowered civil society in Kenya.</p>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-logo">Huduma Hub</div>
          <p>Empowering Civil Society Through Digital Innovation</p>
          <p>© ${new Date().getFullYear()} Reprodrive Center for Innovation Ltd. All rights reserved.</p>
          <p>📍 5th Floor Hifadhi House, ICD Road, Embakasi South</p>
          <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
            This email was sent to you because you created an account on Huduma Hub.<br>
            If you have any questions, please contact our support team.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;
  };
  
  // Login Detection Email Template
  const createLoginAlertEmail = (user, ip, deviceString) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Login Detected</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #ff9900;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #ff9900;
          margin-top: 0;
        }
        .alert-icon {
          text-align: center;
          font-size: 48px;
          margin-bottom: 20px;
        }
        .login-details {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 20px;
          margin: 20px 0;
        }
        .login-details table {
          width: 100%;
          border-collapse: collapse;
        }
        .login-details td {
          padding: 8px 12px;
        }
        .login-details td:first-child {
          font-weight: bold;
          width: 30%;
        }
        .button {
          display: inline-block;
          background-color: #ff9900;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          margin-top: 20px;
        }
        .warning {
          background-color: #fff9e6;
          border-left: 4px solid #ff9900;
          padding: 15px;
          margin-top: 25px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/Huduma Hub-logo_d86yas.png" alt="Huduma Hub Logo">
        </div>
        <div class="content">
          <div class="alert-icon">🔐</div>
          <h1>New Login Detected</h1>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>We detected a new login to your Huduma Hub account. If this was you, no action is needed.</p>
          
          <div class="login-details">
            <table>
              <tr>
                <td>IP Address:</td>
                <td>${ip}</td>
              </tr>
              <tr>
                <td>Device:</td>
                <td>${deviceString}</td>
              </tr>
              <tr>
                <td>Time:</td>
                <td>${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <a href="https://Huduma Hubapp.com/account/security" class="button">Review Security Settings</a>
          
          <div class="warning">
            <p><strong>Don't recognize this activity?</strong> Please secure your account immediately by changing your password and enabling two-factor authentication.</p>
          </div>
          
          <div class="divider"></div>
          
          <p>If you need assistance, please contact our support team at <a href="mailto:support@Huduma Hubapp.com">support@Huduma Hubapp.com</a>.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Huduma Hub. All rights reserved.</p>
          <p>📍 5th Floor Hifadhi House, ICD Road, Embakasi South</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };
  
  // Password Reset Email Template
  const createPasswordResetEmail = (email, code) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Code</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #0066ff;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #0066ff;
          margin-top: 0;
        }
        .code-container {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        .code {
          font-family: monospace;
          font-size: 32px;
          letter-spacing: 8px;
          color: #0066ff;
          padding: 10px;
        }
        .expiry {
          color: #ff3b30;
          font-size: 14px;
          margin-top: 10px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
        .note {
          font-size: 14px;
          background-color: #f0f7ff;
          border-left: 4px solid #0066ff;
          padding: 15px;
          margin-top: 25px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/Huduma Hub-logo_d86yas.png" alt="Huduma Hub Logo">
        </div>
        <div class="content">
          <h1>Password Reset Code</h1>
          <p>Hello,</p>
          <p>We received a request to reset the password for your Huduma Hub account associated with ${email}.</p>
          
          <div class="code-container">
            <p>Your verification code is:</p>
            <div class="code">${code}</div>
            <p class="expiry">This code will expire in 10 minutes</p>
          </div>
          
          <div class="note">
            <p>If you did not request this code, please ignore this email or contact support if you believe this is suspicious activity.</p>
          </div>
          
          <div class="divider"></div>
          
          <p>For security reasons, this code can only be used once. If you need assistance, please contact our support team at <a href="mailto:support@Huduma Hubapp.com">support@Huduma Hubapp.com</a>.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Huduma Hub. All rights reserved.</p>
          <p>📍 5th Floor Hifadhi House, ICD Road, Embakasi South</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  const createCronErrorEmail = (jobName, error, timestamp) => {
    const formattedDate = new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium', 
      timeStyle: 'medium'
    });
  
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cron Job Error Alert</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #e74c3c;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #e74c3c;
          margin-top: 0;
        }
        .error-container {
          background-color: #fff5f5;
          border: 1px solid #e74c3c;
          border-left: 5px solid #e74c3c;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
        }
        .error-title {
          color: #e74c3c;
          font-weight: bold;
          margin-top: 0;
        }
        .error-details {
          font-family: monospace;
          background-color: #f9f9f9;
          padding: 12px;
          border-radius: 4px;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .timestamp {
          color: #666666;
          font-style: italic;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/Huduma Hub-logo_d86yas.png" alt="Huduma Hub Logo">
        </div>
        <div class="content">
          <h1>⚠️ Cron Job Error Alert</h1>
          <p>A scheduled task has encountered an error and failed to complete:</p>
          
          <div class="error-container">
            <h3 class="error-title">Job: ${jobName}</h3>
            <p class="timestamp">Occurred at: ${formattedDate}</p>
            <p><strong>Error Details:</strong></p>
            <div class="error-details">${error.stack || error.message || String(error)}</div>
          </div>
          
          <p>Please investigate this issue as soon as possible to ensure system reliability.</p>
          
          <div class="divider"></div>
          
          <p>This is an automated notification from the Huduma Hub system monitoring service.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Huduma Hub. All rights reserved.</p>
          <p>📍 5th Floor Hifadhi House, ICD Road, Embakasi South</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  const createQuotationEmail = (quotation, quotationUrl) => {
    const { 
      clientSnapshot, 
      creatorSnapshot,
      quoteNumber, 
      quoteName,
      validUntil,
      currency,
      total
    } = quotation;
  
    // Format the date
    const formattedValidUntil = new Date(validUntil).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  
    // Format the total amount
    const formattedTotal = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency || 'USD' 
    }).format(total);
  
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Quotation from ${creatorSnapshot.companyName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #0066ff;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #0066ff;
          margin-top: 0;
        }
        .quote-details {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 20px;
          margin: 25px 0;
        }
        .quote-number {
          font-family: monospace;
          font-size: 20px;
          color: #0066ff;
          margin-bottom: 10px;
        }
        .expiry {
          color: #ff3b30;
          font-size: 14px;
          margin-top: 10px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
        .note {
          font-size: 14px;
          background-color: #f0f7ff;
          border-left: 4px solid #0066ff;
          padding: 15px;
          margin-top: 25px;
        }
        .button {
          display: inline-block;
          background-color: #0066ff;
          color: white;
          text-decoration: none;
          padding: 12px 25px;
          border-radius: 4px;
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #0055cc;
        }
        .text-center {
          text-align: center;
        }
        .company-info {
          margin-top: 20px;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${creatorSnapshot.logo && creatorSnapshot.logo.url ? 
            `<img src="${creatorSnapshot.logo.url}" alt="${creatorSnapshot.companyName} Logo">` : 
            `<h2>${creatorSnapshot.companyName}</h2>`
          }
        </div>
        <div class="content">
          <h1>Quotation: ${quoteName}</h1>
          <p>Dear ${clientSnapshot.name},</p>
          <p>Thank you for your interest in our products/services. We're pleased to provide you with the following quotation:</p>
          
          <div class="quote-details">
            <div class="quote-number">Quotation Number: ${quoteNumber}</div>
            <p><strong>Total Amount:</strong> ${formattedTotal}</p>
            <p class="expiry">Valid until: ${formattedValidUntil}</p>
          </div>
          
          <div class="text-center">
            <a href="${quotationUrl}" class="button">View Complete Quotation</a>
          </div>
          
          <div class="note">
            <p>To view the detailed quotation with all product/service information, please click the button above or use the link below:</p>
            <p><a href="${quotationUrl}">${quotationUrl}</a></p>
          </div>
          
          <div class="divider"></div>
          
          <p>If you have any questions or would like to discuss this quotation further, please don't hesitate to contact us at <a href="mailto:${creatorSnapshot.email}">${creatorSnapshot.email}</a>${creatorSnapshot.phone ? ` or by phone at ${creatorSnapshot.phone}` : ''}.</p>
          
          <div class="company-info">
            <p>Best regards,</p>
            <p><strong>${creatorSnapshot.companyName}</strong></p>
            ${creatorSnapshot.address ? `<p>${creatorSnapshot.address}</p>` : ''}
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${creatorSnapshot.companyName}. All rights reserved.</p>
          ${creatorSnapshot.address ? `<p>${creatorSnapshot.address}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
    `;
  };
  
  const createInvoiceEmail = (invoice, invoiceUrl) => {
    // Format the total amount
    const formattedTotal = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: invoice.currency || 'USD' 
    }).format(invoice.total);

    // Format the due date
    const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice from ${invoice.creatorSnapshot.companyName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            background-color: #f8f9fa;
            border-bottom: 3px solid #0066ff;
          }
          .header img {
            max-height: 60px;
          }
          .content {
            padding: 30px 20px;
            background-color: #ffffff;
          }
          .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #666666;
            background-color: #f8f9fa;
          }
          h1 {
            color: #0066ff;
            margin-top: 0;
          }
          .invoice-details {
            background-color: #f7f7f7;
            border: 1px solid #e1e1e1;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
          }
          .invoice-number {
            font-family: monospace;
            font-size: 20px;
            color: #0066ff;
            margin-bottom: 10px;
          }
          .due-date {
            color: #ff3b30;
            font-size: 14px;
            margin-top: 10px;
          }
          .payment-details {
            background-color: #f0f7ff;
            border-left: 4px solid #0066ff;
            padding: 15px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background-color: #0066ff;
            color: white;
            text-decoration: none;
            padding: 12px 25px;
            border-radius: 4px;
            font-weight: bold;
            margin: 20px 0;
          } 
          .button:hover {
            background-color: #0055cc;
          }
          .text-center {
            text-align: center;
          }
          .company-info {
            margin-top: 20px;
            font-style: italic;
          }
          .divider {
            height: 1px;
            background-color: #e1e1e1;
            margin: 25px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${invoice.creatorSnapshot.logo && invoice.creatorSnapshot.logo.url ? 
              `<img src="${invoice.creatorSnapshot.logo.url}" alt="${invoice.creatorSnapshot.companyName} Logo">` : 
              `<h2>${invoice.creatorSnapshot.companyName}</h2>`
            }
          </div>
          <div class="content">
            <h1>Invoice: ${invoice.invoiceName}</h1>
            <p>Dear ${invoice.clientSnapshot.name},</p>
            <p>Please find below your invoice details:</p>
            
            <div class="invoice-details">
              <div class="invoice-number">Invoice Number: ${invoice.invoiceNumber}</div>
              <p><strong>Amount Due:</strong> ${formattedTotal}</p>
              <p class="due-date">Due Date: ${formattedDueDate}</p>
            </div>
            
            <div class="payment-details">
              <h3>Payment Details:</h3>
              ${formatPaymentDetails(invoice.payment)}
            </div>
            
            <div class="text-center">
              <a href="${invoiceUrl}" class="button">View Complete Invoice</a>
            </div>
            
            <div class="divider"></div>
            
            <p>If you have any questions about this invoice, please contact us at <a href="mailto:${invoice.creatorSnapshot.email}">${invoice.creatorSnapshot.email}</a>${invoice.creatorSnapshot.phone ? ` or by phone at ${invoice.creatorSnapshot.phone}` : ''}.</p>
            
            <div class="company-info">
              <p>Best regards,</p>
              <p><strong>${invoice.creatorSnapshot.companyName}</strong></p>
              ${invoice.creatorSnapshot.address ? `<p>${invoice.creatorSnapshot.address}</p>` : ''}
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${invoice.creatorSnapshot.companyName}. All rights reserved.</p>
            ${invoice.creatorSnapshot.address ? `<p>${invoice.creatorSnapshot.address}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Helper function to format payment details
  function formatPaymentDetails(payment) {
    if (!payment) return '<p>Payment details not specified</p>';
  
    let details = `<p><strong>Payment Method:</strong> ${payment.method.toUpperCase()}</p>`;
  
    if (payment.method === 'mpesa') {
      if (payment.mpesa.type === 'paybill') {
        details += `
          <p><strong>Paybill Number:</strong> ${payment.mpesa.paybill.tillNumber}</p>
        `;
      } else if (payment.mpesa.type === 'sendMoney') {
        details += `
          <p><strong>Phone Number:</strong> ${payment.mpesa.sendMoney.phoneNumber}</p>
        `;
      }
    } else if (payment.method === 'bank') {
      details += `
        <p><strong>Bank Name:</strong> ${payment.bank.bankName}</p>
        <p><strong>Account Number:</strong> ${payment.bank.accountNumber}</p>
      `;
    }
  
    return details;
  }
  
  // Payment Initiation Email Template
  const createPaymentInitiationEmail = (user, plan, amount, billingType, paymentUrl) => {
    const amountInKES = (amount / 100).toFixed(2); // Convert from kobo to KES
    const billingPeriod = billingType === 'yearly' ? 'Annual' : 'Monthly';

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Complete Your Subscription Payment</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #0066ff; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 20px; }
              .footer { background: #333; color: white; padding: 10px; text-align: center; }
              .button { background: #0066ff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-size: 16px; font-weight: bold; }
              .details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Action Required: Complete Your Subscription Payment</h1>
              </div>
              <div class="content">
                  <h2>Hello ${user.name},</h2>
                  <p>Thank you for choosing the <strong>${plan.name}</strong> plan on Huduma Hub.</p>
                  <div class="details">
                    <ul>
                      <li><strong>Plan:</strong> ${plan.name}</li>
                      <li><strong>Billing:</strong> ${billingPeriod}</li>
                      <li><strong>Amount:</strong> KES ${amountInKES}</li>
                    </ul>
                  </div>
                  <p>To activate or renew your subscription, please complete your payment by clicking the button below:</p>
                  <a href="${paymentUrl}" class="button">Pay Now</a>
                  <p>If the button above does not work, copy and paste the following link into your browser:</p>
                  <p><a href="${paymentUrl}">${paymentUrl}</a></p>
                  <p>If you have any questions or need assistance, please contact our support team at <a href="mailto:support@Huduma Hubapp.com">support@Huduma Hubapp.com</a>.</p>
                  <p>Thank you for being a valued member of Huduma Hub!</p>
              </div>
              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Huduma Hub. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  };
  
  module.exports = {
    createWelcomeEmail,
    createLoginAlertEmail,
    createPasswordResetEmail,
    createCronErrorEmail,
    createQuotationEmail,
    createInvoiceEmail,
    createPaymentInitiationEmail
  };