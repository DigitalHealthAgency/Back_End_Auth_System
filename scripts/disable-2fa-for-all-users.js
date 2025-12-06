// Script to disable 2FA for all users or specific users
// Run this if users are blocked by 2FA

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const disable2FAForAllUsers = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Disable 2FA for all users
    const result = await User.updateMany(
      {},
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSetupRequired: false,
          twoFactorSecret: null,
          twoFactorTempSecret: null
        }
      }
    );

    console.log(`✅ Successfully disabled 2FA for ${result.modifiedCount} users`);

    // Show users who had 2FA enabled
    const users = await User.find({}).select('email username googleId');
    console.log('\nUsers in database:');
    users.forEach(user => {
      console.log(`- ${user.email || user.username} ${user.googleId ? '(Google)' : '(Password)'}`);
    });

    mongoose.connection.close();
    console.log('\n✅ Done! All users can now login without 2FA.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

disable2FAForAllUsers();
