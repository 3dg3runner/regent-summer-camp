/**
 * Camper model — a child belonging to a parent (User). One parent can have many campers.
 */

const db = require('../config/database');

const Camper = {
  create({ userId, firstName, lastName, dateOfBirth, grade, allergies = null, medicalNotes = null, emergencyContactName, emergencyContactPhone }) {
    const stmt = db.prepare(`
      INSERT INTO campers
        (user_id, first_name, last_name, date_of_birth, grade, allergies, medical_notes, emergency_contact_name, emergency_contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(userId, firstName, lastName, dateOfBirth, grade, allergies, medicalNotes, emergencyContactName, emergencyContactPhone);
    return Camper.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM campers WHERE id = ?').get(id);
  },

  listByUser(userId) {
    return db.prepare('SELECT * FROM campers WHERE user_id = ? ORDER BY first_name').all(userId);
  },

  list() {
    return db.prepare(`
      SELECT campers.*, users.email AS parent_email, users.full_name AS parent_name
      FROM campers
      JOIN users ON campers.user_id = users.id
      ORDER BY last_name, first_name
    `).all();
  },

  update(id, fields) {
    const allowed = ['first_name', 'last_name', 'date_of_birth', 'grade', 'allergies', 'medical_notes', 'emergency_contact_name', 'emergency_contact_phone'];
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) return Camper.findById(id);
    values.push(id);
    db.prepare(`UPDATE campers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return Camper.findById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM campers WHERE id = ?').run(id);
  },

  ownedBy(camperId, userId) {
    const row = db.prepare('SELECT user_id FROM campers WHERE id = ?').get(camperId);
    return row && row.user_id === userId;
  }
};

module.exports = Camper;
