# Haajari architecture

How the code is organised, which layer does what, and how to add a feature without making a mess.

## The big picture

```
Phone / laptop browser                                   Render (one web service)
┌──────────────────────────────────────────┐            ┌──────────────────────────────────┐
│ React app (client/)                      │  HTTPS     │ Express (server/)                │
│  pages → api/ hooks → api/client (axios) ├───────────►│  /api → api/index.js (route table)│
│  offline/: IndexedDB + sync queue        │  /api/*    │    → modules/<feature>/*.routes   │
│  sw.js: offline start, notifications     │◄───────────┤      → *.service (business rules) │
└──────────────────────────────────────────┘  JSON      │        → models/ (Mongoose)       │
                                                         │  jobs/: alerts every 30 s        │
                                                         │  serves client/dist (same origin)│
                                                         └───────────────┬──────────────────┘
                                                                         │
                                                                 MongoDB Atlas
```

One address serves both the app and the API, because browsers allow offline start (service worker)
and push notifications only for a single secure origin.

## Server (`server/`)

```
src/
  server.js        start-up: settings → database → demo data → approver → HTTP → jobs; graceful shutdown
  app.js           Express app: security headers, compression, CORS, JSON, /api, the built app, errors
  config/env.js    every setting, validated at start-up (the only file that reads process.env)
  config/db.js     MongoDB connection
  api/index.js     the API in one table: URL prefix → who may call it → module
  middleware/      auth (JWT, roles, school approval), access (class/student scoping), error (one JSON error shape)
  models/          Mongoose schemas; constants.js holds shared enums (roles, statuses, grades)
  modules/<feature>/
    <feature>.routes.js    parse + validate the request, call the service, send JSON. No database calls.
    <feature>.service.js   business rules and database work. No req/res.
    <feature>.schemas.js   zod schemas for request bodies and queries
    <feature>.<helper>.js  feature-only helpers (pickup.pass.js, students.import.js)
  shared/          code used by several modules: dates, errors, validate, token, otp, attendanceRules, schoolStatus
  jobs/index.js    background jobs (absence alerts, late pickup, evening at-risk check), each isolated
seed/              the demo school
scripts/           dev-memory (API on an in-memory database), loadtest
tests/             Jest + Supertest, one file per area
```

Modules: `auth`, `public` (no login), `school`, `classes`, `students`, `users`, `attendance`, `leave`,
`pickup`, `risk`, `reports`, `parents` (`/me/children…`), `notifications` (`/me/notifications`, push, alerts),
`dashboard`, `platform` (schools joining, the block office).

### Rules

- **Routes are thin.** A route validates input with a schema, checks access, calls one service function
  and returns its result. If a route needs `Model.find(...)`, that belongs in the service.
- **Every school-scoped query filters by `schoolId`.** `middleware/access.js` loads a class or student
  only if it belongs to the user's school; services receive the user and never trust ids from the client alone.
- **Errors:** throw `HttpError` helpers from `shared/errors.js` (`badRequest`, `forbidden`, `notFound`, or
  `new HttpError(status, code, message, details)`). `middleware/error.js` turns them, zod errors, Mongo
  duplicate keys and bad ids into one shape: `{ error: { code, message, details?, fields? } }`.
  Express 5 forwards errors from async routes automatically, so routes need no try/catch.
  Unexpected errors are logged and answered with a generic 500. `server.js` logs unhandled rejections,
  and exits cleanly on SIGTERM.
- **Jobs never crash the server.** Each job runs in its own try/catch and is skipped if the previous run
  is still going.
- **Settings** come only from `config/env.js`. Production refuses to start with a weak `JWT_SECRET` or
  no `MONGO_URI`. See `server/.env.example`.

### Adding an API feature

1. Create `src/modules/<name>/` with `<name>.routes.js`, `<name>.service.js` and, if it takes input,
   `<name>.schemas.js`.
2. Add one line to the table in `src/api/index.js` with its URL prefix and guard (`PUBLIC`, `SIGNED_IN`,
   `ADMIN`, `APPROVER`).
3. Add a test in `tests/`.

## Client (`client/`)

```
src/
  main.jsx         start-up: query client (retries, error toasts), language, theme
  App.jsx          routes; every screen is loaded on demand; role guards
  api/
    client.js      the axios instance: login token, logout on expired session, errorMessage()
    keys.js        every cache key in one place
    <feature>.js   server calls for one feature (`classesApi.list()`…) and query options (`classesQuery()`)
  stores/          client-only state (zustand): auth session, low-data mode
  hooks/           shared React hooks (useUnread: alerts badge)
  offline/         IndexedDB (Dexie): cached rosters, marks saved on the phone, the sync queue
  pages/           one screen per file, grouped by role: teacher/, parent/, admin/, office/
  components/
    ui/            the design kit: Button, Input, PasswordInput, Select, Card, Notice, Sheet, Toast, Avatar, Confetti
    layout/        AppShell (navigation), BoardHeader, LanguageSwitch, ErrorBoundary
    attendance/    StudentRow (P/A/L/Lv), ClassSlate, SyncBar
    auth/ pickup/ schools/ parent/ charts/   feature components
  lib/             small helpers with no React: dates, format, status colours, theme, image, push
  i18n/            kn.json (bundled), en.json and hi.json (loaded when chosen)
  sw.js            service worker: offline start, notifications with reply buttons
```

### State management

| Kind of state | Where it lives | Example |
| --- | --- | --- |
| Data from the server | TanStack Query, through `api/<feature>.js` query options | classes, rosters, dashboard |
| Data that must survive no network | IndexedDB via `offline/` (Dexie) | marks saved on the phone, cached rosters |
| App-wide client state | zustand stores in `stores/` | login session, low-data mode |
| One screen's form or UI state | `useState` in that component | the student form, which tab is open |

Reading: `useQuery(classesQuery())`. After a change: `qc.invalidateQueries({ queryKey: keys.classes })`.
**Two screens may share a cache key only if they expect the same data shape**; `keys.js` gives each shape its
own key (`classList` vs `classOverview`, `leaveFor('pending')` vs `leaveFor('all')`).

### Errors in the app

- `api/client.js` → `errorMessage(err)` gives a readable, translated message (network down, a known server
  code such as `school_pending`, or the server's own text).
- Requests that never reached the server retry for about 30 seconds; real server errors retry once.
- A save (`useMutation`) with no `onError` of its own still shows a toast (`main.jsx`).
- A screen that fails to load or crashes shows a Reload card instead of a blank page (`ErrorBoundary`),
  reloading once by itself if a newer version was deployed.

### Adding a screen

1. Add the server call to `api/<feature>.js` (and a key to `keys.js` if it is new data).
2. Create the page in `pages/<role>/`, using components from `components/ui`.
3. Add the route in `App.jsx` with the right `Guard`, and a navigation item in `components/layout/AppShell.jsx`.
4. Add the strings to all three files in `i18n/`.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| React components and pages | PascalCase file and function | `StudentRow.jsx`, `LeaveInbox.jsx` |
| Hooks | `useX` | `useUnread.js` |
| Server modules | `<feature>.<role>.js` | `attendance.service.js`, `pickup.pass.js` |
| API objects (client) | `<feature>Api` + `<thing>Query()` | `leaveApi.decide()`, `leaveQuery('pending')` |
| Translation keys | `area.thing`, camelCase | `mark.onLeave`, `office.approve` |
| Error codes | snake_case | `school_pending`, `udise_taken` |

## Quality checks

```bash
npm test                      # 61 API tests (server)
npm --prefix server run lint  # ESLint, server
npm --prefix client run lint  # ESLint + React hooks rules, app
npm run build                 # production build of the app
```
