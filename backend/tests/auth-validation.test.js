const test = require('node:test');
const assert = require('node:assert/strict');
const { __test } = require('../routes/auth');

test('public registration rejects an admin role', () => {
  const result = __test.validateAccountInput({
    name: 'Owner', email: 'owner@example.com', password: 'secret12', role: 'admin'
  });
  assert.equal(result.error, 'Invalid account role');
});

test('admin dashboard validation accepts admin role when explicitly enabled', () => {
  const result = __test.validateAccountInput({
    name: 'Owner', email: 'OWNER@example.com', password: 'secret12', role: 'admin', phone: '9876543210'
  }, { allowAdmin: true });
  assert.equal(result.error, undefined);
  assert.equal(result.email, 'owner@example.com');
  assert.equal(result.role, 'admin');
});

test('password length and phone are validated', () => {
  assert.match(__test.validateAccountInput({
    name: 'Buyer', email: 'buyer@example.com', password: '123', role: 'buyer'
  }).error, /Password/);
  assert.match(__test.validateAccountInput({
    name: 'Buyer', email: 'buyer@example.com', password: '123456', role: 'buyer', phone: 'abc'
  }).error, /phone/i);
});
