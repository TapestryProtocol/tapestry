'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegistry, ILLEGAL_TRANSITION, TRANSITIONS } = require('../lib/registry');
const { tempDir } = require('./helpers');

const file = () => path.join(tempDir(), 'registry.json');
const record = (slug = 'avi', status = 'creating') => ({
  slug, ownerPubkey: 'a'.repeat(64), status, imageTag: 'dogfood', createdAt: 't', destroyedAt: null, reapAfter: null, lastError: null, everRunning: false,
});

test('starts empty when there is no file, and survives a reload', () => {
  const f = file();
  const r = createRegistry({ file: f });
  assert.deepEqual(r.list(), []);
  r.add(record());
  assert.equal(createRegistry({ file: f }).find('avi').status, 'creating');
});

test('a crash between the temp file and the rename leaves the old file intact', () => {
  const f = file();
  const r = createRegistry({ file: f });
  r.add(record());
  const before = fs.readFileSync(f, 'utf8');
  const crashing = createRegistry({
    file: f,
    fsImpl: { ...fs, renameSync() { throw new Error('crash'); } },
  });
  assert.throws(() => crashing.transition('avi', 'running'), /crash/);
  assert.equal(fs.readFileSync(f, 'utf8'), before);
  assert.equal(crashing.find('avi').status, 'creating', 'memory must not move ahead of the disk');
});

test('every legal transition is allowed', () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    for (const to of tos) {
      const r = createRegistry({ file: file() });
      r.add(record('avi', from));
      assert.equal(r.transition('avi', to).status, to, `${from} -> ${to}`);
    }
  }
});

test('every other transition is refused', () => {
  const all = Object.keys(TRANSITIONS);
  for (const from of all) {
    for (const to of all) {
      if (TRANSITIONS[from].includes(to)) continue;
      const r = createRegistry({ file: file() });
      r.add(record('avi', from));
      // A destroyed record is history: it is no longer found at all.
      if (from === 'destroyed') assert.throws(() => r.transition('avi', to), /no live brain/);
      else assert.throws(() => r.transition('avi', to), (e) => e.code === ILLEGAL_TRANSITION, `${from} -> ${to}`);
    }
  }
});

test('the expected transitions are the legal ones', () => {
  assert.deepEqual(TRANSITIONS, {
    creating: ['running', 'failed'],
    running: ['stopped', 'failed'],
    stopped: ['running', 'failed', 'destroyed', 'creating'],
    failed: ['creating', 'stopped', 'destroyed'],
    destroyed: [],
  });
});

test('find returns the live record for a slug, past destroyed ones', () => {
  const r = createRegistry({ file: file() });
  r.add(record('avi', 'destroyed'));
  assert.equal(r.find('avi'), undefined);
  r.add(record('avi', 'creating'));
  assert.equal(r.find('avi').status, 'creating');
  assert.equal(r.list().length, 2, 'the destroyed record stays as history');
});

test('a second live record for a slug is refused', () => {
  const r = createRegistry({ file: file() });
  r.add(record());
  assert.throws(() => r.add(record()), /taken/);
});

test('patch changes fields without changing status', () => {
  const r = createRegistry({ file: file() });
  r.add(record());
  assert.throws(() => r.patch('avi', { status: 'running' }), /status/);
  assert.equal(r.patch('avi', { lastError: 'x' }).lastError, 'x');
});
