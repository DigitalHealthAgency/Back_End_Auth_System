/**
 * Script to fix user issues:
 * 1. Ensure county is set
 * 2. Disable 2FA if causing login issues
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

async function fixUserIssues() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/dha_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully!\n');

    // Find the most recent organization user
    const user = await User.findOne({
      organizationEmail: 'icp.smartprojects@gmail.com'
    });

    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }

    console.log('Found user:');
    console.log(`  Name: ${user.organizationName}`);
    console.log(`  Email: ${user.organizationEmail}`);
    console.log(`  County: ${user.county || 'NOT SET'}`);
    console.log(`  SubCounty: ${user.subCounty}`);
    console.log(`  OrganizationType: ${user.organizationType}`);
    console.log(`  2FA Enabled: ${user.twoFactorEnabled}`);
    console.log();

    let updated = false;

    // Fix county if missing
    if (!user.county && user.subCounty) {
      console.log('  County is missing but subCounty exists. Setting county based on subCounty...');
      // Funyula is in Busia County
      const countyMap = {
        'Funyula': 'Busia',
        'Mogotio': 'Baringo',
        'Rongai': 'Nakuru'
      };
      user.county = countyMap[user.subCounty] || 'Nairobi';
      console.log(` Set county to: ${user.county}`);
      updated = true;
    }

    // Disable 2FA if enabled (temporary fix for login issues)
    if (user.twoFactorEnabled) {
      console.log('  2FA is enabled. Disabling temporarily to fix login issues...');
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      console.log(' Disabled 2FA');
      updated = true;
    }

    if (updated) {
      await user.save();
      console.log('\n User updated successfully!');
    } else {
      console.log('\n No updates needed.');
    }

    console.log('\nFinal user state:');
    console.log(`  County: ${user.county}`);
    console.log(`  SubCounty: ${user.subCounty}`);
    console.log(`  2FA Enabled: ${user.twoFactorEnabled}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Run the function
fixUserIssues();
