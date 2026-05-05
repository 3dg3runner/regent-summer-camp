/**
 * Database configuration using better-sqlite3.
 *
 * SQLite was chosen for portability: the database is a single file, requires no
 * external service, and Railway can persist it via a Volume mount. For a small-
 * scale registration system (a few hundred campers per session) this is more than
 * adequate. Migration to Postgres would only require swapping this module — the
 * rest of the application uses parameterized queries that translate directly.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'rsc.db');

// Ensure the data directory exists before opening the file.
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// WAL mode gives us better concurrency for reads while writes are happening.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Schema definition. All tables are created if they don't already exist, so this
 * is idempotent and safe to run on every startup.
 */
function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      full_name     TEXT    NOT NULL,
      phone         TEXT,
      role          TEXT    NOT NULL DEFAULT 'parent' CHECK(role IN ('parent','admin')),
      created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS camps (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      description  TEXT,
      start_date   TEXT    NOT NULL,
      end_date     TEXT    NOT NULL,
      capacity     INTEGER NOT NULL CHECK(capacity > 0),
      location     TEXT,
      grade_min    INTEGER NOT NULL DEFAULT 6,
      grade_max    INTEGER NOT NULL DEFAULT 12,
      cost_cents   INTEGER NOT NULL DEFAULT 0,
      is_open      INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campers (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                  INTEGER NOT NULL,
      first_name               TEXT    NOT NULL,
      last_name                TEXT    NOT NULL,
      date_of_birth            TEXT    NOT NULL,
      grade                    INTEGER NOT NULL,
      allergies                TEXT,
      medical_notes            TEXT,
      emergency_contact_name   TEXT    NOT NULL,
      emergency_contact_phone  TEXT    NOT NULL,
      created_at               TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      camper_id       INTEGER NOT NULL,
      camp_id         INTEGER NOT NULL,
      status          TEXT    NOT NULL CHECK(status IN ('active','waitlist','dropped','completed')),
      waitlist_pos    INTEGER,
      registered_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      dropped_at      TEXT,
      drop_reason     TEXT,
      promoted_at     TEXT,
      FOREIGN KEY (camper_id) REFERENCES campers(id) ON DELETE CASCADE,
      FOREIGN KEY (camp_id)   REFERENCES camps(id)   ON DELETE CASCADE,
      UNIQUE (camper_id, camp_id)
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient   TEXT    NOT NULL,
      subject     TEXT    NOT NULL,
      body        TEXT    NOT NULL,
      template    TEXT,
      status      TEXT    NOT NULL DEFAULT 'sent',
      error       TEXT,
      sent_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for the queries the waitlist service runs most frequently.
    CREATE INDEX IF NOT EXISTS idx_reg_camp_status   ON registrations(camp_id, status);
    CREATE INDEX IF NOT EXISTS idx_reg_camp_waitlist ON registrations(camp_id, waitlist_pos);
    CREATE INDEX IF NOT EXISTS idx_camper_user       ON campers(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
  `);
}

initializeSchema();

module.exports = db;
