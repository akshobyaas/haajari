const { School, Attendance, ClassRoom, Student, User, PickupLog } = require('../models');
const { notify } = require('../services/notify');
const { signAbsenceReply } = require('../utils/token');
const { todayIn, nowTimeIn } = require('../utils/dates');

const className = (c) => `${c.grade === 'PREKG' ? 'Pre-KG' : c.grade}-${c.section}`;
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const REPLY_ACTIONS = [
  { action: 'sick', title: 'Sick / ಅನಾರೋಗ್ಯ' },
  { action: 'family', title: 'Family / ಕುಟುಂಬ' },
];

async function alertParentsOfAbsence(record, cls, student) {
  const parents = await User.find({ _id: { $in: student.parentIds }, active: true });
  for (const parent of parents) {
    await notify(parent, 'absent', { studentName: student.name, className: className(cls), studentId: String(student._id), attendanceId: String(record._id), date: record.date, key: String(record._id) }, {
      url: `/p/child/${student._id}`,
      actions: REPLY_ACTIONS,
      replyToken: signAbsenceReply(record._id, parent._id),
    });
  }
}

/**
 * Tells parents about today's absences once they have stood for `alertDelayMinutes`,
 * so a teacher who corrects a tap within a minute or two never alarms anyone.
 * Runs every 30 seconds; the Phase 3 target is an alert within 5 minutes.
 */
async function runAbsenceAlerts({ now = new Date() } = {}) {
  let sent = 0;
  for (const school of await School.find()) {
    const today = todayIn(school.timezone, now);
    const cutoff = new Date(now.getTime() - school.alertDelayMinutes * 60 * 1000);
    const classes = await ClassRoom.find({ schoolId: school._id, active: true });
    const byId = new Map(classes.map((c) => [String(c._id), c]));
    const due = await Attendance.find({
      schoolId: school._id, date: today, status: 'A', alertedAt: null, updatedAt: { $lte: cutoff }, period: { $in: [0, 1] },
    });
    for (const rec of due) {
      const cls = byId.get(String(rec.classId));
      // Daily classes alert on the day register; period-wise classes on period 1.
      if (!cls || rec.period !== (cls.mode === 'period' ? 1 : 0)) continue;
      // Claim it first so two servers (or overlapping runs) never alert twice.
      const claimed = await Attendance.updateOne({ _id: rec._id, alertedAt: null, status: 'A' }, { $set: { alertedAt: now } });
      if (!claimed.modifiedCount) continue;
      const student = await Student.findById(rec.studentId);
      if (student) { await alertParentsOfAbsence(rec, cls, student); sent += 1; }
    }
  }
  return sent;
}

/** Pre-primary: tells the class teacher and the office about children still waiting after pickup time. */
async function runLatePickupAlerts({ now = new Date() } = {}) {
  let sent = 0;
  for (const school of await School.find()) {
    const late = minutesOf(nowTimeIn(school.timezone, now)) - minutesOf(school.pickupTime);
    if (late < school.pickupGraceMinutes) continue;
    const today = todayIn(school.timezone, now);
    const classes = await ClassRoom.find({ schoolId: school._id, active: true, mode: 'checkin' });
    const admins = await User.find({ schoolId: school._id, role: 'admin', active: true });
    for (const cls of classes) {
      const present = await Attendance.find({ classId: cls._id, date: today, period: 0, status: { $in: ['P', 'L'] } }).distinct('studentId');
      const logs = await PickupLog.find({ studentId: { $in: present }, date: today });
      const done = new Set(logs.filter((l) => l.checkOutAt || l.lateAlertedAt).map((l) => String(l.studentId)));
      const waiting = present.filter((id) => !done.has(String(id)));
      if (!waiting.length) continue;
      const teacher = cls.classTeacherId && (await User.findById(cls.classTeacherId));
      for (const sid of waiting) {
        const student = await Student.findById(sid);
        await PickupLog.updateOne({ studentId: sid, date: today }, { $set: { lateAlertedAt: now }, $setOnInsert: { schoolId: school._id } }, { upsert: true });
        for (const u of [teacher, ...admins].filter(Boolean)) {
          await notify(u, 'late_pickup', { studentName: student.name, className: className(cls), minutes: late, key: `${sid}:${today}` }, { url: `/t/class/${cls._id}/pickup` });
        }
        sent += 1;
      }
    }
  }
  return sent;
}

/** Notifies parents that an absence they were told about has been corrected. */
async function notifyAbsenceCleared(records) {
  for (const rec of records) {
    const student = await Student.findById(rec.studentId);
    if (!student) continue;
    const parents = await User.find({ _id: { $in: student.parentIds }, active: true });
    for (const p of parents) await notify(p, 'absent_cleared', { studentName: student.name, key: String(rec._id) }, { url: `/p/child/${student._id}` });
  }
}

function startWorkers({ intervalMs = 30_000, log = console.error } = {}) {
  const tick = async () => {
    try {
      await runAbsenceAlerts();
      await runLatePickupAlerts();
      await require('./risk').runDailyRisk({ log: console.log });
    } catch (e) { log('Alert worker:', e.message); }
  };
  const id = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(id);
}

module.exports = { runAbsenceAlerts, runLatePickupAlerts, notifyAbsenceCleared, startWorkers, className };
