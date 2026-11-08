'use strict';
/**
 * lifecycle download-backup — its own suite, run by test/operations.test.js (ADR graph-operations-foundation/0001
 * Decision 12).
 *   Story: engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md (AC4, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md
 *            (Decisions 1, 9 and 10)
 *
 *   D1  the declaration: a read for the owner and admins, a required backup id, a file result (application/x-tar),
 *       refusals unknown-backup and too-large
 *   D2  the answer is one file: its headers, and a ustar archive of the backup's five files, in order, byte for byte
 *   D3  the system's own tar reads it
 *   D4  an unknown backup is refused 404 unknown-backup, in JSON
 *   D5  a backup whose dump is 8 GiB or more is refused 413 too-large
 *   D6  who may call (AC6)
 *   D7  the command writes the same bytes to stdout, and refuses to write them to a terminal (AC6)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('../../helpers/lifecycleFakes');

const { suite, assert, show, OWNER, ADMIN } = F;
const S = suite('lifecycle download-backup');
const test = S.test;
const ROUTE = '/api/tapestry/lifecycle/download-backup';
const DECL = path.join(F.ROOT, 'src/operations/catalog/lifecycle/download-backup.js');
const NEED = [[DECL, 'ADR graph-operations-foundation/0002 Decision 1']];
const EIGHT_GIB = 8 * 1024 * 1024 * 1024;
const get = (id, caller, backup) => ({ id, method: 'GET', url: `${ROUTE}?backup=${backup}`, caller });

function downloads() {
  return S.setup('downloads', {
    mustExist: NEED,
    before: (inst) => {
      const mine = { identityDir: inst.keysDir, assistantPubkey: inst.identity.pubkey, ownerPubkey: OWNER, admins: [ADMIN] };
      const b = F.writeBackup(inst.backupsDir, { ...mine, note: 'to move' });
      const big = F.writeBackup(inst.backupsDir, { ...mine, takenAt: new Date(Date.now() - 86400e3).toISOString() });
      // A sparse 8 GiB dump: too big for one ustar member. Nothing reads it whole.
      const fd = fs.openSync(path.join(big.folder, 'neo4j.dump'), 'r+');
      fs.ftruncateSync(fd, EIGHT_GIB);
      fs.closeSync(fd);
      return { b, big, unknown: F.newId(new Date(Date.now() - 5 * 86400e3)) };
    },
    scenario: (inst, e) => ({
      requests: [get('owner', 'owner', e.b.id), get('admin', 'admin', e.b.id), get('local', 'local', e.b.id),
        get('visitor', 'visitor', e.b.id), get('stranger', 'stranger', e.b.id), get('unknown', 'owner', e.unknown), get('big', 'owner', e.big.id)],
      cli: [
        { id: 'cli', argv: ['lifecycle', 'download-backup', '--backup', e.b.id] },
        { id: 'cli-tty', argv: ['lifecycle', 'download-backup', '--backup', e.b.id], stdoutIsTTY: true },
      ],
    }),
  });
}
const bytesOf = (r) => Buffer.from(r.bodyBase64 || r.stdoutBase64 || '', 'base64');

test('D1: the declaration is a read for the owner and admins, takes a required backup id, answers with a file, and declares unknown-backup and too-large', () => {
  for (const [abs, why] of NEED) if (!fs.existsSync(abs)) throw new Error(`${path.relative(F.ROOT, abs)} does not exist yet (${why})`);
  const { loadOperations } = require(path.join(F.ROOT, 'src/operations/index.js'));
  const op = loadOperations().operations.find((o) => o.group === 'lifecycle' && o.name === 'download-backup');
  assert(op, 'lifecycle download-backup is not among the loaded operations');
  assert(op.kind === 'read' && op.method === 'GET' && op.access === 'owner-and-admins', `a GET read for the owner and admins; got ${op.kind} ${op.method} ${op.access}`);
  assert(op.inputs.backup && op.inputs.backup.required === true && op.inputs.backup.schema.pattern === '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$', `a required backup id; got ${show(op.inputs.backup)}`);
  assert(op.result && op.result.file && op.result.file.contentType === 'application/x-tar', `its result is a file, application/x-tar; got ${show(op.result)}`);
  const r = Object.fromEntries(op.declaredRefusals.map((x) => [x.code, x.status]));
  assert(r['unknown-backup'] === 404 && r['too-large'] === 413, `declares unknown-backup (404) and too-large (413); got ${show(r)}`);
});

test('D2: the answer is one file — its headers, and a ustar archive of the backup\'s five files, in order, byte for byte (AC4)', async () => {
  const { run, extra } = await downloads();
  const r = F.pick(run, 'owner');
  assert(r.status === 200, `200; got ${r.status} ${show(r.body).slice(0, 400)}`);
  const h = r.headers || {};
  const body = bytesOf(r);
  assert(h['content-type'] && h['content-type'].startsWith('application/x-tar'), `Content-Type application/x-tar; got ${show(h['content-type'])}`);
  assert(Number(h['content-length']) === body.length, `Content-Length is the archive's length (${body.length}); got ${show(h['content-length'])}`);
  assert(/^attachment;\s*filename="tapestry-backup-[^"]+\.tar"$/.test(String(h['content-disposition'])) && String(h['content-disposition']).includes(extra.b.id),
    `Content-Disposition: attachment; filename="tapestry-backup-<id>.tar"; got ${show(h['content-disposition'])}`);
  assert(/no-store/.test(String(h['cache-control'])) && h['x-content-type-options'] === 'nosniff', `Cache-Control no-store and nosniff; got ${show({ cc: h['cache-control'], xcto: h['x-content-type-options'] })}`);
  const t = F.tarRead(body);
  assert(show(t.members.map((m) => m.name)) === show(F.MEMBER_ORDER), `members, in order, ${show(F.MEMBER_ORDER)}; got ${show(t.members.map((m) => m.name))}`);
  for (const m of t.members) {
    assert(m.type === '0' && m.mode === 0o600 && m.checksumOk && m.magic === 'ustar\0', `${m.name}: a regular ustar file, mode 0600, good checksum; got ${show({ type: m.type, mode: m.mode.toString(8), magic: m.magic, ok: m.checksumOk })}`);
    assert(m.data.equals(fs.readFileSync(path.join(extra.b.folder, m.name))), `${m.name} is the backup's file, byte for byte`);
  }
  assert(t.endsWithTwoZeroBlocks && t.consumed === body.length, `the archive ends with two zero blocks and nothing after; got ${show({ two: t.endsWithTwoZeroBlocks, consumed: t.consumed, length: body.length })}`);
  const a = F.pick(run, 'admin');
  assert(a.status === 200 && bytesOf(a).equals(body), 'the admin gets the same file');
});

test('D3: the system\'s own tar lists the archive and extracts the same files', async () => {
  const { run, extra } = await downloads();
  const body = bytesOf(F.pick(run, 'owner'));
  const dir = fs.mkdtempSync(path.join(S.base(), 'untar-'));
  const file = path.join(dir, 'backup.tar');
  fs.writeFileSync(file, body);
  const list = spawnSync('tar', ['-tf', file], { encoding: 'utf8' });
  assert(list.status === 0 && show(list.stdout.trim().split('\n')) === show(F.MEMBER_ORDER), `tar -tf lists the five members; got ${list.status} ${show(list.stdout)} ${list.stderr}`);
  const x = spawnSync('tar', ['-xf', file, '-C', dir], { encoding: 'utf8' });
  assert(x.status === 0, `tar -xf extracts it; got ${x.status} ${x.stderr}`);
  for (const name of F.MEMBER_ORDER) assert(fs.readFileSync(path.join(dir, name)).equals(fs.readFileSync(path.join(extra.b.folder, name))), `${name} extracts byte for byte`);
});

test('D4: an unknown backup is refused 404 unknown-backup, as JSON', async () => {
  const { run } = await downloads();
  const r = F.pick(run, 'unknown');
  assert(r.status === 404 && r.body && r.body.code === 'unknown-backup' && /json/.test(String(r.headers && r.headers['content-type'])),
    `404 unknown-backup, as JSON; got ${r.status} ${show(r.body)} ${show(r.headers && r.headers['content-type'])}`);
});

test('D5: a backup whose dump is 8 GiB or more, more than one ustar member can carry, is refused 413 too-large', async () => {
  const { run } = await downloads();
  const r = F.pick(run, 'big');
  assert(r.status === 413 && r.body && r.body.code === 'too-large', `413 too-large; got ${r.status} ${show(r.body).slice(0, 300)}`);
});

test('D6: the owner, an admin and a direct-local caller may download; a visitor is refused 401 and a stranger 403 (AC6)', async () => {
  const { run } = await downloads();
  assert(F.pick(run, 'local').status === 200, 'direct-local 200');
  const v = F.pick(run, 'visitor');
  const s = F.pick(run, 'stranger');
  assert(v.status === 401 && v.body.success === false && /owner/i.test(String(v.body.error)) && s.status === 403 && s.body.success === false && /owner/i.test(String(s.body.error)), `visitor 401, stranger 403; got ${v.status} ${s.status}`);
});

test('D7: `tapestry lifecycle download-backup --backup <id>` writes the same bytes to stdout, and won\'t write them to a terminal (AC6)', async () => {
  const { run } = await downloads();
  const route = bytesOf(F.pick(run, 'owner'));
  const c = F.pick(run, 'cli');
  assert(c.code === 0 && bytesOf(c).equals(route), `the command exits 0 and its stdout is the archive, byte for byte (${route.length} bytes); got exit ${show(c.code)}, ${bytesOf(c).length} bytes, stderr ${show(String(c.stderr).slice(-300))}`);
  const t = F.pick(run, 'cli-tty');
  assert(t.code === 2 && bytesOf(t).length === 0 && /download-backup --backup .*>/.test(t.stderr), `to a terminal: exit 2, nothing on stdout, and a hint to redirect it; got ${show(t.code)} ${show(t.stderr)}`);
});

module.exports = { run: () => S.run() };
if (require.main === module) S.run().then(({ fail }) => process.exit(fail ? 1 : 0));
