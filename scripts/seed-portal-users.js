/**
 * Seed Script for DHA Portal Users
 * Creates test users for all 9 roles
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
require('dotenv').config();

// Test credentials for all 9 user roles
const testUsers = [
  {
    type: 'individual',
    firstName: 'John',
    lastName: 'Developer',
    email: 'vendor.dev@dha.test',
    username: 'vendor_dev',
    password: 'Password123!',
    role: 'vendor_developer',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Sarah',
    lastName: 'TechLead',
    email: 'vendor.lead@dha.test',
    username: 'vendor_lead',
    password: 'Password123!',
    role: 'vendor_technical_lead',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Mike',
    lastName: 'Compliance',
    email: 'vendor.compliance@dha.test',
    username: 'vendor_comp',
    password: 'Password123!',
    role: 'vendor_compliance_officer',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Admin',
    lastName: 'System',
    email: 'admin@dha.test',
    username: 'dha_admin',
    password: 'Password123!',
    role: 'dha_system_administrator',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Cert',
    lastName: 'Officer',
    email: 'cert.officer@dha.test',
    username: 'cert_officer',
    password: 'Password123!',
    role: 'dha_certification_officer',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Lab',
    lastName: 'Staff',
    email: 'lab.staff@dha.test',
    username: 'lab_staff',
    password: 'Password123!',
    role: 'testing_lab_staff',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Committee',
    lastName: 'Member',
    email: 'committee@dha.test',
    username: 'committee_member',
    password: 'Password123!',
    role: 'certification_committee_member',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'County',
    lastName: 'Officer',
    email: 'county@dha.test',
    username: 'county_officer',
    password: 'Password123!',
    role: 'county_health_officer',
    isActive: true,
    emailVerified: true
  },
  {
    type: 'individual',
    firstName: 'Public',
    lastName: 'User',
    email: 'public@dha.test',
    username: 'public_user',
    password: 'Password123!',
    role: 'public_user',
    isActive: true,
    emailVerified: true
  }
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27018/dha_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully!');

    // Clear existing test users
    console.log('\nClearing existing test users...');
    await User.deleteMany({ email: { $regex: /@dha\.test$/ } });
    console.log('Existing test users cleared!');

    // Create new test users
    console.log('\nCreating test users...');
    for (const userData of testUsers) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      const user = new User({
        ...userData,
        password: hashedPassword
      });

      await user.save();
      console.log(` Created: ${userData.email} (${userData.role})`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUCCESS! Test users created successfully!');
    console.log('='.repeat(80));
    console.log('\nTest Credentials (All passwords: Password123!):');
    console.log('='.repeat(80));

    testUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.role.toUpperCase().replace(/_/g, ' ')}`);
      console.log(`   Email:    ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Portal:   /${user.role.startsWith('vendor') ? 'vendor' :
        user.role === 'dha_system_administrator' ? 'admin' :
          user.role === 'dha_certification_officer' ? 'certification' :
            user.role === 'testing_lab_staff' ? 'lab' :
              user.role === 'certification_committee_member' ? 'committee' :
                user.role === 'county_health_officer' ? 'county' : 'public'}-portal`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('You can now login with any of these credentials!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Run the seed function
seedUsers();
