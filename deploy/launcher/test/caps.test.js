'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkCaps } = require('../lib/caps');

const config = { maxBrainsPerOwner: 2, maxBrainsTotal: 3, minFreeDiskGb: 10 };
const A = 'a'.repeat(64), B = 'b'.repeat(64);
const brain = (ownerPubkey, status = 'running') => ({ ownerPubkey, status });

test('allows a create under every cap', () => {
  assert.equal(checkCaps({ brains: [brain(A)], owner: A, config, freeDiskGb: 50 }), null);
});

test('refuses past the per-owner cap, with its own message', () => {
  const r = checkCaps({ brains: [brain(A), brain(A)], owner: A, config, freeDiskGb: 50 });
  assert.equal(r.code, 'owner-cap');
  assert.match(r.message, /2/);
});

test('refuses past the total cap, with its own message', () => {
  const r = checkCaps({ brains: [brain(B), brain(B), brain(A)], owner: A, config: { ...config, maxBrainsPerOwner: 5 }, freeDiskGb: 50 });
  assert.equal(r.code, 'total-cap');
  assert.match(r.message, /3/);
});

test('refuses under the disk floor, with its own message', () => {
  const r = checkCaps({ brains: [], owner: A, config, freeDiskGb: 9.9 });
  assert.equal(r.code, 'disk-floor');
  assert.match(r.message, /10/);
});

test('stopped and destroyed brains hold no memory, so they do not count', () => {
  const brains = [brain(A, 'stopped'), brain(A, 'destroyed'), brain(A, 'stopped')];
  assert.equal(checkCaps({ brains, owner: A, config, freeDiskGb: 50 }), null);
});

test('creating and failed brains count', () => {
  const brains = [brain(A, 'creating'), brain(A, 'failed')];
  assert.equal(checkCaps({ brains, owner: A, config, freeDiskGb: 50 })?.code, 'owner-cap');
});
