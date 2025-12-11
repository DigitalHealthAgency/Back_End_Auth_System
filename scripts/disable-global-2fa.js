/**
 * Script to disable global 2FA requirement
 */

const mongoose = require('mongoose');
const SystemSettings = require('../src/models/SystemSettings');
require('dotenv').config();

async function disableGlobal2FA() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/dha_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully!\n');

    // Get current settings
    let settings = await SystemSettings.findOne({});
    
    if (!settings) {
      console.log('No system settings found. Creating default settings...');
      settings = new SystemSettings({
        require2FA: false,
        maxLoginAttempts: 5,
        lockoutDuration: 30
      });
    }

    console.log('Current settings:');
    console.log(`  require2FA: ${settings.require2FA}`);
    console.log(`  maxLoginAttempts: ${settings.maxLoginAttempts}`);
    console.log(`  lockoutDuration: ${settings.lockoutDuration}`);
    console.log();

    if (settings.require2FA) {
      console.log('  Global 2FA is ENABLED. Disabling it now...');
      settings.require2FA = false;
      await settings.save();
      console.log(' Global 2FA disabled successfully!');
    } else {
      console.log(' Global 2FA is already disabled.');
    }

    console.log('\nFinal settings:');
    console.log(`  require2FA: ${settings.require2FA}`);

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
disableGlobal2FA();
