/**
 * Admin routes: manage camps, view all registrations, run admin removals.
 */

const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');
const User = require('../models/User');
const Registration = require('../models/Registration');
const RegistrationService = require('../services/registrationService');
const EmailService = require('../services/emailService');

router.get('/', (req, res) => {
  const camps = Camp.listWithCounts();
  res.render('pages/admin-dashboard', {
    title: 'Admin Dashboard',
    camps,
    userCount: User.count(),
    adminCount: User.countAdmins()
  });
});

// -------- Camp management --------------------------------------------------

router.get('/camps/new', (req, res) => {
  res.render('pages/admin-camp-form', { title: 'New Camp', camp: {}, errors: [], action: '/admin/camps' });
});

router.post('/camps', (req, res) => {
  const { name, description, start_date, end_date, capacity, location, grade_min, grade_max, cost_dollars } = req.body;
  const errors = [];
  if (!name) errors.push('Name is required.');
  if (!start_date) errors.push('Start date is required.');
  if (!end_date) errors.push('End date is required.');
  if (!capacity || isNaN(parseInt(capacity, 10)) || parseInt(capacity, 10) < 1) errors.push('Capacity must be a positive integer.');
  if (start_date && end_date && end_date < start_date) errors.push('End date must be on or after the start date.');

  if (errors.length) {
    return res.status(400).render('pages/admin-camp-form', {
      title: 'New Camp', camp: req.body, errors, action: '/admin/camps'
    });
  }

  Camp.create({
    name: name.trim(),
    description: description || '',
    startDate: start_date,
    endDate: end_date,
    capacity: parseInt(capacity, 10),
    location: location || '',
    gradeMin: grade_min ? parseInt(grade_min, 10) : 6,
    gradeMax: grade_max ? parseInt(grade_max, 10) : 12,
    costCents: cost_dollars ? Math.round(parseFloat(cost_dollars) * 100) : 0
  });

  req.session.flash = { type: 'success', message: 'Camp created.' };
  res.redirect('/admin');
});

router.get('/camps/:id', (req, res) => {
  const camp = Camp.findById(parseInt(req.params.id, 10));
  if (!camp) return res.status(404).render('pages/error', { title: 'Not Found', message: 'Camp not found.' });
  const registrations = Registration.listForCamp(camp.id);
  res.render('pages/admin-camp-detail', {
    title: camp.name,
    camp,
    registrations,
    activeCount: Camp.activeCount(camp.id),
    waitlistCount: Camp.waitlistCount(camp.id)
  });
});

router.get('/camps/:id/edit', (req, res) => {
  const camp = Camp.findById(parseInt(req.params.id, 10));
  if (!camp) return res.status(404).render('pages/error', { title: 'Not Found', message: 'Camp not found.' });
  res.render('pages/admin-camp-form', {
    title: `Edit ${camp.name}`,
    camp,
    errors: [],
    action: `/admin/camps/${camp.id}`
  });
});

router.post('/camps/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, start_date, end_date, capacity, location, grade_min, grade_max, cost_dollars, is_open } = req.body;
  Camp.update(id, {
    name,
    description,
    start_date,
    end_date,
    capacity: parseInt(capacity, 10),
    location,
    grade_min: parseInt(grade_min, 10),
    grade_max: parseInt(grade_max, 10),
    cost_cents: cost_dollars ? Math.round(parseFloat(cost_dollars) * 100) : 0,
    is_open: is_open === 'on' ? 1 : 0
  });
  req.session.flash = { type: 'success', message: 'Camp updated.' };
  res.redirect(`/admin/camps/${id}`);
});

router.post('/camps/:id/delete', (req, res) => {
  Camp.delete(parseInt(req.params.id, 10));
  req.session.flash = { type: 'success', message: 'Camp deleted.' };
  res.redirect('/admin');
});

// -------- Forced withdrawal -----------------------------------------------

router.post('/registrations/:id/remove', async (req, res) => {
  try {
    const result = await RegistrationService.adminRemove({
      registrationId: parseInt(req.params.id, 10),
      reason: req.body.reason || 'Removed by administrator'
    });
    let msg = 'Camper removed.';
    if (result.promoted) {
      msg += ` ${result.promoted.camper.first_name} promoted from waitlist.`;
    }
    req.session.flash = { type: 'success', message: msg };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message || 'Failed to remove registration.' };
  }
  res.redirect('back');
});

// -------- Email log --------------------------------------------------------

router.get('/emails', (req, res) => {
  res.render('pages/admin-emails', {
    title: 'Email Activity',
    emails: EmailService.recentLog(100)
  });
});

module.exports = router;
