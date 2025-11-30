const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// GET /recovery/:filename → serve PDF from /temp
router.get('/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, '..', 'temp', fileName);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Recovery PDF not found or expired.' });
  }

  try {
    // Get file stats for Content-Length header
    const stat = fs.statSync(filePath);
    
    // Set appropriate headers manually
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stat.size);
    
    // Stream the file with explicit error handling
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading recovery key.' });
      } else {
        res.end();
      }
    });
    
    // Pipe file to response
    fileStream.pipe(res)
      .on('error', (error) => {
        console.error('Error in pipe:', error);
      })
      .on('finish', () => {
        // Optionally: If you want to delete the file after download
        // Uncomment the next 3 lines if you want to delete the file after serving
        /*
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete temporary PDF file:', err);
        });
        */
      });
  } catch (error) {
    console.error('PDF serving error:', error);
    res.status(500).json({ message: 'Error processing recovery key file.' });
  }
});

module.exports = router;