const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { startWorkers } = require('./workers/alerts');

(async () => {
  try {
    await connectDB(env.mongoUri);
    // First start on an empty database (e.g. a fresh Atlas cluster): load the demo school.
    if (process.env.SEED_ON_EMPTY === 'true' && !(await require('./models').School.exists({}))) {
      console.log('Empty database: loading the demo school...');
      await require('../seed/seedData').seed();
    }
    await require('./utils/approver').ensureApprover({
      email: process.env.SUPERADMIN_EMAIL, password: process.env.SUPERADMIN_PASSWORD, name: process.env.SUPERADMIN_NAME,
    });
    createApp().listen(env.port, () => console.log(`Haajari API on http://localhost:${env.port}`));
    startWorkers();
  } catch (err) {
    console.error('Could not start the server:', err.message);
    console.error('Is MongoDB running? Check MONGO_URI in server/.env, or use "npm run dev:memory".');
    process.exit(1);
  }
})();
