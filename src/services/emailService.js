/**
 * Email service.
 *
 * In production (when SMTP_HOST is set) this sends real email through Nodemailer.
 * In development (no SMTP credentials configured) it falls back to logging to the
 * console — meaning the system is fully testable end-to-end without ever needing
 * a real mail server. Every send is recorded to the email_log table so admins can
 * audit what was delivered, what bounced, and replay the queue if needed.
 *
 * Templates live in this file as plain functions returning { subject, text, html }.
 * Keeping them in code (as opposed to a templating engine) makes it trivial to
 * unit-test the bodies and to interpolate domain objects directly.
 */

const nodemailer = require('nodemailer');
const db = require('../config/database');

const FROM = process.env.EMAIL_FROM || 'Regent Summer Camp <noreply@regent.edu>';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // console mode

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
  return transporter;
}

function logEmail({ recipient, subject, body, template, status = 'sent', error = null }) {
  db.prepare(`
    INSERT INTO email_log (recipient, subject, body, template, status, error)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(recipient, subject, body, template, status, error);
}

async function sendEmail({ to, subject, text, html, template }) {
  const t = getTransporter();
  try {
    if (t) {
      await t.sendMail({ from: FROM, to, subject, text, html });
    } else {
      // Console mode — the most useful "fake" because it's actually visible.
      console.log('\n[EMAIL]'.padEnd(80, '='));
      console.log(`To:      ${to}`);
      console.log(`From:    ${FROM}`);
      console.log(`Subject: ${subject}`);
      console.log('-'.repeat(80));
      console.log(text);
      console.log('='.repeat(80) + '\n');
    }
    logEmail({ recipient: to, subject, body: text, template, status: 'sent' });
    return { ok: true };
  } catch (err) {
    console.error(`Email send failed for ${to}:`, err.message);
    logEmail({ recipient: to, subject, body: text, template, status: 'failed', error: err.message });
    return { ok: false, error: err.message };
  }
}

// -------- Templates --------------------------------------------------------

function fmtDate(iso) {
  // Display dates in a human-friendly form. Stored ISO; shown like "June 15, 2026".
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const templates = {
  enrollmentConfirmation({ parent, camper, camp }) {
    const subject = `You're enrolled! ${camper.first_name} is registered for ${camp.name}`;
    const text =
`Hi ${parent.full_name},

Great news — ${camper.first_name} ${camper.last_name} is officially enrolled in ${camp.name} at Regent University.

Camp details:
  Dates:    ${fmtDate(camp.start_date)} – ${fmtDate(camp.end_date)}
  Location: ${camp.location || 'TBA'}

Next steps:
  1. Log in to your account to review or update ${camper.first_name}'s profile, allergies, and emergency contacts.
  2. Watch for a follow-up email a week before the camp with drop-off and parking instructions.
  3. If your plans change, you can withdraw at any time from your dashboard — and the next family on the waitlist will automatically take the open spot.

We're looking forward to seeing ${camper.first_name} this summer!

— Regent Summer Camp`;
    return { subject, text, html: text.replace(/\n/g, '<br>') };
  },

  waitlistConfirmation({ parent, camper, camp, position }) {
    const subject = `${camper.first_name} is on the waitlist for ${camp.name}`;
    const text =
`Hi ${parent.full_name},

${camp.name} is currently full, so we've placed ${camper.first_name} ${camper.last_name} on the waitlist.

Current waitlist position: #${position}

How the waitlist works:
  - If a registered camper drops out, the first family on the list is promoted automatically and notified by email.
  - You'll keep your position even if you log out — no need to refresh the page.
  - You can remove ${camper.first_name} from the waitlist at any time from your account dashboard.

We'll be in touch the moment a spot opens up.

— Regent Summer Camp`;
    return { subject, text, html: text.replace(/\n/g, '<br>') };
  },

  promotedFromWaitlist({ parent, camper, camp }) {
    const subject = `Spot opened! ${camper.first_name} is now enrolled in ${camp.name}`;
    const text =
`Hi ${parent.full_name},

A spot has just opened up and ${camper.first_name} ${camper.last_name} has been moved from the waitlist into ${camp.name}.

Camp details:
  Dates:    ${fmtDate(camp.start_date)} – ${fmtDate(camp.end_date)}
  Location: ${camp.location || 'TBA'}

No action is required from you — the registration is already active. If you need to withdraw for any reason, you can do so from your dashboard.

— Regent Summer Camp`;
    return { subject, text, html: text.replace(/\n/g, '<br>') };
  },

  dropConfirmation({ parent, camper, camp, reason }) {
    const subject = `Withdrawal confirmed: ${camper.first_name} from ${camp.name}`;
    const text =
`Hi ${parent.full_name},

We've withdrawn ${camper.first_name} ${camper.last_name} from ${camp.name}.${reason ? `\n\nReason on file: "${reason}"` : ''}

If this was a mistake, log back in and re-register — but note that if the camp has filled up since you withdrew, you'll go to the bottom of the waitlist.

— Regent Summer Camp`;
    return { subject, text, html: text.replace(/\n/g, '<br>') };
  },

  welcome({ user }) {
    const subject = 'Welcome to Regent Summer Camp';
    const text =
`Hi ${user.full_name},

Thanks for creating an account. You can now:
  - Add your camper's information (one account can manage multiple campers).
  - Browse our open camps and register.
  - Track enrollment status and waitlist positions in real time.

Visit your dashboard any time to make changes.

— Regent Summer Camp`;
    return { subject, text, html: text.replace(/\n/g, '<br>') };
  }
};

// -------- Public API -------------------------------------------------------

const EmailService = {
  async sendEnrollmentConfirmation({ parent, camper, camp }) {
    const { subject, text, html } = templates.enrollmentConfirmation({ parent, camper, camp });
    return sendEmail({ to: parent.email, subject, text, html, template: 'enrollment' });
  },

  async sendWaitlistConfirmation({ parent, camper, camp, position }) {
    const { subject, text, html } = templates.waitlistConfirmation({ parent, camper, camp, position });
    return sendEmail({ to: parent.email, subject, text, html, template: 'waitlist' });
  },

  async sendPromotedFromWaitlist({ parent, camper, camp }) {
    const { subject, text, html } = templates.promotedFromWaitlist({ parent, camper, camp });
    return sendEmail({ to: parent.email, subject, text, html, template: 'promoted' });
  },

  async sendDropConfirmation({ parent, camper, camp, reason }) {
    const { subject, text, html } = templates.dropConfirmation({ parent, camper, camp, reason });
    return sendEmail({ to: parent.email, subject, text, html, template: 'dropped' });
  },

  async sendWelcome({ user }) {
    const { subject, text, html } = templates.welcome({ user });
    return sendEmail({ to: user.email, subject, text, html, template: 'welcome' });
  },

  // Exposed for tests & admin screens.
  _templates: templates,

  recentLog(limit = 50) {
    return db.prepare('SELECT * FROM email_log ORDER BY sent_at DESC LIMIT ?').all(limit);
  }
};

module.exports = EmailService;
