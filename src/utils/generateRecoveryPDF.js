// utils/generateRecoveryPDF.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Generates a professional recovery key PDF document
 * @param {Object} options - Configuration options
 * @param {string} options.name - User's name
 * @param {string} options.email - User's email
 * @param {string} options.recoveryKey - The generated recovery key
 * @returns {Promise<string>} - Path to the generated PDF file
 */
const generateRecoveryPDF = async ({ name, email, recoveryKey }) => {
  // Create a new PDF document
  const doc = new PDFDocument({
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    size: 'A4',
  });
  
  // Set up file path and stream
  const filePath = path.join(__dirname, '..', 'temp', `recovery_${Date.now()}.pdf`);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  
  // Get current date in a readable format
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  try {
    // Add logo (smaller size) - skip in test environment if fetch fails
    let logoAddedSuccessfully = false;
    if (process.env.NODE_ENV !== 'test') {
      try {
        const logoUrl = 'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/prezio-logo_d86yas.png';
        const logoResponse = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 5000 });
        const logoBuffer = Buffer.from(logoResponse.data);

        // Add logo to the top center with reduced size
        doc.image(logoBuffer, (doc.page.width - 150) / 2, 40, { width: 150 });
        logoAddedSuccessfully = true;
      } catch (logoError) {
        console.warn('Failed to fetch logo for PDF, continuing without it:', logoError.message);
      }
    }

    // Add document title (moved up) - adjust spacing based on whether logo was added
    doc.moveDown(logoAddedSuccessfully ? 3 : 1);
    doc.font('Helvetica-Bold').fontSize(24).text('', { align: 'center' });
    
    // Add horizontal line
    doc.moveDown(0.5);
    doc.lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke('#3498db');
    
    // Add greeting
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(14).text(`Dear ${name},`, { align: 'left' });
    
    // Add instructions
    doc.moveDown(0.5);
    doc.fontSize(12).text(
      'Thank you for securing your Prezio account with two-factor authentication. ' +
      'The recovery key below provides an alternative way to access your account if you lose access to your authentication device.',
      { align: 'left' }
    );
    
    doc.moveDown(0.5);
    doc.text(
      'Please store this recovery key in a secure location. Do not share it with anyone, ' +
      'including Prezio support staff. We will never ask you for this key.',
      { align: 'left' }
    );
    
    // Add recovery key section with styled box
    doc.moveDown(1);
    
    // Draw a styled box for the recovery key
    const boxY = doc.y;
    doc.rect(75, boxY, doc.page.width - 150, 80)
       .fillAndStroke('#f8f9fa', '#e9ecef');
    
    // Add recovery key label and value
    doc.fill('#000');
    doc.font('Helvetica-Bold').fontSize(14)
       .text('Your Recovery Key:', 75 + 20, boxY + 15);
    
    // Use the recovery key as-is without adding extra formatting
    doc.font('Courier-Bold').fontSize(24)
       .fillColor('#2c3e50')
       .text(recoveryKey, 75 + 20, boxY + 40, { align: 'center' });
    
    // Additional information
    doc.moveDown(4);
    doc.font('Helvetica').fontSize(12)
       .fillColor('#000')
       .text('Important: If you lose both your authentication device and this recovery key, you may permanently lose access to your account.');
    
    // Add bottom section with details
    doc.moveDown(1);
    const detailsY = doc.y;
    
    // Create a light gray box for details
    doc.rect(50, detailsY, doc.page.width - 100, 70)
       .fillAndStroke('#f8f9fa', '#e9ecef');
    
    // Add account details
    doc.fill('#000');
    doc.font('Helvetica-Bold').fontSize(12)
       .text('Account Information:', 70, detailsY + 15);
    
    doc.font('Helvetica').fontSize(11)
       .text(`Email: ${email}`, 70, detailsY + 35);
    
    doc.font('Helvetica').fontSize(11)
       .text(`Generated: ${formattedDate} at ${formattedTime}`, 70, detailsY + 55);
    
    // Add footer (on same page, reduced space)
    doc.moveDown(2);
    doc.font('Helvetica-Oblique').fontSize(10)
       .text('Prezio Inc. • Security & Privacy Team', { align: 'center' });
    
    doc.font('Helvetica').fontSize(8)
       .text('This document contains sensitive security information. Keep it confidential.', { align: 'center' });
    
    // Finalize the PDF
    doc.end();
    
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating recovery PDF:', error);
    doc.end();
    throw error;
  }
};

module.exports = generateRecoveryPDF;