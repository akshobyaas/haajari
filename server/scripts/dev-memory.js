// Runs the API against a throwaway in-memory MongoDB, seeded with the demo school.
// Use this when MongoDB is not installed. Data resets every time you restart.
const { MongoMemoryServer } = require('mongodb-memory-server');
const env = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const { seed } = require('../seed/seedData');
const { startJobs } = require('../src/jobs');

(async () => {
  console.log('Starting in-memory MongoDB (first run downloads it, about 1 minute)...');
  const mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri('haajari'));
  await seed();
  createApp().listen(env.port, () => console.log(`Haajari API (in-memory DB) on http://localhost:${env.port}`));
  startJobs();
  const stop = async () => { await mongod.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
