//  DHA RBAC ROLE MIGRATION SCRIPT
// Migrates users from old role system to new 9-role DHA RBAC system
// Run with: node scripts/migrateRoles.js

const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

// ============================================================================
// ROLE MAPPING CONFIGURATION
// ============================================================================

const ROLE_MIGRATION_MAP = {
  // Old Role → New Role
  'admin': 'dha_system_administrator',
  'user': 'public_user',
  'organization': 'vendor_developer',
  'reviewer': 'dha_certification_officer',

  // Board roles → Public user (not applicable to DHA certification)
  'chairperson': 'public_user',
  'vice_chairperson': 'public_user',
  'secretary': 'public_user',
  'treasurer': 'public_user',
  'board_member': 'public_user',
  'patron': 'public_user',
  'advisor': 'public_user',

  // Operational roles → Public user
  'project_manager': 'public_user',
  'field_officer': 'public_user',
  'm_and_e_officer': 'public_user',
  'donor': 'public_user',

  // Department roles → Public user
  'hr': 'public_user',
  'finance': 'public_user',
  'operations': 'public_user',
  'marketing': 'public_user',
  'it': 'public_user',
  'legal': 'public_user',
  'programs': 'public_user',
  'communications': 'public_user',

  // Management roles → Public user
  'ceo': 'public_user',
  'director': 'public_user',
  'manager': 'public_user',
  'coordinator': 'public_user',
  'officer': 'public_user',
  'assistant': 'public_user'
};

// ============================================================================
// SPECIAL HANDLING RULES
// ============================================================================

/**
 * Determine new role based on user context
 * Some users may need manual review or special handling
 */
function determineNewRole(user) {
  const oldRole = user.role;

  // Direct mapping
  if (ROLE_MIGRATION_MAP[oldRole]) {
    return {
      newRole: ROLE_MIGRATION_MAP[oldRole],
      confidence: 'high',
      reason: 'Direct mapping'
    };
  }

  // Contextual mapping for organizations
  if (user.type === 'organization') {
    // Check if user has technical vs compliance focus
    if (user.email && user.email.toLowerCase().includes('tech')) {
      return {
        newRole: 'vendor_technical_lead',
        confidence: 'medium',
        reason: 'Organization user with technical email'
      };
    }
    if (user.email && user.email.toLowerCase().includes('compliance')) {
      return {
        newRole: 'vendor_compliance_officer',
        confidence: 'medium',
        reason: 'Organization user with compliance email'
      };
    }
    return {
      newRole: 'vendor_developer',
      confidence: 'high',
      reason: 'Organization type user'
    };
  }

  // Default fallback
  return {
    newRole: 'public_user',
    confidence: 'low',
    reason: 'Unknown role, defaulting to public_user'
  };
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Main migration function
 */
async function migrateRoles() {
  console.log('='.repeat(80));
  console.log('DHA RBAC ROLE MIGRATION');
  console.log('='.repeat(80));
  console.log();

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/huduma-hub');
    console.log(' Connected to MongoDB\n');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to migrate\n`);

    // Statistics
    const stats = {
      total: users.length,
      migrated: 0,
      skipped: 0,
      needsReview: 0,
      errors: 0,
      byOldRole: {},
      byNewRole: {},
      needsReviewList: []
    };

    // Process each user
    for (const user of users) {
      try {
        const oldRole = user.role;

        // Count old roles
        stats.byOldRole[oldRole] = (stats.byOldRole[oldRole] || 0) + 1;

        // Determine new role
        const migration = determineNewRole(user);
        const newRole = migration.newRole;

        console.log(`[${user.email || user.organizationEmail || user.username}]`);
        console.log(`  Old Role: ${oldRole}`);
        console.log(`  New Role: ${newRole}`);
        console.log(`  Confidence: ${migration.confidence}`);
        console.log(`  Reason: ${migration.reason}`);

        // Flag for manual review if low confidence
        if (migration.confidence === 'low' || migration.confidence === 'medium') {
          stats.needsReview++;
          stats.needsReviewList.push({
            userId: user._id,
            email: user.email || user.organizationEmail,
            oldRole,
            suggestedRole: newRole,
            confidence: migration.confidence,
            reason: migration.reason
          });
          console.log(`    NEEDS MANUAL REVIEW\n`);
        } else {
          console.log(`   Migrated\n`);
        }

        // Update user role
        user.role = newRole;
        await user.save();

        // Count new roles
        stats.byNewRole[newRole] = (stats.byNewRole[newRole] || 0) + 1;

        stats.migrated++;

      } catch (userError) {
        console.error(`   Error migrating user:`, userError.message, '\n');
        stats.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Users: ${stats.total}`);
    console.log(`Successfully Migrated: ${stats.migrated}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Needs Manual Review: ${stats.needsReview}`);
    console.log();

    console.log('OLD ROLE DISTRIBUTION:');
    console.log('-'.repeat(80));
    for (const [role, count] of Object.entries(stats.byOldRole)) {
      console.log(`  ${role.padEnd(30)} → ${count}`);
    }
    console.log();

    console.log('NEW ROLE DISTRIBUTION:');
    console.log('-'.repeat(80));
    for (const [role, count] of Object.entries(stats.byNewRole)) {
      console.log(`  ${role.padEnd(30)} → ${count}`);
    }
    console.log();

    // Print users that need manual review
    if (stats.needsReviewList.length > 0) {
      console.log('USERS REQUIRING MANUAL REVIEW:');
      console.log('-'.repeat(80));
      for (const item of stats.needsReviewList) {
        console.log(`User: ${item.email}`);
        console.log(`  ID: ${item.userId}`);
        console.log(`  Old Role: ${item.oldRole}`);
        console.log(`  Suggested Role: ${item.suggestedRole}`);
        console.log(`  Confidence: ${item.confidence}`);
        console.log(`  Reason: ${item.reason}`);
        console.log();
      }

      // Write to file for manual review
      const fs = require('fs');
      fs.writeFileSync(
        'role_migration_review.json',
        JSON.stringify(stats.needsReviewList, null, 2)
      );
      console.log('📄 Users needing review written to: role_migration_review.json\n');
    }

    console.log('='.repeat(80));
    console.log(' MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log();

    console.log('NEXT STEPS:');
    console.log('1. Review users flagged for manual review');
    console.log('2. Update specific user roles if needed:');
    console.log('   node scripts/updateUserRole.js <userId> <newRole>');
    console.log('3. Verify permissions work correctly');
    console.log('4. Run tests: npm test tests/rbac/');
    console.log();

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error(' Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

/**
 * Rollback migration (restore old roles)
 */
async function rollbackMigration() {
  console.log('='.repeat(80));
  console.log('ROLLING BACK ROLE MIGRATION');
  console.log('  WARNING: This will attempt to restore old roles');
  console.log('='.repeat(80));
  console.log();

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/huduma-hub');
    console.log(' Connected to MongoDB\n');

    // This requires having saved old roles somewhere
    // For now, we'll just set everyone to 'user' as a safe default
    console.log('  Rollback not fully implemented');
    console.log('Manual intervention required to restore old roles');
    console.log('Consider restoring from database backup instead');
    console.log();

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error(' Rollback failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

/**
 * Preview migration without making changes
 */
async function previewMigration() {
  console.log('='.repeat(80));
  console.log('MIGRATION PREVIEW (DRY RUN)');
  console.log('='.repeat(80));
  console.log();

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/huduma-hub');
    console.log(' Connected to MongoDB\n');

    const users = await User.find({});
    console.log(`Found ${users.length} users\n`);

    const preview = {
      byOldRole: {},
      byNewRole: {},
      needsReview: []
    };

    for (const user of users) {
      const oldRole = user.role;
      const migration = determineNewRole(user);
      const newRole = migration.newRole;

      preview.byOldRole[oldRole] = (preview.byOldRole[oldRole] || 0) + 1;
      preview.byNewRole[newRole] = (preview.byNewRole[newRole] || 0) + 1;

      if (migration.confidence !== 'high') {
        preview.needsReview.push({
          email: user.email || user.organizationEmail,
          oldRole,
          newRole,
          confidence: migration.confidence
        });
      }
    }

    console.log('OLD → NEW ROLE MAPPING:');
    console.log('-'.repeat(80));
    for (const [oldRole, count] of Object.entries(preview.byOldRole)) {
      const newRole = ROLE_MIGRATION_MAP[oldRole] || 'public_user';
      console.log(`${oldRole.padEnd(30)} → ${newRole.padEnd(30)} (${count} users)`);
    }
    console.log();

    console.log(`Users needing review: ${preview.needsReview.length}`);
    console.log();

    console.log('Run with "node scripts/migrateRoles.js" to execute migration');
    console.log();

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error(' Preview failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

const command = process.argv[2];

switch (command) {
  case 'preview':
    previewMigration();
    break;

  case 'rollback':
    rollbackMigration();
    break;

  case undefined:
  case 'migrate':
    migrateRoles();
    break;

  default:
    console.log('Usage:');
    console.log('  node scripts/migrateRoles.js           - Run migration');
    console.log('  node scripts/migrateRoles.js preview   - Preview without changes');
    console.log('  node scripts/migrateRoles.js rollback  - Rollback migration');
    process.exit(1);
}
