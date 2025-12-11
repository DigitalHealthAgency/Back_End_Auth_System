// Migration script to update invalid user roles to valid DHA roles
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const ROLE_MIGRATION_MAP = {
  'user': 'public_user',
  'admin': 'dha_system_administrator',
  'organization': 'vendor_developer',
  'chairperson': 'public_user',
  'vice_chairperson': 'public_user',
  'secretary': 'public_user',
  'treasurer': 'public_user',
  'board_member': 'public_user',
  'patron': 'public_user',
  'advisor': 'public_user',
  'project_manager': 'public_user',
  'field_officer': 'public_user',
  'm_and_e_officer': 'public_user',
  'finance': 'public_user',
  'donor': 'public_user'
};

const VALID_DHA_ROLES = [
  'vendor_developer',
  'vendor_technical_lead',
  'vendor_compliance_officer',
  'dha_system_administrator',
  'dha_certification_officer',
  'testing_lab_staff',
  'certification_committee_member',
  'county_health_officer',
  'public_user'
];

async function migrateUserRoles() {
  try {
    console.log(' Starting user role migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log(' Connected to MongoDB\n');

    // Find all users
    const allUsers = await User.find({}).select('_id email organizationEmail username role type');
    console.log(` Found ${allUsers.length} total users\n`);

    let migratedCount = 0;
    let alreadyValidCount = 0;
    let errors = [];

    for (const user of allUsers) {
      const identifier = user.email || user.organizationEmail || user.username || user._id;

      // Check if role is valid
      if (VALID_DHA_ROLES.includes(user.role)) {
        alreadyValidCount++;
        console.log(` User ${identifier} already has valid role: ${user.role}`);
        continue;
      }

      // Map old role to new role
      const oldRole = user.role;
      const newRole = ROLE_MIGRATION_MAP[oldRole] || 'public_user';

      try {
        // Update directly using MongoDB update to bypass validation
        await mongoose.connection.collection('users').updateOne(
          { _id: user._id },
          { $set: { role: newRole } }
        );

        migratedCount++;
        console.log(` Migrated user ${identifier}: ${oldRole} → ${newRole}`);
      } catch (error) {
        errors.push({ user: identifier, error: error.message });
        console.error(` Failed to migrate user ${identifier}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(' MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users processed:     ${allUsers.length}`);
    console.log(`Already valid:             ${alreadyValidCount}`);
    console.log(`Successfully migrated:     ${migratedCount}`);
    console.log(`Errors:                    ${errors.length}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n Errors encountered:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. User: ${err.user}`);
        console.log(`   Error: ${err.error}\n`);
      });
    }

    if (migratedCount > 0) {
      console.log('\n Migration completed successfully!');
      console.log(' Please restart your application for changes to take effect.');
    } else {
      console.log('\n No migration needed - all users already have valid roles.');
    }

  } catch (error) {
    console.error('\n Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
migrateUserRoles();
