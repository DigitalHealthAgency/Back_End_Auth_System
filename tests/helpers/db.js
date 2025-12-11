//  DATABASE HELPERS FOR TESTS

const mongoose = require('mongoose');

/**
 * Connect to test database
 */
async function connectDB() {
  const uri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/huduma-hub-test';

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

/**
 * Disconnect from test database
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

/**
 * Clear all collections in test database
 */
async function clearDatabase() {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Drop entire test database
 */
async function dropDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
  }
}

/**
 * Clear specific collection
 */
async function clearCollection(collectionName) {
  const collection = mongoose.connection.collections[collectionName];
  if (collection) {
    await collection.deleteMany({});
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  clearDatabase,
  dropDatabase,
  clearCollection
};
