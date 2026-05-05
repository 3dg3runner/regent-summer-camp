/**
 * Parent-facing routes: dashboard, manage campers, register/withdraw from camps.
 * All routes here are gated by requireLogin in the parent server.js.
 */

const express = require('express');
const router = express.Router();
const Camper = require('../models/Camper');
const Camp = require('../models/Camp');
const Registration = require('../models/Registration');
const RegistrationService = require('../services/registrationService');

router.get('/dashboard', (req, res) => {
  const campers = Camper.listByUser(req.user.id);
  const registrations = Registration.listForUser(req.user.id);
  const openCamps = Camp.listWithCounts({ openOnly: true });
  res.render('pages/dashboard', {
    title: 'My Dashboard',
    campers,
    registrations,
    openCamps
  });
});

// -------- Campers ----------------------------------------------------------

router.get('/campers/new', (req, res) => {
  res.render('pages/camper-form', { title: 'Add Camper', camper: {}, errors: [], action: '/campers' });
});

router.post('/campers', (req, res) => {
  const { first_name, last_name, date_of_birth, grade, allergies, medical_notes, emergency_contact_name, emergency_contact_phone } = req.body;
  const errors = [];
  if (!first_name) errors.push('First name is required.');
  if (!last_name) errors.push('Last name is required.');
  if (!date_of_birth) errors.push('Date of birth is required.');
  if (!grade || isNaN(parseInt(grade, 10))) errors.push('Grade is required.');
  if (!emergency_contact_name) errors.push('Emergency contact name is required.');
  if (!emergency_contact_phone) errors.push('Emergency contact phone is required.');

  if (errors.length) {
    return res.status(400).render('pages/camper-form', {
      title: 'Add Camper',
      camper: req.body,
      errors,
      action: '/campers'
    });
  }

  Camper.create({
    userId: req.user.id,
    firstName: first_name.trim(),
    lastName: last_name.trim(),
    dateOfBirth: date_of_birth,
    grade: parseInt(grade, 10),
    allergies: allergies || null,
    medicalNotes: medical_notes || null,
    emergencyContactName: emergency_contact_name.trim(),
    emergencyContactPhone: emergency_contact_phone.trim()
  });

  req.session.flash = { type: 'success', message: 'Camper added.' };
  res.redirect('/dashboard');
});

router.get('/campers/:id/edit', (req, res) => {
  const camperId = parseInt(req.params.id, 10);
  if (!Camper.ownedBy(camperId, req.user.id)) return res.status(404).render('pages/error', { title: 'Not Found', message: 'Camper not found.' });
  const camper = Camper.findById(camperId);
  res.render('pages/camper-form', { title: 'Edit Camper', camper, errors: [], action: `/campers/${camperId}` });
});

router.post('/campers/:id', (req, res) => {
  const camperId = parseInt(req.params.id, 10);
  if (!Camper.ownedBy(camperId, req.user.id)) return res.status(404).render('pages/error', { title: 'Not Found', message: 'Camper not found.' });
  Camper.update(camperId, {
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    date_of_birth: req.body.date_of_birth,
    grade: parseInt(req.body.grade, 10),
    allergies: req.body.allergies || null,
    medical_notes: req.body.medical_notes || null,
    emergency_contact_name: req.body.emergency_contact_name,
    emergency_contact_phone: req.body.emergency_contact_phone
  });
  req.session.flash = { type: 'success', message: 'Camper updated.' };
  res.redirect('/dashboard');
});

// -------- Camps & Registration --------------------------------------------

router.get('/camps', (req, res) => {
  const camps = Camp.listWithCounts({ openOnly: true });
  const campers = Camper.listByUser(req.user.id);
  res.render('pages/camps', { title: 'Browse Camps', camps, campers });
});

router.get('/camps/:id', (req, res) => {
  const camp = Camp.findById(parseInt(req.params.id, 10));
  if (!camp) return res.status(404).render('pages/error', { title: 'Not Found', message: 'Camp not found.' });
  const campers = Camper.listByUser(req.user.id);
  const activeCount = Camp.activeCount(camp.id);
  const waitlistCount = Camp.waitlistCount(camp.id);
  res.render('pages/camp-detail', { title: camp.name, camp, campers, activeCount, waitlistCount });
});

router.post('/camps/:id/register', async (req, res) => {
  const campId = parseInt(req.params.id, 10);
  const camperId = parseInt(req.body.camper_id, 10);

  if (!Camper.ownedBy(camperId, req.user.id)) {
    req.session.flash = { type: 'error', message: 'Invalid camper selection.' };
    return res.redirect(`/camps/${campId}`);
  }

  try {
    const result = await RegistrationService.register({ camperId, campId });
    if (result.status === 'active') {
      req.session.flash = {
        type: 'success',
        message: 'Enrolled! A confirmation email is on the way.'
      };
    } else {
      req.session.flash = {
        type: 'info',
        message: `Camp is full — added to the waitlist at position #${result.registration.waitlist_pos}. We'll email if a spot opens up.`
      };
    }
    res.redirect('/dashboard');
  } catch (err) {
    if (err instanceof RegistrationService.RegistrationError) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect(`/camps/${campId}`);
    }
    console.error('Registration error:', err);
    req.session.flash = { type: 'error', message: 'Something went wrong. Please try again.' };
    res.redirect(`/camps/${campId}`);
  }
});

router.post('/registrations/:id/withdraw', async (req, res) => {
  const regId = parseInt(req.params.id, 10);
  const reg = Registration.findById(regId);

  // Confirm ownership: only the parent who registered can withdraw.
  if (!reg) {
    req.session.flash = { type: 'error', message: 'Registration not found.' };
    return res.redirect('/dashboard');
  }
  const camper = Camper.findById(reg.camper_id);
  if (!camper || camper.user_id !== req.user.id) {
    req.session.flash = { type: 'error', message: 'You can only withdraw your own campers.' };
    return res.redirect('/dashboard');
  }

  try {
    const result = await RegistrationService.withdraw({
      registrationId: regId,
      reason: req.body.reason ? req.body.reason.trim() : null
    });
    let msg = 'Withdrawal complete. A confirmation email has been sent.';
    if (result.promoted) {
      msg += ` ${result.promoted.camper.first_name} from the waitlist has been auto-enrolled.`;
    }
    req.session.flash = { type: 'success', message: msg };
    res.redirect('/dashboard');
  } catch (err) {
    if (err instanceof RegistrationService.RegistrationError) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect('/dashboard');
    }
    console.error('Withdraw error:', err);
    req.session.flash = { type: 'error', message: 'Something went wrong. Please try again.' };
    res.redirect('/dashboard');
  }
});

module.exports = router;
