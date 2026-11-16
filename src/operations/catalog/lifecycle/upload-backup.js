'use strict';
/**
 * lifecycle upload-backup — keep a backup another instance made, from the tar `download-backup` gives (story
 * graph-operations-foundation #2, ADR graph-operations-foundation/0002 Decisions 1, 7, 9 and 10).
 *
 * The archive is read as it arrives, into a folder of its own (.incoming-<x>/), taking only a backup's five files as
 * regular files; anything else refuses it. Once every file's size and sha256 match its manifest, the graph database
 * can read its dump and its key is the assistant it names, the folder is renamed into place in one step.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { refusal } = require('../../refusal');
const C = require('./_common');

const MAX_BYTES = 8 * 1024 ** 3 + 64 * 1024 ** 2;

module.exports = {
  group: 'lifecycle',
  name: 'upload-backup',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Upload a backup (the tar download-backup gives) to keep it here, ready to restore',
  description: [
    'The body is the backup\'s tar, as `lifecycle download-backup` gives it. It is checked before it is kept: only a backup\'s five files, each the size and sha256 its manifest records, a dump the graph database can load, and a key that is the assistant it names. The same backup again is already held; a different one under the same id is refused. Restore it with `lifecycle restore`.',
    'From a shell inside the instance: `tapestry lifecycle upload-backup < backup.tar`.',
  ].join('\n\n'),
  inputs: {},
  body: { file: { contentTypes: ['application/x-tar', 'application/octet-stream'], maxBytes: MAX_BYTES } },
  result: {
    description: 'The backup kept: { backup, holds, graph, offlineMs, sameInstance, alreadyHeld }',
    schema: { type: 'object', properties: { backup: C.REF, holds: C.HOLDS, graph: C.GRAPH, sameInstance: { type: 'boolean' }, alreadyHeld: { type: 'boolean' } } },
  },
  refusals: [
    { code: 'not-a-backup', status: 422, when: 'The body is not a whole, undamaged backup as Tapestry writes one' },
    { code: 'backup-exists', status: 409, when: 'The instance holds a different backup under the same id' },
    C.BUSY,
  ],

  async run(inputs, context) {
    const store = require('./_store');
    const system = require('./_system');
    const jobs = require('./_jobs');
    const identity = require('./_identity');
    const tar = require('./_tar');

    const live = await store.recoverIfStale(system, jobs.waitForGraph);
    if (live) throw refusal('busy', store.busyMessage(live));

    const notABackup = (why) => refusal('not-a-backup', `This isn't a backup as Tapestry writes one: ${why}.`);
    const dir = store.ensureDir();
    const incoming = fs.mkdtempSync(path.join(dir, '.incoming-'));
    const open = new Set();
    try {
      const got = new Map();
      try {
        await tar.readArchive(context.body, {
          entry: async (meta) => {
            const name = meta.name.replace(/^\.\//, '');
            if (meta.type === '5') {
              if (name.replace(/\/$/, '') === 'identity' || name === '' || name === '.') return null;
              throw notABackup(`it holds the folder '${meta.name}'`);
            }
            if (meta.type !== '0') throw notABackup(`its member '${meta.name}' isn't a regular file`);
            if (!store.MEMBERS.includes(name)) throw notABackup(`it holds '${meta.name}', which a backup doesn't`);
            if (got.has(name)) throw notABackup(`'${name}' appears in it twice`);
            fs.mkdirSync(path.join(incoming, 'identity'), { recursive: true, mode: 0o700 });
            const fd = fs.openSync(path.join(incoming, name), 'wx', 0o600);
            open.add(fd);
            const hash = crypto.createHash('sha256');
            const rec = { size: 0, sha256: null };
            got.set(name, rec);
            const sink = async (chunk) => {
              hash.update(chunk);
              rec.size += chunk.length;
              let off = 0;
              while (off < chunk.length) off += fs.writeSync(fd, chunk, off, chunk.length - off);
            };
            sink.end = async () => { fs.closeSync(fd); open.delete(fd); rec.sha256 = hash.digest('hex'); };
            return sink;
          },
        });
      } catch (err) {
        if (err && err.name === 'TarError') throw notABackup(err.message);
        throw err;
      }

      for (const m of store.MEMBERS) if (!got.has(m)) throw notABackup(`its ${m} is missing`);
      const manifest = store.readJson(path.join(incoming, 'manifest.json'));
      if (!manifest) throw notABackup('its manifest.json is not JSON');
      const problem = store.manifestProblem(manifest);
      if (problem) throw notABackup(problem);
      for (const m of store.PAYLOAD) {
        const want = manifest.files[m];
        const have = got.get(m);
        if (have.size !== want.size || have.sha256 !== want.sha256) throw notABackup(`its ${m} is not the file its manifest recorded`);
      }
      const check = await system.neo4jAdmin(['database', 'load', '--info', '--from-stdin', 'neo4j'], { stdin: fs.createReadStream(path.join(incoming, 'neo4j.dump')) });
      if (check.code !== 0) throw notABackup("its neo4j.dump is not an archive the graph database can load");
      if (!(await identity.checkIdentity(incoming, manifest.instance.assistantPubkey))) throw notABackup("its assistant key doesn't decrypt to the assistant its manifest names");

      const id = manifest.id;
      const target = store.folderOf(id);
      let alreadyHeld = false;
      if (fs.existsSync(target)) {
        const held = store.readManifest(id);
        const same = held && store.PAYLOAD.every((m) => held.files[m] && held.files[m].sha256 === manifest.files[m].sha256);
        if (!same) throw refusal('backup-exists', `This instance holds a different backup under the id ${id}.`);
        alreadyHeld = true;
      } else {
        const by = (context && context.caller && context.caller.pubkey) || 'local';
        store.writeJson(path.join(incoming, 'received.json'), { receivedAt: new Date().toISOString(), by });
        fs.renameSync(incoming, target);
      }
      const summary = store.summaryOf(id, store.readManifest(id), { assistantPubkey: identity.namedAssistant() });
      const { holds, graph, offlineMs, sameInstance } = summary;
      const backup = { id, takenAt: summary.takenAt, note: summary.note, size: summary.size, origin: summary.origin, reason: summary.reason };
      if (summary.receivedAt) backup.receivedAt = summary.receivedAt;
      return { backup, holds, graph, offlineMs, sameInstance, alreadyHeld };
    } finally {
      for (const fd of open) { try { fs.closeSync(fd); } catch { /* already closed */ } }
      fs.rmSync(incoming, { recursive: true, force: true });
    }
  },
};
