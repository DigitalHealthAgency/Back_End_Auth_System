const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: String,
  description: String,
  fileName: String, // e.g., 'modern.hbs', 'classic.hbs'
  previewImageUrl: String, // to show in UI
  fileUrl: String,        // Cloudinary URL
  public_id: String,      // Cloudinary public ID
  type: String
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
