/**
 * Script to update Safaricom organization with organizationType
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

async function updateSafaricomOrgType() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/dha_db';
    console.log('Connecting to MongoDB...');
    console.log('URI:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully!\n');

    // Find the Safaricom user by email
    const user = await User.findOne({
      $or: [
        { organizationEmail: 'maqueenl800@gmail.com' },
        { email: 'maqueenl800@gmail.com' }
      ]
    });

    if (!user) {
      console.error('Safaricom user (maqueenl800@gmail.com) not found!');
      console.log('\nSearching for all organization users...\n');

      const orgUsers = await User.find({ type: 'organization' }).select('organizationName organizationEmail organizationType');
      if (orgUsers.length > 0) {
        console.log('Found organization users:');
        orgUsers.forEach((u, idx) => {
          console.log(`${idx + 1}. ${u.organizationName} (${u.organizationEmail}) - Type: ${u.organizationType || 'NOT SET'}`);
        });
      } else {
        console.log('No organization users found in database!');
      }
      process.exit(1);
    }

    console.log('Found user:');
    console.log(`  Name: ${user.organizationName}`);
    console.log(`  Email: ${user.organizationEmail}`);
    console.log(`  Type: ${user.type}`);
    console.log(`  Current organizationType: ${user.organizationType || 'NOT SET'}\n`);

    // Update the organizationType
    user.organizationType = 'NPO'; // Default to NPO, user can change it later
    await user.save();

    console.log('✓ Successfully updated organizationType to: NPO');
    console.log('\nUser can now start organization registration!');

  } catch (error) {
    console.error('Error updating user:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Run the update function
updateSafaricomOrgType();
