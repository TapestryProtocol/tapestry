'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createQueue } = require('../lib/queue');

const tick = () => new Promise((r) => setTimeout(r, 5));

test('two jobs submitted together run one after the other', async () => {
  const q = createQueue();
  const seen = [];
  const job = (name) => async () => { seen.push(`${name} start`); await tick(); seen.push(`${name} end`); return name; };
  const results = await Promise.all([q.enqueue('a', job('a')), q.enqueue('b', job('b'))]);
  assert.deepEqual(seen, ['a start', 'a end', 'b start', 'b end']);
  assert.deepEqual(results, ['a', 'b']);
});

test('a failing job rejects its own promise and the next one still runs', async () => {
  const q = createQueue();
  const first = q.enqueue('a', async () => { throw new Error('boom'); });
  const second = q.enqueue('b', async () => 'ok');
  await assert.rejects(first, /boom/);
  assert.equal(await second, 'ok');
});

test('isWaiting is true only while a job has not started', async () => {
  const q = createQueue();
  let release;
  const running = q.enqueue('a', () => new Promise((r) => { release = r; }));
  const waiting = q.enqueue('b', async () => {});
  await tick();
  assert.equal(q.isWaiting('a'), false);
  assert.equal(q.isWaiting('b'), true);
  release();
  await Promise.all([running, waiting]);
  assert.equal(q.isWaiting('b'), false);
});
