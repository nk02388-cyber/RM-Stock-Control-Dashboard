const assert = require('node:assert/strict');
const qr = require('../rm-qr-core.js');

const locations = [
  { zone: 'A', code: 'A-01', slotId: 'A-01' },
  { zone: 'B', code: 'B-02', slotId: 'B-02' }
];
const products = [{ code: 'RM-AT-H-017', name: 'Example RM' }];

assert.equal(qr.locationPayload('A', 'A-01'), 'RMLOC|A|A-01');
assert.equal(qr.productPayload('RM-AT-H-017'), 'RMITEM|RM-AT-H-017');
assert.deepEqual(qr.resolveScan('RMLOC|A|A-01', locations, products), { kind: 'location', location: locations[0] });
assert.deepEqual(qr.resolveScan('a-01', locations, products), { kind: 'location', location: locations[0] });
assert.deepEqual(qr.resolveScan('rmitem|rm-at-h-017', locations, products), { kind: 'product', product: products[0] });
assert.equal(qr.resolveScan('PKLOC|A|A-01', locations, products).kind, 'invalid');
assert.equal(qr.resolveScan('RMLOC|B|A-01', locations, products).kind, 'invalid');
assert.equal(qr.resolveScan('RMITEM|UNKNOWN', locations, products).kind, 'invalid');
assert.equal(qr.resolveScan('A-01', locations, [{ code: 'A-01' }]).kind, 'invalid');
console.log('RM QR core tests passed');
