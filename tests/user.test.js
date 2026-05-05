/**
 * Authentication tests: hashing, lookup, and password verification.
 */

process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const User = require('../src/models/User');

test('user creation hashes the password (no plaintext storage)', async () => {
  db.exec('DELETE FROM users');
  const user = await User.create({
    email: 'TEST@Example.com',
    password: 'mypassword123',
    fullName: 'Test User'
  });
  assert.notEqual(user.password_hash, 'mypassword123', 'password should never be stored in plain text');
  assert.equal(user.email, 'test@example.com', 'email should be normalized to lowercase');
});

test('verifyPassword returns true for correct password and false otherwise', async () => {
  db.exec('DELETE FROM users');
  const user = await User.create({
    email: 'verify@test.com',
    password: 'correct-horse-battery-staple',
    fullName: 'Verify Test'
  });
  assert.equal(await User.verifyPassword(user, 'correct-horse-battery-staple'), true);
  assert.equal(await User.verifyPassword(user, 'wrong-password'), false);
  assert.equal(await User.verifyPassword(null, 'anything'), false);
});

test('findByEmail is case-insensitive', async () => {
  db.exec('DELETE FROM users');
  await User.create({ email: 'CaseTest@Example.com', password: 'pw12345678', fullName: 'Case Test' });
  assert.ok(User.findByEmail('casetest@example.com'));
  assert.ok(User.findByEmail('CASETEST@EXAMPLE.COM'));
  assert.ok(User.findByEmail(' CaseTest@Example.com  '));
});

test('countAdmins reflects only users with role admin', async () => {
  db.exec('DELETE FROM users');
  await User.create({ email: 'a1@test.com', password: 'pw12345678', fullName: 'Admin 1', role: 'admin' });
  await User.create({ email: 'a2@test.com', password: 'pw12345678', fullName: 'Admin 2', role: 'admin' });
  await User.create({ email: 'p1@test.com', password: 'pw12345678', fullName: 'Parent 1' });
  assert.equal(User.countAdmins(), 2);
  assert.equal(User.count(), 3);
});
