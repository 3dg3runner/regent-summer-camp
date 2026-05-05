/**
 * User model — handles parents and admins.
 *
 * Passwords are hashed with bcrypt (10 rounds). Email lookups are case-insensitive
 * because users tend to inconsistently capitalize their email when logging back in.
 */

const bcrypt = require('bcryptjs');
const db = require('../config/database');

const SALT_ROUNDS = 10;

const User = {
  async create({ email, password, fullName, phone = null, role = 'parent' }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, phone, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(email.toLowerCase().trim(), passwordHash, fullName, phone, role);
    return User.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  },

  async verifyPassword(user, plainPassword) {
    if (!user) return false;
    return bcrypt.compare(plainPassword, user.password_hash);
  },

  async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  },

  list() {
    return db.prepare('SELECT id, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC').all();
  },

  count() {
    return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  },

  countAdmins() {
    return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
  }
};

module.exports = User;
