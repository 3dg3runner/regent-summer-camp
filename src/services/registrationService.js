/**
 * Registration service — the orchestrator for the most important business rules
 * in the system.
 *
 * Responsibilities:
 *   - Decide whether a sign-up becomes 'active' or goes to 'waitlist' based on
 *     current capacity.
 *   - Fire the right confirmation email for whichever path was taken.
 *   - On withdrawal, atomically promote the next waitlisted camper, shift the
 *     remaining waitlist down, and email everyone affected.
 *   - Enforce the rules that prevent the database from ever entering a bad state:
 *     no double-registration, no registration past the camp start date, no
 *     promotion that would exceed capacity.
 *
 * Atomicity matters here. The "active count + waitlist promotion" sequence has to
 * be a single transaction; otherwise two simultaneous drops could each look at a
 * stale active count and double-promote. Every multi-step operation goes through
 * `db.transaction(...)`.
 */

const db = require('../config/database');
const Registration = require('../models/Registration');
const Camper = require('../models/Camper');
const Camp = require('../models/Camp');
const User = require('../models/User');
const EmailService = require('./emailService');

class RegistrationError extends Error {
  constructor(message, code = 'REGISTRATION_ERROR') {
    super(message);
    this.code = code;
  }
}

/**
 * Validates the camper is eligible for the camp (grade range, camp open, not
 * already registered, etc.) before any state changes.
 */
function validateEligibility(camper, camp) {
  if (!camp) throw new RegistrationError('Camp not found', 'CAMP_NOT_FOUND');
  if (!camp.is_open) throw new RegistrationError('This camp is no longer accepting registrations.', 'CAMP_CLOSED');
  if (!camper) throw new RegistrationError('Camper not found', 'CAMPER_NOT_FOUND');

  if (camper.grade < camp.grade_min || camper.grade > camp.grade_max) {
    throw new RegistrationError(
      `${camper.first_name} is in grade ${camper.grade}, but this camp is for grades ${camp.grade_min}–${camp.grade_max}.`,
      'GRADE_OUT_OF_RANGE'
    );
  }

  // Don't allow new registrations after the camp has started.
  const today = new Date().toISOString().slice(0, 10);
  if (camp.start_date < today) {
    throw new RegistrationError('This camp has already started.', 'CAMP_STARTED');
  }
}

const RegistrationService = {
  RegistrationError,

  /**
   * Register a camper for a camp. Returns:
   *   { registration, status: 'active' | 'waitlist', emailSent: bool }
   *
   * Behavior:
   *   - If active count < capacity → status='active', send enrollment email.
   *   - Else → status='waitlist' at the next available position, send waitlist email.
   *   - If a previous registration exists for this camper/camp:
   *       'dropped'   → re-activate or re-waitlist (treats it as a fresh signup,
   *                     but reuses the row so we don't violate UNIQUE).
   *       'active' / 'waitlist' → throw ALREADY_REGISTERED.
   *       'completed' → throw ALREADY_COMPLETED.
   */
  async register({ camperId, campId }) {
    const camper = Camper.findById(camperId);
    const camp = Camp.findById(campId);
    validateEligibility(camper, camp);

    const existing = Registration.findByCamperAndCamp(camperId, campId);
    if (existing && (existing.status === 'active' || existing.status === 'waitlist')) {
      throw new RegistrationError(`${camper.first_name} is already registered for this camp.`, 'ALREADY_REGISTERED');
    }
    if (existing && existing.status === 'completed') {
      throw new RegistrationError('This camp session is already complete.', 'ALREADY_COMPLETED');
    }

    // Decide active vs waitlist atomically: we need the capacity check and the
    // status-set to happen against the same snapshot of the database.
    const result = db.transaction(() => {
      const activeCount = Camp.activeCount(campId);
      const goingActive = activeCount < camp.capacity;

      let registration;
      if (existing && existing.status === 'dropped') {
        // Reuse the row to avoid the UNIQUE(camper_id, camp_id) constraint.
        registration = Registration.setStatus(existing.id, goingActive ? 'active' : 'waitlist', {
          waitlistPos: goingActive ? null : Registration.highestWaitlistPos(campId) + 1,
          droppedAt: null,
          dropReason: null,
          promotedAt: null
        });
      } else {
        registration = Registration.insert({
          camperId,
          campId,
          status: goingActive ? 'active' : 'waitlist',
          waitlistPos: goingActive ? null : Registration.highestWaitlistPos(campId) + 1
        });
      }
      return { registration, goingActive };
    })();

    const parent = User.findById(camper.user_id);

    // Email is fire-and-forget from the request handler's perspective: even if SMTP
    // is down, the registration is already saved and the email is recorded as failed
    // in the email_log so an admin can re-send.
    if (result.goingActive) {
      await EmailService.sendEnrollmentConfirmation({ parent, camper, camp });
    } else {
      await EmailService.sendWaitlistConfirmation({
        parent, camper, camp,
        position: result.registration.waitlist_pos
      });
    }

    return {
      registration: result.registration,
      status: result.goingActive ? 'active' : 'waitlist'
    };
  },

  /**
   * Withdraw a camper from a camp. If they were active, automatically promote the
   * next waitlisted camper.
   *
   * Returns: { droppedRegistration, promoted: { registration, camper, parent } | null }
   */
  async withdraw({ registrationId, reason = null }) {
    const reg = Registration.findById(registrationId);
    if (!reg) throw new RegistrationError('Registration not found', 'NOT_FOUND');
    if (reg.status === 'dropped') throw new RegistrationError('This registration has already been withdrawn.', 'ALREADY_DROPPED');
    if (reg.status === 'completed') throw new RegistrationError('Cannot withdraw from a completed camp.', 'ALREADY_COMPLETED');

    const camp = Camp.findById(reg.camp_id);
    const camper = Camper.findById(reg.camper_id);
    const parent = User.findById(camper.user_id);

    // The whole drop+promote sequence runs in one transaction so we can't
    // double-promote on concurrent drops, and the active count never goes
    // negative or above capacity.
    const wasActive = reg.status === 'active';
    const droppedWaitlistPos = reg.waitlist_pos;

    const txResult = db.transaction(() => {
      const droppedReg = Registration.setStatus(reg.id, 'dropped', {
        droppedAt: new Date().toISOString(),
        dropReason: reason,
        waitlistPos: null
      });

      let promotedReg = null;
      if (wasActive) {
        // Active spot opened up: promote head of waitlist if there is one.
        const next = Registration.nextWaitlisted(reg.camp_id);
        if (next) {
          promotedReg = Registration.setStatus(next.id, 'active', {
            waitlistPos: null,
            promotedAt: new Date().toISOString()
          });
          // Everyone behind them shifts up one position.
          Registration.shiftWaitlistDown(reg.camp_id, next.waitlist_pos);
        }
      } else if (reg.status === 'waitlist' && droppedWaitlistPos != null) {
        // A waitlisted person bailed: shift everyone behind them up.
        Registration.shiftWaitlistDown(reg.camp_id, droppedWaitlistPos);
      }

      return { droppedReg, promotedReg };
    })();

    // Send the drop confirmation to the parent who withdrew.
    await EmailService.sendDropConfirmation({ parent, camper, camp, reason });

    // If we promoted someone, tell them.
    let promotedSummary = null;
    if (txResult.promotedReg) {
      const pCamper = Camper.findById(txResult.promotedReg.camper_id);
      const pParent = User.findById(pCamper.user_id);
      await EmailService.sendPromotedFromWaitlist({ parent: pParent, camper: pCamper, camp });
      promotedSummary = { registration: txResult.promotedReg, camper: pCamper, parent: pParent };
    }

    return {
      droppedRegistration: txResult.droppedReg,
      promoted: promotedSummary
    };
  },

  /**
   * Admin operation: forcibly remove a registration (e.g., behavioral issue,
   * fraudulent signup). Same promotion logic as withdraw but logged with a
   * different drop reason.
   */
  async adminRemove({ registrationId, reason = 'Removed by administrator' }) {
    return RegistrationService.withdraw({ registrationId, reason });
  }
};

module.exports = RegistrationService;
