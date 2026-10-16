require('dotenv').config({ quiet: true });

const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/haajari',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // 'dev' returns the OTP in the API response so the demo works without an SMS provider.
  otpMode: process.env.OTP_MODE || 'dev',
  isProd: process.env.NODE_ENV === 'production',
};

if (env.isProd && env.jwtSecret === 'dev-only-change-me') {
  throw new Error('Set JWT_SECRET in production.');
}

module.exports = env;
