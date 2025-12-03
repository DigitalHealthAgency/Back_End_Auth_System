// ✅ GLOBAL SETUP - Runs once before all tests

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Start in-memory MongoDB for testing
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'huduma-hub-test'
    }
  });

  const uri = mongod.getUri();

  // Store for global teardown
  global.__MONGOD__ = mongod;
  process.env.MONGO_URI_TEST = uri;

  console.log('\n🚀 Global Test Setup Complete');
  console.log(`📦 MongoDB Memory Server started at: ${uri}\n`);
};
