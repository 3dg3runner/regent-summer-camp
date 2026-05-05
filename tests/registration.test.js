/**
 * Unit tests for the registration & waitlist logic.
 *
 * These tests run against an isolated in-memory SQLite database (we override
 * DATABASE_PATH to ":memory:" before requiring any of our modules). That keeps
 * tests fast and prevents them from polluting the dev database. Run with:
 *
 *     npm test
 */

process.env.DATABASE_PATH = ':memory:';
process.env.SMTP_HOST = ''; // force email service into console mode

const test = require('node:test');
const assert = require('node:assert/strict');

// Important: require AFTER setting the env vars above.
const db = require('../src/config/database');
const User = require('../src/models/User');
const Camp = require('../src/models/Camp');
const Camper = require('../src/models/Camper');
const Registration = require('../src/models/Registration');
const RegistrationService = require('../src/services/registrationService');

// Silence the [EMAIL] console output during tests so the output stays readable.
const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[EMAIL]')) return;
  if (typeof args[0] === 'string' && args[0].startsWith('To:'))      return;
  if (typeof args[0] === 'string' && args[0].startsWith('From:'))    return;
  if (typeof args[0] === 'string' && args[0].startsWith('Subject:')) return;
  if (typeof args[0] === 'string' && /^[=\-]{40,}$/.test(args[0]))   return;
  originalLog(...args);
};

// -------- Test fixtures ---------------------------------------------------

async function freshFixtures({ capacity = 2 } = {}) {
  // Wipe everything between tests so each test starts from a clean slate.
  db.exec('DELETE FROM registrations; DELETE FROM campers; DELETE FROM camps; DELETE FROM users; DELETE FROM email_log;');

  const parent1 = await User.create({ email: 'p1@test.com', password: 'pw12345678', fullName: 'Parent One' });
  const parent2 = await User.create({ email: 'p2@test.com', password: 'pw12345678', fullName: 'Parent Two' });
  const parent3 = await User.create({ email: 'p3@test.com', password: 'pw12345678', fullName: 'Parent Three' });

  const camper1 = Camper.create({
    userId: parent1.id, firstName: 'Alice', lastName: 'A', dateOfBirth: '2012-01-01', grade: 7,
    emergencyContactName: 'Parent One', emergencyContactPhone: '5551111'
  });
  const camper2 = Camper.create({
    userId: parent2.id, firstName: 'Bob', lastName: 'B', dateOfBirth: '2011-01-01', grade: 8,
    emergencyContactName: 'Parent Two', emergencyContactPhone: '5552222'
  });
  const camper3 = Camper.create({
    userId: parent3.id, firstName: 'Cara', lastName: 'C', dateOfBirth: '2010-01-01', grade: 9,
    emergencyContactName: 'Parent Three', emergencyContactPhone: '5553333'
  });

  // Far enough in the future to not trigger the "camp started" rule, regardless
  // of when the test suite is run.
  const future = new Date(); future.setFullYear(future.getFullYear() + 1);
  const startDate = future.toISOString().slice(0, 10);
  const endLater = new Date(future); endLater.setDate(endLater.getDate() + 5);
  const endDate = endLater.toISOString().slice(0, 10);

  const camp = Camp.create({
    name: 'Test Camp', description: '', startDate, endDate, capacity, location: 'Lab 1',
    gradeMin: 6, gradeMax: 12, costCents: 0
  });

  return { parent1, parent2, parent3, camper1, camper2, camper3, camp };
}

// -------- Tests -----------------------------------------------------------

test('register: first sign-up under capacity becomes active', async () => {
  const { camper1, camp } = await freshFixtures({ capacity: 2 });
  const { registration, status } = await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  assert.equal(status, 'active');
  assert.equal(registration.status, 'active');
  assert.equal(registration.waitlist_pos, null);
  assert.equal(Camp.activeCount(camp.id), 1);
});

test('register: signup at capacity goes to waitlist position 1', async () => {
  const { camper1, camper2, camper3, camp } = await freshFixtures({ capacity: 2 });
  await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  await RegistrationService.register({ camperId: camper2.id, campId: camp.id });

  const result = await RegistrationService.register({ camperId: camper3.id, campId: camp.id });
  assert.equal(result.status, 'waitlist');
  assert.equal(result.registration.waitlist_pos, 1);
  assert.equal(Camp.activeCount(camp.id), 2);
  assert.equal(Camp.waitlistCount(camp.id), 1);
});

test('waitlist promotes head when an active camper drops', async () => {
  const { camper1, camper2, camper3, camp } = await freshFixtures({ capacity: 2 });
  const r1 = await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  await RegistrationService.register({ camperId: camper2.id, campId: camp.id });
  const r3 = await RegistrationService.register({ camperId: camper3.id, campId: camp.id });
  assert.equal(r3.status, 'waitlist');

  const drop = await RegistrationService.withdraw({ registrationId: r1.registration.id, reason: 'schedule conflict' });
  assert.ok(drop.promoted, 'a waitlisted camper should have been promoted');
  assert.equal(drop.promoted.camper.first_name, 'Cara');

  // Still at capacity, no one on the waitlist anymore.
  assert.equal(Camp.activeCount(camp.id), 2);
  assert.equal(Camp.waitlistCount(camp.id), 0);
});

test('waitlist shifts down when a middle waitlister drops', async () => {
  const { camper1, camper2, camper3, camp } = await freshFixtures({ capacity: 1 });
  await RegistrationService.register({ camperId: camper1.id, campId: camp.id });   // active
  const r2 = await RegistrationService.register({ camperId: camper2.id, campId: camp.id }); // wl 1
  const r3 = await RegistrationService.register({ camperId: camper3.id, campId: camp.id }); // wl 2

  assert.equal(r2.registration.waitlist_pos, 1);
  assert.equal(r3.registration.waitlist_pos, 2);

  await RegistrationService.withdraw({ registrationId: r2.registration.id });
  const r3After = Registration.findById(r3.registration.id);
  assert.equal(r3After.waitlist_pos, 1, 'the camper behind should shift up to position 1');
});

test('register: cannot register the same camper twice for the same camp', async () => {
  const { camper1, camp } = await freshFixtures();
  await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  await assert.rejects(
    () => RegistrationService.register({ camperId: camper1.id, campId: camp.id }),
    err => err.code === 'ALREADY_REGISTERED'
  );
});

test('register: a dropped camper can re-register and reuses the same row', async () => {
  const { camper1, camp } = await freshFixtures();
  const first = await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  await RegistrationService.withdraw({ registrationId: first.registration.id });

  const second = await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  // Reuses the same DB row to avoid the UNIQUE(camper_id, camp_id) violation.
  assert.equal(second.registration.id, first.registration.id);
  assert.equal(second.registration.status, 'active');
  assert.equal(second.registration.dropped_at, null);
});

test('register: rejects camper with grade outside camp range', async () => {
  process.env.DATABASE_PATH = ':memory:';
  db.exec('DELETE FROM registrations; DELETE FROM campers; DELETE FROM camps; DELETE FROM users;');
  const parent = await User.create({ email: 'p@test.com', password: 'pw12345678', fullName: 'Parent' });
  const youngCamper = Camper.create({
    userId: parent.id, firstName: 'Tiny', lastName: 'T', dateOfBirth: '2018-01-01', grade: 2,
    emergencyContactName: 'Parent', emergencyContactPhone: '5550000'
  });
  const future = new Date(); future.setFullYear(future.getFullYear() + 1);
  const camp = Camp.create({
    name: 'HS Camp', description: '', startDate: future.toISOString().slice(0,10),
    endDate: future.toISOString().slice(0,10), capacity: 10, location: '',
    gradeMin: 9, gradeMax: 12, costCents: 0
  });
  await assert.rejects(
    () => RegistrationService.register({ camperId: youngCamper.id, campId: camp.id }),
    err => err.code === 'GRADE_OUT_OF_RANGE'
  );
});

test('admin remove: promotes waitlist same as parent withdraw', async () => {
  const { camper1, camper2, camp } = await freshFixtures({ capacity: 1 });
  const active = await RegistrationService.register({ camperId: camper1.id, campId: camp.id });
  const waitlisted = await RegistrationService.register({ camperId: camper2.id, campId: camp.id });

  const result = await RegistrationService.adminRemove({ registrationId: active.registration.id });
  assert.ok(result.promoted);
  assert.equal(result.promoted.registration.id, waitlisted.registration.id);
  const drop = Registration.findById(active.registration.id);
  assert.equal(drop.drop_reason, 'Removed by administrator');
});

test('register: closed camps reject new signups', async () => {
  const { camper1, camp } = await freshFixtures();
  Camp.update(camp.id, { is_open: 0 });
  await assert.rejects(
    () => RegistrationService.register({ camperId: camper1.id, campId: camp.id }),
    err => err.code === 'CAMP_CLOSED'
  );
});
