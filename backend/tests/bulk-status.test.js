const test = require('node:test');
const assert = require('node:assert/strict');
const { __test } = require('../routes/bulkOrders');

function order(allocations, requestedQuantity = 100) {
  return { status: 'sourcing', requestedQuantity, allocations };
}

test('bulk order becomes awaiting acceptance when fully allocated', () => {
  const value = order([{ quantity: 60, status: 'pending' }, { quantity: 40, status: 'pending' }]);
  __test.recomputeStatus(value);
  assert.equal(value.status, 'awaiting_acceptance');
});

test('bulk order reports partial confirmation and delivery', () => {
  const confirmed = order([{ quantity: 60, status: 'accepted' }, { quantity: 40, status: 'pending' }]);
  __test.recomputeStatus(confirmed);
  assert.equal(confirmed.status, 'partially_confirmed');

  const delivered = order([{ quantity: 60, status: 'delivered' }, { quantity: 40, status: 'accepted' }]);
  __test.recomputeStatus(delivered);
  assert.equal(delivered.status, 'partially_delivered');
});

test('rejected allocations do not count toward fulfillment', () => {
  const value = order([{ quantity: 100, status: 'rejected' }]);
  __test.recomputeStatus(value);
  assert.equal(value.status, 'unfulfilled');
  assert.equal(__test.activeAllocations(value).length, 0);
});
