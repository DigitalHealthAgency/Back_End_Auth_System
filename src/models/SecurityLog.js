const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g. "Password Changed", "Access Key Regenerated"
  details: { type: String },
  ip: { type: String },
  device: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SecurityLog', securityLogSchema);
