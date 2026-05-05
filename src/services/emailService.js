/**
 * Email service.
 *
 * Three delivery modes, picked at runtime in this priority order:
 *   1. Resend HTTPS API   — when RESEND_API_KEY is set. Required for Railway,
 *                           which blocks all outbound SMTP on Free/Hobby plans.
 *                           Uses port 443 (HTTPS) so it always gets through.
 *   2. SMTP (Nodemailer)  — when SMTP_HOST is set. Useful for local development
 *                           and for any host that doesn't block SMTP.
 *   3. Console            — fallback. Writes the email to stdout so you can
 *                           read it during local dev without configuring SMTP.
 *
 * Every send is recorded to the email_log table regardless of mode, so admins
 * can audit what was delivered, what bounced, and (in future work) replay
 * failed sends.
 *
 * Templates live in this file as plain functions returning { subject, text, html }.
 * Keeping them in code (as opposed to a templating engine) makes it trivial to
 * unit-test the bodies and to interpolate domain objects directly.
 */

const nodemailer = require('nodemailer');
const db = require('../config/database');

const FROM = process.env.EMAIL_FROM || 'Regent Summer Camp <onboarding@resend.dev>';

// -------- Transport: Resend HTTPS API ------------------------------------

/**
 * Send an email via Resend's HTTPS API. Returns nothing on success; throws on
 * any non-2xx response so the caller's try/catch can log the failure normally.
 *
 * Why we use this on Railway: Railway blocks all outbound SMTP ports on the
 * Free, Trial, and Hobby plans (and intermittently on Pro). HTTPS to port 443
 * is always allowed, so the API path is the only reliable way to send email
 * from a Railway-hosted service unless you upgrade to a paid plan AND get
 * lucky with their firewall policy.
 */
async function sendViaResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      text,
      html
    })
  });
  if (!response.ok) {
    // Resend returns a JSON body with `message` and `name` on errors.
    const body = await response.text();
    throw new Error(`Resend API ${response.status}: ${body}`);
  }
  return response.json();
}

// -------- Transport: SMTP (Nodemailer) -----------------------------------

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

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

// -------- Logging --------------------------------------------------------

function logEmail({ recipient, subject, body, template, status = 'sent', error = null }) {
  db.prepare(`
    INSERT INTO email_log (recipient, subject, body, template, status, error)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(recipient, subject, body, template, status, error);
}

// -------- Top-level send -------------------------------------------------

async function sendEmail({ to, subject, text, html, template }) {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, subject, text, html });
    } else {
      const t = getTransporter();
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
  },

  verifyEmail({ user, verificationUrl }) {
    const subject = 'Please verify your email address';
    const text =
`Hi ${user.full_name},

Thanks for creating an account at Regent Summer Camp. To finish setting up, please confirm your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours. If it expires before you can use it, log in and click "Resend verification email" on your dashboard to get a fresh one.

You can sign in and add campers right away, but you'll need to verify your email before you can register a camper for a camp.

If you didn't create this account, you can safely ignore this message — no further emails will be sent.

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

  async sendVerifyEmail({ user, verificationUrl }) {
    const { subject, text, html } = templates.verifyEmail({ user, verificationUrl });
    return sendEmail({ to: user.email, subject, text, html, template: 'verify-email' });
  },

  // Exposed for tests & admin screens.
  _templates: templates,

  recentLog(limit = 50) {
    return db.prepare('SELECT * FROM email_log ORDER BY sent_at DESC LIMIT ?').all(limit);
  }
};

module.exports = EmailService;
