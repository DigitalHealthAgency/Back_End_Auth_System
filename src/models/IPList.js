// models/IPList.js
const mongoose = require('mongoose');

const ipListSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Enhanced IP validation with proper IPv6 support
        return isValidIP(v);
      },
      message: 'Invalid IP address format'
    }
  },
  type: {
    type: String,
    enum: ['whitelist', 'blacklist'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // null means never expires
  },
  hitCount: {
    type: Number,
    default: 0 // Track how many times this IP rule was triggered
  },
  lastHit: {
    type: Date,
    default: null
  },
  metadata: {
    country: String,
    region: String,
    city: String,
    organization: String,
    // Additional metadata can be added here
  }
}, {
  timestamps: true
});

// Enhanced IP validation function
function isValidIP(ip) {
  // Check for CIDR notation first
  if (ip.includes('/')) {
    return isValidCIDR(ip);
  }
  
  // Check IPv4
  if (isValidIPv4(ip)) {
    return true;
  }
  
  // Check IPv6
  if (isValidIPv6(ip)) {
    return true;
  }
  
  return false;
}

function isValidIPv4(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  
  // Check each octet is between 0-255
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
}

function isValidIPv6(ip) {
  // Handle IPv6 with zone identifier (e.g., fe80::1%eth0)
  const cleanIp = ip.split('%')[0];
  
  // IPv6 can have various formats:
  // - Full format: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
  // - Compressed: 2001:db8:85a3::8a2e:370:7334
  // - Localhost: ::1
  // - All zeros: :: or 0:0:0:0:0:0:0:0
  // - IPv4-mapped IPv6: ::ffff:192.0.2.1
  
  // Basic structure check
  if (!/^[0-9a-fA-F:]+$/.test(cleanIp.replace(/\./g, ''))) {
    // Allow dots for IPv4-mapped IPv6 addresses
    if (!/^[0-9a-fA-F:.]+$/.test(cleanIp)) {
      return false;
    }
  }
  
  // Check for multiple :: (only one allowed)
  const doubleColonCount = (cleanIp.match(/::/g) || []).length;
  if (doubleColonCount > 1) {
    return false;
  }
  
  // Handle special cases
  if (cleanIp === '::' || cleanIp === '::1') {
    return true;
  }
  
  // Handle IPv4-mapped IPv6 (e.g., ::ffff:192.0.2.1)
  if (cleanIp.includes('.')) {
    const parts = cleanIp.split(':');
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) {
      // Validate the IPv4 part
      if (!isValidIPv4(lastPart)) {
        return false;
      }
      // Remove the IPv4 part for further validation
      const ipv6Part = cleanIp.substring(0, cleanIp.lastIndexOf(':'));
      if (ipv6Part && !isValidIPv6Pure(ipv6Part + ':0')) {
        return false;
      }
      return true;
    }
  }
  
  return isValidIPv6Pure(cleanIp);
}

function isValidIPv6Pure(ip) {
  let parts;
  
  if (ip.includes('::')) {
    // Handle compressed format
    const [left, right] = ip.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    
    // Total parts should not exceed 8
    const totalParts = leftParts.length + rightParts.length;
    if (totalParts > 8) {
      return false;
    }
    
    // Validate each part
    const allParts = [...leftParts, ...rightParts];
    return allParts.every(part => {
      if (part === '') return false;
      return /^[0-9a-fA-F]{1,4}$/.test(part);
    });
  } else {
    // Handle full format
    parts = ip.split(':');
    if (parts.length !== 8) {
      return false;
    }
    
    return parts.every(part => {
      return /^[0-9a-fA-F]{1,4}$/.test(part);
    });
  }
}

function isValidCIDR(cidr) {
  const [ip, mask] = cidr.split('/');
  const maskNum = parseInt(mask, 10);
  
  if (isNaN(maskNum)) {
    return false;
  }
  
  // IPv4 CIDR
  if (isValidIPv4(ip)) {
    return maskNum >= 0 && maskNum <= 32;
  }
  
  // IPv6 CIDR
  if (isValidIPv6(ip)) {
    return maskNum >= 0 && maskNum <= 128;
  }
  
  return false;
}

// Indexes for performance
ipListSchema.index({ ip: 1, type: 1 }, { unique: true });
ipListSchema.index({ type: 1, isActive: 1 });
ipListSchema.index({ expiresAt: 1 });
ipListSchema.index({ createdBy: 1 });
ipListSchema.index({ 'metadata.country': 1 });
ipListSchema.index({ hitCount: -1 });
ipListSchema.index({ lastHit: -1 });

// Virtual to check if entry is expired
ipListSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Add method to update reputation score
ipListSchema.methods.updateReputation = function(score) {
  if (!this.metadata) this.metadata = {};
  this.metadata.reputationScore = score;
  this.metadata.lastReputationUpdate = new Date();
  return this.save();
};

// Add method to check CIDR ranges more efficiently
ipListSchema.statics.findMatchingCIDRs = async function(ip) {
  const entries = await this.find({
    type: 'blacklist',
    isActive: true,
    ip: { $regex: /\// },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  return entries.filter(entry => isIPInCIDR(ip, entry.ip));
};

// Add method to handle temporary blocks
ipListSchema.statics.createTemporaryBlock = async function(ip, reason, duration, createdBy) {
  return await this.create({
    ip,
    type: 'blacklist',
    reason,
    expiresAt: new Date(Date.now() + duration * 60 * 1000),
    createdBy,
    isActive: true,
    metadata: {
      blockType: 'temporary',
      originalDuration: duration
    }
  });
};

// Method to increment hit count
ipListSchema.methods.recordHit = function() {
  this.hitCount += 1;
  this.lastHit = new Date();
  return this.save();
};

// Enhanced static method to check if IP is in a list (supports IP matching)
ipListSchema.statics.checkIP = async function(clientIP, type) {
  // First try exact match
  let entry = await this.findOne({
    ip: clientIP,
    type,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  if (entry) {
    await entry.recordHit();
    return entry;
  }
  
  // If no exact match, check CIDR ranges
  const entries = await this.find({
    type,
    isActive: true,
    ip: { $regex: /\// }, // Only get CIDR entries
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  for (const cidrEntry of entries) {
    if (isIPInCIDR(clientIP, cidrEntry.ip)) {
      await cidrEntry.recordHit();
      return cidrEntry;
    }
  }
  
  return null;
};

// Helper function to check if IP is in CIDR range
function isIPInCIDR(ip, cidr) {
  const [networkIP, maskBits] = cidr.split('/');
  const mask = parseInt(maskBits, 10);
  
  // For IPv4
  if (isValidIPv4(ip) && isValidIPv4(networkIP)) {
    const ipNum = ipv4ToNumber(ip);
    const networkNum = ipv4ToNumber(networkIP);
    const maskNum = (0xFFFFFFFF << (32 - mask)) >>> 0;
    
    return (ipNum & maskNum) === (networkNum & maskNum);
  }
  
  // For IPv6 (simplified - you might want to use a library like 'ip' for production)
  if (isValidIPv6(ip) && isValidIPv6(networkIP)) {
    // This is a simplified IPv6 CIDR check
    // In production, consider using libraries like 'ip' or 'ipaddr.js'
    return false; // Placeholder - implement full IPv6 CIDR logic if needed
  }
  
  return false;
}

function ipv4ToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// Static method to clean expired entries
ipListSchema.statics.cleanExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lte: new Date() }
  });
  return result.deletedCount;
};

// Static method to normalize IP (useful for consistent storage)
ipListSchema.statics.normalizeIP = function(ip) {
  // Convert IPv4-mapped IPv6 to IPv4 if needed
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    return ip.substring(7);
  }
  
  // Normalize IPv6 (expand :: and convert to lowercase)
  if (isValidIPv6(ip)) {
    return ip.toLowerCase();
  }
  
  return ip;
};

module.exports = mongoose.model('IPList', ipListSchema);