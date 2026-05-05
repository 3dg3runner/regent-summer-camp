# RSC User Guide

Step-by-step walkthroughs for the two kinds of people who use this site:

- **[Parents](#for-parents)** — adults registering one or more children for camps.
- **[Administrators](#for-administrators)** — Regent University staff managing the camp program.

If you're stuck, you can always click the **Regent Summer Camp** logo in the top-left corner to get back to the home page.

---

## For parents

### 1. Creating an account

The first time you visit the site:

1. Click **Sign Up** in the top-right corner of the page.
2. Fill in:
   - **Full name** — the name you'd like the system to address you by in emails.
   - **Email address** — must be unique. This is what you'll log in with.
   - **Password** — at least 8 characters. Your password is hashed before being stored; nobody at Regent (including the site's administrators) can read it back.
   - **Phone number** *(optional)* — used by the camp office if they need to reach you.
3. Click **Create account**.

You'll be logged in automatically and dropped on your dashboard. You'll also receive a welcome email confirming the account.

> **If you forget your password,** contact the camp office. We don't yet have a self-serve password reset flow — that's on the future-work list. The office can verify your identity and set a new password for you.

### 2. Adding a camper

A "camper" is one of your children. You add them once and re-use the record for every camp registration.

1. From your dashboard, click **+ Add Camper** (or **Add Camper Now** if you have none yet).
2. Fill in:
   - **First name** and **last name**
   - **Date of birth**
   - **Grade** — the grade your child will be entering in the fall
   - **Allergies** — anything the camp staff should know about. Leave blank if none.
   - **Medical notes** — anything else relevant. Leave blank if none.
   - **Emergency contact name and phone** — someone other than yourself who can be reached during camp hours if needed.
3. Click **Save Camper**.

You can edit a camper at any time from the dashboard by clicking their card.

### 3. Browsing and registering for a camp

1. Click **Browse Camps** from the dashboard or top navigation.
2. You'll see every camp that's currently open for registration, with:
   - Camp name and dates
   - Grade range
   - Location
   - A capacity bar showing how full the camp is
3. Click **View Details** on any camp to see the description and the registration form.
4. On the camp detail page, pick which of your campers to register and click **Register This Camper**.

**What happens next depends on capacity:**

- **If there's room,** the camper is registered immediately. You'll see a green confirmation, and you'll get an email saying so.
- **If the camp is full,** the camper is added to the waitlist. You'll get an email confirming the waitlist position. If someone ahead of you drops out, you'll get a *second* email letting you know your camper has been moved into an active spot — no action required from you.

### 4. Checking on your registrations

Your dashboard shows a **Registrations** section listing every camp you've signed up for, with a status badge:

- 🟢 **Active** — your camper has a confirmed seat.
- 🟡 **Waitlist** — your camper is in the queue. The position number shows where in line.
- 🔴 **Dropped** — the registration has been withdrawn (by you or by the camp office).
- 🔵 **Completed** — the camp has ended. (Used after the program is over.)

Click any registration row to see the camp's full details.

### 5. Withdrawing from a camp

If you can no longer attend a camp:

1. From your dashboard, find the registration in the **Registrations** section.
2. Click **Withdraw** next to that row.
3. Confirm when prompted.
4. (Optional) The system may ask for a reason — anything from "scheduling conflict" to "moved out of state" — but it's optional.

You'll get a confirmation email. If your camper was actively registered (not waitlisted), the next person on the waitlist for that camp is automatically promoted into your seat. They get an email too.

> **You can re-register for a camp you previously dropped from**, as long as the camp's start date hasn't passed. If the camp is now full, you'll go to the bottom of the waitlist.

### 6. Common parent issues

**"I registered but didn't get an email."**

Check your spam folder first. If it's not there, the camp office can verify the registration in the database — log in and check your dashboard, the registration is the source of truth.

**"My child's grade changed and I want to update it."**

From the dashboard, click your camper's card → **Edit**. Note that changing grade does *not* re-validate existing registrations. If a camper is in a camp that no longer matches their grade, the camp office will work with you directly.

**"I need to register my child for two camps that overlap in dates."**

The system doesn't currently flag schedule conflicts — it'll let you register for both. That's deliberate (sometimes camps are half-day and don't actually conflict). It's your call.

---

## For administrators

> Default admin login: `admin@regent.edu` / `ChangeMe123!`
>
> **Change the password immediately.** The default value is intended for first-boot only. Log in, click your name in the top-right, and use the password reset flow… *(currently must be set via the database; password reset UI is on the future-work list)*. To change the default at install time, set `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` in the environment before first boot.

### 1. Logging in

Go to **Sign In**, enter your admin email and password. You'll be redirected to the **Admin** dashboard. The top navigation now shows an "Admin" link that wasn't there for regular users.

### 2. The admin dashboard

The first thing you see when you log in is the system overview:

- **Parents** — total number of parent accounts.
- **Campers** — total number of campers across all parents.
- **Camps** — total number of camps in the system (open and closed).
- **Active registrations** — total active registrations across all camps.

Below the stat grid is a table of every camp with its current active count, waitlist count, and a "View" / "Edit" button.

### 3. Creating a camp

1. Click **+ New Camp** on the admin dashboard.
2. Fill in:
   - **Name** — what families will see on the camp browser. Be specific (e.g., "Robotics & AI Week — July 6–10" rather than "Robotics").
   - **Description** — the elevator pitch shown on the camp detail page. 1–3 sentences is plenty.
   - **Start date** and **End date** — must be in `YYYY-MM-DD` format. End must be ≥ start.
   - **Capacity** — maximum number of active registrations. Once this many people register, everyone after goes to the waitlist.
   - **Location** — where it's held. Free-text.
   - **Grade range** — minimum and maximum eligible grades, inclusive. The system rejects registrations from campers outside this range.
   - **Cost (in cents)** — `35000` = $350.00. Stored as cents to avoid rounding errors.
3. Click **Save Camp**.

### 4. Editing or closing a camp

From the admin dashboard, click any camp's name → **Edit**.

You can change anything except the camp ID. Particularly important toggles:

- **Open for registration** — uncheck this to stop accepting new registrations *without* deleting existing ones. Use this when a camp is full and you want to hide it from the camp browser, or when registration window has closed.

### 5. Viewing a roster

From the admin dashboard, click any camp's name → **View**. You'll see:

- The camp's basic details.
- An **Active Registrations** table with parent name, parent email, parent phone, camper name, camper grade, registration date, and a **Remove** button per row.
- A **Waitlist** table (only shown if the camp has waitlist entries) ordered by waitlist position, with the same columns plus a position number.

The roster is the source of truth for the day-of camp check-in. Print this page (Ctrl/Cmd-P) for a physical hardcopy.

### 6. Removing a registrant

If a registrant needs to be removed by the office (no-show, behavioral issue, payment problem, etc.):

1. On the camp's roster page, find the row.
2. Click **Remove**.
3. Confirm.

The system marks the registration as `dropped` with reason "Removed by administrator", sends the family a notification email, and — if the removed registration was active — promotes the head of the waitlist into the freed seat (with an email to the promoted family). The same automatic promotion applies whether the parent withdraws or you remove.

### 7. Auditing the email log

Click **Email Log** in the top navigation to see every email the system has tried to send, in reverse-chronological order. Each row shows:

- Timestamp
- Recipient address
- Subject line
- Status (`sent` or `failed`)
- (If failed) the error message from the SMTP server

Use this when a parent calls saying "I didn't get an email." Check the log first; it'll tell you whether the system actually sent anything and, if it did, when.

### 8. SMTP configuration

If `SMTP_HOST` is not set in the environment, the system runs in **console mode**: emails are written to the server log instead of being delivered. This is fine for development and demos, not fine for production.

To enable real email delivery, set in the deployment environment:

| Variable      | Example                              |
| ------------- | ------------------------------------ |
| `SMTP_HOST`   | `smtp.sendgrid.net`                  |
| `SMTP_PORT`   | `587`                                |
| `SMTP_USER`   | `apikey`                             |
| `SMTP_PASS`   | (the SMTP password / API key)        |
| `EMAIL_FROM`  | `"Regent Summer Camp <camp@regent.edu>"` |

Restart the application. Emails will now be delivered through SMTP. The email log will record `sent` for successes and `failed` (with the error) for transient SMTP failures.

### 9. Common admin issues

**"A parent says they registered but they aren't on the roster."**

Check the email log first — search for their email. Then check the **Camps** page for that camp; the roster is the system of record. If the parent thinks they registered but no row exists, they may have abandoned the registration form before submitting.

**"I need to reorder the waitlist manually."**

The system doesn't currently expose a "move up / move down" UI for waitlist reordering. The waitlist is FIFO by registration time. If you need a special ordering, the cleanest approach is: remove the registrations and re-add them in the order you want.

**"I want to delete a camp."**

You can only delete a camp that has no registrations on it (active or waitlisted). For a camp with registrations, *close* it instead (uncheck "Open for registration") — that hides it from new sign-ups while preserving the historical roster.

**"I want to give another staff member admin access."**

There's currently no UI to promote a user to admin. Until that ships, do it manually: connect to the SQLite database and run `UPDATE users SET role = 'admin' WHERE email = '<their email>';`. They'll have admin rights on their next page load.

---

## Quick keyboard reference

| Action                    | How                                                  |
| ------------------------- | ---------------------------------------------------- |
| Get back home             | Click the **Regent Summer Camp** logo (top-left)     |
| Log out                   | Click your name (top-right) → **Sign Out**           |
| Print roster              | On the admin camp roster page: Ctrl/Cmd-P            |
| Find a parent             | Currently: Email Log search by email. Future: directory page on the admin dashboard. |

---

## Getting help

For technical issues that look like bugs (errors, broken pages, missing features that should exist), file an issue in the project's GitHub repository. For day-to-day questions about the camp program itself (refunds, schedules, scholarships), contact the camp office directly — that's outside the scope of this software.
