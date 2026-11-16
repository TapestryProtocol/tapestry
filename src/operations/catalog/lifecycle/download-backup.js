'use strict';
/**
 * lifecycle download-backup — a backup as one file, a tar of its five files (story graph-operations-foundation #2,
 * ADR graph-operations-foundation/0002 Decisions 1, 9 and 10).
 */

const fs = require('fs');
const path = require('path');
const { refusal } = require('../../refusal');
const C = require('./_common');

module.exports = {
  group: 'lifecycle',
  name: 'download-backup',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'Download a backup as one file (a tar), to keep off the box or upload to another instance',
  description: [
    'The backup\'s five files — manifest.json, admins.json, identity/tapestry-assistant.json, identity/master-key and neo4j.dump — as one POSIX tar, which `tar` can list and unpack. Upload it to another instance with `lifecycle upload-backup`.',
    '**The file is a key:** it holds the instance assistant\'s secret key and the master key it is encrypted under, so anyone with it can sign as the instance. Keep it like one.',
    'From a shell inside the instance, `tapestry lifecycle download-backup --backup <id> > backup.tar` writes the same file.',
  ].join('\n\n'),
  inputs: { backup: C.idInput('The id of the backup to download') },
  result: { description: 'The backup, as a tar', file: { contentType: 'application/x-tar' } },
  refusals: [C.UNKNOWN, { code: 'too-large', status: 413, when: 'The backup\'s database file is 8 GiB or more, more than one tar member holds' }],

  async run(inputs) {
    const store = require('./_store');
    const tar = require('./_tar');
    const id = inputs.backup;
    const manifest = store.readManifest(id);
    if (!manifest) throw refusal('unknown-backup', `This instance holds no backup ${id}. It holds: ${store.heldIds()}.`);
    const folder = store.folderOf(id);
    const mtime = Math.floor(Date.parse(manifest.takenAt) / 1000) || 0;
    const members = store.MEMBERS.map((name) => {
      const p = path.join(folder, name);
      if (!fs.existsSync(p)) throw new Error(`backup ${id} has lost its ${name}`);
      return { name, path: p, size: fs.statSync(p).size, mtime };
    });
    const big = members.find((m) => m.size > tar.MAX_MEMBER);
    if (big) throw refusal('too-large', `Backup ${id}'s ${big.name} is ${big.size} bytes, more than one tar member holds (8 GiB); it can't be downloaded as one file yet.`);
    return { file: { name: `tapestry-backup-${id}.tar`, size: tar.archiveSize(members), contentType: 'application/x-tar', open: () => tar.archiveStream(members) } };
  },
};
