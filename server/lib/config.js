'use strict';
const crypto = require('crypto');

function load(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const cfg = {
    prod,
    port: Number(env.PORT) || 8080,
    mongoUri: (env.MONGODB_URI || '').trim(),
    dbName: (env.MONGODB_DB || 'queenstown').trim(),
    jwtSecret: env.JWT_SECRET || '',
    adminUser: (env.ADMIN_USERNAME || '').trim(),
    adminPass: env.ADMIN_PASSWORD || '',
    adminReset: env.ADMIN_RESET === '1',
    tokenDays: Number(env.TOKEN_DAYS) || 7,
    origins: (env.CLIENT_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean),
    razorpayKeyId: (env.RAZORPAY_KEY_ID || '').trim(),
    razorpayKeySecret: (env.RAZORPAY_KEY_SECRET || '').trim(),
    razorpayWebhookSecret: (env.RAZORPAY_WEBHOOK_SECRET || '').trim()
  };
  if (cfg.razorpayKeyId && !cfg.razorpayKeySecret) throw new Error('RAZORPAY_KEY_SECRET is required when RAZORPAY_KEY_ID is set.');
  if (prod) {
    if (!cfg.mongoUri) throw new Error('MONGODB_URI is required when NODE_ENV=production.');
    if (cfg.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters when NODE_ENV=production.');
  } else if (!cfg.jwtSecret) {
    cfg.jwtSecret = crypto.randomBytes(32).toString('hex'); // dev only: logins reset on every restart
  }
  return cfg;
}

module.exports = { load };
