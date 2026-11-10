'use strict';
const crypto = require('crypto');
const { hashPassword } = require('./auth');

const id = p => p + crypto.randomBytes(5).toString('hex');

const DEFAULT_SETTINGS = {
  id: 'settings', name: 'Queenstown Society', tagline: 'Home, together.', address: 'Queenstown Society, Main Gate Road',
  upi: '', upiName: 'Queenstown Society', bank: '',
  charges: [{ label: 'Maintenance charges', amt: 2200 }, { label: 'Sinking fund', amt: 300 }, { label: 'Water and common electricity', amt: 450 }, { label: 'Security and housekeeping', amt: 350 }],
  dueDay: 15, latePct: 2, adRates: { banner: 500, classified: 0 }, demo: false
};

const DEFAULT_AMENITIES = [
  { id: 'am1', name: 'Banquet Hall', rate: 3000, unit: 'per slot', capacity: 120, hours: '8 am to 11 pm', desc: 'Air conditioned hall with a pantry and stage. Cleaning charges included.', scene: 'festival' },
  { id: 'am2', name: 'Clubhouse Lounge', rate: 800, unit: 'per slot', capacity: 30, hours: '8 am to 10 pm', desc: 'Ideal for birthday parties and small gatherings.', scene: 'meeting' },
  { id: 'am3', name: 'Tennis Court', rate: 150, unit: 'per hour', capacity: 4, hours: '6 am to 9 pm', desc: 'Floodlit synthetic court. Racquets available at the desk.', scene: 'sports' },
  { id: 'am4', name: 'Swimming Pool', rate: 0, unit: 'free for residents', capacity: 40, hours: '6 am to 9 am, 4 pm to 8 pm', desc: 'Swim cap compulsory. Lifeguard on duty. Guests need a pass.', scene: 'yoga' },
  { id: 'am5', name: 'Guest Room', rate: 1200, unit: 'per night', capacity: 3, hours: 'Check-in 12 pm', desc: 'Two guest rooms for visiting relatives. Book at least two days ahead.', scene: 'garden' }
];

const DEFAULT_CONTACTS = [
  ['Police', 'Emergency', '100'], ['Fire brigade', 'Emergency', '101'], ['Ambulance', 'Emergency', '102'], ['Women helpline', 'Emergency', '1091']
].map(([name, role, phone]) => ({ id: id('t'), name, role, phone, cat: 'Emergency' }));

/* First start: default settings, amenities and emergency numbers.
   Admin: created from ADMIN_USERNAME and ADMIN_PASSWORD when no admin exists yet. */
async function bootstrap(store, cfg, log = console) {
  if (!(await store.get('settings', 'settings'))) {
    await store.put('settings', DEFAULT_SETTINGS);
    for (const a of DEFAULT_AMENITIES) await store.put('amenities', a);
    for (const c of DEFAULT_CONTACTS) await store.put('contacts', c);
    log.log('Created default society settings.');
  }
  const users = await store.all('users');
  const admin = users.find(u => u.role === 'admin');
  if (!admin) {
    if (!cfg.adminUser || cfg.adminPass.length < 8) {
      throw new Error('No admin account exists. Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 8 characters) and restart.');
    }
    await store.put('users', {
      id: 'admin-root', role: 'admin', status: 'approved', name: 'Society Admin', username: cfg.adminUser.toLowerCase(),
      pass: await hashPassword(cfg.adminPass), pwdAt: Date.now(), created: Date.now()
    });
    log.log('Created admin account "' + cfg.adminUser.toLowerCase() + '".');
  } else if (cfg.adminReset && cfg.adminPass.length >= 8) {
    admin.pass = await hashPassword(cfg.adminPass);
    admin.pwdAt = Date.now();
    if (cfg.adminUser) admin.username = cfg.adminUser.toLowerCase();
    await store.put('users', admin);
    log.log('Admin password was reset from ADMIN_PASSWORD. Remove ADMIN_RESET now.');
  }
}

module.exports = { bootstrap };
