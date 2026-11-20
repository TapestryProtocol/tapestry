'use strict';
/**
 * Fake nostr relays and a fake DNS for import nostr's suites (story graph-operations-first-slice #32; ADR
 * graph-operations-first-slice/0032 Decision 2 and Implementation notes, "The relay seam" and "The relay host guard").
 *
 * install({ root, file }) runs in the child process before the catalog loads (test/helpers/operationsHarness.js, for a
 * scenario's relayFake: { file }; test/helpers/externalCliServer.js, for spec.relayFake):
 *   - dns.promises.Resolver becomes a resolver that answers from the fixture's `dns`, so the relay host guard
 *     (src/utils/relayHostGuard.js), which takes `require('dns').promises.Resolver` when it is given none, asks the
 *     fixture. A name the fixture doesn't list resolves to nothing (ENOTFOUND);
 *   - src/operations/catalog/import/_relay.js's `connect` becomes fakeConnect(file). The module must export an object
 *     whose `connect(url)` it calls through that object at each connection (as src/operations/graph.js's methods are
 *     called), so assigning it replaces every connection the import makes. A module that is missing, or exports no
 *     connect, stops the install with the reason.
 *
 * The fixture file (writeFixture):
 *   relays: { '<url>': {
 *     events     the events it holds, sent as stored (an invalid one too), newest first, a tie by the lower id first
 *     cap        the most events one request answers, whatever its limit (default 500, strfry's)
 *     connect    'ok' (default) | 'refuse' (every attempt throws) | 'fail-once' (the first attempt throws) | 'hang'
 *     noEose     request numbers (1-based, per connection) that send their events and then never EOSE
 *     close      [{ request, afterEvents }]: that request sends that many events, then the relay closes it
 *     extra      events sent at the start of every request, whatever it asked: events not asked for
 *   } }
 *   dns: { '<name>': { v4: [...], v6: [...] } }
 * A relay's url is compared as new URL() gives it, without a trailing slash. A url the fixture doesn't list refuses
 * every connection.
 *
 * The log, <file>.log.jsonl, one JSON line for each: { at: 'connect', url, attempt, ok }, { at: 'req', url, n, filters,
 * overlap } (overlap: another request on the connection hadn't finished), { at: 'eose', url, n, sent },
 * { at: 'closed-by-relay', url, n, sent }, { at: 'unsub', url, n }, { at: 'close', url }, { at: 'publish', url, id },
 * { at: 'dns', name, type }. readLog(file) reads it back.
 *
 * Nothing here opens a socket or asks a real DNS server.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CAP = 500;

function writeFixture(file, { relays = {}, dns = {} } = {}) {
  fs.writeFileSync(file, JSON.stringify({ relays, dns }));
  fs.writeFileSync(`${file}.log.jsonl`, '');
  return file;
}
function readFixture(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function log(file, entry) { fs.appendFileSync(`${file}.log.jsonl`, `${JSON.stringify(entry)}\n`); }
function readLog(file) {
  const f = `${file}.log.jsonl`;
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** A relay url as the fixture keys it. */
function normalize(url) {
  try {
    const u = new URL(String(url));
    const p = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return `${u.protocol}//${u.host.toLowerCase()}${p}${u.search}`;
  } catch { return String(url); }
}

/** NIP-01: does event `e` match filter `f`? (ids, authors, kinds, #<letter>, since, until; search and limit aside.) */
function matches(f, e) {
  if (!e || typeof e !== 'object' || !f || typeof f !== 'object') return false;
  if (Array.isArray(f.ids) && !f.ids.includes(e.id)) return false;
  if (Array.isArray(f.authors) && !f.authors.includes(e.pubkey)) return false;
  if (Array.isArray(f.kinds) && !f.kinds.includes(e.kind)) return false;
  for (const [k, vals] of Object.entries(f)) {
    if (k[0] !== '#' || !Array.isArray(vals)) continue;
    const letter = k.slice(1);
    if (!(Array.isArray(e.tags) && e.tags.some((t) => Array.isArray(t) && t[0] === letter && vals.includes(t[1])))) return false;
  }
  if (typeof f.since === 'number' && !(e.created_at >= f.since)) return false;
  if (typeof f.until === 'number' && !(e.created_at <= f.until)) return false;
  return true;
}
/** NIP-01's order for an initial query: newer first, and on a tie the lower id first. */
const newestFirst = (a, b) => ((b.created_at || 0) - (a.created_at || 0)) || String(a.id).localeCompare(String(b.id));

/** What one request answers: the events matching any of its filters, each filter's limit kept, the relay's cap over all. */
function answer(relay, filters) {
  const held = (relay.events || []).filter((e) => e && typeof e === 'object');
  const out = [];
  const seen = new Set();
  for (const f of filters) {
    const limit = Number.isInteger(f && f.limit) && f.limit >= 0 ? f.limit : Infinity;
    const hits = held.filter((e) => matches(f, e)).sort(newestFirst).slice(0, limit);
    for (const e of hits) { const k = String(e.id); if (!seen.has(k)) { seen.add(k); out.push(e); } }
  }
  out.sort(newestFirst);
  return out.slice(0, Number.isInteger(relay.cap) ? relay.cap : DEFAULT_CAP);
}

const later = (fn) => setImmediate(fn);
const clone = (x) => JSON.parse(JSON.stringify(x));

/** connect(url) over the fixture in `file`, as nostr-tools' Relay.connect resolves one. */
function fakeConnect(file) {
  const attempts = new Map();
  return async function connect(url) {
    const fixture = readFixture(file);
    const key = normalize(url);
    const relays = Object.fromEntries(Object.entries(fixture.relays || {}).map(([k, v]) => [normalize(k), v]));
    const relay = relays[key];
    const attempt = (attempts.get(key) || 0) + 1;
    attempts.set(key, attempt);
    const mode = relay ? relay.connect || 'ok' : 'refuse';
    if (mode === 'hang') { log(file, { at: 'connect', url: key, attempt, ok: false, hang: true }); return new Promise(() => {}); }
    if (mode === 'refuse' || (mode === 'fail-once' && attempt === 1)) {
      log(file, { at: 'connect', url: key, attempt, ok: false });
      throw new Error(`connection refused: ${key} (the fake relay${relay ? '' : ', which the fixture does not list'})`);
    }
    log(file, { at: 'connect', url: key, attempt, ok: true });
    let n = 0;
    let active = 0;
    return {
      url: key,
      subscribe(filters, params = {}) {
        n += 1;
        const me = n;
        const list = Array.isArray(filters) ? filters : [filters];
        log(file, { at: 'req', url: key, n: me, filters: list, overlap: active > 0 });
        active += 1;
        let done = false;
        const finish = () => { if (!done) { done = true; active -= 1; } };
        const sub = {
          close() { if (!done) log(file, { at: 'unsub', url: key, n: me }); finish(); },
        };
        later(() => {
          if (done) return;
          const extra = (relay.extra || []).map(clone);
          const events = [...extra, ...answer(relay, list).map(clone)];
          const closing = (relay.close || []).find((c) => c && c.request === me);
          let sent = 0;
          for (const e of events) {
            if (done) return;
            if (closing && sent >= (closing.afterEvents || 0)) break;
            if (typeof params.onevent === 'function') params.onevent(e);
            sent += 1;
          }
          if (closing) {
            log(file, { at: 'closed-by-relay', url: key, n: me, sent });
            finish();
            if (typeof params.onclose === 'function') params.onclose('error: the relay closed the subscription (the fake relay)');
            return;
          }
          if ((relay.noEose || []).includes(me)) { log(file, { at: 'no-eose', url: key, n: me, sent }); return; }
          log(file, { at: 'eose', url: key, n: me, sent });
          finish();
          if (typeof params.oneose === 'function') params.oneose();
        });
        return sub;
      },
      async publish(event) { log(file, { at: 'publish', url: key, id: event && event.id }); return 'ok'; },
      close() { log(file, { at: 'close', url: key }); },
    };
  };
}

/** A dns.promises.Resolver over the fixture's `dns`. */
function fakeResolver(file) {
  return class FakeResolver {
    constructor() { this.cancelled = false; }
    lookup(name, type) {
      log(file, { at: 'dns', name, type });
      const d = (readFixture(file).dns || {})[String(name).toLowerCase()];
      if (!d) return Promise.reject(Object.assign(new Error(`queryA ENOTFOUND ${name}`), { code: 'ENOTFOUND' }));
      const list = d[type];
      if (!Array.isArray(list) || !list.length) return Promise.reject(Object.assign(new Error(`query ENODATA ${name}`), { code: 'ENODATA' }));
      return Promise.resolve([...list]);
    }
    resolve4(name) { return this.lookup(name, 'v4'); }
    resolve6(name) { return this.lookup(name, 'v6'); }
    cancel() { this.cancelled = true; }
  };
}

/** Put the fakes in, in the child process, before the catalog loads. */
function install({ root, file }) {
  require('dns').promises.Resolver = fakeResolver(file);
  const rel = 'src/operations/catalog/import/_relay.js';
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`${rel} does not exist yet (ADR graph-operations-first-slice/0032, Implementation notes: the reader, with its connect seam)`);
  const seam = require(abs);
  if (!seam || typeof seam.connect !== 'function') throw new Error(`${rel} exports no connect(url), the seam a suite replaces (ADR graph-operations-first-slice/0032 Decision 2)`);
  seam.connect = fakeConnect(file);
}

module.exports = { writeFixture, readFixture, readLog, normalize, matches, newestFirst, answer, fakeConnect, fakeResolver, install, DEFAULT_CAP };
