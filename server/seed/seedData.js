const { todayIn, addDays, closedReason } = require('../src/utils/dates');
const { School, User, ClassRoom, Student, Attendance, AuditLog, LeaveRequest, PickupLog, Notification, GRADES, defaultModeFor } = require('../src/models');

// Deterministic random numbers so every seed produces the same demo school.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const GIRLS = ['Ananya', 'Bhoomika', 'Chaitra', 'Deepa', 'Divya', 'Gagana', 'Harini', 'Inchara', 'Kavya', 'Keerthana', 'Lakshmi', 'Meghana', 'Nandini', 'Pavithra', 'Poorvi', 'Rakshitha', 'Sahana', 'Sanjana', 'Shreya', 'Spoorthi', 'Tejaswini', 'Varsha', 'Vidya', 'Yashaswini', 'Ayesha', 'Fathima', 'Sumaiya'];
const BOYS = ['Abhishek', 'Akash', 'Bharath', 'Chethan', 'Darshan', 'Ganesh', 'Harsha', 'Karthik', 'Kiran', 'Manoj', 'Mithun', 'Nagaraj', 'Pavan', 'Prajwal', 'Rahul', 'Rakesh', 'Sachin', 'Santhosh', 'Shashank', 'Sudeep', 'Tejas', 'Vinay', 'Yashwanth', 'Arif', 'Imran', 'Sameer', 'Naveen'];
const FATHERS = ['Ramesh', 'Suresh', 'Mahesh', 'Manjunath', 'Shivakumar', 'Basavaraj', 'Prakash', 'Nagesh', 'Venkatesh', 'Raju', 'Siddappa', 'Mohan', 'Lokesh', 'Ravi', 'Mallesh', 'Chandru', 'Nataraj', 'Puttaswamy', 'Imtiaz', 'Javeed'];
const MOTHERS = ['Lakshmamma', 'Savitha', 'Shobha', 'Geetha', 'Manjula', 'Sunitha', 'Rekha', 'Shilpa', 'Kavitha', 'Pushpa', 'Asha', 'Nagarathna', 'Roopa', 'Jayamma', 'Shabana', 'Nasreen'];
const TEACHERS = [
  ['Smt. Kamala Devi', 'PREKG'], ['Smt. Usha Rani', 'LKG'], ['Smt. Padmavathi', 'UKG'], ['Sri. Gopal Rao', '1'],
  ['Smt. Sudha M', '2'], ['Smt. Bhagya R', '3'], ['Smt. Rekha Kulkarni', '4'], ['Sri. Shivanna B', '5'],
  ['Sri. Mohammed Rafiq', '6'], ['Smt. Leela Hegde', '7'], ['Sri. Anand Joshi', '8'], ['Smt. Vani Prasad', '9'],
  ['Sri. Raghavendra K', '10'],
];
const SUBJECTS = ['Kannada', 'English', 'Maths', 'Science', 'Social Science', 'Hindi'];

const DEMO = {
  adminEmail: 'hm@kps-mysuru.in',
  adminPassword: 'Haajari@2026',
  teacherPhone: '9000000007', // Smt. Rekha Kulkarni, class teacher of 4-A
  parentPhone: '9100000001',
  pin: '1234',
};

async function clearAll() {
  await Promise.all([School, User, ClassRoom, Student, Attendance, AuditLog, LeaveRequest, PickupLog, Notification].map((M) => M.deleteMany({})));
}

async function seed({ log = console.log, days = 40 } = {}) {
  const rand = rng(2026);
  const pickOne = (arr) => arr[Math.floor(rand() * arr.length)];
  await clearAll();

  const school = await School.create({
    name: 'Karnataka Public School, Hebbal, Mysuru',
    udiseCode: '29261200101',
    district: 'Mysuru',
    block: 'Mysuru North',
    academicYear: '2026-27',
    markingWindow: { start: '09:00', end: '11:00' },
    holidays: [
      { date: '2026-10-20', name: 'Naraka Chaturdashi' },
      { date: '2026-11-01', name: 'Kannada Rajyotsava' },
      { date: '2026-11-08', name: 'Kanakadasa Jayanti' },
    ],
  });

  const admin = new User({ schoolId: school._id, role: 'admin', name: 'Sri. H. S. Nagaraju (Headmaster)', email: DEMO.adminEmail, phone: '9000000000', language: 'en' });
  await admin.setPassword(DEMO.adminPassword);
  await admin.setPin(DEMO.pin);
  await admin.save();

  const teachers = [];
  for (let i = 0; i < TEACHERS.length; i++) {
    const t = new User({ schoolId: school._id, role: 'teacher', name: TEACHERS[i][0], phone: `90000000${String(i + 1).padStart(2, '0')}`, language: 'kn' });
    await t.setPin(DEMO.pin);
    teachers.push(await t.save());
  }

  const classes = [];
  for (let i = 0; i < GRADES.length; i++) {
    const grade = GRADES[i];
    classes.push(await ClassRoom.create({
      schoolId: school._id, grade, section: 'A', medium: 'kannada',
      // Class 10 takes attendance every period, to demo period-wise mode.
      classTeacherId: teachers[i]._id, mode: grade === '10' ? 'period' : defaultModeFor(grade), periodsPerDay: Number(grade) >= 6 ? 7 : 0,
    }));
  }

  // High-school subject teachers: each Grade 6-10 teacher also teaches one subject in two other classes.
  const high = classes.filter((c) => Number(c.grade) >= 6);
  for (let i = 8; i < teachers.length; i++) {
    const subject = SUBJECTS[i % SUBJECTS.length];
    teachers[i].subjects = high.filter((c) => String(c.classTeacherId) !== String(teachers[i]._id)).slice(0, 2).map((c) => ({ classId: c._id, subject }));
    await teachers[i].save();
  }

  let parentSeq = 1;
  let admSeq = 1;
  let studentCount = 0;
  let siblingPool = [];
  const relationOf = new Map();
  for (const cls of classes) {
    // 4-A has 40 children: the Phase 2 gate is marking a class of 40 in under 30 seconds.
    const size = cls.grade === '4' ? 40 : ['PREKG', 'LKG', 'UKG'].includes(cls.grade) ? 18 + Math.floor(rand() * 6) : 28 + Math.floor(rand() * 8);
    const docs = [];
    for (let r = 1; r <= size; r++) {
      const girl = rand() < 0.5;
      const first = pickOne(girl ? GIRLS : BOYS);
      // About 1 in 8 children shares parents with an older sibling.
      let parent;
      if (siblingPool.length && rand() < 0.12) parent = pickOne(siblingPool);
      else {
        const mother = rand() < 0.6;
        const phone = `91${String(parentSeq).padStart(8, '0')}`;
        parent = new User({ schoolId: school._id, role: 'parent', name: mother ? `${pickOne(MOTHERS)}` : `${pickOne(FATHERS)}`, phone, language: 'kn' });
        // Every third parent already set a PIN; the rest show the first-time OTP setup in the demo.
        if (parentSeq === 1 || parentSeq % 3 === 0) await parent.setPin(DEMO.pin);
        await parent.save();
        relationOf.set(String(parent._id), mother ? 'Mother' : 'Father');
        parentSeq += 1;
        siblingPool.push(parent);
      }
      const fatherName = pickOne(FATHERS);
      const year = 2026 - (GRADES.indexOf(cls.grade) + 3);
      const dob = `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`;
      const guardians = [{ name: parent.name, relation: relationOf.get(String(parent._id)) || 'Parent', phone: parent.phone }];
      if (['PREKG', 'LKG', 'UKG'].includes(cls.grade)) guardians.push({ name: `${pickOne(FATHERS)} (grandfather)`, relation: 'Grandparent' });
      docs.push({
        schoolId: school._id,
        admissionNo: `KPS${String(admSeq++).padStart(4, '0')}`,
        // A few pre-primary children have no SATS ID yet: shows the setup warning.
        satsId: ['PREKG', 'LKG'].includes(cls.grade) && rand() < 0.3 ? undefined : String(100000000 + Math.floor(rand() * 899999999)),
        name: `${first} ${fatherName.charAt(0)}`,
        gender: girl ? 'F' : 'M',
        dob,
        classId: cls._id,
        rollNo: r,
        parentIds: [parent._id],
        pickupGuardians: guardians,
      });
    }
    await Student.insertMany(docs);
    studentCount += docs.length;
    siblingPool = siblingPool.slice(-60);
  }

  // The demo parent's first child is in 4-A, the demo teacher's class.
  const demoParent = await User.findOne({ phone: DEMO.parentPhone });
  const fourA = classes.find((c) => c.grade === '4');
  await Student.updateOne({ classId: fourA._id, rollNo: 3 }, { $set: { parentIds: [demoParent._id], name: 'Riya S' } });

  const marks = await seedAttendance({ school, classes, rand, days });

  const summary = { school: school.name, classes: classes.length, teachers: teachers.length, students: studentCount, parents: parentSeq - 1, attendanceRecords: marks };
  log('Seeded:', summary);
  log('Demo logins:');
  log(`  Admin   ${DEMO.adminEmail} / ${DEMO.adminPassword}`);
  log(`  Teacher ${DEMO.teacherPhone} / PIN ${DEMO.pin}  (class teacher, 4-A)`);
  log(`  Parent  ${DEMO.parentPhone} / PIN ${DEMO.pin}  (Riya S, 4-A)`);
  return { summary, DEMO };
}

/**
 * Past attendance for the last `days` school days (not today, so the demo starts unmarked).
 * Most children attend about 93% of days; a few are irregular; one child in 4-A has been
 * absent the last 4 days, to show the at-risk flag.
 */
async function seedAttendance({ school, classes, rand, days }) {
  const today = todayIn(school.timezone);
  const dates = [];
  for (let d = addDays(today, -1); dates.length < days; d = addDays(d, -1)) if (!closedReason(school, d)) dates.push(d);
  const students = await Student.find({ schoolId: school._id }).select('_id classId rollNo');
  const byClass = new Map(classes.map((c) => [String(c._id), c]));
  const profile = new Map(students.map((s) => [String(s._id), rand() < 0.05 ? 0.6 : rand() < 0.15 ? 0.85 : 0.95]));
  const fourA = classes.find((c) => c.grade === '4');
  const atRisk = students.find((s) => String(s.classId) === String(fourA._id) && s.rollNo === 6);
  const docs = [];
  for (const date of dates) {
    for (const s of students) {
      const cls = byClass.get(String(s.classId));
      const p = profile.get(String(s._id));
      let status = rand() < p ? (rand() < 0.04 ? 'L' : 'P') : rand() < 0.2 ? 'LV' : 'A';
      if (atRisk && String(s._id) === String(atRisk._id) && dates.indexOf(date) < 4) status = 'A';
      docs.push({
        schoolId: school._id, studentId: s._id, classId: cls._id, date, period: cls.mode === 'period' ? 1 : 0, status,
        markedBy: cls.classTeacherId, markedAt: new Date(`${date}T09:${String(10 + Math.floor(rand() * 40)).padStart(2, '0')}:00+05:30`),
      });
    }
  }
  for (let i = 0; i < docs.length; i += 2000) await Attendance.insertMany(docs.slice(i, i + 2000), { ordered: false });
  return docs.length;
}

module.exports = { seed, clearAll, DEMO };
