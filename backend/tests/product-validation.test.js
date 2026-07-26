const test = require('node:test');
const assert = require('node:assert/strict');
const { __test } = require('../routes/products');

test('complete product payload is normalized', () => {
  const payload = __test.productPayload({
    name: '  Wheat ', description: 'Fresh crop', category: 'grains',
    price: '31.5', unit: 'kg', quantity: '200', location: 'Junagadh',
    qualityGrade: 'premium', farmingMethod: 'natural',
    images: ['https://example.com/wheat.jpg']
  });
  assert.equal(payload.name, 'Wheat');
  assert.equal(payload.price, 31.5);
  assert.equal(payload.quantity, 200);
  assert.equal(payload.isAvailable, true);
  assert.deepEqual(payload.images, ['https://example.com/wheat.jpg']);
});

test('product payload rejects bad category and negative stock', () => {
  assert.match(__test.productPayload({
    name: 'Wheat', description: 'Fresh', category: 'bad', price: 10,
    unit: 'kg', quantity: 1, location: 'Rajkot'
  }).error, /category/i);
  assert.match(__test.productPayload({
    name: 'Wheat', description: 'Fresh', category: 'grains', price: 10,
    unit: 'kg', quantity: -1, location: 'Rajkot'
  }).error, /quantity/i);
});
