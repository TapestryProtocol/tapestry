'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createBrains } = require('../lib/brains');
const { createRegistry } = require('../lib/registry');
const { createQueue } = require('../lib/queue');
const { tempDir } = require('./helpers');

const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-11-04T12:00:00Z');

function setup({ config = {}, failing = {}, disk = 100 } = {}) {
  const calls = [];
  const fail = { ...failing };
  const verb = (name) => async (arg) => {
    const slug = typeof arg === 'string' ? arg : arg.slug;
    calls.push(`${name} ${slug ?? arg}`);
    if (fail[`${name} ${slug}`] || fail[name]) throw new Error(`${name} went wrong`);
  };
  const backend = {
    create: verb('create'), restore: verb('restore'), destroy: verb('destroy'), purge: verb('purge'),
    ensureUp: verb('ensureUp'), pullImages: async (tag) => { calls.push(`pullImages ${tag}`); if (fail.pullImages) throw new Error('pull went wrong'); },
    readLog: () => 'the log', readPassword: () => 'the password',
  };
  const registry = createRegistry({ file: path.join(tempDir(), 'registry.json') });
  const queue = createQueue();
  let now = T0;
  const brains = createBrains({
    registry, backend, queue,
    getConfig: () => ({
      baseDomain: 'tapestry.test', imageTag: 'dogfood', graceDays: 7, maxBrainsPerOwner: 3, maxBrainsTotal: 3, minFreeDiskGb: 10,
      allowlist: [{ pubkey: A, label: 'Ana' }, { pubkey: B, label: 'Bo' }], ...config,
    }),
    freeDiskGb: async () => disk,
    now: () => now,
    log: () => {},
  });
  return { brains, registry, calls, fail, queue, advance: (ms) => { now += ms; }, idle: () => brains.idle() };
}

async function launched(ctx, owner = A, slug = 'avi') {
  await ctx.brains.create(owner, slug);
  await ctx.idle();
  return ctx.registry.find(slug);
}

test('create answers at once with creating, then the brain reaches running, owned by the signer', async () => {
  const ctx = setup();
  const r = await ctx.brains.create(A, 'avi');
  assert.deepEqual(r, { slug: 'avi', status: 'creating' });
  assert.equal(ctx.registry.find('avi').status, 'creating');
  await ctx.idle();
  const rec = ctx.registry.find('avi');
  assert.equal(rec.status, 'running');
  assert.equal(rec.ownerPubkey, A);
  assert.equal(rec.everRunning, true);
  assert.equal(rec.imageTag, 'dogfood');
  assert.deepEqual(ctx.calls, ['create avi']);
});

test('a create that fails is marked failed, with the error', async () => {
  const ctx = setup({ failing: { create: true } });
  const rec = await launched(ctx);
  assert.equal(rec.status, 'failed');
  assert.match(rec.lastError, /create went wrong/);
  assert.equal(rec.everRunning, false);
});

for (const [why, slug, code] of [['bad', 'A!', 'bad-slug'], ['reserved', 'www', 'reserved-slug']]) {
  test(`create refuses a ${why} slug before touching the backend`, async () => {
    const ctx = setup();
    await assert.rejects(ctx.brains.create(A, slug), (e) => e.code === code && e.http === 400);
    assert.deepEqual(ctx.calls, []);
  });
}

test('create refuses a slug that is taken, whoever holds it', async () => {
  const ctx = setup();
  await launched(ctx);
  await assert.rejects(ctx.brains.create(B, 'avi'), (e) => e.code === 'slug-taken' && e.http === 409);
  await assert.rejects(ctx.brains.create(A, 'avi'), (e) => e.code === 'slug-taken');
});

test('a slug stays taken while its volumes are kept', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  await assert.rejects(ctx.brains.create(A, 'avi'), (e) => e.code === 'slug-taken');
});

test('caps are checked before anything happens, and each has its own code', async () => {
  const owner = setup({ config: { maxBrainsPerOwner: 1 } });
  await launched(owner);
  await assert.rejects(owner.brains.create(A, 'two'), (e) => e.code === 'owner-cap' && e.http === 409);

  const total = setup({ config: { maxBrainsTotal: 1 } });
  await launched(total);
  await assert.rejects(total.brains.create(B, 'two'), (e) => e.code === 'total-cap');

  const disk = setup({ disk: 1 });
  await assert.rejects(disk.brains.create(A, 'two'), (e) => e.code === 'disk-floor');
  assert.deepEqual(disk.calls, []);
});

test('two creates at once cannot both pass the last slot', async () => {
  const ctx = setup({ config: { maxBrainsTotal: 1 } });
  const results = await Promise.allSettled([ctx.brains.create(A, 'one'), ctx.brains.create(B, 'two')]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  await ctx.idle();
});

test('two creates run one after the other, and the second shows as queued', async () => {
  const ctx = setup();
  await ctx.brains.create(A, 'one');
  await ctx.brains.create(B, 'two');
  assert.equal(ctx.brains.publicStatus('two').queued, true);
  await ctx.idle();
  assert.deepEqual(ctx.calls, ['create one', 'create two']);
  assert.equal(ctx.brains.publicStatus('two').queued, false);
});

test('retry on a brain that never ran deletes what is there and creates it again', async () => {
  const ctx = setup({ failing: { create: true } });
  await launched(ctx);
  ctx.fail.create = false;
  const r = await ctx.brains.create(A, 'avi');
  assert.equal(r.status, 'creating');
  await ctx.idle();
  assert.deepEqual(ctx.calls, ['create avi', 'purge avi', 'create avi']);
  assert.equal(ctx.registry.find('avi').status, 'running');
  assert.equal(ctx.registry.find('avi').lastError, null);
});

test('retry on a brain that has run keeps its data', async () => {
  const ctx = setup();
  await launched(ctx);
  ctx.registry.transition('avi', 'failed', { lastError: 'roll' });
  ctx.calls.length = 0;
  await ctx.brains.create(A, 'avi');
  await ctx.idle();
  assert.deepEqual(ctx.calls, ['restore avi']);
  assert.equal(ctx.registry.find('avi').status, 'running');
});

test('retry records the image version it used', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.roll('sha-old');
  ctx.registry.transition('avi', 'failed', { lastError: 'roll' });
  await ctx.brains.create(A, 'avi');
  await ctx.idle();
  assert.equal(ctx.registry.find('avi').imageTag, 'dogfood');
});

test('only the owner can retry', async () => {
  const ctx = setup({ failing: { create: true } });
  await launched(ctx);
  await assert.rejects(ctx.brains.create(B, 'avi'), (e) => e.code === 'slug-taken');
});

test('destroy keeps the volumes for the grace period', async () => {
  const ctx = setup();
  await launched(ctx);
  const r = await ctx.brains.destroy(A, 'avi');
  assert.equal(r.slug, 'avi');
  await ctx.idle();
  const rec = ctx.registry.find('avi');
  assert.equal(rec.status, 'stopped');
  assert.equal(Date.parse(rec.reapAfter), T0 + 7 * DAY);
  assert.equal(Date.parse(rec.destroyedAt), T0);
  assert.deepEqual(ctx.calls, ['create avi', 'destroy avi']);
});

test('only the owner can destroy', async () => {
  const ctx = setup();
  await launched(ctx);
  await assert.rejects(ctx.brains.destroy(B, 'avi'), (e) => e.http === 403);
  await assert.rejects(ctx.brains.destroy(A, 'nope'), (e) => e.http === 404);
});

test('destroy on a brain that never ran has no grace, and frees the slug', async () => {
  const ctx = setup({ failing: { create: true } });
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  assert.equal(ctx.registry.find('avi'), undefined);
  assert.equal(ctx.registry.list()[0].status, 'destroyed');
  assert.ok(ctx.calls.includes('purge avi'));
});

test('destroy on a failed brain that has run still gets its grace, because it holds real data', async () => {
  const ctx = setup();
  await launched(ctx);
  ctx.registry.transition('avi', 'failed', { lastError: 'roll' });
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  const rec = ctx.registry.find('avi');
  assert.equal(rec.status, 'stopped');
  assert.ok(rec.reapAfter);
  assert.ok(!ctx.calls.includes('purge avi'));
});

test('a brain with work queued refuses more work', async () => {
  const ctx = setup();
  await ctx.brains.create(A, 'avi');
  await assert.rejects(ctx.brains.destroy(A, 'avi'), (e) => e.code === 'busy' && e.http === 409);
  await ctx.idle();
  await ctx.brains.destroy(A, 'avi');
  await assert.rejects(ctx.brains.destroy(A, 'avi'), (e) => e.code === 'busy');
  await ctx.idle();
});

test('destroying a stopped brain is refused', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  await assert.rejects(ctx.brains.destroy(A, 'avi'), (e) => e.code === 'wrong-state' && e.http === 409);
});

test('restore in the grace period brings the brain back and clears the dates', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  ctx.advance(6 * DAY);
  await ctx.brains.restore(A, 'avi');
  await ctx.idle();
  const rec = ctx.registry.find('avi');
  assert.equal(rec.status, 'running');
  assert.equal(rec.reapAfter, null);
  assert.equal(rec.destroyedAt, null);
  assert.ok(ctx.calls.includes('restore avi'));
});

test('restore after the grace period is refused', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  ctx.advance(8 * DAY);
  await assert.rejects(ctx.brains.restore(A, 'avi'), (e) => e.code === 'grace-over');
});

test('restore respects the owner and the caps', async () => {
  const ctx = setup({ config: { maxBrainsTotal: 1 } });
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  await assert.rejects(ctx.brains.restore(B, 'avi'), (e) => e.http === 403);
  await ctx.brains.create(B, 'bo-brain');
  await ctx.idle();
  await assert.rejects(ctx.brains.restore(A, 'avi'), (e) => e.code === 'total-cap');
});

test('a restore that does not come back is failed, and still counts as having run', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  ctx.fail.restore = true;
  await ctx.brains.restore(A, 'avi');
  await ctx.idle();
  const rec = ctx.registry.find('avi');
  assert.equal(rec.status, 'failed');
  assert.equal(rec.everRunning, true);
});

test('start fresh deletes the kept volumes and creates the brain again under the same name', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  ctx.calls.length = 0;
  ctx.advance(DAY);
  const r = await ctx.brains.startFresh(A, 'avi');
  assert.equal(r.status, 'creating');
  await ctx.idle();
  assert.deepEqual(ctx.calls, ['purge avi', 'create avi']);
  const rec = ctx.registry.find('avi');
  assert.equal(rec.status, 'running');
  assert.equal(Date.parse(rec.createdAt), T0 + DAY);
  assert.equal(rec.reapAfter, null);
});

test('start fresh is only for the owner of a stopped brain', async () => {
  const ctx = setup();
  await launched(ctx);
  await assert.rejects(ctx.brains.startFresh(A, 'avi'), (e) => e.code === 'wrong-state');
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  await assert.rejects(ctx.brains.startFresh(B, 'avi'), (e) => e.http === 403);
});

test('reap removes what is past its date and frees the slug, and leaves the rest', async () => {
  const ctx = setup();
  await launched(ctx, A, 'old');
  await ctx.brains.destroy(A, 'old');
  await ctx.idle();
  ctx.advance(6 * DAY);
  await launched(ctx, A, 'new');
  await ctx.brains.destroy(A, 'new');
  await ctx.idle();
  ctx.advance(2 * DAY);
  const reaped = await ctx.brains.reap();
  assert.deepEqual(reaped, ['old']);
  assert.equal(ctx.registry.find('old'), undefined);
  assert.equal(ctx.registry.find('new').status, 'stopped');
  assert.ok(ctx.calls.includes('purge old'));
  assert.ok(!ctx.calls.includes('purge new'));
  await ctx.brains.create(B, 'old');
  await ctx.idle();
  assert.equal(ctx.registry.find('old').ownerPubkey, B);
  assert.equal(ctx.registry.list().filter((r) => r.slug === 'old').length, 2, 'the old record stays as history');
});

test('a reap that fails leaves the brain stopped, to try again next time', async () => {
  const ctx = setup();
  await launched(ctx);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  ctx.advance(8 * DAY);
  ctx.fail.purge = true;
  assert.deepEqual(await ctx.brains.reap(), []);
  assert.equal(ctx.registry.find('avi').status, 'stopped');
});

test('roll pulls once, then updates each running brain in turn', async () => {
  const ctx = setup();
  await launched(ctx, A, 'one');
  await launched(ctx, B, 'two');
  await launched(ctx, A, 'off');
  await ctx.brains.destroy(A, 'off');
  await ctx.idle();
  ctx.calls.length = 0;
  const lines = [];
  const r = await ctx.brains.roll('sha-abc', (l) => lines.push(l));
  assert.equal(r.ok, true);
  assert.deepEqual(ctx.calls, ['pullImages sha-abc', 'restore one', 'restore two']);
  assert.equal(ctx.registry.find('one').imageTag, 'sha-abc');
  assert.equal(ctx.registry.find('off').status, 'stopped');
  assert.ok(lines.length >= 2);
});

test('a roll stops on the first brain that does not come back, and leaves the rest alone', async () => {
  const ctx = setup();
  await launched(ctx, A, 'one');
  await launched(ctx, B, 'two');
  await launched(ctx, A, 'three');
  ctx.calls.length = 0;
  ctx.fail['restore two'] = true;
  const r = await ctx.brains.roll('sha-abc');
  assert.equal(r.ok, false);
  assert.equal(r.failed, 'two');
  assert.deepEqual(ctx.calls, ['pullImages sha-abc', 'restore one', 'restore two']);
  assert.equal(ctx.registry.find('two').status, 'failed');
  assert.match(ctx.registry.find('two').lastError, /restore went wrong/);
  assert.equal(ctx.registry.find('three').status, 'running');
  assert.equal(ctx.registry.find('three').imageTag, 'dogfood');
});

test('a roll whose pull fails touches no brain', async () => {
  const ctx = setup();
  await launched(ctx, A, 'one');
  ctx.calls.length = 0;
  ctx.fail.pullImages = true;
  const r = await ctx.brains.roll('sha-abc');
  assert.equal(r.ok, false);
  assert.deepEqual(ctx.calls, ['pullImages sha-abc']);
  assert.equal(ctx.registry.find('one').status, 'running');
});

test('reconcile fails what a crash left creating, brings up what should be running, and leaves stopped alone', async () => {
  const ctx = setup();
  await launched(ctx, A, 'alive');
  await launched(ctx, A, 'off');
  await ctx.brains.destroy(A, 'off');
  await ctx.idle();
  ctx.registry.add({ slug: 'crashed', ownerPubkey: A, status: 'creating', imageTag: 'dogfood', createdAt: 't', destroyedAt: null, reapAfter: null, lastError: null, everRunning: false });
  ctx.calls.length = 0;
  await ctx.brains.reconcile();
  assert.equal(ctx.registry.find('crashed').status, 'failed');
  assert.match(ctx.registry.find('crashed').lastError, /launcher restarted/);
  assert.deepEqual(ctx.calls, ['ensureUp alive']);
});

test('reconcile marks a brain failed if it will not come up', async () => {
  const ctx = setup();
  await launched(ctx);
  ctx.fail.ensureUp = true;
  await ctx.brains.reconcile();
  assert.equal(ctx.registry.find('avi').status, 'failed');
});

test('ask says yes only for one label under the base domain, on a running brain', async () => {
  const ctx = setup();
  await launched(ctx);
  assert.equal(ctx.brains.askAllowed('avi.tapestry.test'), true);
  assert.equal(ctx.brains.askAllowed('nothing.tapestry.test'), false);
  assert.equal(ctx.brains.askAllowed('a.avi.tapestry.test'), false);
  assert.equal(ctx.brains.askAllowed('avi.other.test'), false);
  assert.equal(ctx.brains.askAllowed('tapestry.test'), false);
  assert.equal(ctx.brains.askAllowed(undefined), false);
  await ctx.brains.destroy(A, 'avi');
  await ctx.idle();
  assert.equal(ctx.brains.askAllowed('avi.tapestry.test'), false);
});

test('the list shows every live brain with its owner label and url', async () => {
  const ctx = setup();
  await launched(ctx, A, 'one');
  await launched(ctx, C, 'two');
  const list = ctx.brains.list();
  assert.deepEqual(list.map((b) => [b.slug, b.ownerLabel, b.status, b.url]), [
    ['one', 'Ana', 'running', 'https://one.tapestry.test'],
    ['two', 'someone no longer on the list', 'running', 'https://two.tapestry.test'],
  ]);
  assert.ok(list.every((b) => !('neo4jPassword' in b)));
});

test('detail is for the owner, and carries the log and the password', async () => {
  const ctx = setup();
  await launched(ctx);
  const d = ctx.brains.detail(A, 'avi');
  assert.equal(d.neo4jPassword, 'the password');
  assert.equal(d.logTail, 'the log');
  assert.equal(d.imageTag, 'dogfood');
  assert.throws(() => ctx.brains.detail(B, 'avi'), (e) => e.http === 403);
  assert.throws(() => ctx.brains.detail(A, 'nope'), (e) => e.http === 404);
});

test('public status holds status words only', async () => {
  const ctx = setup();
  await launched(ctx);
  assert.deepEqual(Object.keys(ctx.brains.publicStatus('avi')).sort(), ['phase', 'queued', 'slug', 'status']);
  assert.equal(ctx.brains.publicStatus('nope'), null);
});
