const multer = require('multer');
const { templateStorage } = require('../config/cloudinary');

const uploadTemplate = multer({
  storage: templateStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html') {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = uploadTemplate;