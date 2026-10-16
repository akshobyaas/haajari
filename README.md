# Haajari — digital attendance for schools

MERN web app for Karnataka government schools, Pre-KG to Class 10. Kannada first, also English and Hindi.

**Status: Phases 1 and 2 complete.**
- Phase 1, Foundation: login, roles, school setup, classes, students, spreadsheet import, three languages.
- Phase 2, Offline marking: one-tap marking that works with no internet and syncs later with no duplicates.

Next: Phase 3, parents and pre-primary pickup.

## Run it on your computer

You need **Node.js 20 or newer** (https://nodejs.org). MongoDB is optional for the demo.

```bash
cd haajari
npm run setup      # installs everything (first time only, takes a few minutes)
npm run dev        # starts the API and the app
```

Open **http://localhost:5173**.

`npm run dev` uses a built-in temporary database filled with a demo school, so you do not need to install MongoDB.
The first start downloads it (about 1 minute). Data resets every time you restart.

To keep data between restarts, install MongoDB (or create a free MongoDB Atlas cluster), then:

```bash
copy server\.env.example server\.env     # Windows (macOS/Linux: cp)
# edit server\.env and set MONGO_URI if you use Atlas
npm run seed        # loads the demo school
npm run dev:mongo
```

To try it on your phone, connect the phone to the same Wi-Fi and open `http://<your-computer-ip>:5173`.

### Demo of offline marking (Phase 2)

```bash
npm run demo        # builds the app with its offline service worker, then serves it
```

Open **http://localhost:4173**, log in as the teacher, open 4-A once (this saves the class on the device),
then turn off Wi-Fi (or Chrome DevTools > Network > Offline) and mark the class. The tiles show a cloud icon:
saved on the device. Turn the network back on and the icons turn into ticks within a few seconds.

`npm run dev` also marks offline once a page is open, but only `npm run demo` (or a real deployment) can
start the app from scratch with no network, because browsers enable service workers only in built apps.

## Demo logins

| Who | Login | Password / PIN |
| --- | --- | --- |
| Headmaster (admin) | School office tab: `hm@kps-mysuru.in` | `Haajari@2026` |
| Teacher, class teacher of 4-A (40 children) | `9000000007` | PIN `1234` |
| Teacher of Class 10 (period-wise marking) | `9000000013` | PIN `1234` |
| Parent of Riya S (4-A) | `9100000001` | PIN `1234` |
| Parent without a PIN yet | `9100000002` | Tap "Set up PIN"; the OTP is shown on screen in demo mode |

Teachers are `9000000001` (Pre-KG) to `9000000013` (Class 10), all PIN `1234`.

## Tests

```bash
npm test
```

27 API tests cover login (email, PIN, OTP setup), role access, spreadsheet import and attendance:
replaying the same offline batch adds nothing, an older offline mark never overwrites a newer one,
late edits need a reason and are audited, subject teachers mark only their periods, future dates,
Sundays and holidays are refused, and a class of 40 saves in one request.

## What is where

```
server/                 Node + Express + MongoDB API
  src/models/           School, User, ClassRoom, Student, Attendance, AuditLog,
                        LeaveRequest, PickupLog, Notification
  src/routes/           auth, school, classes, students, users, me, dashboard
  src/middleware/       JWT auth, role checks, class/student access rules
  src/utils/            OTP, spreadsheet import, validation
  src/services/         attendance saving rules (idempotent bulk save)
  seed/                 demo school: KPS Hebbal, Mysuru — 13 classes, 389 students, 40 days of attendance
  tests/                Jest + Supertest
client/                 React + Vite + Tailwind
  src/pages/            Login, Setup (OTP + PIN), teacher/ (MarkAttendance, ClassHistory), parent/, admin/
  src/offline/          IndexedDB storage and the sync queue
  src/components/       PinPad, ClassSlate, AppShell, Sheet, ...
  src/i18n/             kn.json, en.json, hi.json
```

## Phase 1 — what it solves

| Research issue | How Phase 1 handles it |
| --- | --- |
| #4 Privacy, #13 face recognition dropped | No GPS, no face data. Only the fields a register already has. |
| #11 SATS duplication | Every student stores a 9-digit SATS ID; dashboard flags missing ones. |
| #12 OTPs often fail | Daily login is phone + PIN. OTP is needed only once, to set the PIN. |
| #15 Kannada-medium schools | Kannada is the default language; switch any time. |
| Data entry burden | Import the whole register from a CSV; bad rows are listed and nothing half-imports. |

## Phase 2 — what it solves

| Research issue | How Phase 2 handles it |
| --- | --- |
| #1 Server overload at 9 a.m., marks lost | Marks are saved on the phone first (IndexedDB) and sent in the background. One request per class. |
| #2 Poor network, data packs | Works fully offline; the class list is downloaded when the teacher opens the home screen. |
| #3 Hard for older teachers | Everyone starts present; tap only the absentees. Big tiles with roll numbers. |
| #5 Rigid marking windows | Late marking is allowed. Changing saved marks after the window asks for a reason, which is logged. |
| #6 Time lost every class | 40 children: 3 absentees = 4 taps including Save. |
| Duplicate or lost records on retry | Every mark carries a phone-generated id; the server ignores ids it has seen and rejects older overwrites. |

**Gate check (passed):** 4-A (40 children) marked with the network off, nothing reached the server;
after reconnecting, exactly 40 records, no duplicates, even with the reconnect fired twice.

How the offline sync works: `client/src/offline/` (`db.js` storage, `sync.js` queue, `roster.js` cached class lists)
and `server/src/services/attendance.js` (`saveBulk`).

## API (Phases 1–2)

| Method | Endpoint | Who |
| --- | --- | --- |
| POST | /api/auth/login | Staff (email + password) |
| POST | /api/auth/pin-login | Teachers, parents |
| POST | /api/auth/otp/request, /otp/verify, /pin/setup | First-time setup, PIN reset |
| GET/PATCH | /api/auth/me | Everyone (language) |
| GET/PATCH | /api/school | Read: all · Edit: admin |
| GET/POST/PATCH/DELETE | /api/classes | Admin; teachers read their own |
| GET/POST/PATCH/DELETE | /api/students | Admin; teachers read their classes |
| POST | /api/students/import?dryRun=true | Admin |
| GET/POST/PATCH/DELETE | /api/users, POST /api/users/:id/reset-pin | Admin |
| GET | /api/classes/:id/roster?date= | Teachers of the class, admin |
| POST | /api/attendance/bulk | Save a class (also the offline replay) |
| GET | /api/attendance/class/:id/history | Last 30 days with counts |
| GET | /api/attendance/audit?studentId=&date= | Who changed a mark, and why |
| GET | /api/me/children | Parent |
| GET | /api/dashboard/summary | Admin |
