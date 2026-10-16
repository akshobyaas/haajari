const { api, start, stop, auth, loginAdmin } = require('./helpers');
const { Student, User } = require('../src/models');

let admin;
beforeAll(async () => {
  await start();
  admin = await loginAdmin();
});
afterAll(stop);

const upload = (csv, dryRun) =>
  api().post(`/api/students/import${dryRun ? '?dryRun=true' : ''}`).set(auth(admin)).attach('file', Buffer.from(csv), 'students.csv');

test('dry run reports every bad row and saves nothing', async () => {
  const csv = [
    'admission_no,name,grade,section,roll_no,gender,dob,sats_id,parent_name,parent_phone',
    'NEW1,Test One,4,A,40,F,12/06/2017,123,Asha,9876501234',
    'NEW2,,11,A,41,M,,,,',
    'NEW1,Dup,4,Z,42,M,,,,',
  ].join('\n');
  const r = await upload(csv, true);
  expect(r.status).toBe(422);
  expect(r.body.errors.map((e) => e.row)).toEqual([2, 3, 4]);
  expect(r.body.errors[0].message).toMatch(/SATS ID/);
  expect(r.body.errors[1].message).toMatch(/name is missing/);
  expect(r.body.errors[2].message).toMatch(/appears twice/);
  expect(await Student.countDocuments({ admissionNo: /^NEW/ })).toBe(0);
});

test('valid sheet imports, links parents and converts DD/MM/YYYY', async () => {
  const csv = [
    'Admission No,Student Name,Class,Section,Roll No,Gender,DOB,SATS ID,Parent Name,Mobile,Relation',
    'NEW10,Kiran T,4th,A,50,M,05/03/2017,987654321,Thimmappa,+91 98765 01111,Father',
    'NEW11,Asha T,LKG,A,30,F,2022-01-09,,Thimmappa,9876501111,Father',
  ].join('\n');
  const preview = await upload(csv, true);
  expect(preview.status).toBe(200);
  const r = await upload(csv, false);
  expect(r.status).toBe(200);
  expect(r.body.created).toBe(2);
  expect(r.body.parentsCreated).toBe(1);
  const kiran = await Student.findOne({ admissionNo: 'NEW10' });
  expect(kiran.dob).toBe('2017-03-05');
  const parent = await User.findOne({ phone: '9876501111' });
  expect(await Student.countDocuments({ parentIds: parent._id })).toBe(2);

  const again = await upload(csv, false);
  expect(again.body.updated).toBe(2);
  expect(again.body.created).toBe(0);
});
