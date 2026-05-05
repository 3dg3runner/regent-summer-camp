/**
 * Camp model — represents a single summer camp session that families can sign up for.
 */

const db = require('../config/database');

const Camp = {
  create({ name, description, startDate, endDate, capacity, location, gradeMin = 6, gradeMax = 12, costCents = 0 }) {
    const stmt = db.prepare(`
      INSERT INTO camps (name, description, start_date, end_date, capacity, location, grade_min, grade_max, cost_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name, description, startDate, endDate, capacity, location, gradeMin, gradeMax, costCents);
    return Camp.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM camps WHERE id = ?').get(id);
  },

  list({ openOnly = false } = {}) {
    const sql = openOnly
      ? 'SELECT * FROM camps WHERE is_open = 1 ORDER BY start_date ASC'
      : 'SELECT * FROM camps ORDER BY start_date ASC';
    return db.prepare(sql).all();
  },

  /**
   * Returns each camp augmented with counts of active registrations and waitlisted
   * campers. Used by the admin dashboard and the camper-facing browse page.
   */
  listWithCounts({ openOnly = false } = {}) {
    const where = openOnly ? 'WHERE c.is_open = 1' : '';
    return db.prepare(`
      SELECT
        c.*,
        COALESCE(SUM(CASE WHEN r.status = 'active'   THEN 1 ELSE 0 END), 0) AS active_count,
        COALESCE(SUM(CASE WHEN r.status = 'waitlist' THEN 1 ELSE 0 END), 0) AS waitlist_count
      FROM camps c
      LEFT JOIN registrations r ON r.camp_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY c.start_date ASC
    `).all();
  },

  update(id, fields) {
    const allowed = ['name', 'description', 'start_date', 'end_date', 'capacity', 'location', 'grade_min', 'grade_max', 'cost_cents', 'is_open'];
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) return Camp.findById(id);
    values.push(id);
    db.prepare(`UPDATE camps SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return Camp.findById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM camps WHERE id = ?').run(id);
  },

  activeCount(campId) {
    return db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE camp_id = ? AND status = 'active'").get(campId).c;
  },

  waitlistCount(campId) {
    return db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE camp_id = ? AND status = 'waitlist'").get(campId).c;
  }
};

module.exports = Camp;
