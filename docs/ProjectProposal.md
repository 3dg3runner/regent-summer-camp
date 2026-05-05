# Project Proposal — RSC (Regent Summer Camp) Website Application

**Course:** CSCI 450 (02) — Software Engineering
**Instructor:** Dr. Johansen
**Date:** April 12, 2026 (Week 4)
**Team:** Spencer Kotrosa, Steven Copeland, Ethan Dickinson, Jaden Abbott, Luke Lacy

---

## 1. Project name

**RSC (Regent Summer Camp) Website Application**

---

## 2. Team members

### Spencer Kotrosa — Project Lead / Backend Developer

Experience in AWS database design and API integration. Languages: JavaScript, Java, Python, Lua, C++. Has shipped full-stack game projects in Unreal Engine, including dedicated server work. Brings the deepest backend and database experience on the team and will own scheduling, scope decisions, and the registration logic.

### Steven Copeland — Frontend Developer

JavaScript ecosystems (React, Next, Vue), Python, SQL, REST APIs, and website design. Will own the look and feel of the user-facing pages and the styling system.

### Ethan Dickinson — Developer / User Stories

Comfortable with Python; brings a clear voice for translating customer needs into user stories and acceptance criteria. Pairs with Steven and Jaden on the frontend.

### Jaden Abbott — Frontend / Documentation

Strong JavaScript and frontend experience; also Python, C#, and GitHub workflow. Owns documentation alongside frontend work, which keeps the docs accurate to what's actually shipping.

### Luke Lacy — Testing / User Guides

Frontend background (React, Tailwind, JavaScript, Python, CSS, C++). Owns the test plan, the test code, and the end-user-facing user guide.

---

## 3. Project description

### Problem

Regent University needs a system to track registration for its STEM summer camp. The current process — spreadsheets, email threads, paper forms — has three failure modes:

1. **Capacity is ambiguous.** When a camp fills up, nobody automatically knows. Late applicants get told "we'll add you to the waitlist" but the waitlist itself is informal and easy to lose track of.
2. **Withdrawals don't propagate.** When a registered family drops out, the spot stays empty unless an administrator notices and manually contacts the next family on the list. A waitlist is only useful if it actually moves.
3. **Communication is manual.** Confirmation emails, waitlist notices, and "a spot opened up" notices are all hand-written, which means they're slow, inconsistent, and sometimes forgotten.

The system needs to populate a database, but more importantly it needs to **process** that data — applying capacity rules, ordering the waitlist, sending notifications — without the administrator having to drive every step.

### Proposed solution

A web application that families and administrators access through a browser. The site has four main areas:

- **Home Page** — landing page that explains the camp program and points new visitors to sign up.
- **Registration Page** (camp browser + camper management) — parents see open camps and the campers they've added, and register a camper for a camp with one click.
- **Upcoming Events Page** — public listing of camps with dates and grade ranges.
- **Account Management Page** — signed-in dashboard where parents see their roster, the status of every registration (active, waitlisted, completed), and can drop a camper from a camp with an optional reason.

Behind the scenes, the system tracks who is currently registered and who is on the waitlist for each camp. When a parent registers a camper, the system checks capacity:

- If there's room, the camper is enrolled immediately and the parent receives a confirmation email.
- If the camp is full, the camper is placed on the waitlist (at the bottom) and the parent receives a "you're on the waitlist" email instead.

When a parent withdraws an active registration, the system automatically promotes the first person on the waitlist into the open seat and sends them a notification email — no administrator action required. Administrators can also remove registrations directly (for behavior issues, no-shows, etc.) and the same auto-promotion fires.

**Success measure:** an administrator can run the entire camp signup cycle — from posting a camp to closing the roster on day one — without ever sending a manual email about waitlist status, and without ever having to ask "is there a spot open?" The system answers both questions.

**Customer benefit:** less administrative work, faster turnaround for waitlisted families, and a clear self-serve interface that parents can use without calling the office.

---

## 4. Plan of work

### Functional features

- Account creation and login for parents, with password hashing.
- Add / edit / remove campers under a parent account, including grade and emergency contact.
- Browse open camps, filtered by grade eligibility.
- Register a camper for a camp; system places into active roster or waitlist based on capacity.
- Withdraw a registration with optional reason; automatic waitlist promotion fires when the withdrawal opens an active spot.
- Administrator interface: create, edit, close, and delete camps; view the full roster (active + waitlist) for each camp; remove a registrant with one click.
- Email notification on every state change: enrollment, waitlist placement, promotion from waitlist, withdrawal confirmation, account creation.

### Qualitative features

- Single-page-style flow within each section — minimal clicks to register or withdraw.
- Clear status badges (Active / Waitlist / Dropped / Completed) so a parent can see at a glance where they stand.
- Responsive layout that works on phone and desktop.
- Self-explanatory administrator dashboard with at-a-glance counts (parents, campers, registrations) and per-camp capacity bars.

### Team assignments

| Member          | Component                                                                 |
| --------------- | ------------------------------------------------------------------------- |
| Spencer Kotrosa | Backend systems: database schema, registration service, waitlist logic, email service, deployment to Railway. |
| Steven Copeland | Frontend: home, registration, account-management page layouts and styling.            |
| Ethan Dickinson | User stories, business-rule clarifications, parts of the dashboard logic.            |
| Jaden Abbott    | Frontend: admin dashboard, camp browser, camp detail page; documentation upkeep.       |
| Luke Lacy       | Test plan, test code (registration, user, email), end-user user guide.                |

### Timeline (estimated)

| Week | Milestone                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 4    | Proposal submitted. Repository scaffolded. Database schema drafted.                                     |
| 5    | Authentication and account management working. Camp browsing for parents.                              |
| 6    | Registration logic complete (active + waitlist + promotion). Email service wired up.                   |
| 7    | Admin dashboard complete. Test suite written. Deployed to Railway with sample data.                    |
| 8    | Final report written, user guide finalized, repository tagged for submission.                          |

---

## References

> RAngeljr. (2025, August 24). *Sad Kitty Meme — Sad kitty — Discover & Share GIFs*. Tenor. https://tenor.com/view/sad-kitty-gif-5011926961558752655
