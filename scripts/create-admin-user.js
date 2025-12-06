/**
 * Script to create an admin user for the DHA system
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
require('dotenv').config();

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => readline.question(query, resolve));
}

async function createAdminUser() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/dha_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully!\n');

    console.log('='.repeat(60));
    console.log('CREATE NEW ADMIN USER');
    console.log('='.repeat(60) + '\n');

    // Get admin details
    const firstName = await question('First Name: ');
    const lastName = await question('Last Name: ');
    const email = await question('Email: ');
    const username = await question('Username (optional, press Enter to skip): ');
    const password = await question('Password: ');

    console.log('\nSelect admin role:');
    console.log('1. admin - Basic admin role');
    console.log('2. reviewer - Reviewer role');
    console.log('3. dha_system_administrator - System administrator');
    console.log('4. dha_certification_officer - Certification officer');

    const roleChoice = await question('\nEnter choice (1-4): ');

    const roleMap = {
      '1': 'admin',
      '2': 'reviewer',
      '3': 'dha_system_administrator',
      '4': 'dha_certification_officer'
    };

    const role = roleMap[roleChoice] || 'admin';

    readline.close();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, ...(username ? [{ username }] : [])]
    });

    if (existingUser) {
      console.error('\n❌ Error: User with this email or username already exists!');
      process.exit(1);
    }

    // Hash password
    console.log('\nCreating admin user...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      type: 'individual',
      firstName,
      lastName,
      email,
      username: username || undefined,
      password: hashedPassword,
      role,
      isActive: true,
      emailVerified: true,
      accountStatus: 'active'
    });

    await user.save();

    console.log('\n' + '='.repeat(60));
    console.log('✓ SUCCESS! Admin user created successfully!');
    console.log('='.repeat(60));
    console.log('\nAdmin Details:');
    console.log(`  Name:     ${firstName} ${lastName}`);
    console.log(`  Email:    ${email}`);
    if (username) console.log(`  Username: ${username}`);
    console.log(`  Role:     ${role}`);
    console.log(`  Password: ${password}`);
    console.log('\n' + '='.repeat(60));
    console.log('You can now login with these credentials!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Run the function
createAdminUser();
