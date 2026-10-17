/**
 * Starts the server: settings -> database -> demo data (if asked) -> approver account
 * -> HTTP server -> background jobs. Exits with a clear message if any step fails.
 */
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { startJobs } = require('./jobs');
const { School } = require('./models');
const { ensureApprover } = require('./modules/platform/approver.service');

// Last line of defence: log anything nothing else caught, instead of failing silently.
process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception, shutting down:', err);
  process.exit(1);
});

async function start() {
  await connectDB(env.mongoUri);
  // First start on an empty database (e.g. a fresh Atlas cluster): load the demo school.
  if (env.seedOnEmpty && !(await School.exists({}))) {
    console.log('Empty database: loading the demo school...');
    await require('../seed/seedData').seed();
  }
  await ensureApprover(env.approver);
  const server = createApp().listen(env.port, () => console.log(`Haajari API on http://localhost:${env.port}`));
  const stopJobs = startJobs();

  // Render (and Ctrl+C) send SIGTERM/SIGINT: finish open requests, then exit.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    stopJobs();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Could not start the server:', err.message);
  console.error('Is MongoDB running? Check MONGO_URI in server/.env, or use "npm run dev:memory".');
  process.exit(1);
});
