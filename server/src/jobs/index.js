const { runAbsenceAlerts, runLatePickupAlerts } = require('../modules/notifications/alerts.service');
const { runDailyRisk } = require('../modules/risk/risk.service');

/**
 * Background jobs, run every 30 seconds:
 * - absence alerts to parents (after the school's short grace delay)
 * - late-pickup alerts for pre-primary children still waiting
 * - the evening at-risk check (once a day after 17:00)
 * Each job is isolated: one failing never stops the others, and a job that is still
 * running (slow database) is skipped rather than started twice.
 */
const JOBS = [
  ['absence alerts', () => runAbsenceAlerts()],
  ['late-pickup alerts', () => runLatePickupAlerts()],
  ['at-risk check', () => runDailyRisk({ log: console.log })],
];

function startJobs({ intervalMs = 30_000, log = console.error } = {}) {
  const running = new Set();
  const tick = () => Promise.all(JOBS.map(async ([name, run]) => {
    if (running.has(name)) return;
    running.add(name);
    try {
      await run();
    } catch (err) {
      log(`Job "${name}" failed:`, err.message);
    } finally {
      running.delete(name);
    }
  }));
  const id = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(id);
}

module.exports = { startJobs };
