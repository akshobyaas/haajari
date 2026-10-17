/**
 * Every setting the server reads, in one place. Values come from environment variables
 * (server/.env locally, the Environment tab on Render). Nothing else in the code reads
 * process.env, so this file is the full list. See .env.example for descriptions.
 */
require('dotenv').config({ quiet: true });
const { z } = require('zod');

const DEV_SECRET = 'dev-only-change-me';
const bool = (fallback) => z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? fallback : v === 'true'));
const optionalText = z.string().trim().optional().transform((v) => v || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/haajari'),
  JWT_SECRET: z.string().min(1).default(DEV_SECRET),
  JWT_EXPIRES_IN: z.string().default('30d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5180'),
  // 'dev' returns the OTP in the API response so the demo works without an SMS provider.
  OTP_MODE: z.enum(['dev', 'sms']).default('dev'),
  VAPID_PUBLIC_KEY: optionalText,
  VAPID_PRIVATE_KEY: optionalText,
  VAPID_SUBJECT: z.string().default('mailto:admin@haajari.local'),
  SEED_ON_EMPTY: bool(false),
  SERVE_CLIENT: bool(true),
  CLIENT_DIST: optionalText,
  SUPERADMIN_EMAIL: optionalText,
  SUPERADMIN_PASSWORD: optionalText,
  SUPERADMIN_NAME: optionalText,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid server settings:\n${lines}`);
}
const e = parsed.data;
const isProd = e.NODE_ENV === 'production';

if (isProd) {
  const problems = [];
  if (e.JWT_SECRET === DEV_SECRET || e.JWT_SECRET.length < 16) problems.push('JWT_SECRET must be a long random string (16+ characters).');
  if (!process.env.MONGO_URI) problems.push('MONGO_URI is required (your MongoDB Atlas connection string).');
  if (e.SUPERADMIN_PASSWORD && e.SUPERADMIN_PASSWORD.length < 8) problems.push('SUPERADMIN_PASSWORD needs at least 8 characters.');
  if (problems.length) throw new Error(`Production settings are not ready:\n  ${problems.join('\n  ')}`);
}

const env = Object.freeze({
  nodeEnv: e.NODE_ENV,
  isProd,
  isTest: e.NODE_ENV === 'test',
  port: e.PORT,
  mongoUri: e.MONGO_URI,
  jwtSecret: e.JWT_SECRET,
  jwtExpiresIn: e.JWT_EXPIRES_IN,
  clientOrigin: e.CLIENT_ORIGIN,
  otpMode: e.OTP_MODE,
  vapid: { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT },
  seedOnEmpty: e.SEED_ON_EMPTY,
  serveClient: e.SERVE_CLIENT,
  clientDist: e.CLIENT_DIST,
  approver: { email: e.SUPERADMIN_EMAIL, password: e.SUPERADMIN_PASSWORD, name: e.SUPERADMIN_NAME },
});

module.exports = env;
