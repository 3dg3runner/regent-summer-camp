/**
 * Auth middleware. Attaches the current user to res.locals so views can render
 * conditional UI without every route having to pass the user through manually.
 */

const User = require('../models/User');

function loadUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = User.findById(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    }
  }
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) {
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  if (req.user.role !== 'admin') {
    res.status(403);
    return res.render('pages/error', { title: 'Forbidden', message: "You don't have permission to view that page." });
  }
  next();
}

module.exports = { loadUser, requireLogin, requireAdmin };
