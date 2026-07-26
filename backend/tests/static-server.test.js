const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SKIP_DB = 'true';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.ADMIN_SETUP_KEY = 'owner-setup-key';
const { app } = require('../server');

let server;
let base;

test.before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('serves homepage and all role dashboards', async () => {
  for (const path of ['/', '/pages/login.html', '/pages/register.html', '/pages/buyer-dashboard.html', '/pages/farmer-dashboard.html', '/pages/admin-dashboard.html']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /KhedutConnect|Dashboard|Register|Login/i);
  }
});

test('health endpoint lists upgraded features', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.database, 'skipped');
  assert.equal(body.features.secureAdminSetup, true);
  assert.equal(body.features.multiFarmerFulfillment, true);
  assert.equal(body.features.equipmentBookings, true);
});


test('public registration cannot request admin role', async () => {
  const response = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unsafe Admin', email: 'unsafe@example.com', password: 'secret12', role: 'admin'
    })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /role/i);
});

test('first admin setup requires the private key and creates an admin', async () => {
  const User = require('../models/user');
  const originals = { exists: User.exists, findOne: User.findOne, create: User.create };
  User.exists = async () => null;
  User.findOne = async () => null;
  User.create = async data => ({
    ...data,
    _id: '507f1f77bcf86cd799439011',
    createdAt: new Date('2026-07-20T00:00:00Z')
  });

  try {
    const denied = await fetch(`${base}/api/auth/admin/setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Owner', email: 'owner@example.com', password: 'secret12', setupKey: 'wrong' })
    });
    assert.equal(denied.status, 403);

    const response = await fetch(`${base}/api/auth/admin/setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Owner', email: 'owner@example.com', password: 'secret12',
        phone: '9876543210', location: 'Gujarat', setupKey: 'owner-setup-key'
      })
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.user.role, 'admin');
    assert.ok(body.token);
  } finally {
    User.exists = originals.exists;
    User.findOne = originals.findOne;
    User.create = originals.create;
  }
});

test('unknown API route returns JSON 404', async () => {
  const response = await fetch(`${base}/api/not-real`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'API route not found' });
});
