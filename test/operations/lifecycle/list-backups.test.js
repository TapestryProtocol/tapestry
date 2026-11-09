'use strict';
/**
 * lifecycle list-backups — its own suite, run by test/operations.test.js (ADR graph-operations-foundation/0001
 * Decision 12).
 *   Story: engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md (AC2, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md
 *            (Decisions 1, 3 and 11)
 *
 *   L1  the declaration: a read for the owner and admins, limit 1–500 (default 100) and before (an id)
 *   L2  every complete backup, newest first, each with its summary, its origin and whether it is this instance's (AC2)
 *   L3  folders without a manifest, uploads still arriving, the lock and anything else are never listed
 *   L4  limit and before page through them, and next is the id to pass on
 *   L5  with no backups folder at all, the list is empty
 *   L6  who may call (AC6)
 */

const fs = require('fs');
const path = require('path');
const F = require('../../helpers/lifecycleFakes');

const { suite, assert, show, OWNER, ADMIN } = F;
const S = suite('lifecycle list-backups');
const test = S.test;
const ROUTE = '/api/tapestry/lifecycle/list-backups';
const DECL = path.join(F.ROOT, 'src/operations/catalog/lifecycle/list-backups.js');
const NEED = [[DECL, 'ADR graph-operations-foundation/0002 Decision 1']];
const get = (id, caller, query = '') => ({ id, method: 'GET', url: `${ROUTE}${query}`, caller });

function listed() {
  return S.setup('listed', {
    mustExist: NEED,
    before: async (inst) => {
      const other = await F.makeInstance(S.base(), { name: 'listed-origin', owner: 'dd'.repeat(32) });
      const at = (h) => new Date(Date.UTC(2026, 10, 8, h, 0, 0)).toISOString();
      const mine = { identityDir: inst.keysDir, assistantPubkey: inst.identity.pubkey, ownerPubkey: OWNER, admins: [ADMIN] };
      const b1 = F.writeBackup(inst.backupsDir, { ...mine, takenAt: at(9), note: 'first' });
      const b2 = F.writeBackup(inst.backupsDir, { ...mine, takenAt: at(10), reason: 'before-restore', restoring: b1.id, note: `Safety backup taken before restoring ${b1.id}`, countsExact: false });
      const b3 = F.writeBackup(inst.backupsDir, {
        identityDir: other.keysDir, assistantPubkey: other.identity.pubkey, ownerPubkey: 'dd'.repeat(32), admins: [],
        takenAt: at(11), note: 'from elsewhere', received: { receivedAt: at(12), by: ADMIN },
      });
      const b4 = F.writeBackup(inst.backupsDir, { ...mine, takenAt: at(13) });
      // Never listed: an incomplete folder, an upload still arriving, the lock, run records, junk.
      fs.mkdirSync(path.join(inst.backupsDir, F.newId(new Date(Date.UTC(2026, 10, 8, 14)))), { mode: 0o700 });
      fs.mkdirSync(path.join(inst.backupsDir, '.incoming-20261108T150000Z-0badf00d'), { mode: 0o700 });
      fs.mkdirSync(path.join(inst.backupsDir, '.runs'), { mode: 0o700 });
      fs.writeFileSync(path.join(inst.backupsDir, '.runs', `${F.newId()}.json`), JSON.stringify({ op: 'backup', outcome: 'done' }));
      fs.writeFileSync(path.join(inst.backupsDir, 'notes.txt'), 'not a backup');
      fs.mkdirSync(path.join(inst.backupsDir, 'not-an-id'), { mode: 0o700 });
      fs.writeFileSync(path.join(inst.backupsDir, 'not-an-id', 'manifest.json'), '{}');
      return { b1, b2, b3, b4 };
    },
    scenario: (inst, e) => ({
      requests: [
        get('all', 'owner'),
        get('page1', 'admin', '?limit=2'),
        get('page2', 'owner', `?limit=2&before=${e.b3.id}`),
        get('visitor', 'visitor'),
        get('stranger', 'stranger'),
        get('too-many', 'owner', '?limit=501'),
      ],
      cli: [{ id: 'cli', argv: ['lifecycle', 'list-backups', '--limit', '1'] }],
    }),
  });
}

test('L1: the declaration is a read for the owner and admins, with limit 1–500 (default 100) and before (a backup id)', () => {
  for (const [abs, why] of NEED) if (!fs.existsSync(abs)) throw new Error(`${path.relative(F.ROOT, abs)} does not exist yet (${why})`);
  const { loadOperations } = require(path.join(F.ROOT, 'src/operations/index.js'));
  const op = loadOperations().operations.find((o) => o.group === 'lifecycle' && o.name === 'list-backups');
  assert(op, 'lifecycle list-backups is not among the loaded operations');
  assert(op.kind === 'read' && op.method === 'GET' && op.access === 'owner-and-admins', `list-backups is a GET read for the owner and admins; got ${op.kind} ${op.method} ${op.access}`);
  const { limit, before } = op.inputs;
  assert(limit && limit.schema.type === 'integer' && limit.schema.minimum === 1 && limit.schema.maximum === 500 && limit.schema.default === 100, `limit: integer 1–500, default 100; got ${show(limit)}`);
  assert(before && before.required !== true && before.schema.pattern === '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$', `before: an optional backup id; got ${show(before)}`);
});

test('L2: every complete backup, newest first, each with its summary, its origin and whether it is this instance\'s (AC2)', async () => {
  const { inst, run, extra } = await listed();
  const d = S.okData(run, 'all');
  const ids = (d.backups || []).map((b) => b.id);
  assert(show(ids) === show([extra.b4.id, extra.b3.id, extra.b2.id, extra.b1.id]), `the four complete backups, newest first; got ${show(ids)}`);
  assert(d.next === null, `next is null when nothing is left; got ${show(d.next)}`);
  const by = Object.fromEntries(d.backups.map((b) => [b.id, b]));
  const size = (b) => Object.values(F.folderFiles(b.folder)).reduce((n, x) => n + x.length, 0);
  const b1 = by[extra.b1.id];
  assert(b1.note === 'first' && b1.origin === 'taken' && b1.reason === 'requested' && b1.takenAt === extra.b1.manifest.takenAt && b1.size === size(extra.b1) && b1.sameInstance === true,
    `a backup taken here: note, origin 'taken', reason, takenAt, size (the sum of its files), sameInstance; got ${show(b1)}`);
  assert(b1.holds && b1.holds.nodes === 5 && b1.holds.tapestryKeys === 3 && b1.holds.assistantPubkey === inst.identity.pubkey && show(b1.holds.admins) === show([ADMIN]),
    `each summary holds what AC1's answer gives; got ${show(b1.holds)}`);
  assert(b1.graph && b1.graph.neo4jVersion === '5.26.10' && b1.graph.lastCommittedTransaction === '18', `and the graph's facts; got ${show(b1.graph)}`);
  const b2 = by[extra.b2.id];
  assert(b2.reason === 'before-restore' && b2.origin === 'taken', `a safety backup is reason 'before-restore', taken here; got ${show(b2)}`);
  const b3 = by[extra.b3.id];
  assert(b3.origin === 'uploaded' && b3.receivedAt && b3.sameInstance === false, `an uploaded backup from another instance: origin 'uploaded', receivedAt, sameInstance false; got ${show(b3)}`);
});

test('L3: incomplete folders, uploads still arriving, the lock, run records and anything else are never listed', async () => {
  const { run } = await listed();
  const d = S.okData(run, 'all');
  assert((d.backups || []).length === 4 && d.backups.every((b) => F.ID_RE.test(b.id)), `only the four complete backups; got ${show((d.backups || []).map((b) => b.id))}`);
});

test('L4: limit and before page through them, and next is the id to pass on', async () => {
  const { run, extra } = await listed();
  const p1 = S.okData(run, 'page1');
  assert(show(p1.backups.map((b) => b.id)) === show([extra.b4.id, extra.b3.id]) && p1.next === extra.b3.id,
    `limit=2 gives the two newest and next = the last one given; got ${show({ ids: p1.backups.map((b) => b.id), next: p1.next })}`);
  const p2 = S.okData(run, 'page2');
  assert(show(p2.backups.map((b) => b.id)) === show([extra.b2.id, extra.b1.id]) && p2.next === null,
    `before=<id> gives the older ones; next is null at the end; got ${show({ ids: p2.backups.map((b) => b.id), next: p2.next })}`);
  const tm = F.pick(run, 'too-many');
  assert(tm.status === 400 && tm.body.code === 'invalid-input' && tm.body.input === 'limit', `limit=501 is 400 invalid-input; got ${tm.status} ${show(tm.body)}`);
});

test('L5: with no backups folder at all, the list is empty and next is null', async () => {
  const { run } = await S.setup('empty', { mustExist: NEED, scenario: () => ({ requests: [get('empty', 'owner')] }) });
  const d = S.okData(run, 'empty');
  assert(Array.isArray(d.backups) && d.backups.length === 0 && d.next === null, `an empty list; got ${show(d)}`);
});

test('L6: a visitor is refused 401 and a stranger 403; the command lists without signing in (AC6)', async () => {
  const { run, extra } = await listed();
  assert(F.pick(run, 'visitor').status === 401 && F.pick(run, 'stranger').status === 403, 'visitor 401, stranger 403');
  const c = F.pick(run, 'cli');
  let j = null;
  try { j = JSON.parse(c.stdout); } catch { /* reported below */ }
  assert(c.code === 0 && j && j.success && j.data.backups.length === 1 && j.data.backups[0].id === extra.b4.id && j.data.next === extra.b4.id,
    `\`tapestry lifecycle list-backups --limit 1\` lists the newest; got ${show(c.code)} ${show(String(c.stdout).slice(0, 300))}`);
});

module.exports = { run: () => S.run() };
if (require.main === module) S.run().then(({ fail }) => process.exit(fail ? 1 : 0));
