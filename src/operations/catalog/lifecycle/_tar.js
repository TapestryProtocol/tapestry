'use strict';
/**
 * A backup as one file: a POSIX ustar archive — ADR graph-operations-foundation/0002 Decision 9. A helper of the
 * lifecycle operations, with no dependency.
 *
 *   archiveSize(members)        the archive's exact length, for Content-Length, before anything is read
 *   archiveStream(members)      a readable stream of the archive: each member's header, its bytes, its padding, then
 *                               two zero blocks. members: [{ name, path, size, mtime }]
 *   readArchive(stream, { entry })
 *                               read an archive as it arrives: for each member, entry({ name, type, size, mode })
 *                               returns a sink (async (chunk) => void, with optional end()) for its bytes, or null to
 *                               skip them, or throws to refuse the archive. A header that isn't ustar, a bad checksum,
 *                               a size it can't read or an archive cut short throws TarError.
 *
 * A member's size is held in 11 octal digits, so one member is under 8 GiB (MAX_MEMBER).
 */

const fs = require('fs');
const { Readable } = require('stream');

const BLOCK = 512;
const MAX_MEMBER = 8 * 1024 ** 3 - 1;

class TarError extends Error {
  constructor(message) { super(message); this.name = 'TarError'; }
}

const padTo = (n) => (BLOCK - (n % BLOCK)) % BLOCK;
const octal = (n, width) => `${Math.floor(n).toString(8).padStart(width - 1, '0')}\0`;

function header(name, size, mtime) {
  if (Buffer.byteLength(name) > 100) throw new Error(`a member name over 100 bytes: ${name}`);
  if (size > MAX_MEMBER) throw new Error(`${name} is ${size} bytes, more than one ustar member holds`);
  const h = Buffer.alloc(BLOCK, 0);
  h.write(name, 0, 100, 'utf8');
  h.write(octal(0o600, 8), 100, 8, 'ascii');
  h.write(octal(0, 8), 108, 8, 'ascii');
  h.write(octal(0, 8), 116, 8, 'ascii');
  h.write(octal(size, 12), 124, 12, 'ascii');
  h.write(octal(mtime, 12), 136, 12, 'ascii');
  h.write('        ', 148, 8, 'ascii');
  h.write('0', 156, 1, 'ascii');
  h.write('ustar\0', 257, 6, 'ascii');
  h.write('00', 263, 2, 'ascii');
  h.write('root', 265, 32, 'ascii');
  h.write('root', 297, 32, 'ascii');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return h;
}

function archiveSize(members) {
  return members.reduce((n, m) => n + BLOCK + m.size + padTo(m.size), 0) + 2 * BLOCK;
}

function archiveStream(members) {
  async function* blocks() {
    for (const m of members) {
      yield header(m.name, m.size, m.mtime || 0);
      let sent = 0;
      for await (const chunk of fs.createReadStream(m.path)) {
        sent += chunk.length;
        if (sent > m.size) throw new Error(`${m.name} grew while it was being sent`);
        yield chunk;
      }
      if (sent !== m.size) throw new Error(`${m.name} changed size while it was being sent`);
      const pad = padTo(m.size);
      if (pad) yield Buffer.alloc(pad);
    }
    yield Buffer.alloc(2 * BLOCK);
  }
  return Readable.from(blocks(), { objectMode: false });
}

const field = (h, a, b) => h.toString('ascii', a, b).replace(/\0[\s\S]*$/, '').trim();

function parseHeader(h) {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
  const stored = parseInt(field(h, 148, 156), 8);
  if (!Number.isFinite(stored) || stored !== sum) throw new TarError('a header\'s checksum is wrong');
  const magic = h.toString('ascii', 257, 263);
  const gnu = h.toString('ascii', 257, 265) === 'ustar  \0';
  if (magic !== 'ustar\0' && !gnu) throw new TarError('a header isn\'t a ustar header');
  if (h[124] & 0x80) throw new TarError('a member is too large for a backup archive');
  const sizeText = field(h, 124, 136);
  if (!/^[0-7]+$/.test(sizeText)) throw new TarError('a header\'s size isn\'t a number');
  const size = parseInt(sizeText, 8);
  const base = h.toString('utf8', 0, 100).replace(/\0[\s\S]*$/, '');
  const prefix = gnu ? '' : h.toString('utf8', 345, 500).replace(/\0[\s\S]*$/, '');
  const type = h[156] ? String.fromCharCode(h[156]) : '0';
  return { name: prefix ? `${prefix}/${base}` : base, size, type, mode: parseInt(field(h, 100, 108) || '0', 8) };
}

async function readArchive(stream, { entry }) {
  const it = stream[Symbol.asyncIterator]();
  let pending = Buffer.alloc(0);
  let finished = false;
  const pull = async () => {
    if (finished) return false;
    const r = await it.next();
    if (r.done) { finished = true; return false; }
    const chunk = Buffer.from(r.value);
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    return true;
  };
  const ensure = async (n) => {
    while (pending.length < n) if (!(await pull())) return false;
    return true;
  };
  const move = async (n, sink) => {
    while (n > 0) {
      if (!pending.length && !(await pull())) throw new TarError('the archive ends in the middle of a member');
      const k = Math.min(n, pending.length);
      const part = pending.subarray(0, k);
      pending = pending.subarray(k);
      n -= k;
      if (sink) await sink(part);
    }
  };
  let zeroBlocks = 0;
  let members = 0;
  for (;;) {
    if (!(await ensure(BLOCK))) {
      if (!pending.length) break; // the end, short of the two zero blocks; anything missing is found by its absence
      throw new TarError('the archive ends in the middle of a header');
    }
    const h = pending.subarray(0, BLOCK);
    pending = pending.subarray(BLOCK);
    if (h.every((b) => b === 0)) {
      zeroBlocks++;
      if (zeroBlocks === 2) break;
      continue;
    }
    if (zeroBlocks) throw new TarError('the archive goes on after its end');
    const meta = parseHeader(h);
    const sink = await entry(meta);
    await move(meta.size, sink || null);
    if (sink && typeof sink.end === 'function') await sink.end();
    await move(padTo(meta.size), null);
    members++;
  }
  // Whatever follows the end (GNU tar pads to a whole record) is read and dropped.
  while (await pull()) pending = Buffer.alloc(0);
  return { members };
}

module.exports = { BLOCK, MAX_MEMBER, TarError, archiveSize, archiveStream, readArchive };
