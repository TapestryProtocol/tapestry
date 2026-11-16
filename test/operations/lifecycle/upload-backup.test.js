'use strict';
/**
 * lifecycle upload-backup — its own suite, run by test/operations.test.js (ADR graph-operations-foundation/0001
 * Decision 12).
 *   Story: engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md (AC4, AC5, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md
 *            (Decisions 1, 7, 9 and 10)
 *
 * The archives are made by the test's own ustar writer (test/helpers/lifecycleFakes.js), from backup folders of
 * another instance, so nothing here depends on the implementation's _tar.js.
 *
 *   U1  the declaration: a write for the owner and admins, no inputs, a file body (application/x-tar or
 *       application/octet-stream, at least 8 GiB), refusals not-a-backup, backup-exists, busy; built-in
 *       wrong-content-type and too-large, and no invalid-body
 *   U2  a backup from another instance is kept as it came: its five files, byte for byte, with received.json (AC4)
 *   U3  it is listed as uploaded, from another instance (AC4)
 *   U4  the same archive again is already held; a different backup under the same id is refused backup-exists
 *   U5  accepted as they come: names with ./, a directory entry identity/, GNU magic, application/octet-stream
 *   U6  every damaged or hostile archive is refused 422 not-a-backup, and nothing is left behind (AC4)
 *   U7  a body of another type is refused 415; a declared size over the limit 413, before anything is read
 *   U8  while a backup or restore runs, an upload is refused busy (AC5)
 *   U9  who may call (AC6)
 *   U10 the command reads the archive from stdin, and won't read a terminal (AC6)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('../../helpers/lifecycleFakes');

const { suite, assert, show, OWNER, ADMIN } = F;
const S = suite('lifecycle upload-backup');
const test = S.test;
const ROUTE = '/api/tapestry/lifecycle/upload-backup';
const DECL = path.join(F.ROOT, 'src/operations/catalog/lifecycle/upload-backup.js');
const NEED = [[DECL, 'ADR graph-operations-foundation/0002 Decision 1']];
const TAR = 'application/x-tar';
const up = (id, caller, buf, contentType = TAR, more = {}) => ({ id, method: 'POST', url: ROUTE, caller, contentType, rawBase64: Buffer.from(buf).toString('base64'), ...more });

function uploads() {
  return S.setup('uploads', {
    mustExist: NEED,
    before: async (inst) => {
      const origin = await F.makeInstance(S.base(), { name: 'uploads-origin', owner: 'dd'.repeat(32), admins: [] });
      const od = path.join(origin.dir, 'made');
      let hour = 0;
      const make = (o = {}) => F.writeBackup(od, {
        identityDir: origin.keysDir, assistantPubkey: origin.identity.pubkey, ownerPubkey: 'dd'.repeat(32), admins: [],
        takenAt: new Date(Date.UTC(2026, 10, 1, hour++)).toISOString(), ...o,
      });
      const tarOf = (b, opts) => F.tarWrite(F.backupMembers(b.folder), opts);
      const good = make({ note: 'moving house' });
      const A = {};
      A.good = tarOf(good);
      // A different backup under the same id.
      const clash = F.writeBackup(path.join(origin.dir, 'clash'), { identityDir: origin.keysDir, assistantPubkey: origin.identity.pubkey, ownerPubkey: 'dd'.repeat(32), id: good.id, graph: { tx: 99 } });
      A.clash = tarOf(clash);
      const dot = make();
      A.dot = F.tarWrite([{ name: 'identity/', type: '5' }, ...F.backupMembers(dot.folder).map((m) => ({ ...m, name: `./${m.name}` }))]);
      const gnu = make(); A.gnu = tarOf(gnu, { gnu: true });
      const octet = make(); A.octet = tarOf(octet);
      const cli = make(); A.cli = tarOf(cli);
      const bad = {};
      { const b = make(); bad.sha = F.tarWrite(F.backupMembers(b.folder).map((m) => (m.name === 'neo4j.dump' ? { ...m, data: F.fakeDumpBytes({ ...F.defaultGraph(), tx: 77 }) } : m))); }
      { const b = make(); bad.missing = F.tarWrite(F.backupMembers(b.folder).filter((m) => m.name !== 'admins.json')); }
      { const b = make(); bad.extra = F.tarWrite([...F.backupMembers(b.folder), { name: 'evil.sh', data: '#!/bin/sh\nrm -rf /\n' }]); }
      { const b = make(); bad.symlink = F.tarWrite([...F.backupMembers(b.folder), { name: 'identity/link', type: '2', linkname: '/etc/passwd' }]); }
      { const b = make(); bad.traversal = F.tarWrite([...F.backupMembers(b.folder).filter((m) => m.name !== 'admins.json'), { name: '../admins.json', data: fs.readFileSync(path.join(b.folder, 'admins.json')) }]); }
      { const b = make(); bad.checksum = F.tarWrite(F.backupMembers(b.folder).map((m, i) => (i === 0 ? { ...m, badChecksum: true } : m))); }
      { const b = make(); const t = tarOf(b); bad.truncated = t.subarray(0, t.length - 1024 - 700); }
      { const b = make({ dump: Buffer.from('this is not a neo4j dump') }); bad.notADump = tarOf(b); }
      { const b = make({ dropManifestFields: ['graph'] }); bad.badManifest = tarOf(b); }
      { const b = make({ assistantPubkey: 'ab'.repeat(32) }); bad.wrongKey = tarOf(b); }
      { const b = make(); const m = F.backupMembers(b.folder); bad.twice = F.tarWrite([...m.slice(0, 2), m[1], ...m.slice(2)]); }
      bad.garbage = crypto.randomBytes(5000);
      bad.empty = Buffer.alloc(0);
      return { A, bad, ids: { good: good.id, dot: dot.id, gnu: gnu.id, octet: octet.id, cli: cli.id }, goodFolder: good.folder, dotFolder: dot.folder };
    },
    scenario: (inst, e) => ({
      requests: [
        up('good', 'admin', e.A.good),
        { id: 'list', method: 'GET', url: '/api/tapestry/lifecycle/list-backups', caller: 'owner' },
        up('again', 'owner', e.A.good),
        up('clash', 'owner', e.A.clash),
        up('dot', 'owner', e.A.dot),
        up('gnu', 'owner', e.A.gnu),
        up('octet', 'owner', e.A.octet, 'application/octet-stream'),
        ...Object.entries(e.bad).map(([k, buf]) => up(`bad-${k}`, 'owner', buf)),
        up('text', 'owner', e.A.good, 'text/plain'),
        { id: 'huge', method: 'POST', url: ROUTE, caller: 'owner', contentType: TAR, headers: { 'Content-Length': String(20 * 1024 * 1024 * 1024) }, declaredOnly: true },
        up('visitor', 'visitor', e.A.good),
        up('stranger', 'stranger', e.A.good),
      ],
      cli: [
        { id: 'cli', argv: ['lifecycle', 'upload-backup'], stdinBase64: e.A.cli.toString('base64') },
        { id: 'cli-tty', argv: ['lifecycle', 'upload-backup'], stdinIsTTY: true },
      ],
    }),
  });
}

test('U1: the declaration is a write for the owner and admins with no inputs and a file body, and its refusals', () => {
  for (const [abs, why] of NEED) if (!fs.existsSync(abs)) throw new Error(`${path.relative(F.ROOT, abs)} does not exist yet (${why})`);
  const { loadOperations } = require(path.join(F.ROOT, 'src/operations/index.js'));
  const op = loadOperations().operations.find((o) => o.group === 'lifecycle' && o.name === 'upload-backup');
  assert(op, 'lifecycle upload-backup is not among the loaded operations');
  assert(op.kind === 'write' && op.method === 'POST' && op.access === 'owner-and-admins' && Object.keys(op.inputs).length === 0,
    `a POST write for the owner and admins, with no inputs; got ${op.kind} ${op.method} ${op.access} ${show(op.inputs)}`);
  const body = op.declaration.body;
  assert(body && body.file && show([...body.file.contentTypes].sort()) === show(['application/octet-stream', 'application/x-tar'])
    && body.file.maxBytes >= 8 * 1024 ** 3 && body.file.maxBytes <= 9 * 1024 ** 3,
    `its body is a file: application/x-tar or application/octet-stream, up to between 8 and 9 GiB (nginx takes 9g); got ${show(body)}`);
  const all = Object.fromEntries(op.refusals.map((x) => [x.code, x.status]));
  const want = { 'not-a-backup': 422, 'backup-exists': 409, busy: 409, 'wrong-content-type': 415, 'too-large': 413 };
  for (const [k, v] of Object.entries(want)) assert(all[k] === v, `upload-backup can refuse ${k} (${v}); got ${show(all)}`);
  assert(!('invalid-body' in all), `a file body is never refused invalid-body; got ${show(all)}`);
});

test('U2: a backup from another instance is kept as it came — its five files byte for byte, with received.json, and nothing left over (AC4)', async () => {
  const { inst, run, extra } = await uploads();
  const d = S.okData(run, 'good');
  assert(d.alreadyHeld === false && d.backup && d.backup.id === extra.ids.good && d.backup.origin === 'uploaded',
    `the answer is the kept backup's summary, origin 'uploaded', alreadyHeld false; got ${show(d).slice(0, 500)}`);
  const kept = path.join(inst.backupsDir, extra.ids.good);
  const files = F.folderFiles(kept);
  for (const name of F.MEMBER_ORDER) assert(files[name] && files[name].equals(fs.readFileSync(path.join(extra.goodFolder, name))), `${name} is kept byte for byte`);
  const rec = files['received.json'] && JSON.parse(files['received.json']);
  assert(rec && !Number.isNaN(Date.parse(rec.receivedAt)) && rec.by === ADMIN, `received.json is { receivedAt, by: the caller's pubkey }; got ${show(rec)}`);
  assert(show(Object.keys(files).sort()) === show([...F.MEMBER_ORDER, 'received.json'].sort()), `nothing else is kept; got ${show(Object.keys(files))}`);
  assert(F.modeOf(kept) === 0o700 && Object.keys(files).every((n) => F.modeOf(path.join(kept, n)) === 0o600), 'the folder is 0700 and its files 0600');
  assert(!fs.readdirSync(inst.backupsDir).some((n) => n.startsWith('.incoming')) && !fs.existsSync(path.join(inst.backupsDir, '.lock')), 'no upload folder or lock is left');
});

test('U3: an uploaded backup is listed as uploaded, from another instance (AC4)', async () => {
  const { run, extra } = await uploads();
  const d = S.okData(run, 'list');
  const b = (d.backups || []).find((x) => x.id === extra.ids.good);
  assert(b && b.origin === 'uploaded' && b.receivedAt && b.sameInstance === false && b.note === 'moving house', `listed as uploaded from another instance; got ${show(b)}`);
});

test('U4: the same archive again is already held; a different backup under the same id is refused 409 backup-exists, changing nothing', async () => {
  const { inst, run, extra } = await uploads();
  const again = S.okData(run, 'again');
  assert(again.alreadyHeld === true && again.backup.id === extra.ids.good, `the same backup again is alreadyHeld; got ${show(again).slice(0, 300)}`);
  const c = F.pick(run, 'clash');
  assert(c.status === 409 && c.body.code === 'backup-exists', `a different backup with the same id is 409 backup-exists; got ${c.status} ${show(c.body)}`);
  const dump = fs.readFileSync(path.join(inst.backupsDir, extra.ids.good, 'neo4j.dump'));
  assert(dump.equals(fs.readFileSync(path.join(extra.goodFolder, 'neo4j.dump'))), 'the held backup is unchanged');
});

test('U5: names with ./, a directory entry identity/, GNU tar\'s magic and application/octet-stream are all accepted', async () => {
  const { inst, run, extra } = await uploads();
  for (const k of ['dot', 'gnu', 'octet']) {
    const d = S.okData(run, k);
    assert(d.backup && d.backup.id === extra.ids[k], `${k}: kept under its id; got ${show(d).slice(0, 300)}`);
    const files = F.folderFiles(path.join(inst.backupsDir, extra.ids[k]));
    assert(F.MEMBER_ORDER.every((n) => files[n]), `${k}: kept with plain names; got ${show(Object.keys(files))}`);
  }
  assert(F.folderFiles(path.join(inst.backupsDir, extra.ids.dot))['neo4j.dump'].equals(fs.readFileSync(path.join(extra.dotFolder, 'neo4j.dump'))), 'the ./ archive\'s dump is kept byte for byte');
});

test('U6: every damaged or hostile archive is refused 422 not-a-backup, and nothing of it is kept or left behind (AC4)', async () => {
  const { inst, run, extra } = await uploads();
  for (const k of Object.keys(extra.bad)) {
    const r = F.pick(run, `bad-${k}`);
    assert(r.status === 422 && r.body && r.body.code === 'not-a-backup' && typeof r.body.error === 'string' && r.body.error.trim().length > 10,
      `${k}: refused 422 not-a-backup, saying why; got ${r.status} ${show(r.body).slice(0, 300)}`);
  }
  const kept = F.backupIds(inst.backupsDir).sort();
  const expected = [extra.ids.good, extra.ids.dot, extra.ids.gnu, extra.ids.octet, extra.ids.cli].sort();
  assert(show(kept) === show(expected), `only the good uploads are kept; got ${show(kept)}`);
  assert(F.leftovers(inst.backupsDir).length === 0, `no incoming folder, incomplete folder or lock is left; got ${show(F.leftovers(inst.backupsDir))}`);
  assert(!fs.existsSync(path.join(inst.backupsDir, '..', 'admins.json')) && !fs.existsSync(path.join(path.dirname(inst.backupsDir), 'evil.sh')), 'nothing was written outside the backups folder');
});

test('U7: a body of another type is refused 415 wrong-content-type; a declared size over the limit 413 too-large, before anything is read', async () => {
  const { inst, run } = await uploads();
  const t = F.pick(run, 'text');
  assert(t.status === 415 && t.body.code === 'wrong-content-type', `text/plain is 415 wrong-content-type; got ${t.status} ${show(t.body)}`);
  const h = F.pick(run, 'huge');
  assert(h.status === 413 && h.body && h.body.code === 'too-large', `a Content-Length over the limit is 413 too-large; got ${h.status} ${show(h.body).slice(0, 300)}`);
  assert(F.leftovers(inst.backupsDir).length === 0, 'neither left anything behind');
});

test('U8: while a backup or restore runs, an upload is refused 409 busy (AC5)', async () => {
  const { inst, run } = await S.setup('busy', {
    mustExist: NEED,
    before: async (i) => {
      const origin = await F.makeInstance(S.base(), { name: 'busy-origin', owner: 'dd'.repeat(32) });
      const b = F.writeBackup(path.join(origin.dir, 'made'), { identityDir: origin.keysDir, assistantPubkey: origin.identity.pubkey, ownerPubkey: 'dd'.repeat(32) });
      F.writeLock(i.backupsDir, { op: 'restore', pid: process.pid });
      return { tar: F.tarWrite(F.backupMembers(b.folder)) };
    },
    scenario: (i, e) => ({ requests: [up('busy', 'owner', e.tar)] }),
  });
  const r = F.pick(run, 'busy');
  assert(r.status === 409 && r.body.code === 'busy', `409 busy; got ${r.status} ${show(r.body)}`);
  assert(F.backupIds(inst.backupsDir).length === 0 && !fs.readdirSync(inst.backupsDir).some((n) => n.startsWith('.incoming')), 'nothing is kept');
});

test('U9: a visitor is refused 401 and a stranger 403 (AC6)', async () => {
  const { run } = await uploads();
  const v = F.pick(run, 'visitor');
  const s = F.pick(run, 'stranger');
  assert(v.status === 401 && v.body.success === false && /owner/i.test(String(v.body.error)) && s.status === 403 && s.body.success === false && /owner/i.test(String(s.body.error)), `visitor 401, stranger 403; got ${v.status} ${show(v.body)} ${s.status} ${show(s.body)}`);
});

test('U10: `tapestry lifecycle upload-backup < backup.tar` reads the archive from stdin, and won\'t read a terminal (AC6)', async () => {
  const { inst, run, extra } = await uploads();
  const c = F.pick(run, 'cli');
  let j = null;
  try { j = JSON.parse(c.stdout); } catch { /* reported below */ }
  assert(c.code === 0 && j && j.success && j.data.backup.id === extra.ids.cli, `exit 0 with the kept backup's summary; got ${show(c.code)} ${show(String(c.stdout).slice(0, 300))} ${String(c.stderr).slice(-300)}`);
  const rec = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, extra.ids.cli, 'received.json'), 'utf8'));
  assert(rec.by === 'local', `received.json says it came from a local caller; got ${show(rec)}`);
  const t = F.pick(run, 'cli-tty');
  assert(t.code === 2 && /upload-backup\s*</.test(t.stderr), `from a terminal: exit 2, with a hint to send the file on stdin; got ${show(t.code)} ${show(t.stderr)}`);
});

module.exports = { run: () => S.run() };
if (require.main === module) S.run().then(({ fail }) => process.exit(fail ? 1 : 0));
