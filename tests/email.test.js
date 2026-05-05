/**
 * Tests for the email service. We don't try to validate SMTP delivery — instead
 * we verify that templates produce the expected content and that every send is
 * recorded in the email_log table.
 */

process.env.DATABASE_PATH = ':memory:';
process.env.SMTP_HOST = ''; // console mode

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const EmailService = require('../src/services/emailService');

// Suppress the "[EMAIL]" console output during the test run.
const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && (args[0].startsWith('[EMAIL]') || args[0].startsWith('To:') ||
       args[0].startsWith('From:') || args[0].startsWith('Subject:') || /^[=\-]{40,}$/.test(args[0]))) return;
  originalLog(...args);
};

const fixtures = {
  parent: { email: 'parent@test.com', full_name: 'Pat Parent' },
  camper: { first_name: 'Sam', last_name: 'Camper' },
  camp:   { name: 'Test Camp', start_date: '2026-07-15', end_date: '2026-07-19', location: 'Lab 1' }
};

test('enrollment template includes camper name, camp name, and dates', () => {
  const out = EmailService._templates.enrollmentConfirmation(fixtures);
  assert.match(out.subject, /Sam/);
  assert.match(out.subject, /Test Camp/);
  assert.match(out.text, /Sam Camper/);
  assert.match(out.text, /Test Camp/);
  assert.match(out.text, /July 15, 2026/); // human-formatted date
});

test('waitlist template includes the position number', () => {
  const out = EmailService._templates.waitlistConfirmation({ ...fixtures, position: 3 });
  assert.match(out.text, /#3/);
  assert.match(out.text, /full/i);
});

test('promotion template uses past-tense move language', () => {
  const out = EmailService._templates.promotedFromWaitlist(fixtures);
  assert.match(out.subject, /Spot opened/i);
  assert.match(out.text, /from the waitlist/i);
});

test('drop confirmation includes the reason when provided', () => {
  const withReason = EmailService._templates.dropConfirmation({ ...fixtures, reason: 'Family vacation' });
  assert.match(withReason.text, /Family vacation/);

  const noReason = EmailService._templates.dropConfirmation({ ...fixtures, reason: null });
  assert.doesNotMatch(noReason.text, /Reason on file/);
});

test('every send is recorded in email_log with a status', async () => {
  db.exec('DELETE FROM email_log');
  await EmailService.sendEnrollmentConfirmation({
    parent: fixtures.parent, camper: fixtures.camper, camp: fixtures.camp
  });
  const rows = db.prepare('SELECT * FROM email_log').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient, 'parent@test.com');
  assert.equal(rows[0].template, 'enrollment');
  assert.equal(rows[0].status, 'sent');
});
