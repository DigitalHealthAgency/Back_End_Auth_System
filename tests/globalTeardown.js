// ✅ GLOBAL TEARDOWN - Runs once after all tests

module.exports = async () => {
  // Stop MongoDB Memory Server
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
    console.log('\n🛑 MongoDB Memory Server stopped\n');
  }

  console.log('✅ Global Test Teardown Complete\n');
};
