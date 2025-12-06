/**
 * Script to create two specific admin users for the DHA system
 * Email 1: ianmathew186@gmail.com
 * Email 2: icp.smartprojects@gmail.com
 * Both with password: Admin123!
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
require('dotenv').config();

async function createTwoAdmins() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/dha_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB successfully!\n');

    console.log('='.repeat(70));
    console.log('CREATING TWO ADMIN USERS');
    console.log('='.repeat(70) + '\n');

    const password = 'Admin123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admins = [
      {
        type: 'individual',
        firstName: 'Ian',
        lastName: 'Mathew',
        email: 'ianmathew186@gmail.com',
        username: 'ianmathew',
        password: hashedPassword,
        role: 'dha_system_administrator',
        isActive: true,
        emailVerified: true,
        accountStatus: 'active',
        twoFactorEnabled: false
      },
      {
        type: 'individual',
        firstName: 'ICP',
        lastName: 'Smart Projects',
        email: 'icp.smartprojects@gmail.com',
        username: 'icpsmartprojects',
        password: hashedPassword,
        role: 'dha_system_administrator',
        isActive: true,
        emailVerified: true,
        accountStatus: 'active',
        twoFactorEnabled: false
      }
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const adminData of admins) {
      // Check if user exists
      const existingUser = await User.findOne({ email: adminData.email });

      if (existingUser) {
        // Update existing user to make them admin
        console.log(`\n📝 User exists: ${adminData.email}`);
        console.log('   Updating to system administrator...');

        existingUser.role = 'dha_system_administrator';
        existingUser.password = hashedPassword;
        existingUser.accountStatus = 'active';
        existingUser.isActive = true;
        existingUser.emailVerified = true;
        existingUser.twoFactorEnabled = false;

        await existingUser.save();

        console.log(`   ✓ Updated: ${adminData.firstName} ${adminData.lastName}`);
        console.log(`   Email:    ${adminData.email}`);
        console.log(`   Username: ${existingUser.username}`);
        console.log(`   Role:     ${existingUser.role}`);
        console.log(`   Password: Admin123!`);

        updatedCount++;
      } else {
        // Create new user
        console.log(`\n✨ Creating new user: ${adminData.email}`);

        const user = new User(adminData);
        await user.save();

        console.log(`   ✓ Created: ${adminData.firstName} ${adminData.lastName}`);
        console.log(`   Email:    ${adminData.email}`);
        console.log(`   Username: ${adminData.username}`);
        console.log(`   Role:     ${adminData.role}`);
        console.log(`   Password: Admin123!`);

        createdCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✓ SUCCESS! ADMIN USERS READY!');
    console.log('='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`   • Created: ${createdCount} new admin(s)`);
    console.log(`   • Updated: ${updatedCount} existing user(s) to admin`);
    console.log(`   • Total:   ${createdCount + updatedCount} system administrators`);

    console.log('\n🎯 Login Credentials:');
    console.log('─'.repeat(70));
    console.log('\n1️⃣  First Admin:');
    console.log('   Email:    ianmathew186@gmail.com');
    console.log('   Username: ianmathew');
    console.log('   Password: Admin123!');
    console.log('   Role:     DHA System Administrator');

    console.log('\n2️⃣  Second Admin:');
    console.log('   Email:    icp.smartprojects@gmail.com');
    console.log('   Username: icpsmartprojects');
    console.log('   Password: Admin123!');
    console.log('   Role:     DHA System Administrator');

    console.log('\n' + '='.repeat(70));
    console.log('🚀 You can now login at: http://localhost:5173/login');
    console.log('📍 Both accounts will redirect to: /admin-dashboard');
    console.log('='.repeat(70));
    console.log('\n😊 READY TO SMILE! All set up successfully! 🎉\n');

  } catch (error) {
    console.error('\n❌ Error creating admin users:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.\n');
    process.exit(0);
  }
}

// Run the function
createTwoAdmins();
