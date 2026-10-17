const { Attendance, AuditLog, Student } = require('../../models');
const { todayIn, daysBetween, closedReason, editNeedsReason } = require('../../shared/dates');
const { HttpError, badRequest, forbidden } = require('../../shared/errors');

/**
 * Who may mark which period:
 * - admin: anything
 * - class teacher: any period of their class
 * - subject teacher: only period > 0 in classes where they teach a subject
 */
async function assertCanMark(user, cls, period) {
  if (user.role === 'admin') return;
  if (user.role !== 'teacher') throw forbidden();
  if (String(cls.classTeacherId) === String(user._id)) return;
  const teachesHere = (user.subjects || []).some((s) => String(s.classId) === String(cls._id));
  if (teachesHere && period > 0) return;
  if (teachesHere) throw forbidden('Only the class teacher marks the daily attendance. Pick your period.');
  throw forbidden('This class is not assigned to you.');
}

function assertDateAllowed(user, school, date) {
  const today = todayIn(school.timezone);
  const age = daysBetween(date, today);
  if (age < 0) throw badRequest('You cannot mark attendance for a future date.');
  if (user.role !== 'admin' && age > school.teacherBackdateDays) {
    throw badRequest(`Teachers can mark up to ${school.teacherBackdateDays} days back. Ask the headmaster to change older days.`);
  }
  const closed = closedReason(school, date);
  if (closed) throw badRequest(`${date} is closed (${closed}).`);
}

/**
 * Saves one class's marks for one date/period. Safe to call many times with the same
 * payload (offline retries): clientIds already stored are reported as 'duplicate', and a
 * mark older than what is stored is reported as 'stale' instead of overwriting it.
 */
async function saveBulk({ user, school, cls, date, period, marks, editReason }) {
  assertDateAllowed(user, school, date);
  await assertCanMark(user, cls, period);

  const ids = marks.map((m) => m.studentId);
  if (new Set(ids).size !== ids.length) throw badRequest('Each student can appear only once.');
  const students = await Student.find({ _id: { $in: ids }, classId: cls._id, active: true }).select('_id');
  if (students.length !== ids.length) throw badRequest('Some students are not in this class. Refresh the class list.');

  const [existing, seenClientIds] = await Promise.all([
    Attendance.find({ studentId: { $in: ids }, date, period }),
    Attendance.find({ clientId: { $in: marks.map((m) => m.clientId) } }).distinct('clientId'),
  ]);
  const byStudent = new Map(existing.map((a) => [String(a.studentId), a]));
  const seen = new Set(seenClientIds);

  const needsReason = editNeedsReason(school, date);
  const results = [];
  const ops = [];
  const audits = [];
  let pendingEdits = 0;
  const cleared = []; // absences parents were told about, now corrected

  for (const m of marks) {
    const prev = byStudent.get(String(m.studentId));
    const markedAt = new Date(m.markedAt);
    if (seen.has(m.clientId)) { results.push({ studentId: m.studentId, clientId: m.clientId, result: 'duplicate' }); continue; }
    if (prev && prev.status === m.status) {
      // Same answer: acknowledge without writing; keeps re-syncs cheap.
      results.push({ studentId: m.studentId, clientId: m.clientId, result: 'unchanged' });
      continue;
    }
    if (prev && prev.markedAt > markedAt) {
      results.push({ studentId: m.studentId, clientId: m.clientId, result: 'stale', current: prev.status });
      continue;
    }
    if (prev) {
      if (needsReason && !editReason) { pendingEdits += 1; continue; }
      ops.push({
        updateOne: {
          filter: { _id: prev._id },
          update: { $set: { status: m.status, markedBy: user._id, markedAt, clientId: m.clientId, source: 'teacher' }, ...(m.status === 'A' ? {} : { $unset: { alertedAt: 1 } }) },
        },
      });
      if (prev.status === 'A' && prev.alertedAt && ['P', 'L'].includes(m.status)) cleared.push(prev);
      audits.push({
        schoolId: school._id, entity: 'attendance', entityId: prev._id, action: 'update', changedBy: user._id,
        from: prev.status, to: m.status, reason: editReason || 'Changed within marking window',
      });
      results.push({ studentId: m.studentId, clientId: m.clientId, result: 'updated' });
    } else {
      ops.push({
        insertOne: {
          document: {
            schoolId: school._id, studentId: m.studentId, classId: cls._id, date, period,
            status: m.status, markedBy: user._id, markedAt, clientId: m.clientId,
          },
        },
      });
      results.push({ studentId: m.studentId, clientId: m.clientId, result: 'created' });
    }
  }

  if (pendingEdits) {
    throw new HttpError(422, 'needs_reason', `Give a reason for changing ${pendingEdits} saved marks after the marking time.`, { needsReason: true, count: pendingEdits });
  }
  if (ops.length) await Attendance.bulkWrite(ops, { ordered: false });
  if (audits.length) await AuditLog.insertMany(audits);
  if (cleared.length) await require('../notifications/alerts.service').notifyAbsenceCleared(cleared);

  const summary = results.reduce((acc, r) => ({ ...acc, [r.result]: (acc[r.result] || 0) + 1 }), {});
  return { date, period, summary, results };
}

// Today's counts per class: period 0 for daily classes, period 1 for period-wise classes.
async function todaySummary(classes, date) {
  const daily = classes.filter((c) => c.mode !== 'period').map((c) => c._id);
  const periodWise = classes.filter((c) => c.mode === 'period').map((c) => c._id);
  const rows = await Attendance.aggregate([
    { $match: { date, $or: [{ classId: { $in: daily }, period: 0 }, { classId: { $in: periodWise }, period: 1 }] } },
    { $group: { _id: { classId: '$classId', status: '$status', source: '$source' }, n: { $sum: 1 } } },
  ]);
  const out = {};
  rows.forEach((r) => {
    const k = String(r._id.classId);
    out[k] ||= { P: 0, A: 0, L: 0, LV: 0, marked: 0 };
    out[k][r._id.status] += r.n;
    // Leave approved in advance does not mean the teacher has taken the register.
    if (r._id.source !== 'leave') out[k].marked += r.n;
  });
  Object.keys(out).forEach((k) => { if (!out[k].marked) delete out[k]; });
  return out;
}

async function classHistory(cls, from, to) {
  const rows = await Attendance.aggregate([
    { $match: { classId: cls._id, date: { $gte: from, $lte: to }, period: cls.mode === 'period' ? 1 : 0 } },
    { $group: { _id: { date: '$date', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const days = {};
  rows.forEach((r) => {
    days[r._id.date] ||= { date: r._id.date, P: 0, A: 0, L: 0, LV: 0 };
    days[r._id.date][r._id.status] = r.n;
  });
  return Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
}

/** Who changed one student's marks on one day, newest first (the "who changed this" sheet). */
async function auditTrail(studentId, date) {
  const records = await Attendance.find({ studentId, date }).select('_id period');
  const logs = await AuditLog.find({ entity: 'attendance', entityId: { $in: records.map((r) => r._id) } })
    .sort({ at: -1 })
    .populate('changedBy', 'name');
  const periodOf = Object.fromEntries(records.map((r) => [String(r._id), r.period]));
  return logs.map((l) => ({ ...l.toObject(), period: periodOf[String(l.entityId)] }));
}

module.exports = { saveBulk, todaySummary, classHistory, auditTrail };
