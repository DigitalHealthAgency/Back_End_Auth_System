/*
 *  The Bouncer of Your API Club 
 * 
 * This middleware is like that one friend who takes being a party bouncer WAY too seriously.
 * It checks IDs, maintains a naughty list, and remembers that one time you tried to sneak in
 * through the back door three months ago.
 * 
 * If your request looks suspicious, it will:
 * - Give you the "sorry, not tonight" treatment
 * - Put your IP in timeout like a misbehaving toddler
 * - Document your shenanigans with more detail than your ex on social media
 * 
 * Remember: On the internet, nobody knows you're a dog... except this middleware.
 * It probably knows your dog's breed, favorite treats, and social security number.
 * 
 * Last updated: When that one penetration tester cried
 */

// middleware/ipSecurityMiddleware.js
const IPList = require('../models/IPList');
const securityEvent = require('../models/securityEvent');
const User = require('../models/User');
const { logsecurityEvent } = require('../controllers/admin/securityController');

// Enhanced threat detection patterns
const THREAT_PATTERNS = {
  // VPN/Proxy providers (common ones)
  VPN_PROVIDERS: [
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'privateinternetaccess',
    'mullvad', 'protonvpn', 'windscribe', 'tunnelbear', 'hotspotshield'
  ],
  
  // Suspicious user agents
  SUSPICIOUS_USER_AGENTS: [
    'curl', 'wget', 'python-requests', 'postman', 'insomnia', 'httpie',
    'bot', 'crawler', 'scraper', 'automation', 'selenium', 'headless'
  ],
  
  // Common attack patterns in headers
  ATTACK_HEADERS: [
    'x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-remote-ip',
    'x-cluster-client-ip', 'cf-connecting-ip'
  ],
  
  // Rate limiting thresholds
  RATE_LIMITS: {
    SUSPICIOUS_THRESHOLD: 50,    // requests per 15 minutes
    CRITICAL_THRESHOLD: 100,     // requests per hour
    ACCOUNT_LOCK_THRESHOLD: 5,   // failed attempts per account
    IP_TEMP_BLOCK_THRESHOLD: 10, // failed attempts per IP
    GLOBAL_BLOCK_THRESHOLD: 25   // failed attempts across all accounts from IP
  }
};

// In-memory stores for advanced tracking
const requestTracking = new Map();
const ipReputationCache = new Map();
const accountSecurityState = new Map();

function isValidIP(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === '127.0.0.1';
}

function isLocalhostIP(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

// Enhanced helper function to get or create a system user ID
async function getSystemUserId() {
  try {
    let systemUser = await User.findOne({ email: 'system@auto-security.local' }).select('_id');
    
    if (!systemUser) {
      systemUser = await User.create({
        email: 'system@auto-security.local',
        username: 'system',
        name: 'System Auto-Security',
        password: 'N/A',
        isActive: false,
        role: 'admin',
        suspended: false
      });
    }
    
    return systemUser._id;
  } catch (error) {
    console.error('Error getting/creating system user:', error);
    return null;
  }
}

// Optimize threat detection
function detectThreatPatterns(req, clientIP, userAgent) {
  // Cache threat detection results
  const cacheKey = `threats:${clientIP}:${generateRequestFingerprint(req)}`;
  const cached = ipReputationCache.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const result = {
    threats: [],
    riskScore: { score: 0, factors: [] }
  };

  // Check for VPN/Proxy patterns
  const lowerUserAgent = (userAgent || '').toLowerCase();
  const vpnDetected = THREAT_PATTERNS.VPN_PROVIDERS.some(vpn => 
    lowerUserAgent.includes(vpn)
  );
  
  if (vpnDetected) {
    result.threats.push('VPN_DETECTED');
    result.riskScore.score += 30;
    result.riskScore.factors.push('VPN user agent detected');
  }

  // Check for suspicious user agents
  const suspiciousUA = THREAT_PATTERNS.SUSPICIOUS_USER_AGENTS.some(pattern =>
    lowerUserAgent.includes(pattern)
  );
  
  if (suspiciousUA) {
    result.threats.push('SUSPICIOUS_USER_AGENT');
    result.riskScore.score += 40;
    result.riskScore.factors.push('Automated tool detected');
  }

  // Check for multiple forwarded headers (proxy chains)
  const forwardedHeaders = THREAT_PATTERNS.ATTACK_HEADERS.filter(header =>
    req.headers[header]
  );
  
  if (forwardedHeaders.length > 2) {
    result.threats.push('PROXY_CHAIN_DETECTED');
    result.riskScore.score += 25;
    result.riskScore.factors.push('Multiple proxy headers detected');
  }

  // Check for IP hopping (rapid IP changes from same fingerprint)
  const fingerprint = generateRequestFingerprint(req);
  const ipHistory = getIPHistoryForFingerprint(fingerprint);
  
  if (ipHistory.length > 3) {
    result.threats.push('IP_HOPPING');
    result.riskScore.score += 35;
    result.riskScore.factors.push('Rapid IP address changes detected');
  }

  // Check for missing common headers
  const commonHeaders = ['accept', 'accept-language', 'accept-encoding'];
  const missingHeaders = commonHeaders.filter(header => !req.headers[header]);
  
  if (missingHeaders.length > 1) {
    result.threats.push('MISSING_HEADERS');
    result.riskScore.score += 15;
    result.riskScore.factors.push('Uncommon header pattern');
  }

  // Check for Tor exit nodes (basic pattern matching)
  if (clientIP.match(/^(185\.220\.|199\.87\.|23\.129\.)/)) {
    result.threats.push('TOR_EXIT_NODE');
    result.riskScore.score += 50;
    result.riskScore.factors.push('Tor exit node detected');
  }

  // Cache for 5 minutes
  ipReputationCache.set(cacheKey, result, {
    ttl: 5 * 60 * 1000
  });

  return result;
}

// Generate request fingerprint for tracking
function generateRequestFingerprint(req) {
  const components = [
    req.headers['accept'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['user-agent'] || '',
    req.headers['sec-ch-ua'] || '',
    req.headers['sec-ch-ua-platform'] || ''
  ];
  
  return require('crypto')
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
}

// Track IP history for fingerprints
function getIPHistoryForFingerprint(fingerprint) {
  const key = `fingerprint:${fingerprint}`;
  const history = requestTracking.get(key) || [];
  
  // Clean old entries (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return history.filter(entry => entry.timestamp > oneHourAgo);
}

function updateIPHistoryForFingerprint(fingerprint, ip) {
  const key = `fingerprint:${fingerprint}`;
  const history = getIPHistoryForFingerprint(fingerprint);
  
  // Add new entry if IP is different from the last one
  if (history.length === 0 || history[history.length - 1].ip !== ip) {
    history.push({ ip, timestamp: Date.now() });
  }
  
  requestTracking.set(key, history);
}

// Enhanced helper function to extract email from request
function extractEmailFromRequest(req) {
  // Check body first (most common for login requests)
  if (req.body?.email) return req.body.email.toLowerCase().trim();
  
  // Check for username that looks like email
  if (req.body?.username && req.body.username.includes('@')) {
    return req.body.username.toLowerCase().trim();
  }
  
  // Check query parameters
  if (req.query?.email) return req.query.email.toLowerCase().trim();
  
  // Check authenticated user
  if (req.user?.email) return req.user.email.toLowerCase().trim();
  
  // Check custom headers
  if (req.headers['x-user-email']) return req.headers['x-user-email'].toLowerCase().trim();
  
  // Check for other common email fields
  if (req.body?.userEmail) return req.body.userEmail.toLowerCase().trim();
  if (req.body?.emailAddress) return req.body.emailAddress.toLowerCase().trim();
  
  return null;
}

// Account-based security state management
async function getAccountSecurityState(email) {
  if (!email) return null;
  
  const key = `account:${email}`;
  let state = accountSecurityState.get(key);
  
  if (!state) {
    // Initialize from database
    const recentFailures = await securityEvent.countDocuments({
      targetEmail: email,
      action: 'Failed Login',
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    });
    
    state = {
      failedAttempts: recentFailures,
      lastFailure: null,
      lockoutUntil: null,
      suspiciousIPs: new Set(),
      riskScore: 0
    };
    
    accountSecurityState.set(key, state);
  }
  
  return state;
}

async function updateAccountSecurityState(email, update) {
  if (!email) return;
  
  const key = `account:${email}`;
  const state = await getAccountSecurityState(email);
  
  Object.assign(state, update);
  accountSecurityState.set(key, state);
}

// Main IP security check middleware
exports.checkIPSecurity = async (req, res, next) => {
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  try {
    // Cache blacklist check results
    const cacheKey = `blacklist:${clientIP}`;
    let blacklistedIP = ipReputationCache.get(cacheKey);
    
    if (!blacklistedIP) {
      blacklistedIP = await IPList.findOne({
        ip: clientIP,
        type: 'blacklist',
        isActive: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });
      
      // Cache for 5 minutes
      ipReputationCache.set(cacheKey, blacklistedIP || false, {
        ttl: 5 * 60 * 1000
      });
    }

    if (blacklistedIP) {
      const targetEmail = extractEmailFromRequest(req);
      
      await securityEvent.createEvent({
        user: req.user?._id || null,
        targetEmail: targetEmail,
        action: 'IP Blocked',
        severity: 'high',
        ip: clientIP,
        device: userAgent,
        details: {
          reason: blacklistedIP.reason,
          ruleId: blacklistedIP._id,
          attemptedEmail: targetEmail,
          blockType: 'permanent'
        }
      });

      return res.status(403).json({
        message: 'Access denied. Your IP address has been blocked.',
        code: 'IP_BLOCKED',
        retryAfter: blacklistedIP.expiresAt ? Math.ceil((blacklistedIP.expiresAt - new Date()) / 1000) : null
      });
    }

    // For enterprise routes, check whitelist
    if (req.path.includes('/enterprise') || req.headers['x-require-whitelist']) {
      const whitelistedIP = await IPList.findOne({
        ip: clientIP,
        type: 'whitelist',
        isActive: true
      });
      
      if (!whitelistedIP) {
        const targetEmail = extractEmailFromRequest(req);
        
        await securityEvent.createEvent({
          user: req.user?._id || null,
          targetEmail: targetEmail,
          action: 'IP Blocked',
          severity: 'medium',
          ip: clientIP,
          device: userAgent,
          details: {
            reason: 'IP not in whitelist for enterprise access',
            requiresWhitelist: true,
            attemptedEmail: targetEmail
          }
        });

        return res.status(403).json({
          message: 'Access denied. Your IP address is not authorized for enterprise access.',
          code: 'IP_NOT_WHITELISTED'
        });
      }
    }

    req.clientIP = clientIP;
    next();

  } catch (error) {
    console.error('IP security check error:', error);
    req.clientIP = clientIP;
    next();
  }
};

// Advanced WAF-style protection middleware
exports.advancedThreatDetection = async (req, res, next) => {
  const clientIP = req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const targetEmail = extractEmailFromRequest(req);
  
  try {
    // Generate and track fingerprint
    const fingerprint = generateRequestFingerprint(req);
    updateIPHistoryForFingerprint(fingerprint, clientIP);
    
    // Detect threat patterns
    const { threats, riskScore } = detectThreatPatterns(req, clientIP, userAgent);
    
    // High-risk request handling
    if (riskScore.score >= 70) {
      await securityEvent.createEvent({
        user: req.user?._id || null,
        targetEmail: targetEmail,
        action: 'High Risk Request Blocked',
        severity: 'critical',
        ip: clientIP,
        device: userAgent,
        details: {
          threats: threats,
          riskScore: riskScore.score,
          riskFactors: riskScore.factors,
          fingerprint: fingerprint,
          targetEmail: targetEmail
        }
      });

      // Temporary IP block for high-risk requests
      if (riskScore.score >= 80) {
        const systemUserId = await getSystemUserId();
        if (systemUserId) {
          await IPList.create({
            ip: clientIP,
            type: 'blacklist',
            reason: `Auto-blocked: High-risk request (Score: ${riskScore.score}, Threats: ${threats.join(', ')})`,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            createdBy: systemUserId,
            isActive: true
          });
        }
      }

      return res.status(429).json({
        message: 'Request blocked due to suspicious activity patterns.',
        code: 'HIGH_RISK_BLOCKED',
        retryAfter: 3600
      });
    }
    
    // Medium-risk request throttling
    if (riskScore.score >= 40) {
      // Add artificial delay for suspicious requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await securityEvent.createEvent({
        user: req.user?._id || null,
        targetEmail: targetEmail,
        action: 'Suspicious Activity Detected',
        severity: 'medium',
        ip: clientIP,
        device: userAgent,
        details: {
          threats: threats,
          riskScore: riskScore.score,
          riskFactors: riskScore.factors,
          targetEmail: targetEmail,
          action: 'throttled'
        }
      });
    }

    // Store risk assessment for other middlewares
    req.riskAssessment = { threats, riskScore };
    next();

  } catch (error) {
    console.error('Advanced threat detection error:', error);
    next();
  }
};

// Enhanced suspicious activity detection with account protection
// Updated detectSuspiciousActivity middleware (simplified since account suspension is now in login)
exports.detectSuspiciousActivity = async (req, res, next) => {
  const clientIP = req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const targetEmail = extractEmailFromRequest(req);

  try {
    // Check if IP is already blocked (this runs for all routes using this middleware)
    const existingBlock = await IPList.findOne({
      ip: clientIP,
      type: 'blacklist',
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (existingBlock) {
      await securityEvent.createEvent({
        user: req.user?._id || null,
        targetEmail: targetEmail,
        action: 'Blocked IP Access Attempt',
        severity: 'high',
        ip: clientIP,
        device: userAgent,
        details: {
          reason: existingBlock.reason,
          blockedUntil: existingBlock.expiresAt,
          targetEmail: targetEmail
        }
      });

      return res.status(429).json({
        message: 'Access temporarily blocked.',
        code: 'IP_BLOCKED',
        retryAfter: Math.floor((existingBlock.expiresAt - new Date()) / 1000)
      });
    }

    // Global threat detection (for patterns across the entire system)
    const globalFailures = await securityEvent.countDocuments({
      ip: clientIP,
      action: { $in: ['Failed Login', 'Multiple Failed Attempts'] },
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });

    if (globalFailures >= THREAT_PATTERNS.RATE_LIMITS.GLOBAL_BLOCK_THRESHOLD) {
      await securityEvent.createEvent({
        user: req.user?._id || null,
        targetEmail: targetEmail,
        action: 'Global Threat Detected',
        severity: 'critical',
        ip: clientIP,
        device: userAgent,
        details: {
          globalFailures: globalFailures,
          timeWindow: '1 hour',
          targetEmail: targetEmail,
          riskAssessment: req.riskAssessment
        }
      });

      // Could implement additional blocking logic here for severe global threats
      // For now, just log and continue
    }

    next();

  } catch (error) {
    console.error('Suspicious activity detection error:', error);
    next(); // Continue even if security check fails
  }
};

// Enhanced rate limiting with adaptive thresholds
exports.adaptiveRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    baseMax = 100,
    burst = 20
  } = options;

  return async (req, res, next) => {
    const clientIP = req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get current rate limit data
    const key = `rate:${clientIP}`;
    let rateLimitData = requestTracking.get(key) || {
      requests: [],
      violations: 0,
      lastViolation: null
    };

    // Clean old requests
    rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);

    // Calculate adaptive max based on risk and violations
    let adaptiveMax = baseMax;
    const riskScore = req.riskAssessment?.riskScore?.score || 0;
    
    if (riskScore > 40) adaptiveMax = Math.floor(baseMax * 0.5);
    if (riskScore > 70) adaptiveMax = Math.floor(baseMax * 0.2);
    if (rateLimitData.violations > 3) adaptiveMax = Math.floor(baseMax * 0.3);

    // Check burst protection
    const recentRequests = rateLimitData.requests.filter(timestamp => timestamp > now - 60000); // Last minute
    if (recentRequests.length > burst) {
      rateLimitData.violations++;
      rateLimitData.lastViolation = now;
      
      const targetEmail = extractEmailFromRequest(req);
      await securityEvent.createEvent({
        user: req.user?._id || null,
        targetEmail: targetEmail,
        action: 'Rate Limit Violation',
        severity: 'medium',
        ip: clientIP,
        device: req.headers['user-agent'] || 'Unknown',
        details: {
          requestsInWindow: rateLimitData.requests.length,
          burstRequests: recentRequests.length,
          adaptiveMax: adaptiveMax,
          violations: rateLimitData.violations
        }
      });

      return res.status(429).json({
        message: 'Rate limit exceeded. Please slow down your requests.',
        retryAfter: 60,
        limit: adaptiveMax,
        remaining: 0
      });
    }

    // Add current request
    rateLimitData.requests.push(now);

    // Check main rate limit
    if (rateLimitData.requests.length > adaptiveMax) {
      rateLimitData.violations++;
      return res.status(429).json({
        message: 'Rate limit exceeded.',
        retryAfter: Math.ceil(windowMs / 1000),
        limit: adaptiveMax,
        remaining: 0
      });
    }

    // Update tracking
    requestTracking.set(key, rateLimitData);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': adaptiveMax,
      'X-RateLimit-Remaining': Math.max(0, adaptiveMax - rateLimitData.requests.length),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
      'X-RateLimit-Adaptive': riskScore > 0 ? 'true' : 'false'
    });

    next();
  };
};

// Middleware specifically for tracking failed login attempts
exports.trackFailedLogin = async (req, res, next) => {
  const clientIP = req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const targetEmail = extractEmailFromRequest(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  try {
    let targetUserId = null;
    if (targetEmail) {
      try {
        // Support both individual and organization accounts
        const user = await User.findOne({
          $or: [
            { email: targetEmail },
            { organizationEmail: targetEmail }
          ]
        }).select('_id suspended');
        targetUserId = user?._id || null;
        
        // Update account security state
        if (user) {
          const accountState = await getAccountSecurityState(targetEmail);
          accountState.failedAttempts++;
          accountState.lastFailure = Date.now();
          accountState.suspiciousIPs.add(clientIP);
          
          await updateAccountSecurityState(targetEmail, accountState);
        }
      } catch (userLookupError) {
        console.warn('Failed to lookup user for failed login tracking:', userLookupError);
      }
    }

    await securityEvent.createEvent({
      user: targetUserId,
      targetEmail: targetEmail,
      action: 'Failed Login',
      severity: 'medium',
      ip: clientIP,
      device: userAgent,
      details: {
        reason: 'Invalid credentials',
        attemptedEmail: targetEmail,
        loginMethod: req.body?.loginMethod || 'password',
        riskAssessment: req.riskAssessment
      }
    });

    next();
  } catch (error) {
    console.error('Failed login tracking error:', error);
    next();
  }
};

// Cleanup function to run periodically
exports.cleanupSecurityTracking = () => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  // Clean request tracking
  for (const [key, data] of requestTracking.entries()) {
    if (key.startsWith('rate:')) {
      data.requests = data.requests.filter(timestamp => timestamp > oneHourAgo);
      if (data.requests.length === 0 && (!data.lastViolation || data.lastViolation < oneHourAgo)) {
        requestTracking.delete(key);
      }
    } else if (key.startsWith('fingerprint:')) {
      const filtered = data.filter(entry => entry.timestamp > oneHourAgo);
      if (filtered.length === 0) {
        requestTracking.delete(key);
      } else {
        requestTracking.set(key, filtered);
      }
    }
  }
  
  // Clean IP reputation cache
  for (const [ip, data] of ipReputationCache.entries()) {
    if (data.lastUpdated < oneHourAgo) {
      ipReputationCache.delete(ip);
    }
  }
  
  // Clean account security state (but keep recent failures)
  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  for (const [email, state] of accountSecurityState.entries()) {
    if (!state.lastFailure || state.lastFailure < thirtyMinutesAgo) {
      state.failedAttempts = Math.max(0, state.failedAttempts - 1);
      if (state.failedAttempts === 0 && state.suspiciousIPs.size === 0) {
        accountSecurityState.delete(email);
      }
    }
  }
  
  console.log('Security tracking cleanup completed');
};

// Start cleanup interval
setInterval(exports.cleanupSecurityTracking, 10 * 60 * 1000); // Every 10 minutes

module.exports = exports;