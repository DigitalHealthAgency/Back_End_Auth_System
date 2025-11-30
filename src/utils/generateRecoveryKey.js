// src/utils/generateRecoveryKey.js
const crypto = require('crypto');

/**
 * Generates a user-friendly recovery key in format: XXXX-XXXX-XXXX-XXXX
 * * The key consists of 4 groups of 4 alphanumeric characters, excluding ambiguous characters.
 */
const generateRecoveryKey = () => {
  // Create 4 groups of 4 alphanumeric characters (excluding ambiguous characters)
  const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like O/0, I/1
  let key = '';
  
  // Generate 4 groups of 4 characters
  for (let group = 0; group < 4; group++) {
    for (let i = 0; i < 4; i++) {
      const randomIndex = crypto.randomInt(0, allowedChars.length);
      key += allowedChars[randomIndex];
    }
    
    // Add hyphen between groups (except after the last group)
    if (group < 3) {
      key += '-';
    }
  }
  
  return key; // Format: XXXX-XXXX-XXXX-XXXX
};

module.exports = generateRecoveryKey;