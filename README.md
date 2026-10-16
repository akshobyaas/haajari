# Haajari — digital attendance for schools

MERN web app for Karnataka government schools, Pre-KG to Class 10. Kannada first, also English and Hindi.

**Status: all 5 phases complete.**
- Phase 1, Foundation: login, roles, school setup, classes, students, spreadsheet import, three languages.
- Phase 2, Offline marking: one-tap marking that works with no internet and syncs later with no duplicates.
- Phase 3, Parents and pre-primary: absence alerts with one-tap replies, leave requests, LKG–UKG arrival and pickup with QR passes.
- Phase 4, Insights: live dashboard, emergency headcount, mid-day meal count, children to follow up, monthly register (print/PDF and Excel), shortage list, SATS export.

- Phase 5, Polish and demo: dark mode, confetti, low-data mode, faster first load, field test on a throttled low-end phone, load test, one-service deployment, demo script and backup video.

Going live: [docs/DEPLOY.md](docs/DEPLOY.md) · Demo day: [docs/DEMO.md](docs/DEMO.md) · Teacher test kit: [docs/USABILITY-TEST.md](docs/USABILITY-TEST.md)

## Run it on your computer

You need **Node.js 20 or newer** (https://nodejs.org). MongoDB is optional for the demo.

```bash
cd haajari
npm run setup      # installs everything (first time only, takes a few minutes)
npm run dev        # starts the API and the app
```

Open **http://localhost:5180**.

`npm run dev` uses a built-in temporary database filled with a demo school, so you do not need to install MongoDB.
The first start downloads it (about 1 minute). Data resets every time you restart.

To keep data between restarts, install MongoDB (or create a free MongoDB Atlas cluster), then:

```bash
copy server\.env.example server\.env     # Windows (macOS/Linux: cp)
# edit server\.env and set MONGO_URI if you use Atlas
npm run seed        # loads the demo school
npm run dev:mongo
```

To try it on your phone, connect the phone to the same Wi-Fi and open `http://<your-computer-ip>:5180`.

### Demo of offline marking (Phase 2)

```bash
npm run demo        # builds the app with its offline service worker, then serves it
```

Open **http://localhost:4173**, log in as the teacher, open 4-A once (this saves the class on the device),
then turn off Wi-Fi (or Chrome DevTools > Network > Offline) and mark the class. The tiles show a cloud icon:
saved on the device. Turn the network back on and the icons turn into ticks within a few seconds.

`npm run dev` also marks offline once a page is open, but only `npm run demo` (or a real deployment) can
start the app from scratch with no network, because browsers enable service workers only in built apps.

### Production build (same as the deployed site)

```bash
npm run build      # builds the app into client/dist
npm start          # one server: API + app on http://localhost:5000 (needs MONGO_URI in server/.env)
```

## Demo logins

| Who | Login | Password / PIN |
| --- | --- | --- |
| Headmaster (admin) | School office tab: `hm@kps-mysuru.in` | `Haajari@2026` |
| Teacher, class teacher of 4-A (40 children) | `9000000007` | PIN `1234` |
| Teacher of Class 10 (period-wise marking) | `9000000013` | PIN `1234` |
| Parent of Riya S (4-A) | `9100000001` | PIN `1234` |
| Parent without a PIN yet | `9100000002` | Tap "Set up PIN"; the OTP is shown on screen in demo mode |
| LKG class teacher (arrivals and pickup) | `9000000002` | PIN `1234` |
| Parent of an LKG child (pickup pass) | `9100000016` | Set up a PIN first (OTP shown on screen) |

Teachers are `9000000001` (Pre-KG) to `9000000013` (Class 10), all PIN `1234`.

## Tests

```bash
npm test
```

50 API tests cover login (email, PIN, OTP setup), role access, spreadsheet import, alerts, leave, pickup and attendance:
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
  src/services/         attendance saving (idempotent), leave, notifications, Web Push
  src/workers/          absence and late-pickup alerts (every 30 s), at-risk check (daily 17:00)
  src/services/stats.js day overview, trend, monthly register; excel.js for downloads
  seed/                 demo school: KPS Hebbal, Mysuru — 13 classes, 389 students, 40 days of attendance
  tests/                Jest + Supertest
client/                 React + Vite + Tailwind
  src/pages/            Login, Setup (OTP + PIN), Alerts, teacher/ (MarkAttendance, ClassHistory,
                        PickupBoard, LeaveInbox), parent/ (Home, Child), admin/ (Dashboard),
                        AtRisk, Reports, InSchool
  src/sw.js             service worker: offline start, notifications with reply buttons
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

## Phase 3 — what it solves

| Research issue | How Phase 3 handles it |
| --- | --- |
| #8 Parents told late; reasons lost in calls and notes | An absence alert reaches the parent within about 2 minutes. They answer Sick, Family, Travelling or Other with one tap, even from the notification itself, and the reason appears on the teacher's tile. |
| #9 Pickup safety for small children | Pre-primary arrival and hand-over board. Parents keep a list of who may collect the child, with optional photos. The teacher hands over by photo, or by scanning the parent's QR pass for the day, which names the person. The parent is told who collected the child and when. Children still waiting after pickup time alert the class teacher and office. |
| #15 Pre-primary needs | LKG–UKG classes open the pickup board instead of the register. |
| Leave | Parents apply in the app; the class teacher approves; the days are marked as leave automatically and do not count as an unexplained absence. |

**Gate check (passed):** teacher marked Riya absent; her parent was alerted 147 seconds later (target: under 5 minutes),
tapped "Sick", and the reason showed on the teacher's tile. Pickup: the parent's QR pass was scanned through a camera
feed, the child was handed to the grandfather named on it, and the parent was told in Kannada.

How it works:
- **Alerts wait 2 minutes** (`alertDelayMinutes` in school settings) so a mis-tap corrected at once never alarms a parent.
  If the teacher corrects an absence after the alert, the parent gets a second message: the child is in school.
- **Phone notifications** use Web Push (the standard behind Firebase messaging in browsers) with no third-party account.
  Keys are created on first start in `server/.vapid.json`. Phones need HTTPS for notifications, so on a phone they
  work once the app is deployed (Phase 5); everything also appears in the in-app Alerts tab.
- **Pickup passes** are short signed codes (`HJ1:` + 51 characters), valid until midnight, so the QR stays simple
  enough for a cheap phone camera. The server checks the signature; the teacher compares the photo before handing over.
- SMS or WhatsApp for parents without smartphones plugs into `server/src/services/notify.js`.

## Phase 4 — what it solves

| Research issue | How Phase 4 handles it |
| --- | --- |
| #7 Data lag; no headcount in an emergency | Live dashboard (refreshes every 30 s): children in school now, registers taken with a Call button for classes still pending, class-wise % today, last 30 school days. "Who is in school now" lists every child present and not yet gone home, class by class, printable for drills. |
| #10 Children at risk go unnoticed | Every evening (17:00) the server flags children absent 3+ school days in a row or below 75% this month or year (both set in School settings). The class teacher is alerted, can call or WhatsApp the parent from the list, and records what was done: called, home visit, message. Flags clear when the child is back. |
| #11 SATS double entry | SATS export: one row per child with SATS ID, class, working days and days present for the month (Excel or CSV). |
| #14 Mid-day meal count | Plates to cook = children present today in Pre-KG to Class 8 (configurable), by class, with a "Send to cook" button that shares the count on WhatsApp. |
| Paper register | Monthly register in the paper layout: P / A / L / Lv per day, holidays shaded, totals per child and per day. Print or save as PDF from the browser (Kannada prints correctly), or download Excel. |

**Gate check (passed):** for 4-A, every total in the monthly register (working days, present, absent and leave days, each child's
row, each day's column) matches an independent count of the raw attendance records, cell by cell, and the Excel file carries the
same totals (`server/tests/reports.test.js`).

The SATS export holds the fields SATS asks for, but the portal's exact upload layout is not public, so check the columns
against the current SATS screen before relying on it.

## Phase 5 — polish, field test, deployment

| Goal | What was done |
| --- | --- |
| Smooth and friendly | Dark mode (follows the phone, or set in Account), confetti when the whole class is present, page transitions, reduced-motion respected. |
| Cheap phones, costly data | First load cut from 269 KB to about 72 KB of JavaScript (pages load on demand, Kannada built in, English/Hindi fetched only when chosen). Low-data mode in Account stops background refreshes. |
| Real network conditions | Fixed a bug where opening a class after the signal dropped showed a blank screen: requests now never pause because the phone *looks* offline. Request timeout raised to 30 s for 2G/3G. |
| One link for everyone | Express serves the built app and the API from one address (needed for offline start and notifications); helmet security headers and gzip on. Render blueprint in `render.yaml`. |

**Field test** (production build, Chrome throttled to Slow 3G 400 kbps / 400 ms latency and a 6× slower CPU, like a ₹7,000 Android phone):

| Step | Result |
| --- | --- |
| First open of the app | 6.8 s, 221 KB downloaded |
| PIN to teacher home | 3.7 s |
| Open 4-A and mark it, to "done" | 3.9 s |
| Marks synced | 40 / 40 |
| Second open | 4 KB downloaded (everything else from the phone) |

**Lighthouse (mobile):** Performance 84–87, Accessibility 100, Best practices 100.

**Load test** (`node server/scripts/loadtest.js`): 50 classes × 40 children saved at the same moment (the 9 a.m. rush), then every
request repeated as if every phone retried: 0 failures, the 2,000 repeats recognised as duplicates, exactly 2,000 records stored.

**Backup video:** [docs/haajari-demo.mp4](docs/haajari-demo.mp4) (3 minutes) — offline marking, parent alert and reply, QR pickup, headmaster dashboard and register.

## API (Phases 1–4)

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
| GET | /api/me/children | Parent: children with today's status and pickup |
| GET | /api/me/children/:id/attendance?month= | Parent: month calendar, month and year % |
| POST | /api/me/absences/:id/reason | Parent: why absent |
| POST | /api/public/absence-reply | One-tap reply from a notification (signed token) |
| PUT | /api/me/children/:id/guardians | Parent: who may collect the child |
| GET | /api/me/children/:id/pickup-pass?guardianId= | Parent: today's QR pass |
| GET/POST | /api/me/notifications, /read | Everyone: alerts inbox |
| POST/DELETE | /api/me/push | Register this phone for notifications |
| POST/GET/PATCH/DELETE | /api/leave | Parent applies, class teacher decides |
| GET | /api/pickup/class/:id/today | Pre-primary board |
| POST | /api/pickup/checkout, /undo | Hand over by photo or QR pass |
| GET | /api/dashboard/today, /trend | Admin: live day, last 30 school days |
| GET/POST | /api/risk, /api/risk/:id/follow-up, /api/risk/refresh | Children to follow up |
| GET | /api/reports/register?classId=&month=&format=xlsx | Monthly register |
| GET | /api/reports/shortage?threshold=&format=xlsx | Below-threshold list |
| GET | /api/reports/sats?month=&format=xlsx\|csv | SATS summary |
| GET | /api/dashboard/summary | Admin |
