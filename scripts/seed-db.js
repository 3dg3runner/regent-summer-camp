/**
 * Seed the database with sample data for development and demos.
 *
 *   npm run seed-db
 *
 * Creates:
 *   - 1 admin (admin@regent.edu / ChangeMe123!)
 *   - 3 sample parents with passwords "Password123!"
 *   - 5 sample campers
 *   - 3 sample camps with realistic dates
 *
 * Re-running is safe: existing emails are skipped.
 */

require('dotenv').config();
const db = require('../src/config/database');
const User = require('../src/models/User');
const Camp = require('../src/models/Camp');
const Camper = require('../src/models/Camper');

async function seed() {
  // Admin --------------------------------------------------------------------
  if (!User.findByEmail('admin@regent.edu')) {
    await User.create({
      email: 'admin@regent.edu',
      password: 'ChangeMe123!',
      fullName: 'Camp Administrator',
      role: 'admin'
    });
    console.log('Created admin: admin@regent.edu / ChangeMe123!');
  }

  // Sample parents -----------------------------------------------------------
  const parentSpecs = [
    { email: 'jane.smith@example.com',  full_name: 'Jane Smith',   phone: '(757) 555-0101' },
    { email: 'mike.johnson@example.com',full_name: 'Mike Johnson', phone: '(757) 555-0102' },
    { email: 'lisa.brown@example.com',  full_name: 'Lisa Brown',   phone: '(757) 555-0103' }
  ];
  const parents = [];
  for (const spec of parentSpecs) {
    let user = User.findByEmail(spec.email);
    if (!user) {
      user = await User.create({
        email: spec.email,
        password: 'Password123!',
        fullName: spec.full_name,
        phone: spec.phone,
        role: 'parent'
      });
      console.log(`Created parent: ${spec.email} / Password123!`);
    }
    parents.push(user);
  }

  // Sample campers -----------------------------------------------------------
  const camperSpecs = [
    { parent: 0, first: 'Emma',   last: 'Smith',   dob: '2012-05-14', grade: 7  },
    { parent: 0, first: 'Noah',   last: 'Smith',   dob: '2010-08-22', grade: 9  },
    { parent: 1, first: 'Olivia', last: 'Johnson', dob: '2011-03-10', grade: 8  },
    { parent: 2, first: 'Liam',   last: 'Brown',   dob: '2009-11-30', grade: 10 },
    { parent: 2, first: 'Ava',    last: 'Brown',   dob: '2013-01-05', grade: 6  }
  ];
  for (const c of camperSpecs) {
    const existing = db.prepare('SELECT id FROM campers WHERE first_name = ? AND last_name = ? AND user_id = ?')
      .get(c.first, c.last, parents[c.parent].id);
    if (!existing) {
      Camper.create({
        userId: parents[c.parent].id,
        firstName: c.first,
        lastName: c.last,
        dateOfBirth: c.dob,
        grade: c.grade,
        allergies: c.first === 'Emma' ? 'Peanuts' : null,
        emergencyContactName: parents[c.parent].full_name,
        emergencyContactPhone: parents[c.parent].phone || '(757) 555-0000'
      });
    }
  }
  console.log(`Ensured ${camperSpecs.length} sample campers exist.`);

  // Sample camps -------------------------------------------------------------
  // Use dates relative to "now" so the seed data stays fresh as time passes.
  const yyyy = new Date().getFullYear();
  const summer = (m, d) => `${yyyy}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const campSpecs = [
    {
      name: 'Robotics & AI Week',
      description: 'Build and program autonomous robots. Hands-on Python, sensor integration, and a final competition.',
      start_date: summer(7, 6),
      end_date:   summer(7, 10),
      capacity: 24,
      location: 'School of Engineering, Room 220',
      grade_min: 7, grade_max: 12,
      cost_cents: 35000
    },
    {
      name: 'Bioscience Discovery Camp',
      description: 'Microscopy, DNA extraction, ecology field trips, and a behind-the-scenes look at university labs.',
      start_date: summer(7, 13),
      end_date:   summer(7, 17),
      capacity: 16,
      location: 'Science Center, Lab 105',
      grade_min: 6, grade_max: 9,
      cost_cents: 30000
    },
    {
      name: 'Game Design Bootcamp',
      description: 'Design, build, and ship a small video game in a week using Unity. No prior coding required.',
      start_date: summer(7, 20),
      end_date:   summer(7, 24),
      capacity: 20,
      location: 'Communications Building, Room 301',
      grade_min: 8, grade_max: 12,
      cost_cents: 35000
    }
  ];
  for (const spec of campSpecs) {
    const existing = db.prepare('SELECT id FROM camps WHERE name = ?').get(spec.name);
    if (!existing) {
      Camp.create({
        name: spec.name,
        description: spec.description,
        startDate: spec.start_date,
        endDate: spec.end_date,
        capacity: spec.capacity,
        location: spec.location,
        gradeMin: spec.grade_min,
        gradeMax: spec.grade_max,
        costCents: spec.cost_cents
      });
    }
  }
  console.log(`Ensured ${campSpecs.length} sample camps exist.`);

  console.log('\nSeed complete.');
  console.log('  Admin:  admin@regent.edu / ChangeMe123!');
  console.log('  Parent: jane.smith@example.com / Password123!');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
