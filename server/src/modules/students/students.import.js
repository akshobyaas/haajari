const { parse: parseCsv } = require('csv-parse/sync');
const { ClassRoom, Student, User, GRADES } = require('../../models');

// Accepts the school's own sheet headings in a few common spellings.
const HEADERS = {
  admissionNo: ['admission_no', 'admission no', 'admissionno', 'adm no'],
  name: ['name', 'student name', 'student_name'],
  grade: ['grade', 'class', 'standard'],
  section: ['section', 'sec'],
  rollNo: ['roll_no', 'roll no', 'rollno', 'roll'],
  gender: ['gender', 'sex'],
  dob: ['dob', 'date of birth', 'date_of_birth'],
  satsId: ['sats_id', 'sats id', 'sats', 'sats no'],
  parentName: ['parent_name', 'parent name', 'guardian', 'guardian name'],
  parentPhone: ['parent_phone', 'parent phone', 'mobile', 'phone', 'parent mobile'],
  relation: ['relation', 'relationship'],
};

const TEMPLATE =
  'admission_no,name,grade,section,roll_no,gender,dob,sats_id,parent_name,parent_phone,relation\n' +
  'KPS2026001,Ananya R,4,A,1,F,2017-06-12,123456789,Ravi Kumar,9876543210,Father\n';

function normaliseGrade(raw) {
  const g = String(raw || '').trim().toUpperCase().replace(/[\s.-]/g, '');
  if (['PREKG', 'PKG', 'NURSERY'].includes(g)) return 'PREKG';
  const n = g.replace(/(ST|ND|RD|TH|STD|CLASS)$/g, '').replace(/^(CLASS|STD)/, '');
  return GRADES.includes(n) ? n : null;
}

function pick(row, key) {
  for (const h of HEADERS[key]) if (row[h] !== undefined && String(row[h]).trim() !== '') return String(row[h]).trim();
  return undefined;
}

function normaliseDate(v) {
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY, common in Indian registers
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : 'invalid';
}

/**
 * Validates every row first; writes only when dryRun is false and no row has errors,
 * so a bad sheet never half-imports.
 */
async function importStudents({ csvText, schoolId, dryRun }) {
  let records;
  try {
    records = parseCsv(csvText, {
      columns: (h) => h.map((x) => x.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (e) {
    return { ok: false, errors: [{ row: 0, message: `Could not read the file: ${e.message}` }], rows: [] };
  }

  const classes = await ClassRoom.find({ schoolId, active: true });
  const classKey = (g, s) => `${g}|${s}`;
  const classMap = new Map(classes.map((c) => [classKey(c.grade, c.section), c]));

  const errors = [];
  const rows = [];
  const seenAdm = new Set();

  records.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    const rowErrors = [];
    const grade = normaliseGrade(pick(r, 'grade'));
    const section = (pick(r, 'section') || 'A').toUpperCase();
    const row = {
      admissionNo: pick(r, 'admissionNo'),
      name: pick(r, 'name'),
      grade,
      section,
      rollNo: pick(r, 'rollNo') ? Number(pick(r, 'rollNo')) : undefined,
      gender: (pick(r, 'gender') || '').charAt(0).toUpperCase() || undefined,
      dob: normaliseDate(pick(r, 'dob')),
      satsId: pick(r, 'satsId'),
      parentName: pick(r, 'parentName'),
      parentPhone: (pick(r, 'parentPhone') || '').replace(/\D/g, '').slice(-10) || undefined,
      relation: pick(r, 'relation') || 'Parent',
    };
    if (!row.admissionNo) rowErrors.push('admission number is missing');
    else if (seenAdm.has(row.admissionNo)) rowErrors.push('admission number appears twice in the file');
    seenAdm.add(row.admissionNo);
    if (!row.name) rowErrors.push('name is missing');
    if (!grade) rowErrors.push(`class "${pick(r, 'grade') || ''}" is not PREKG, LKG, UKG or 1-10`);
    else if (!classMap.has(classKey(grade, section))) rowErrors.push(`class ${grade}-${section} does not exist yet; add it in Classes`);
    if (row.rollNo !== undefined && !(row.rollNo > 0)) rowErrors.push('roll number must be a positive number');
    if (row.gender && !['M', 'F', 'O'].includes(row.gender)) rowErrors.push('gender must be M, F or O');
    if (row.dob === 'invalid') rowErrors.push('date of birth must be DD/MM/YYYY or YYYY-MM-DD');
    if (row.satsId && !/^\d{9}$/.test(row.satsId)) rowErrors.push('SATS ID must be 9 digits');
    if (row.parentPhone && !/^[6-9]\d{9}$/.test(row.parentPhone)) rowErrors.push('parent phone must be a 10-digit mobile number');
    if (rowErrors.length) errors.push({ row: rowNo, message: rowErrors.join('; ') });
    rows.push(row);
  });

  if (!records.length) errors.push({ row: 0, message: 'The file has no student rows.' });
  if (errors.length || dryRun) return { ok: errors.length === 0, errors, rows: rows.slice(0, 200), total: rows.length };

  let created = 0;
  let updated = 0;
  let parentsCreated = 0;
  for (const row of rows) {
    let parentIds = [];
    if (row.parentPhone) {
      let parent = await User.findOne({ phone: row.parentPhone });
      if (!parent) {
        parent = await User.create({ schoolId, role: 'parent', name: row.parentName || 'Parent', phone: row.parentPhone });
        parentsCreated += 1;
      }
      parentIds = [parent._id];
    }
    const cls = classMap.get(classKey(row.grade, row.section));
    const update = {
      name: row.name,
      classId: cls._id,
      rollNo: row.rollNo,
      gender: row.gender,
      dob: row.dob,
      satsId: row.satsId,
      active: true,
    };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);
    const result = await Student.updateOne(
      { schoolId, admissionNo: row.admissionNo },
      {
        $set: update,
        $addToSet: { parentIds: { $each: parentIds } },
        $setOnInsert: row.parentName
          ? { pickupGuardians: [{ name: row.parentName, relation: row.relation, phone: row.parentPhone }] }
          : {},
      },
      { upsert: true, runValidators: true }
    );
    if (result.upsertedCount) created += 1;
    else updated += 1;
  }
  return { ok: true, errors: [], created, updated, parentsCreated, total: rows.length };
}

module.exports = { importStudents, TEMPLATE };
