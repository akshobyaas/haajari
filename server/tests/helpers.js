const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../src/app');
const { seed, DEMO } = require('../seed/seedData');

let mongod;
const app = createApp();
const api = () => request(app);

// Uses a throwaway in-memory MongoDB. Set TEST_MONGO_URI to test against a running server instead.
async function start() {
  if (process.env.TEST_MONGO_URI) {
    const db = `haajari-test-${process.pid}-${Date.now()}`;
    await mongoose.connect(process.env.TEST_MONGO_URI.replace(/\/?$/, `/${db}`));
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('haajari-test'));
  }
  await seed({ log: () => {}, days: 5 });
}
async function stop() {
  if (process.env.TEST_MONGO_URI) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function loginAdmin() {
  const r = await api().post('/api/auth/login').send({ email: DEMO.adminEmail, password: DEMO.adminPassword });
  return r.body.token;
}
async function loginPin(phone, pin = DEMO.pin) {
  const r = await api().post('/api/auth/pin-login').send({ phone, pin });
  return r.body.token;
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

module.exports = { api, start, stop, loginAdmin, loginPin, auth, DEMO };
