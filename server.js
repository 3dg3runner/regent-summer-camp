/**
 * RSC Summer Camp Registration System — main entry point.
 *
 * Starts the Express HTTP server, wires up middleware, mounts the route modules,
 * and on first launch creates a default admin account so a brand-new deployment
 * isn't locked out.
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

const db = require('./src/config/database'); // initializes schema as a side effect
const User = require('./src/models/User');

const indexRoutes = require('./src/routes/index');
const dashboardRoutes = require('./src/routes/dashboard');
const adminRoutes = require('./src/routes/admin');
const { loadUser, requireLogin, requireAdmin } = require('./src/middleware/auth');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// --- View engine: EJS with a tiny layout helper ---------------------------
// (We avoid express-ejs-layouts to keep the dependency footprint small. The
//  helper just renders the page template into the body of the layout.)
app.engine('ejs', require('ejs').__express);
app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

const ejs = require('ejs');
const layoutPath = path.join(__dirname, 'src/views/layouts/main.ejs');

app.use((req, res, next) => {
  // Wrap res.render so every page is automatically inserted into the main layout.
  // Pages opt out by ending in `-bare` (none currently do).
  const originalRender = res.render.bind(res);
  res.render = function (view, options = {}) {
    options.title = options.title || 'Regent Summer Camp';
    ejs.renderFile(path.join(__dirname, 'src/views/pages', `${view.replace(/^pages\//, '')}.ejs`),
      { ...options, currentUser: res.locals.currentUser, flash: res.locals.flash },
      (err, body) => {
        if (err) {
          console.error('Render error:', err);
          if (!res.headersSent) {
            res.status(500).send('Internal server error');
          }
          return;
        }
        ejs.renderFile(layoutPath,
          { ...options, body, currentUser: res.locals.currentUser, flash: res.locals.flash },
          (err2, html) => {
            if (err2) {
              console.error('Layout render error:', err2);
              if (!res.headersSent) res.status(500).send('Internal server error');
              return;
            }
            res.send(html);
          });
      });
  };
  next();
});

// --- Standard middleware ---------------------------------------------------

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session storage uses SQLite as well, so deployments only need one persistent
// store. The `connect-sqlite3` table is auto-created.
const sessionsDir = path.dirname(process.env.DATABASE_PATH || path.join(__dirname, 'data/rsc.db'));
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: sessionsDir, table: 'sessions' }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

app.use(loadUser);

// --- Routes ----------------------------------------------------------------

app.use('/', indexRoutes);
app.use('/', requireLogin, dashboardRoutes);
app.use('/admin', requireLogin, requireAdmin, adminRoutes);

// 404 fallthrough
app.use((req, res) => {
  res.status(404).render('pages/error', {
    title: 'Page Not Found',
    message: `We couldn't find that page (${req.path}).`
  });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('pages/error', {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again.'
  });
});

// --- Bootstrap default admin if there isn't one ----------------------------

async function bootstrapAdmin() {
  if (User.countAdmins() === 0) {
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@regent.edu';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';
    const existing = User.findByEmail(email);
    if (existing) {
      // Promote the existing user instead of crashing on a UNIQUE violation.
      db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email.toLowerCase());
      console.log(`[bootstrap] Promoted existing user ${email} to admin.`);
    } else {
      await User.create({ email, password, fullName: 'Camp Administrator', role: 'admin' });
      console.log(`[bootstrap] Created default admin: ${email} / ${password}`);
      console.log('[bootstrap] Change this password immediately in production.');
    }
  }
}

bootstrapAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`RSC Summer Camp running on http://localhost:${PORT}`);
    if (!process.env.SMTP_HOST) {
      console.log('[email] SMTP not configured — emails will be printed to the console.');
    }
  });
}).catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});

module.exports = app;
