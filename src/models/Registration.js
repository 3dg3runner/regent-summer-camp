/**
 * Registration model — links a Camper to a Camp with a status.
 *
 * Status values:
 *   active     — currently enrolled and counted against capacity
 *   waitlist   — capacity full at registration time; will be promoted on a drop
 *   dropped    — was enrolled or waitlisted and withdrew
 *   completed  — camp ended successfully (set by an admin or scheduled job)
 *
 * Direct creation should always go through the registrationService — it owns the
 * capacity-checking and waitlist-position logic. The methods here are the
 * lower-level building blocks that the service composes.
 */

const db = require('../config/database');

const Registration = {
  insert({ camperId, campId, status, waitlistPos = null }) {
    const stmt = db.prepare(`
      INSERT INTO registrations (camper_id, camp_id, status, waitlist_pos)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(camperId, campId, status, waitlistPos);
    return Registration.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
  },

  findByCamperAndCamp(camperId, campId) {
    return db.prepare('SELECT * FROM registrations WHERE camper_id = ? AND camp_id = ?').get(camperId, campId);
  },

  /**
   * Returns rows for displaying registrations alongside parent/camper/camp context.
   * Used by both the parent's "my registrations" page and the admin dashboard.
   */
  listForUser(userId) {
    return db.prepare(`
      SELECT r.*, c.name AS camp_name, c.start_date, c.end_date, c.location,
             cm.first_name, cm.last_name
      FROM registrations r
      JOIN camps   c  ON r.camp_id   = c.id
      JOIN campers cm ON r.camper_id = cm.id
      WHERE cm.user_id = ?
      ORDER BY c.start_date ASC, r.registered_at ASC
    `).all(userId);
  },

  listForCamp(campId) {
    return db.prepare(`
      SELECT r.*, cm.first_name, cm.last_name, u.email AS parent_email, u.full_name AS parent_name, u.phone AS parent_phone
      FROM registrations r
      JOIN campers cm ON r.camper_id = cm.id
      JOIN users   u  ON cm.user_id  = u.id
      WHERE r.camp_id = ?
      ORDER BY
        CASE r.status WHEN 'active' THEN 1 WHEN 'waitlist' THEN 2 WHEN 'dropped' THEN 3 ELSE 4 END,
        r.waitlist_pos ASC NULLS LAST,
        r.registered_at ASC
    `).all(campId);
  },

  setStatus(id, status, extra = {}) {
    const sets = ['status = ?'];
    const values = [status];

    if (extra.waitlistPos !== undefined) {
      sets.push('waitlist_pos = ?');
      values.push(extra.waitlistPos);
    }
    if (extra.droppedAt !== undefined) {
      sets.push('dropped_at = ?');
      values.push(extra.droppedAt);
    }
    if (extra.dropReason !== undefined) {
      sets.push('drop_reason = ?');
      values.push(extra.dropReason);
    }
    if (extra.promotedAt !== undefined) {
      sets.push('promoted_at = ?');
      values.push(extra.promotedAt);
    }

    values.push(id);
    db.prepare(`UPDATE registrations SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return Registration.findById(id);
  },

  /**
   * The single-most-important query in the system: find the next person to promote
   * off the waitlist when a spot opens up. Lowest waitlist_pos wins; ties broken by
   * who registered first (FIFO).
   */
  nextWaitlisted(campId) {
    return db.prepare(`
      SELECT * FROM registrations
      WHERE camp_id = ? AND status = 'waitlist'
      ORDER BY waitlist_pos ASC, registered_at ASC
      LIMIT 1
    `).get(campId);
  },

  /**
   * After someone is promoted off the waitlist (or removed), shift everyone behind
   * them up by one. Wrapped in a transaction by the caller for atomicity.
   */
  shiftWaitlistDown(campId, fromPos) {
    db.prepare(`
      UPDATE registrations
      SET waitlist_pos = waitlist_pos - 1
      WHERE camp_id = ? AND status = 'waitlist' AND waitlist_pos > ?
    `).run(campId, fromPos);
  },

  highestWaitlistPos(campId) {
    const row = db.prepare(`
      SELECT MAX(waitlist_pos) AS max_pos
      FROM registrations
      WHERE camp_id = ? AND status = 'waitlist'
    `).get(campId);
    return row.max_pos || 0;
  }
};

module.exports = Registration;
