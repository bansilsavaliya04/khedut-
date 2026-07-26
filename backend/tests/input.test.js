const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanText, normalizeEmail, isValidEmail, positiveNumber,
  optionalDate, safeRole, cleanImages, timingSafeEqualText
} = require('../utils/input');

test('text and email input are normalized', () => {
  assert.equal(cleanText('  Wheat  ', { required: true }), 'Wheat');
  assert.equal(normalizeEmail(' Farmer@Example.COM '), 'farmer@example.com');
  assert.equal(isValidEmail('farmer@example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
});

test('numeric and date validation rejects invalid values', () => {
  assert.equal(positiveNumber('2.5', { min: 1, max: 3 }), 2.5);
  assert.equal(positiveNumber('-1'), null);
  assert.equal(optionalDate('not-a-date'), null);
  assert.ok(optionalDate('2026-07-22') instanceof Date);
});

test('public roles and image formats are restricted', () => {
  assert.equal(safeRole('admin'), null);
  assert.equal(safeRole('admin', ['buyer', 'farmer', 'admin']), 'admin');
  assert.deepEqual(cleanImages([
    'javascript:alert(1)',
    'https://example.com/crop.jpg',
    'data:image/png;base64,AAAA'
  ]), ['https://example.com/crop.jpg', 'data:image/png;base64,AAAA']);
});

test('setup key comparison is exact', () => {
  assert.equal(timingSafeEqualText('owner-key', 'owner-key'), true);
  assert.equal(timingSafeEqualText('owner-key', 'wrong-key'), false);
  assert.equal(timingSafeEqualText('', ''), false);
});
