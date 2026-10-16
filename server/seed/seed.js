const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { seed } = require('./seedData');

(async () => {
  await connectDB(env.mongoUri);
  await seed();
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
