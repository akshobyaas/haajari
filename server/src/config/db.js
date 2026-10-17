const mongoose = require('mongoose');

/**
 * Connects to MongoDB. Fails within 15 s if the database cannot be reached (wrong
 * MONGO_URI, Atlas IP list) instead of hanging, and logs later disconnects.
 */
async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected; retrying...'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  return mongoose.connection;
}

module.exports = { connectDB };
