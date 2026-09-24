const assert = require('node:assert/strict');
const incoming = require('../rm-incoming-core.js');

const id = '123e4567-e89b-42d3-a456-426614174000';
assert.equal(incoming.tagPayload(id), `RMTAG|${id}`);
assert.equal(incoming.parseTag(` rmtag|${id.toUpperCase()} `), id);
assert.equal(incoming.parseTag(`PKTAG|${id}`), null);
assert.equal(incoming.parseTag('RMTAG|not-a-uuid'), null);
assert.deepEqual(incoming.distributeQuantity(10, 3), [4, 3, 3]);
assert.deepEqual(incoming.distributeQuantity(1.001, 2), [0.501, 0.5]);
assert.equal(incoming.distributeQuantity(0.001, 2), null);
assert.equal(incoming.distributeQuantity(1, 101), null);
assert.equal(incoming.validAllocation(1.001, [0.501, 0.5]), true);
assert.equal(incoming.validAllocation(1.001, [0.501, 0.499]), false);
assert.equal(incoming.validAllocation(1, ['', 1]), false);
console.log('RM incoming core tests passed');
