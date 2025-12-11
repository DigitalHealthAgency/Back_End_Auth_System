//  USER TEST FIXTURES

const bcrypt = require('bcryptjs');

/**
 * Valid individual user data
 */
const validIndividualUser = {
  type: 'individual',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  email: 'testuser@example.com',
  phone: '+254712345678',
  password: 'TestPassword123!',
  receiveSystemAlerts: true
};

/**
 * Valid organization user data
 */
const validOrganizationUser = {
  type: 'organization',
  organizationName: 'Test Health System',
  organizationType: 'HOSPITAL',
  county: 'Nairobi',
  subCounty: 'Westlands',
  organizationEmail: 'contact@testhealthsystem.com',
  organizationPhone: '+254712345679',
  yearOfEstablishment: 2020,
  password: 'OrgPassword123!',
  receiveSystemAlerts: false
};

/**
 * Invalid user data (missing required fields)
 */
const invalidUser = {
  type: 'individual',
  username: 'invalid',
  // Missing required fields
};

/**
 * User with weak password (meets length but fails complexity)
 */
const userWithWeakPassword = {
  ...validIndividualUser,
  email: 'weakpassword@example.com',
  password: 'weakpassword123' // 15 chars but lacks uppercase and special char
};

/**
 * User with password less than 12 characters
 */
const userWithShortPassword = {
  ...validIndividualUser,
  email: 'shortpw@example.com',
  password: 'Short123!' // Only 9 characters
};

/**
 * User with invalid email
 */
const userWithInvalidEmail = {
  ...validIndividualUser,
  email: 'invalid-email' // No @ or domain
};

/**
 * User with invalid phone
 */
const userWithInvalidPhone = {
  ...validIndividualUser,
  email: 'invalidphone@example.com',
  phone: '123456' // Not Kenyan format
};

/**
 * Hashed password helper
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 4); // Low rounds for testing
}

/**
 * Create user with hashed password
 */
async function createUserWithHashedPassword(userData) {
  return {
    ...userData,
    password: await hashPassword(userData.password)
  };
}

/**
 * Multiple test users for bulk operations
 */
const testUsers = [
  {
    ...validIndividualUser,
    username: 'user1',
    email: 'user1@example.com',
    role: 'vendor_developer'
  },
  {
    ...validIndividualUser,
    username: 'user2',
    email: 'user2@example.com',
    role: 'dha_certification_officer'
  },
  {
    ...validIndividualUser,
    username: 'user3',
    email: 'user3@example.com',
    role: 'testing_lab_staff'
  },
  {
    ...validIndividualUser,
    username: 'user4',
    email: 'user4@example.com',
    role: 'certification_committee_member'
  },
  {
    ...validIndividualUser,
    username: 'user5',
    email: 'user5@example.com',
    role: 'dha_system_administrator'
  }
];

module.exports = {
  validIndividualUser,
  validOrganizationUser,
  invalidUser,
  userWithWeakPassword,
  userWithShortPassword,
  userWithInvalidEmail,
  userWithInvalidPhone,
  hashPassword,
  createUserWithHashedPassword,
  testUsers
};
