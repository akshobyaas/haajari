const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { startWorkers } = require('./workers/alerts');

(async () => {
  try {
    await connectDB(env.mongoUri);
    createApp().listen(env.port, () => console.log(`Haajari API on http://localhost:${env.port}`));
    startWorkers();
  } catch (err) {
    console.error('Could not start the server:', err.message);
    console.error('Is MongoDB running? Check MONGO_URI in server/.env, or use "npm run dev:memory".');
    process.exit(1);
  }
})();
