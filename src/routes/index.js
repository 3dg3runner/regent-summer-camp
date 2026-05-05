/**
 * Public routes: home, signup, login, logout. No authentication required.
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Camp = require('../models/Camp');
const EmailService = require('../services/emailService');

router.get('/', (req, res) => {
  const camps = Camp.listWithCounts({ openOnly: true });
  res.render('pages/home', { title: 'Regent Summer Camp', camps });
});

router.get('/health', (req, res) => {
  // Lightweight health check used by Railway's deploy probe.
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('pages/signup', { title: 'Create Account', errors: [], form: {} });
});

router.post('/signup', async (req, res) => {
  const { email, password, password_confirm, full_name, phone } = req.body;
  const errors = [];

  if (!email || !email.includes('@')) errors.push('A valid email is required.');
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password !== password_confirm) errors.push('Passwords do not match.');
  if (!full_name || full_name.trim().length < 2) errors.push('Please enter your full name.');

  if (errors.length === 0) {
    const existing = User.findByEmail(email);
    if (existing) errors.push('An account with that email already exists.');
  }

  if (errors.length > 0) {
    return res.status(400).render('pages/signup', {
      title: 'Create Account',
      errors,
      form: { email, full_name, phone }
    });
  }

  try {
    const user = await User.create({
      email,
      password,
      fullName: full_name.trim(),
      phone: phone || null,
      role: 'parent'
    });
    req.session.userId = user.id;
    await EmailService.sendWelcome({ user });
    req.session.flash = { type: 'success', message: 'Account created. Add a camper to get started.' };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).render('pages/signup', {
      title: 'Create Account',
      errors: ['Something went wrong creating your account. Please try again.'],
      form: { email, full_name, phone }
    });
  }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('pages/login', { title: 'Sign In', error: null, email: '' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = User.findByEmail(email || '');
  const valid = user && await User.verifyPassword(user, password || '');

  if (!valid) {
    return res.status(401).render('pages/login', {
      title: 'Sign In',
      error: 'Email or password is incorrect.',
      email: email || ''
    });
  }

  req.session.userId = user.id;
  const dest = req.session.returnTo || (user.role === 'admin' ? '/admin' : '/dashboard');
  delete req.session.returnTo;
  res.redirect(dest);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/about', (req, res) => {
  res.render('pages/about', { title: 'About Regent Summer Camp' });
});

module.exports = router;
