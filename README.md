# RSC — Regent Summer Camp Registration System

A web application that lets parents register middle- and high-school students for Regent University's STEM summer camps and lets administrators manage rosters, capacity, and waitlists. Built for **CSCI 450 — Software Engineering**, Spring 2026.

> **Team:** Spencer Kotrosa (Project Lead / Backend), Steven Copeland (Frontend), Ethan Dickinson (Logic / User Stories), Jaden Abbott (Frontend / Documentation), Luke Lacy (Testing / User Guide)

---

## What it does

- **Parents** create an account, add one or more campers (their kids), browse open camps, and register. The system automatically places them in an open seat or on the waitlist depending on capacity. Email confirmations go out for every state change.
- **Administrators** create camps, set capacity, view rosters, see who's on the waitlist, and remove registrants. When an active registrant withdraws, the next person on the waitlist is automatically promoted and emailed.
- **Automation** is the point. The user never has to ask "is there room?" or "who's next on the waitlist?" — the system answers both questions and acts on them.

A live walkthrough of every page lives in [`docs/UserGuide.md`](docs/UserGuide.md).

---

## Quick start (local)

You need **Node.js 20 or newer** and a C/C++ toolchain (the `better-sqlite3` and `sqlite3` modules compile a small native binding).

```bash
git clone <this-repo>
cd rsc-summer-camp
npm install
cp .env.example .env
npm run seed-db        # creates ./data/rsc.db with sample camps + users
npm run dev            # starts on http://localhost:3000
```

**Default credentials** (after seeding):

| Role   | Email                       | Password       |
| ------ | --------------------------- | -------------- |
| Admin  | `admin@regent.edu`          | `ChangeMe123!` |
| Parent | `jane.smith@example.com`    | `Password123!` |
| Parent | `mike.johnson@example.com`  | `Password123!` |
| Parent | `lisa.brown@example.com`    | `Password123!` |

**Change `ChangeMe123!` immediately on any non-development deployment.** The default is set in `.env` via `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`; setting a different email/password before first boot creates that account instead.

---

## Running the tests

```bash
npm test
```

Eighteen unit/integration tests across three files (`tests/registration.test.js`, `tests/user.test.js`, `tests/email.test.js`) using Node's built-in `node:test` runner against an in-memory SQLite database. No external test framework required.

The tests cover the full registration lifecycle (active → full → waitlist → drop → auto-promotion), password hashing and verification, and email template rendering. See [`docs/ProjectReport.md` § Testing Design](docs/ProjectReport.md#testing-design) for the test design rationale.

---

## Deploying to Railway

The repo is configured for Railway out of the box.

1. **Push to GitHub.** Railway watches a branch.
2. **Create a new Railway project** → "Deploy from GitHub repo" → pick this repo.
3. **Add a Volume** to the service (Settings → Volumes) and mount it at `/data`. SQLite needs persistent disk; without the volume, the database resets on every redeploy.
4. **Set environment variables** in the Railway dashboard (Variables tab):
   - `SESSION_SECRET` — long random string. **Required.**
   - `DATABASE_PATH` — `/data/rsc.db` (matches the volume mount).
   - `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` — set once, before first boot.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — for real email delivery. If unset, emails are written to the server log instead (useful for staging).
5. **Deploy.** Railway runs `npm install` (Nixpacks auto-detects Node), then `npm start`. The healthcheck at `/health` returns 200 once the server is ready.
6. **First boot** automatically creates the admin account from `DEFAULT_ADMIN_*` and runs the schema migration. If you want sample data, open Railway's shell once and run `npm run seed-db`.

The `railway.json` and `nixpacks.toml` files in the repo root pin the Node version and the build packages (`python3`, `gcc` for native compilation) so deploys are reproducible.

---

## Project structure

```
.
├── server.js                 Express entry point, session + auth wiring
├── src/
│   ├── config/database.js    SQLite connection, schema, indexes
│   ├── models/               User / Camp / Camper / Registration data access
│   ├── services/
│   │   ├── registrationService.js   register / withdraw / admin-remove (transactional)
│   │   └── emailService.js          template rendering + SMTP/console transport
│   ├── middleware/auth.js    requireLogin / requireAdmin / loadUser
│   ├── routes/               public / dashboard / admin route handlers
│   └── views/                EJS templates (layouts/main.ejs + pages/*.ejs)
├── public/css/style.css      Hand-written CSS, Regent navy + gold palette
├── scripts/
│   ├── init-db.js            Apply schema to a fresh database
│   └── seed-db.js            Insert sample admin, parents, campers, camps
├── tests/                    Node:test suites (registration, user, email)
├── docs/
│   ├── ProjectProposal.md    Week 4 deliverable
│   ├── ProjectReport.md      Week 8 deliverable — full report
│   └── UserGuide.md          End-user walkthrough
├── railway.json              Railway build/deploy config
├── nixpacks.toml             Build packages (Node 20, python3, gcc)
└── package.json
```

Why this layout: routes are thin (parse input, call a service, render a view); models are pure data access; the registration service owns all business logic and runs every multi-step operation inside a `db.transaction()` so capacity checks and waitlist promotions can't race. See the [System Architecture & Design section](docs/ProjectReport.md#system-architecture--design) of the report for the full rationale.

---

## Tech stack

| Layer    | Choice                          | Why                                                                                                                                       |
| -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime  | Node.js 20                      | Team familiarity, single-language stack with the frontend.                                                                                |
| Server   | Express 4                       | Minimal, well-documented, no opinion about structure.                                                                                     |
| Views    | EJS                             | Server-rendered HTML — no build step, fast iteration, easy for any team member to edit.                                                   |
| Database | SQLite via `better-sqlite3`     | Single-file database, no external service to provision. Synchronous API simplifies transaction code. Plenty fast for camp-sized rosters. |
| Sessions | `express-session` + `connect-sqlite3` | Sessions persist across restarts in the same SQLite file.                                                                              |
| Auth     | `bcryptjs`                      | Pure-JS bcrypt; no native dependency beyond what we already use for the database.                                                         |
| Email    | `nodemailer`                    | Industry standard for SMTP from Node; falls back to console output when credentials aren't set.                                           |
| Testing  | `node:test` (built-in)          | Zero new dependencies; ships with Node 20+.                                                                                                |
| Hosting  | Railway                         | Free tier covers the demo; volumes give us persistent disk for SQLite.                                                                    |

The original proposal mentioned AWS for the database. We pivoted to SQLite for two reasons: (1) zero external services to provision means a teammate can clone the repo and have it running in under a minute, and (2) Railway's volume mount gives us persistent disk without paying for RDS. SQLite handles tens of thousands of registrations per second on a single core — well past anything a summer camp will throw at it.

---

## Documentation

| Document                                       | Audience       | What's in it                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | -------------- | ----- |
| [`docs/ProjectProposal.md`](docs/ProjectProposal.md) | Instructor     | Week 4 deliverable. Problem statement, proposed solution, plan of work, team roles. |
| [`docs/ProjectReport.md`](docs/ProjectReport.md)     | Instructor     | Week 8 deliverable. Customer requirements, glossary, user stories, GUI specs, functional + non-functional requirements, stakeholders, actors and goals, use cases, effort estimation, system model, architecture, data structures, algorithms, testing design, history and future work. |
| [`docs/UserGuide.md`](docs/UserGuide.md)             | Parents, admins | Step-by-step walkthroughs of every page and every common task.                                                                                                                                                                                                                              |

---

## License

Coursework — submitted for academic credit at Regent University, Spring 2026. Not licensed for redistribution.
