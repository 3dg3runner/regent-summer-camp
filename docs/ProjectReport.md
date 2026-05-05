# Project Report — RSC (Regent Summer Camp) Registration Tracking System

**Course:** CSCI 450 — Software Engineering
**Instructor:** Dr. Johansen
**Semester:** Spring 2026
**Submission:** Week 8

**Team:**

- Spencer Kotrosa — Project Lead, Backend
- Steven Copeland — Frontend
- Ethan Dickinson — Logic / User Stories
- Jaden Abbott — Frontend / Documentation
- Luke Lacy — Testing / User Guide

**Contribution:** All team members contributed equally.

---

## Summary of Changes

| Version | Date           | Changes                                                                                                       |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 1.0     | April 12, 2026 | Initial proposal submitted (Week 4). See [`ProjectProposal.md`](ProjectProposal.md).                          |
| 1.1     | April 28, 2026 | Pivoted backend datastore from AWS RDS to SQLite (deployment simplicity, single-file persistence on Railway). |
| 1.2     | May 1, 2026    | Added admin "remove registrant" path that re-uses the waitlist-promotion code. Closes the asymmetry where parents could trigger promotion but admins couldn't. |
| 1.3     | May 5, 2026    | Final report compiled. Added effort estimation, completed user-story-to-test traceability, finalized testing design. |

---

## Table of Contents

1. [Customer Statement of Requirements](#customer-statement-of-requirements)
2. [Glossary of Terms](#glossary-of-terms)
3. [System Development](#system-development)
   - [User Stories](#user-stories)
   - [Graphical User Interface & Specifications](#graphical-user-interface--specifications)
4. [Requirements](#requirements)
   - [Non-functional Requirements](#non-functional-requirements)
   - [Functional Requirements](#functional-requirements)
   - [Stakeholders](#stakeholders)
   - [Actors and Goals](#actors-and-goals)
   - [Use Cases](#use-cases)
   - [Effort Estimation](#effort-estimation)
5. [System Model](#system-model)
6. [System Architecture & Design](#system-architecture--design)
7. [Data Structures and Algorithms](#data-structures-and-algorithms)
8. [Testing Design](#testing-design)
9. [History of Work, Current Status, & Future Work](#history-of-work-current-status--future-work)
10. [References](#references)

---

## Customer Statement of Requirements

> *Reproduced and lightly edited from the original Week 4 proposal interview with Dr. Johansen, who is acting as the customer for this engagement.*

Regent University will host a middle-school and high-school STEM Summer Camp and needs a computerized system to keep track of registration. Today the camp office uses a spreadsheet and an email inbox, which has three problems:

- **Capacity is hard to track in real time.** A camp may have twenty seats, but as registrations come in by phone and email it's easy to over-enroll or to leave seats empty because the count is stale.
- **The waitlist is informal.** When a camp fills, late applicants are told they're "on the list" but the list lives in an inbox. When a registered family drops out, the office has to remember to look at the inbox and email the next family — a step that's frequently delayed or skipped.
- **Confirmation and notification emails are written by hand.** Wording is inconsistent, sometimes families don't get one at all, and the office spends time on a task that should be automatic.

The customer needs:

1. A central database of camps, registrants, and their parents.
2. **Automation, not just storage.** Registering a camper should automatically place them on the active roster or the waitlist. Withdrawing a camper should automatically promote the next family on the waitlist. Every status change should send a clear, branded email without anyone in the office having to write it.
3. A self-serve interface so families can see their own status and drop themselves out without calling the office.
4. An administrator view that shows, for each camp, who's enrolled and who's waiting — at a glance, in the right order.

The customer is not interested in the implementation choices (database engine, language, hosting). The customer is interested in the experience: families see clearly what they're signed up for, the office doesn't field "did I get in?" phone calls, and waitlist seats get filled the moment they open up.

The system should be easy to navigate. New users — a parent who has never used the site before — should be able to sign up, add a camper, and complete a registration without external instruction. Administrators should not have to be trained for more than a few minutes to manage a camp.

---

## Glossary of Terms

| Term                            | Definition                                                                                                                                                                                                                  |
| ------------------------------- | ----- |
| **Active registration**         | A registration in which the camper currently holds a confirmed seat in the camp. Counted against the camp's capacity. |
| **Administrator** (admin)       | A user with elevated privileges. Creates and edits camps, views all rosters across all parents, and can remove any registration. |
| **Camp**                        | A single offering — name, description, start and end dates, location, capacity, eligible grade range, cost. The unit that registrations are made against. |
| **Camper**                      | A child (typically grades 6–12) who attends a camp. Belongs to exactly one parent account in the system. A parent may have multiple campers. |
| **Capacity**                    | The maximum number of active registrations a camp can hold. Once active count equals capacity, new registrations go to the waitlist. |
| **Drop / Withdraw**             | The act of removing an existing registration. The registration row is preserved (status set to `dropped`) for audit purposes; the seat is freed. |
| **Grade range**                 | The minimum and maximum grades eligible for a camp. The system enforces this at registration time. |
| **Parent**                      | A user with the `parent` role. The default role for any new sign-up. Owns one or more campers and registers them for camps. |
| **Promotion (from waitlist)**   | The automatic process of moving the head of a camp's waitlist into an active seat when an active registration is dropped. The system fires this transactionally and emails the promoted family. |
| **Registration**                | The link between a camper and a camp. Has a status (`active`, `waitlist`, `dropped`, `completed`) and, if waitlisted, a position in the queue. |
| **Roster**                      | The list of campers currently active in a camp, in registration order. |
| **Seed data**                   | Sample admin / parent / camper / camp records inserted by `npm run seed-db` for demonstration purposes. |
| **Session**                     | The authenticated identity of a logged-in user. Stored in a SQLite-backed session store; survives server restarts. |
| **Waitlist position**           | An integer ≥ 1 indicating where a waitlisted camper falls in the queue. Position 1 is next in line. |

---

## System Development

### User Stories

User stories are written from the point of view of the actor performing the action and are scoped to a single goal. Stories are numbered for traceability to test cases and acceptance criteria below.

**Parent stories**

- **US-1.** As a parent, I want to create an account with my email and a password so that I can come back and manage my children's registrations later.
- **US-2.** As a parent, I want to add my children's details (name, grade, emergency contact) so that I can register them for camps without retyping everything each time.
- **US-3.** As a parent, I want to see a list of upcoming camps with dates, grade ranges, and remaining seats so that I can choose what to sign my child up for.
- **US-4.** As a parent, I want to register one of my children for a camp with a single click so that I don't have to fill out a long form for every signup.
- **US-5.** As a parent, when a camp is full, I want the system to automatically place my child on the waitlist and tell me their position so that I know whether to wait or look for another camp.
- **US-6.** As a parent, I want to see the status of every registration I've made (active, waitlist, dropped) on my dashboard so that I always know where things stand.
- **US-7.** As a parent, I want to withdraw a registration with an optional reason so that I can free up the spot if my child can no longer attend.
- **US-8.** As a parent, I want to receive an email confirmation any time my child's registration status changes so that I don't have to keep logging in to check.
- **US-9.** As a parent who is on a waitlist, I want to be told by email the moment my child is promoted into an active seat so that I can plan accordingly.

**Administrator stories**

- **US-10.** As an administrator, I want to create new camps with a name, dates, capacity, and grade range so that families can register for them.
- **US-11.** As an administrator, I want to edit a camp's details after creation so that I can correct mistakes or update information.
- **US-12.** As an administrator, I want to close a camp to new registrations without deleting it so that the historical roster is preserved.
- **US-13.** As an administrator, I want to see the full roster of every camp — active and waitlisted, with parent contact info — so that I can manage the program.
- **US-14.** As an administrator, I want to remove any registrant for cause and have the next person on the waitlist promoted automatically so that the seat doesn't sit empty.
- **US-15.** As an administrator, I want a dashboard view showing total parents, total campers, total active registrations, and per-camp utilization so that I can see the health of the program at a glance.
- **US-16.** As an administrator, I want an audit log of every email the system sent so that I can verify families were notified.

### Graphical User Interface & Specifications

The application uses server-rendered HTML pages styled with a single hand-written stylesheet (`public/css/style.css`). The palette is Regent navy `#00356b` with gold `#c8a951` accents on buttons and active states. All pages share a common header and footer (`src/views/layouts/main.ejs`).

#### Public pages (no login required)

| Page          | Path        | Purpose                                                                                                                                            |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home          | `/`         | Welcome message, brief description of the program, prominent "Browse Camps" and "Sign Up" buttons.                                                 |
| About         | `/about`    | Background on the camp and the team. Used as a low-priority navigation target.                                                                     |
| Sign Up       | `/signup`   | Form: full name, email, password (twice), phone (optional). Validates email uniqueness and password length server-side. On success, sends a welcome email and logs the user in. |
| Sign In       | `/login`    | Form: email and password. Redirects to dashboard on success or back to the requested page if the user was redirected here.                          |

#### Authenticated parent pages

| Page         | Path                            | Purpose                                                                                                                                |
| ------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard    | `/dashboard`                    | Three sections: campers (with edit links), recent registrations (with status badges and withdraw button), and a strip of open camps.   |
| Camper form  | `/campers/new`, `/campers/:id/edit` | Captures camper name, date of birth, grade (number), allergies, medical notes, emergency contact name and phone.                       |
| Camp browser | `/camps`                        | Cards of every open camp, with capacity bar and "Details" link.                                                                        |
| Camp detail  | `/camps/:id`                    | Full camp description plus a registration form: pick a camper from a dropdown and submit. Shows a warning if the camp is currently full. |

#### Administrator pages

| Page                | Path                                | Purpose                                                                                                                              |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Admin dashboard     | `/admin`                            | Stat grid (parents, campers, camps, active registrations) and a table of every camp with active and waitlist counts.                 |
| Admin camp form     | `/admin/camps/new`, `/admin/camps/:id/edit` | Create / edit a camp. Edit form also shows a delete button for empty camps.                                                         |
| Admin camp detail   | `/admin/camps/:id`                  | Full roster: every active registration, every waitlisted registration in order, with parent name, phone, email, and a "Remove" button. |
| Email log           | `/admin/emails`                     | Reverse-chronological list of every email the system has sent (or attempted), with status `sent` or `failed`.                        |

#### GUI conventions

- Status badges use color: green (`active`), yellow (`waitlist`), red (`dropped`), blue (`completed`).
- Capacity bars show a horizontal fill proportional to (active / capacity), with red text below if the camp is full.
- Forms use server-side validation. Errors come back as a flash message at the top of the page; previously-entered values are preserved in a `formData` object so the user doesn't have to retype.
- Every destructive action (remove camp, remove registrant, delete camper) is wrapped in a JavaScript `confirm()` dialog as a guardrail against misclicks.

---

## Requirements

### Non-functional Requirements

| #     | Requirement                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | **Usability.** A parent should be able to sign up, add a camper, and complete a registration in fewer than 60 seconds with no training. |
| NFR-2 | **Responsiveness.** Every page must respond in under 500 ms on a typical broadband connection. Local benchmarks show <50 ms typical.    |
| NFR-3 | **Reliability.** The system must not lose registrations under concurrent updates. All multi-step operations run inside a database transaction. |
| NFR-4 | **Auditability.** Every email the system sends must be logged with timestamp, recipient, status, and (on failure) the error message.   |
| NFR-5 | **Security.** Passwords must be hashed with bcrypt before storage. Session cookies must be HTTP-only and (in production) Secure.        |
| NFR-6 | **Authorization.** A parent must never be able to see or modify another parent's data. Admin-only routes must reject non-admin sessions. |
| NFR-7 | **Portability.** The system must run on any platform with Node 20+. The default deployment target is Railway, but no Railway-specific code is permitted in the application. |
| NFR-8 | **Data persistence.** The database file must survive server restarts and redeployments (achieved via Railway volume mount in production). |
| NFR-9 | **Email graceful degradation.** If SMTP credentials are missing or invalid, the application must continue to function — emails are written to the server log instead of failing the request. |

### Functional Requirements

| #      | Requirement                                                                                                                                                          | Traces to               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| FR-1   | The system shall allow new users to register with email, password, full name, and (optionally) phone.                                                                | US-1                    |
| FR-2   | The system shall reject sign-ups whose email is already in use, with a clear message.                                                                                | US-1                    |
| FR-3   | The system shall require login for all parent and admin pages.                                                                                                       | US-1, US-13             |
| FR-4   | A parent shall be able to create, list, and edit their own campers.                                                                                                  | US-2                    |
| FR-5   | A parent shall be able to view a list of camps that are open for registration.                                                                                       | US-3                    |
| FR-6   | A parent shall be able to register a camper for a camp.                                                                                                              | US-4                    |
| FR-7   | The system shall reject registration attempts where the camper's grade is outside the camp's grade range.                                                            | US-4                    |
| FR-8   | The system shall reject registration attempts where the camper is already registered (active or waitlisted) for the camp.                                            | US-4                    |
| FR-9   | The system shall reject registration attempts after a camp's start date has passed.                                                                                  | US-4                    |
| FR-10  | If a camp's active count is below capacity at registration time, the system shall mark the registration `active`. Otherwise it shall mark the registration `waitlist` and assign it the next sequential waitlist position. | US-4, US-5              |
| FR-11  | The system shall send a tailored email on every status change: enrollment, waitlist placement, promotion from waitlist, and withdrawal confirmation.                 | US-8, US-9              |
| FR-12  | A parent shall be able to withdraw any of their own registrations.                                                                                                   | US-7                    |
| FR-13  | When an active registration is withdrawn, the system shall promote the lowest-position waitlist registration for the same camp into the open seat and renumber the remaining waitlist positions, all in a single transaction. | US-7, US-9              |
| FR-14  | An administrator shall be able to create, edit, and delete camps.                                                                                                    | US-10, US-11, US-12     |
| FR-15  | An administrator shall be able to view the full roster (active and waitlist) of any camp.                                                                            | US-13                   |
| FR-16  | An administrator shall be able to remove any registration; the same auto-promotion rule (FR-13) shall apply.                                                         | US-14                   |
| FR-17  | An administrator shall see, on the dashboard, total counts of parents, campers, active registrations, and per-camp utilization.                                      | US-15                   |
| FR-18  | An administrator shall see a chronological log of every email the system attempted to send.                                                                          | US-16                   |
| FR-19  | The system shall create a default admin account on first boot if no admin exists, using `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` from environment configuration. | (deployment requirement) |
| FR-20  | The system shall expose a `/health` endpoint returning HTTP 200 with `{status: "ok"}` for use by deployment-platform health checks.                                  | (deployment requirement) |

### Stakeholders

| Stakeholder                | Stake in the system                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Camp office staff**      | Primary daily users. Need fast roster and waitlist views and want to stop writing notification emails by hand.                 |
| **Parents / guardians**    | End users for sign-up. Need to know whether their child is in or waitlisted, and to manage that without phone calls.           |
| **Campers**                | Indirect beneficiaries. The system never represents them as users — they don't log in — but their data is in the system.       |
| **Regent University IT**   | Operates the deployment environment. Needs the system to be reasonable about resource use and to log enough to debug issues.   |
| **Course instructor (Dr. Johansen)** | Acts as the project's customer / approver. Evaluates whether the deliverable meets the stated requirements.            |
| **Project team**           | Owns code quality, documentation, and the test suite. Needs maintainability for the second-half-of-semester iteration.         |

### Actors and Goals

| Actor             | Type     | Goals                                                                                                          |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| **Anonymous visitor** | Primary  | Browse public information; create an account.                                                                  |
| **Parent**        | Primary  | Manage campers; register / withdraw; see status; receive notifications.                                        |
| **Administrator** | Primary  | Create and manage camps; view rosters; remove registrants; audit communications.                               |
| **Email service (SMTP)** | Supporting | Deliver outbound notifications. Out of project scope to operate; the system uses it as a black box.        |
| **Database (SQLite)**    | Supporting | Persist all application state. Internal to the deployment; the application owns its schema.                |

### Use Cases

Five core use cases — UC-1 through UC-5 — cover the registration lifecycle and the admin workflow. Each is shown below with a primary actor, preconditions, main success scenario, alternate flows, and the requirements it satisfies.

#### UC-1: Register for a camp (active path)

**Actor:** Parent
**Preconditions:** Parent is logged in. Parent has at least one camper. The camp is open and has active count < capacity.

| Step | Actor                             | System                                                                                                                                       |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigates to a camp's detail page |                                                                                                                                              |
| 2    |                                   | Displays the camp details, the parent's eligible campers, and a register form.                                                               |
| 3    | Picks a camper, clicks Register   |                                                                                                                                              |
| 4    |                                   | Begins a transaction. Verifies camp is open, not started, and grade-eligible. Verifies camper is not already registered. Counts current actives. |
| 5    |                                   | Active count < capacity → inserts a registration row with status `active`, registered_at = now. Commits.                                     |
| 6    |                                   | Sends an enrollment confirmation email; logs the send.                                                                                       |
| 7    |                                   | Redirects to dashboard with a "Registered for {camp}" flash.                                                                                  |

**Alternate flows:**
- **Camp is full at step 4** → see UC-2.
- **Grade out of range** → registration aborted, error flash shown. (FR-7)
- **Camper already registered** → registration aborted, error flash shown. (FR-8)

**Satisfies:** US-4, FR-6, FR-10, FR-11.

#### UC-2: Register for a camp (waitlist path)

**Actor:** Parent
**Preconditions:** Same as UC-1, except the camp's active count equals capacity.

| Step | Actor                  | System                                                                                                                            |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1–4  | (same as UC-1)         |                                                                                                                                   |
| 5    |                        | Active count == capacity → looks up the highest current waitlist position for the camp. Inserts registration with status `waitlist`, waitlist_pos = (highest + 1). |
| 6    |                        | Sends a waitlist-confirmation email noting the position; logs the send.                                                            |
| 7    |                        | Redirects to dashboard with "Camp full — added to waitlist (position N)" flash.                                                    |

**Satisfies:** US-5, FR-10, FR-11.

#### UC-3: Withdraw a registration (no waitlist behind)

**Actor:** Parent
**Preconditions:** Parent owns an active or waitlisted registration; camp has no waitlist behind this registration (or this registration is itself waitlisted).

| Step | Actor                                       | System                                                                                                                                      |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Clicks "Withdraw" on a registration row     |                                                                                                                                             |
| 2    |                                             | Begins transaction. Verifies the registration belongs to the requesting parent. Marks status `dropped`, dropped_at = now, drop_reason = (text or "Withdrawn by parent"). |
| 3    |                                             | If the dropped registration was on the waitlist, shifts down all later waitlist positions for that camp.                                    |
| 4    |                                             | Commits. Sends a withdrawal confirmation email.                                                                                              |

#### UC-4: Withdraw a registration (with auto-promotion)

**Actor:** Parent **or** Administrator
**Preconditions:** Withdrawn registration was `active`. Camp has at least one waitlisted registration.

| Step | Actor                          | System                                                                                                                                                                                                                |
| ---- | ------------------------------ | ----- |
| 1    | Triggers withdrawal as in UC-3 | Begins transaction. Marks dropped row's status as `dropped`. |
| 2    |                                | Selects the registration with the lowest waitlist_pos for this camp, ordered by registered_at as a tiebreaker. |
| 3    |                                | Updates that registration: status = `active`, waitlist_pos = NULL, promoted_at = now. |
| 4    |                                | Decrements every other waitlist_pos for this camp by 1, preserving the queue order. |
| 5    |                                | Commits. Sends a withdrawal email to the original family AND a "you've been promoted" email to the newly-active family. |

**Satisfies:** US-7, US-9, US-14, FR-12, FR-13, FR-16.

#### UC-5: Create a camp (administrator)

**Actor:** Administrator
**Preconditions:** Logged in as admin.

| Step | Actor                                | System                                                                                            |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1    | Goes to "New Camp" form              | Displays the form with empty fields.                                                              |
| 2    | Fills name, dates, capacity, grades, location, cost; submits |                                                                          |
| 3    |                                      | Validates: required fields present, end_date >= start_date, capacity > 0, grade_min ≤ grade_max.   |
| 4    |                                      | Inserts new row in `camps`. Redirects to the new camp's admin detail page with a success flash.    |

**Satisfies:** US-10, FR-14.

### Effort Estimation

We used the use-case-points (UCP) method as a sanity check on a more bottom-up component-level estimate.

**Use Case Points (rough)**

- **Unadjusted Actor Weight (UAW):** Parent and Administrator are both "complex" GUI actors at 3 points each. Email service and database are "simple" supporting actors at 1 point each. UAW = 3 + 3 + 1 + 1 = **8**.
- **Unadjusted Use Case Weight (UUCW):** UC-1 (≤ 7 transactions, average) = 10. UC-2 (≤ 7, average) = 10. UC-3 (≤ 4, simple) = 5. UC-4 (≤ 7, average) = 10. UC-5 (≤ 4, simple) = 5. UUCW = **40**.
- **Unadjusted UCP (UUCP) = UAW + UUCW = 48.**
- **Technical & Environmental factor:** ~0.85 (small team, familiar stack, low complexity). **Adjusted UCP ≈ 41.**
- **Productivity factor:** ~20 person-hours/UCP for a five-person student team in a four-week sprint. **≈ 820 person-hours.**

**Bottom-up estimate (component level)**

| Component                             | Hours    | Owner            |
| ------------------------------------- | -------- | ---------------- |
| Database schema, models               | 30       | Spencer          |
| Registration service (incl. transactions and tests) | 50    | Spencer          |
| Email service + templates             | 25       | Spencer          |
| Authentication, sessions, middleware  | 20       | Spencer          |
| Public pages + signup/login forms     | 20       | Steven           |
| Parent dashboard + camp browser       | 30       | Steven           |
| Admin dashboard + camp forms          | 30       | Jaden            |
| Admin roster page + email log         | 20       | Jaden            |
| User-story authoring + acceptance criteria | 15  | Ethan            |
| Camper-management screens (logic + form) | 20    | Ethan            |
| Test suite (registration + user + email) | 25     | Luke             |
| User guide                            | 15       | Luke             |
| Project report (this document)        | 30       | Jaden + everyone |
| Deployment + Railway config           | 10       | Spencer          |
| Code review + integration             | 30       | Whole team       |
| Buffer for refactors / bug fixing     | 30       | Whole team       |
| **Total**                             | **400 person-hours** | (≈ 80 hrs/member over 4 weeks) |

The bottom-up number is roughly half of the UCP estimate, which is expected: UCP includes ramp-up time and overhead that doesn't apply to a team that already knows the stack.

---

## System Model

The system is a server-rendered web application. Three external entities exist: the **browser** (one per user, parent or admin), the **database** (single SQLite file on disk), and the **SMTP server** (optional; used only for outbound email).

### Context diagram (textual)

```
                  ┌────────────────┐
                  │    Browser     │
                  │ (parent/admin) │
                  └───────┬────────┘
                          │ HTTPS (HTML, forms, sessions)
                          ▼
                  ┌────────────────┐
                  │  RSC Server    │
                  │  Express + EJS │
                  └───┬─────────┬──┘
                      │         │
            SQL │     │         │     SMTP
                ▼     ▼         ▼
       ┌────────────────┐  ┌────────────┐
       │ SQLite (rsc.db)│  │ SMTP relay │
       │   on disk      │  │ (optional) │
       └────────────────┘  └────────────┘
```

### Domain model (entities)

```
┌───────────────┐   1   *  ┌────────────────┐   *   1  ┌───────────────┐
│ User (parent) │──────────│ Camper         │          │ Camp          │
│ id            │          │ id             │          │ id            │
│ email         │          │ user_id   ─────┘          │ name          │
│ password_hash │          │ first_name                │ start_date    │
│ role          │          │ last_name                 │ end_date      │
└───────────────┘          │ grade                     │ capacity      │
                           │ allergies, notes          │ grade_min/max │
                           └──────┬─────────┘          │ is_open       │
                                  │ 1                  └────────┬──────┘
                                  │                             │ 1
                                  ▼ *                           ▼ *
                           ┌──────────────────────────────────────┐
                           │ Registration                          │
                           │ id                                    │
                           │ camper_id (FK)                        │
                           │ camp_id (FK)                          │
                           │ status: active|waitlist|dropped|...   │
                           │ waitlist_pos (NULL when active)       │
                           │ registered_at, dropped_at, ...        │
                           │ UNIQUE(camper_id, camp_id)            │
                           └──────────────────────────────────────┘
```

A user owns zero or more campers; a camp has zero or more registrations; a registration always belongs to exactly one camper and one camp. The unique constraint on `(camper_id, camp_id)` prevents double-registration. We allow the registration row to be reused after a drop (status flips back to `active`/`waitlist` and the dropped fields are nulled out) so re-registration works without violating the constraint.

### Sequence — register an active spot (UC-1)

```
Parent      Browser        Express             registrationService     DB           emailService
  │            │               │                       │                │                 │
  │ click reg  │               │                       │                │                 │
  │──────────▶│ POST /camps/.. │                       │                │                 │
  │           │──────────────▶│                       │                │                 │
  │           │               │ register(...)         │                │                 │
  │           │               │─────────────────────▶│                │                 │
  │           │               │                       │ BEGIN          │                 │
  │           │               │                       │───────────────▶│                 │
  │           │               │                       │ activeCount    │                 │
  │           │               │                       │───────────────▶│                 │
  │           │               │                       │◀───────────────│                 │
  │           │               │                       │ INSERT active  │                 │
  │           │               │                       │───────────────▶│                 │
  │           │               │                       │ COMMIT         │                 │
  │           │               │                       │───────────────▶│                 │
  │           │               │ ◀────────────────────│                │                 │
  │           │               │ enrollmentEmail(...)  │                │                 │
  │           │               │───────────────────────────────────────▶│ SMTP send       │
  │           │               │                       │                │ INSERT email_log │
  │           │ 302 → /dash   │                       │                │                 │
  │ flash: ok │◀──────────────│                       │                │                 │
```

### Sequence — withdraw with auto-promotion (UC-4)

```
Parent      Express        registrationService           DB              emailService
  │           │                    │                      │                    │
  │ withdraw  │ POST .../withdraw  │                      │                    │
  │──────────▶│──────────────────▶│ BEGIN                │                    │
  │           │                    │─────────────────────▶│                    │
  │           │                    │ UPDATE reg = dropped │                    │
  │           │                    │─────────────────────▶│                    │
  │           │                    │ SELECT next waitlist │                    │
  │           │                    │─────────────────────▶│                    │
  │           │                    │◀─────────────────────│                    │
  │           │                    │ UPDATE next = active │                    │
  │           │                    │─────────────────────▶│                    │
  │           │                    │ shiftWaitlist(-1)    │                    │
  │           │                    │─────────────────────▶│                    │
  │           │                    │ COMMIT               │                    │
  │           │                    │─────────────────────▶│                    │
  │           │                    │ dropEmail(orig)      │                    │
  │           │                    │─────────────────────────────────────────▶│
  │           │                    │ promoEmail(promoted) │                    │
  │           │                    │─────────────────────────────────────────▶│
```

The promoted family receives their notification on the same request; nobody has to remember to send it.

---

## System Architecture & Design

### High-level architecture

A classic **three-tier web application**:

```
┌───────────────────────── Presentation ──────────────────────────┐
│  EJS templates (src/views/)                                      │
│  Hand-written CSS (public/css/style.css)                         │
│  No JS framework on the client; minimal jQuery-free DOM.         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌──────────────────────── Application ────────────────────────────┐
│  Express routes (src/routes/)                                    │
│    - public:   index.js     (home, signup, login, health)        │
│    - parent:   dashboard.js (campers, camps, registrations)      │
│    - admin:    admin.js     (camp CRUD, rosters, email log)      │
│  Middleware (src/middleware/auth.js)                             │
│    - loadUser, requireLogin, requireAdmin                        │
│  Services (src/services/)                                        │
│    - registrationService.js  ← business logic, transactions      │
│    - emailService.js         ← templates + SMTP/console output   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌─────────────────────────── Data ────────────────────────────────┐
│  Models (src/models/)                                            │
│    - User.js, Camp.js, Camper.js, Registration.js                │
│    - Pure data access; no business rules.                        │
│  better-sqlite3 → SQLite file on disk.                           │
│  Sessions also persisted in SQLite via connect-sqlite3.          │
└──────────────────────────────────────────────────────────────────┘
```

### Design choices and rationale

**Why server-rendered HTML rather than a SPA?** This is a school project on a four-week budget with five developers, only some of whom have heavy frontend experience. A React-style SPA adds a build pipeline, an API surface to design, and a second mental model (client state vs. server state) to keep in sync. EJS gives us one model and zero build tools, which lets us spend the time on registration logic instead.

**Why SQLite?** The spec we were given (track summer camp registrations) involves at most a few dozen camps and a few thousand parents. SQLite handles that load on a single CPU without breaking a sweat. It's also a single file, which means a teammate clones the repo, runs `npm run seed-db`, and is up and running in 30 seconds — no Postgres install, no Docker. On Railway we mount a volume for persistence and we're done. Trading off: SQLite has no network protocol, so this server cannot be horizontally scaled. For a summer camp signup site, that's not a real constraint.

**Why a registration service instead of putting logic in routes?** Two reasons. First, the same business operation (withdraw + promote) is triggered from two routes (parent dashboard withdraw, admin remove). Putting it in a service means there's exactly one implementation. Second, the operation requires a transaction across multiple tables; that transaction needs to live somewhere that isn't HTTP-aware so we can test it directly against an in-memory database (which is exactly what the test suite does).

**Why bcryptjs and not bcrypt?** `bcrypt` is a native module that requires recompilation per Node version and per platform; it kept failing on the team's mixed-OS dev environment. `bcryptjs` is pure JavaScript, marginally slower (irrelevant for a login route), and works everywhere with no extra setup.

**Why split routes into three files?** The three files map to three middleware tiers: public (no auth), authenticated (any role), and admin-only. Keeping them separate makes the auth model obvious — a route in `admin.js` cannot accidentally be exposed to a non-admin because the file is mounted behind `requireAdmin`.

### Module responsibilities

| Module                         | Responsibility                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `server.js`                    | Wires Express, sessions, EJS, static files, routes, error handlers. Bootstraps the default admin on first boot.          |
| `src/config/database.js`       | Opens the SQLite database, applies the schema if missing, exports a `db` handle.                                         |
| `src/models/*.js`              | One file per entity. Pure CRUD: `create`, `findById`, `list`, etc. No business rules; no email; no transactions beyond a single SQL statement. |
| `src/services/registrationService.js` | Owns `register`, `withdraw`, `adminRemove`. Validates eligibility, runs transactions, calls the email service.   |
| `src/services/emailService.js` | Renders template-driven emails. Sends via SMTP if configured; otherwise writes to the console. Logs every send to `email_log`. |
| `src/middleware/auth.js`       | Loads the current user from the session, gates routes by login or by role.                                              |
| `src/routes/*.js`              | Parses inputs, calls a service or model, picks a view to render. Thin by design.                                         |
| `src/views/`                   | EJS templates. `layouts/main.ejs` wraps every page; `pages/*.ejs` is one template per URL.                              |

---

## Data Structures and Algorithms

### Database schema

Five tables. SQL is in `src/config/database.js`.

#### users

| Column            | Type             | Notes                                           |
| ----------------- | ---------------- | ----------------------------------------------- |
| `id`              | INTEGER PK       |                                                 |
| `email`           | TEXT NOT NULL    | Stored case-folded for case-insensitive lookup. UNIQUE. |
| `password_hash`   | TEXT NOT NULL    | bcrypt hash, 10 rounds.                         |
| `full_name`       | TEXT             |                                                 |
| `phone`           | TEXT             |                                                 |
| `role`            | TEXT NOT NULL    | `'parent'` or `'admin'`.                        |
| `created_at`      | TEXT NOT NULL    | ISO-8601 string.                                |

Indexes: `idx_users_email` on `email`.

#### camps

| Column         | Type            | Notes                                       |
| -------------- | --------------- | ------------------------------------------- |
| `id`           | INTEGER PK      |                                             |
| `name`         | TEXT NOT NULL   |                                             |
| `description`  | TEXT            |                                             |
| `start_date`   | TEXT NOT NULL   | ISO date.                                   |
| `end_date`     | TEXT NOT NULL   | ISO date.                                   |
| `capacity`     | INTEGER NOT NULL | Maximum number of active registrations.    |
| `location`     | TEXT            |                                             |
| `grade_min`    | INTEGER         | Inclusive.                                  |
| `grade_max`    | INTEGER         | Inclusive.                                  |
| `cost_cents`   | INTEGER         | Stored in cents to avoid floating-point math. |
| `is_open`      | INTEGER NOT NULL DEFAULT 1 | 0 = closed (admin-toggleable). |

#### campers

| Column                  | Type           | Notes                              |
| ----------------------- | -------------- | ---------------------------------- |
| `id`                    | INTEGER PK     |                                    |
| `user_id`               | INTEGER NOT NULL | FK → users.id (the parent).      |
| `first_name`, `last_name` | TEXT NOT NULL |                                    |
| `date_of_birth`         | TEXT           | ISO date.                          |
| `grade`                 | INTEGER        |                                    |
| `allergies`             | TEXT           |                                    |
| `medical_notes`         | TEXT           |                                    |
| `emergency_contact_name`, `emergency_contact_phone` | TEXT |                          |

Index: `idx_campers_user` on `user_id`.

#### registrations

| Column          | Type          | Notes                                                              |
| --------------- | ------------- | ------------------------------------------------------------------ |
| `id`            | INTEGER PK    |                                                                    |
| `camper_id`     | INTEGER NOT NULL | FK → campers.id.                                                |
| `camp_id`       | INTEGER NOT NULL | FK → camps.id.                                                  |
| `status`        | TEXT NOT NULL | `'active' | 'waitlist' | 'dropped' | 'completed'`.                  |
| `waitlist_pos`  | INTEGER       | NULL for active/dropped/completed; ≥ 1 when status = `'waitlist'`. |
| `registered_at` | TEXT NOT NULL |                                                                    |
| `promoted_at`   | TEXT          | Set when waitlist → active.                                        |
| `dropped_at`    | TEXT          | Set when status → `'dropped'`.                                     |
| `drop_reason`   | TEXT          |                                                                    |
| `UNIQUE(camper_id, camp_id)` |               | Prevents double-registration; reused on re-register.              |

Indexes: `idx_reg_camp_status` on `(camp_id, status)`, `idx_reg_camp_waitpos` on `(camp_id, waitlist_pos)`.

#### email_log

| Column        | Type          | Notes                                  |
| ------------- | ------------- | -------------------------------------- |
| `id`          | INTEGER PK    |                                        |
| `to_email`    | TEXT NOT NULL |                                        |
| `subject`     | TEXT          |                                        |
| `body`        | TEXT          | Full body, for audit.                  |
| `status`      | TEXT NOT NULL | `'sent'` or `'failed'`.                |
| `error`       | TEXT          | NULL unless `status = 'failed'`.       |
| `sent_at`     | TEXT NOT NULL |                                        |

### Key algorithms

#### Registration capacity check (atomic)

```javascript
db.transaction(() => {
  const activeCount = Camp.activeCount(campId);
  if (activeCount < capacity) {
    return Registration.insert({ camperId, campId, status: 'active', waitlistPos: null });
  } else {
    const highest = Registration.highestWaitlistPos(campId) ?? 0;
    return Registration.insert({ camperId, campId, status: 'waitlist', waitlistPos: highest + 1 });
  }
});
```

Wrapping the count and the insert in a single transaction prevents a race where two simultaneous registrations both observe `activeCount = capacity - 1` and both insert an `active` row. Under SQLite's default `IMMEDIATE` transaction mode, the second transaction blocks until the first commits, then sees the updated count.

#### Auto-promotion on withdrawal

```javascript
db.transaction(() => {
  const reg = Registration.findById(registrationId);
  Registration.setStatus(reg.id, { status: 'dropped', droppedAt: now, dropReason });

  if (reg.status === 'active') {
    // Promote head of waitlist into the open seat.
    const next = Registration.nextWaitlisted(reg.camp_id);
    if (next) {
      Registration.setStatus(next.id, { status: 'active', promotedAt: now, waitlistPos: null });
      Registration.shiftWaitlistDown(reg.camp_id, next.waitlist_pos);
      // (queue everyone behind shifts up by 1)
      promotedRegistration = next;
    }
  } else if (reg.status === 'waitlist') {
    // Just shift everyone behind this one up.
    Registration.shiftWaitlistDown(reg.camp_id, reg.waitlist_pos);
  }
});
```

The waitlist is maintained as a dense integer sequence 1..N. On promotion, the new active row's position becomes NULL, and every subsequent waitlist position is decremented by one. The cost is `O(W)` updates per drop, where W is the waitlist length — trivial at the scale of a summer camp (low tens of registrants per camp).

We chose this dense-integer scheme over a "linked-list-by-pointer" or "fractional positions" approach because:

1. The dataset is small enough that `O(W)` doesn't matter.
2. Dense integers make the admin's roster page trivially sortable in SQL: `ORDER BY waitlist_pos ASC`.
3. There's no risk of position numbers drifting toward floating-point noise (a known pitfall of the fractional approach when waitlists are reordered many times).

#### Email logging

Every call to the email service writes a row to `email_log` regardless of whether SMTP delivery succeeded. The status field captures success or failure; the error field captures the underlying SMTP error message on failure. The admin email-log view is a chronological dump of this table.

This means a failed delivery is visible to the operator without having to inspect server logs, and there's a paper trail proving (or disproving) that "we never got an email" claims.

#### Default admin bootstrap

On startup, `server.js` calls `bootstrapAdmin()`, which checks `User.countAdmins()`. If zero admins exist, it creates one using `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` from the environment. This makes the first deploy of the system self-sufficient: no manual `INSERT` into the database, no "now SSH in and run this script" step.

---

## Testing Design

The test strategy targets the three areas where mistakes would hurt most:

1. **Registration logic** — the rules around capacity, the waitlist, and re-registration are the heart of the application. A bug here directly damages the customer's data.
2. **Authentication / password handling** — a regression here is a security incident.
3. **Email content** — emails are the primary signal users receive about their status. Incorrect or empty emails = confused users + admin phone calls.

### Approach

- **Test runner:** Node's built-in `node:test` (no Jest, no Mocha, no extra dependencies).
- **Test database:** in-memory SQLite (`:memory:`). Each test resets the database state in a `beforeEach` hook by truncating the application tables.
- **No mocks for the database.** Tests run against the same SQLite layer the production code uses.
- **Email service mocked at the transport level.** The email-template tests verify content without actually sending mail; emails are intercepted and inspected.

### Test files

| File                              | Tests | Coverage area                                                                                                  |
| --------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `tests/registration.test.js`      | 9     | Full registration lifecycle: register active, register waitlist, drop active → promote head, drop middle waitlister → renumber, double-register rejected, dropped re-register reuses row, grade mismatch rejected, admin remove behaves identically to parent withdraw, closed camps reject. |
| `tests/user.test.js`              | 4     | Password hashed (no plaintext), `verifyPassword` correct/wrong, case-insensitive email lookup, `countAdmins`.   |
| `tests/email.test.js`             | 5     | Enrollment email content, waitlist email mentions position, promotion language, drop-reason inclusion, `email_log` rows recorded. |
| **Total**                         | **18**|                                                                                                                |

### Traceability — user stories to tests

| User story | Test                                                                       | Test file                       |
| ---------- | -------------------------------------------------------------------------- | ------------------------------- |
| US-1       | "user creation hashes the password (no plaintext storage)"                 | `tests/user.test.js`            |
| US-1       | "verifyPassword returns true for correct password and false otherwise"     | `tests/user.test.js`            |
| US-4, FR-10 | "register: under capacity → status=active"                                | `tests/registration.test.js`    |
| US-5       | "register: at capacity → status=waitlist with position 1"                  | `tests/registration.test.js`    |
| US-7       | "withdraw active: head of waitlist is promoted to active"                  | `tests/registration.test.js`    |
| US-7       | "withdraw waitlist (middle): later positions shift up"                     | `tests/registration.test.js`    |
| FR-8       | "register: same camper twice → ALREADY_REGISTERED"                         | `tests/registration.test.js`    |
| US-9       | "promotion email mentions the camp by name"                                | `tests/email.test.js`           |
| US-14, FR-16 | "admin remove: promotes waitlist same as parent withdraw"                | `tests/registration.test.js`    |
| FR-7       | "register: grade out of range rejected"                                    | `tests/registration.test.js`    |
| FR-13      | "drop reason is included in the withdrawal email"                          | `tests/email.test.js`           |
| NFR-4      | "email_log rows are written for every send"                                | `tests/email.test.js`           |

### Running the tests

```bash
npm test
# > rsc-summer-camp@1.0.0 test
# > node --test tests/*.test.js
# ...
# # tests 18
# # pass 18
# # fail 0
```

All 18 tests pass on Node 20 and Node 22. The test suite runs in roughly 3 seconds.

### What is not tested (and why)

- **Browser-side rendering.** We don't have Selenium / Playwright in the test loop. The view templates are simple enough that a typo is caught at first glance, and the team manually exercises every page during sprint review.
- **Concurrency under high load.** We rely on SQLite's transaction model (which we do test correctness of, indirectly). We don't load-test, because the customer's expected concurrent-user count is in the dozens, not thousands.
- **SMTP delivery itself.** We test that the email service produces correct content and writes a log row; we do not verify that an actual SMTP server delivered the message. This is a defensible boundary: SMTP delivery is an external integration whose reliability we don't own.

---

## History of Work, Current Status, & Future Work

### History of work

| Week | Milestones                                                                                                                                                                |
| ---- | ----- |
| 4    | Proposal submitted. Repo created on GitHub. Stack chosen (Node + Express + EJS + SQLite). Initial schema drafted on paper. |
| 5    | `database.js`, the four model files, and authentication wired up. `signup` and `login` flows working end-to-end. Default admin bootstrap added. Camper CRUD shipped. |
| 6    | Core registration service written, including the transactional capacity check and auto-promotion on withdrawal. Email service shipped with five templates. First six registration tests passed. |
| 7    | Admin dashboard, camp CRUD, admin roster page, and email-log view shipped. Test suite expanded to 18 tests. CSS rewritten from a default sans-serif to the Regent navy + gold palette. Deployed to Railway with a mounted volume; first end-to-end round-trip from a parent's browser to the admin's email log verified. |
| 8    | Project report written. User guide written. Code reviewed across the team; minor refactors to the dashboard view; final pass on error handling and flash messages. |

### Pivots from the original proposal

- **AWS RDS → SQLite.** Original proposal mentioned AWS for the backend database. We pivoted to SQLite for two practical reasons: (1) zero external services to provision lets a teammate clone the repo and have a fully working environment in under a minute, and (2) Railway's volume mount gives us persistent disk without paying for a managed database. The customer's constraints are well below SQLite's capabilities. We documented the tradeoff clearly in the README and architecture section.
- **AWS-side REST API → server-rendered HTML.** Original sketch implied a separate API. With server-rendered EJS we eliminated the API surface entirely. Less code, fewer moving parts.
- **Added admin-side "remove registrant" with the same auto-promotion path.** The original proposal had withdrawal driven only by parents. Mid-project, we noticed that an administrator removing someone (e.g. for behavior issues or no-show on day one) should fire the same waitlist promotion. We refactored `registrationService.withdraw` so both paths share one implementation.

### Current status

All 20 functional requirements are implemented. All 9 non-functional requirements are met (with the caveat that NFR-1's "60 seconds" is anecdotal — we have observed it in team usability checks, but not in a formal study). The test suite is at 18 tests, all passing. The application is deployed to Railway with sample data and the demo URL has been shared with the instructor.

### Future work

If the project continues into a second iteration, the next features in priority order would be:

1. **Payment integration.** The system tracks `cost_cents` per camp but currently does not collect payment. Stripe Checkout would slot into the registration flow naturally.
2. **CSV export of rosters.** Admins occasionally need to print a hardcopy roster for the day-of check-in desk. A "Download CSV" button on the admin camp detail page is a small feature with high practical value.
3. **Multi-session camps.** Today a camp is a single date range. In practice, the same content is sometimes offered as Session A (week 1) and Session B (week 2). Modeling this as a parent `Camp` with multiple `CampSession` children would handle that without breaking existing data.
4. **Per-parent dashboard customization.** Allow parents to subscribe to "tell me when a camp opens up matching grades 7–9" so they don't have to keep checking the camps page.
5. **Soft-delete for users.** Currently users can be created but not removed. A `is_active` flag and an admin "Deactivate user" button would let the office wind down accounts without breaking historical foreign keys.
6. **Email retry on transient failures.** Today, a failed email is logged and that's it. A small retry queue (every 30 seconds, three attempts) would absorb intermittent SMTP outages.
7. **Two-factor authentication for the admin role.** A summer camp roster is not high-stakes, but the principle of least surprise suggests admin accounts should be hardened.
8. **Accessibility audit.** The interface uses semantic HTML and high-contrast colors but has not been formally tested with screen readers or keyboard-only navigation. A WCAG 2.1 AA pass would be straightforward and worth doing.

### Lessons learned

- **Transactions over optimism.** The first cut of the registration service did the capacity check and the insert as separate calls. The waitlist test that registers two campers concurrently caught it. Wrapping in `db.transaction()` was a one-line fix and is now the team's default for any multi-step database operation.
- **Build the test database early.** Using an in-memory SQLite database from day one let us write tests as we wrote the registration service, not after. Several edge cases (re-register after drop, middle-waitlist drop renumbers) were discovered by the tests rather than by users.
- **Avoid native modules where possible.** `bcrypt` cost two team-days of "it works on mine but not on Steven's machine." Switching to `bcryptjs` cleared it instantly. Lesson: in a multi-OS team, prefer pure-JS dependencies unless the performance cost is meaningful.
- **Server-rendered HTML is underrated for projects of this size.** No build pipeline, no API design, no API versioning. We spent the time on the registration logic instead.

---

## References

- Marsic, I. *Software Engineering: Projects.* Rutgers University. https://www.ece.rutgers.edu/~marsic/books/SE/projects/  *(Adapted source for the project description.)*
- Cohn, M. (2004). *User Stories Applied: For Agile Software Development.* Addison-Wesley.  *(User-story format.)*
- Karner, G. (1993). *Resource Estimation for Objectory Projects.*  *(Use Case Points methodology.)*
- SQLite Consortium. *SQLite documentation: Transactions, Locking, and Concurrency.* https://www.sqlite.org/lockingv3.html  *(Concurrency model used in the design.)*
- Express.js team. *Express 4.x API reference.* https://expressjs.com/en/4x/api.html
- Nodemailer authors. *Nodemailer documentation.* https://nodemailer.com/
- RAngeljr. (2025, August 24). *Sad Kitty Meme — Sad kitty — Discover & Share GIFs.* Tenor. https://tenor.com/view/sad-kitty-gif-5011926961558752655  *(Original team-logo reference from the proposal.)*
