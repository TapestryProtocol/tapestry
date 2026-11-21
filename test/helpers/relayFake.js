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
 *     ignoreLimit  true: a request's limit is ignored, so it can answer more than it asked for (review round 1, 5)
 *     delayMs    each request is answered that long after it is sent
 *   } }
 *   dns: { '<name>': { v4: [...], v6: [...] } }
 *   live: { '<url>': { events, cap, ignoreLimit, dropOn, refuseAfterDrop, handshakeDelays } }  (review round 1,
 *     findings 1 and 2) a real relay: install starts a ws server on 127.0.0.1 in the child for each, and a connection to
 *     its url goes through _relay.js's own connect, nostr-tools' AbstractRelay, to that server instead. The url's host
 *     is still asked of the fake DNS, so the relay host guard sees a public name. The server answers each REQ from its
 *     events, then EOSE; dropOn n terminates the connection when the n-th REQ it ever gets arrives, and after a drop
 *     refuseAfterDrop terminates each new connection at once; handshakeDelays [ms…] holds the n-th handshake that long
 *     before completing it, so a connect can time out while its socket is still alive
 *   timing: { CONNECT_MS, REQUEST_MS, BUDGET_MS }  (review round 1, finding 2's seam) set before the catalog loads on
 *     _relay.js's exported object (CONNECT_MS, REQUEST_MS) and on nostr.js's declaration (BUDGET_MS), which the code
 *     reads through those objects at each call, so a suite needn't wait out the real 5 s, 10 s and 40 s
 * A relay's url is compared as new URL() gives it, without a trailing slash. A url the fixture doesn't list refuses
 * every connection.
 *
 * Export nostr's additions (story graph-operations-first-slice #34; ADR graph-operations-first-slice/0034 Decision 6 and
 * Implementation notes, "Seams for the suites"), all additive:
 *   the store, <file>.store.json: what was published to a relay or put into the instance's own relay through the fake
 *     strfry import, by relay url. Every request answers from the fixture's events and the store's alike, newest first,
 *     so a read-back, a later request or a later call sees it. An addressable or replaceable version replaces an older
 *     one at its address there, as strfry keeps only the newest; an older one is kept out. storedAt(file, url) reads it.
 *     writeFixture(file, cfg, { keep: true }) rewrites the fixture and keeps its store and its log, for a later run
 *   a fake relay's connection has `connected` (false once it is closed or dropped), and publish(event), which answers
 *     as nostr-tools' AbstractRelay does: resolves with the relay's reason on OK true, rejects with an Error carrying it
 *     on OK false. Its relay entry may say
 *       publish        'accept' (the default: stored, resolves '') | 'refuse' (rejects with `reason`) | 'duplicate'
 *                      (stored, resolves 'duplicate: …') | 'timeout' (never answers) | 'drop' (the connection closes:
 *                      this publish and every later one rejects, and `connected` is false), as a string or as
 *                      { mode, reason, ids, addresses }: ids or addresses limit the mode to those events, the rest accepted
 *       publishDelayMs each publish answers that long after it is made
 *       silentAfterImport  once the fake strfry import has run, every request on the relay sends its events and never
 *                      ends: the read-back that doesn't answer
 *     The log gains { at: 'publish', url, id, outcome } as each publish is made
 *   strfry: { mode, ids, addresses }: installStrfry({ root, file }) replaces src/operations/catalog/export/_send.js's
 *     strfryImport(lines) (lines: JSONL text, or a list of event objects or of their JSON) with one that logs
 *     { at: 'strfry-import', ids } and puts the events into the store at ws://127.0.0.1:7777, resolving as strfry import
 *     does once it ran: mode 'ok' (the default) stores them all; 'drop' stores all but those ids or addresses pick
 *     (all, when neither is given), as strfry import exits 0 when it refuses one; 'fail' rejects, as when strfry import
 *     can't run; 'hang' (review round 1, finding 7) logs the import, stores nothing and never resolves or rejects,
 *     whatever it is given, as a strfry import that never exits. A missing _send.js, or one with no strfryImport, stops
 *     the install with the reason
 *   exportTiming: { BUDGET_MS, SEND_CUTOFF_MS, MAX_SCOPE, MAX_SEND, OK_MS, IN_FLIGHT, NOW }: set by installStrfry before
 *     the catalog loads, on export nostr's declaration (the first four) and on _send.js's object (OK_MS, IN_FLIGHT, and
 *     now(), answering NOW), which the code reads through those objects at each call
 *   a live relay answers each EVENT with OK true; dropOnEvent n terminates the connection when the n-th EVENT it ever
 *     gets arrives. The log gains { at: 'live-event', url, conn, n, id, t } and { at: 'live-drop-event', url, conn, n, t }
 *
 * The log, <file>.log.jsonl, one JSON line for each: { at: 'connect', url, attempt, ok }, { at: 'req', url, n, filters,
 * overlap } (overlap: another request on the connection hadn't finished), { at: 'eose', url, n, sent },
 * { at: 'closed-by-relay', url, n, sent }, { at: 'unsub', url, n }, { at: 'close', url }, { at: 'publish', url, id },
 * { at: 'dns', name, type }; and for a live server { at: 'live-handshake' | 'live-open' | 'live-socket-ended' (the
 * client's FIN) | 'live-socket-error' (its RST, with code) | 'live-socket-closed' | 'live-handshake-abandoned' |
 * 'live-refused', url, n, t }, n the connection's number, and { at: 'live-req' | 'live-drop',
 * url, conn, req, filters, t }, req the REQ's number over the server's life; t is Date.now(). readLog(file) reads it back.
 *
 * Nothing here asks a real DNS server, and only the live relays open sockets, on loopback.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CAP = 500;
const OWN_RELAY = 'ws://127.0.0.1:7777';

function writeFixture(file, { relays = {}, dns = {}, live = {}, timing = {}, strfry = null, exportTiming = {} } = {}, { keep = false } = {}) {
  fs.writeFileSync(file, JSON.stringify({ relays, dns, live, timing, strfry, exportTiming }));
  if (!keep || !fs.existsSync(`${file}.log.jsonl`)) fs.writeFileSync(`${file}.log.jsonl`, '');
  if (!keep || !fs.existsSync(storeFile(file))) fs.writeFileSync(storeFile(file), '{}');
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
    const limit = !relay.ignoreLimit && Number.isInteger(f && f.limit) && f.limit >= 0 ? f.limit : Infinity;
    const hits = held.filter((e) => matches(f, e)).sort(newestFirst).slice(0, limit);
    for (const e of hits) { const k = String(e.id); if (!seen.has(k)) { seen.add(k); out.push(e); } }
  }
  out.sort(newestFirst);
  return out.slice(0, Number.isInteger(relay.cap) ? relay.cap : DEFAULT_CAP);
}

const later = (fn) => setImmediate(fn);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── the store (export nostr's additions) ──
function storeFile(file) { return `${file}.store.json`; }
function readStore(file) {
  try { const s = JSON.parse(fs.readFileSync(storeFile(file), 'utf8')); return s && typeof s === 'object' ? s : {}; } catch { return {}; }
}
/** NIP-01's address of a replaceable or addressable event, or null for any other. */
function addressOfEvent(e) {
  if (!e || typeof e !== 'object' || !Number.isInteger(e.kind) || typeof e.pubkey !== 'string') return null;
  const k = e.kind;
  if (k === 0 || k === 3 || (k >= 10000 && k < 20000)) return `${k}:${e.pubkey}:`;
  if (k >= 30000 && k < 40000) {
    const d = (Array.isArray(e.tags) ? e.tags : []).find((t) => Array.isArray(t) && t[0] === 'd');
    return `${k}:${e.pubkey}:${d && typeof d[1] === 'string' ? d[1] : ''}`;
  }
  return null;
}
const newerThan = (a, b) => (a.created_at || 0) > (b.created_at || 0) || ((a.created_at || 0) === (b.created_at || 0) && String(a.id) < String(b.id));
/** Put events into the store at `url`: one at an address replaces an older version there; an older one is kept out. */
function storeAdd(file, url, events) {
  const s = readStore(file);
  const key = normalize(url);
  let list = Array.isArray(s[key]) ? s[key] : [];
  for (const e of events || []) {
    if (!e || typeof e !== 'object' || list.some((x) => x.id === e.id)) continue;
    const a = addressOfEvent(e);
    if (a) {
      if (list.some((x) => addressOfEvent(x) === a && !newerThan(e, x))) continue;
      list = list.filter((x) => addressOfEvent(x) !== a);
    }
    list.push(clone(e));
  }
  s[key] = list;
  fs.writeFileSync(storeFile(file), JSON.stringify(s));
}
/** What the store holds at `url`, newest first. */
function storedAt(file, url) {
  const list = readStore(file)[normalize(url)];
  return Array.isArray(list) ? clone(list).sort(newestFirst) : [];
}
/** Whether a publish mode's ids or addresses pick event `e` (all, when it names neither). */
function picks(spec, e) {
  const ids = Array.isArray(spec && spec.ids) ? spec.ids : [];
  const addresses = Array.isArray(spec && spec.addresses) ? spec.addresses : [];
  if (!ids.length && !addresses.length) return true;
  return ids.includes(e && e.id) || addresses.includes(addressOfEvent(e));
}
/** How a relay answers a publish of `e`: { mode, reason }. */
function publishModeOf(relay, e) {
  const p = relay && relay.publish;
  if (!p) return { mode: 'accept', reason: null };
  const spec = typeof p === 'string' ? { mode: p } : p;
  if (!picks(spec, e)) return { mode: 'accept', reason: null };
  return { mode: spec.mode || 'accept', reason: spec.reason || null };
}
/** strfryImport's lines: JSONL text, a list of events or of their JSON, or one event. */
function eventsOfLines(lines) {
  const parse = (x) => { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch { return null; } };
  if (typeof lines === 'string') return lines.split('\n').map((l) => l.trim()).filter(Boolean).map(parse).filter(Boolean);
  if (Array.isArray(lines)) return lines.map(parse).filter(Boolean);
  if (lines && typeof lines === 'object') return [lines];
  return [];
}

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
      connected: true,
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
        const answerLater = relay.delayMs > 0 ? (fn) => setTimeout(fn, relay.delayMs) : later;
        answerLater(() => {
          if (done) return;
          const extra = (relay.extra || []).map(clone);
          // The fixture's events and the store's (export nostr's additions): what was published or imported here.
          const held = { ...relay, events: [...(relay.events || []), ...storedAt(file, key)] };
          const events = [...extra, ...answer(held, list).map(clone)];
          const silent = relay.silentAfterImport && readLog(file).some((x) => x.at === 'strfry-import');
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
          if ((relay.noEose || []).includes(me) || silent) { log(file, { at: 'no-eose', url: key, n: me, sent, silentAfterImport: !!silent }); return; }
          log(file, { at: 'eose', url: key, n: me, sent });
          finish();
          if (typeof params.oneose === 'function') params.oneose();
        });
        return sub;
      },
      // As nostr-tools' AbstractRelay.publish answers (export nostr's additions): its reason on OK true, a rejection
      // carrying it on OK false, nothing at all for a relay that never sends its OK.
      async publish(event) {
        const id = event && event.id;
        if (this.connected === false) {
          log(file, { at: 'publish', url: key, id, outcome: 'closed' });
          throw new Error('relay connection closed (the fake relay)');
        }
        const { mode, reason } = publishModeOf(relay, event);
        log(file, { at: 'publish', url: key, id, outcome: mode });
        if (relay.publishDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, relay.publishDelayMs));
        if (mode === 'timeout') return new Promise(() => {});
        if (mode === 'drop') {
          this.connected = false;
          throw new Error('relay connection closed (the fake relay dropped it)');
        }
        if (mode === 'refuse') throw new Error(reason || 'blocked: the fake relay refuses this event');
        storeAdd(file, key, [event]);
        return mode === 'duplicate' ? 'duplicate: already have this event' : '';
      },
      close() { this.connected = false; log(file, { at: 'close', url: key }); },
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

/** A live relay (review round 1): a ws server on 127.0.0.1 in this process, as the fixture's `live` entry describes. */
function startLive(file, url, spec) {
  const http = require('http');
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ noServer: true });
  let handshakes = 0;
  let reqs = 0;
  let eventsIn = 0;
  let dropped = false;
  const server = http.createServer((req, res) => { res.writeHead(426); res.end(); });
  server.on('upgrade', (req, socket, head) => {
    handshakes += 1;
    const n = handshakes;
    log(file, { at: 'live-handshake', url, n, t: Date.now() });
    // The held socket is read while it waits, so a client that gives up is seen: its FIN as end, its RST as an error,
    // which ends the hold and never takes this process down (IL9; tmp/a10-32/il9-probes/).
    socket.on('data', () => {});
    socket.on('end', () => { log(file, { at: 'live-socket-ended', url, n, t: Date.now() }); socket.destroy(); });
    socket.on('error', (e) => { log(file, { at: 'live-socket-error', url, n, code: (e && e.code) || null, t: Date.now() }); socket.destroy(); });
    socket.on('close', () => log(file, { at: 'live-socket-closed', url, n, t: Date.now() }));
    const delay = (Array.isArray(spec.handshakeDelays) && spec.handshakeDelays[n - 1]) || 0;
    setTimeout(() => {
      if (socket.destroyed) { log(file, { at: 'live-handshake-abandoned', url, n, t: Date.now() }); return; }
      wss.handleUpgrade(req, socket, head, (ws) => {
        log(file, { at: 'live-open', url, n, t: Date.now() });
        if (dropped && spec.refuseAfterDrop) { log(file, { at: 'live-refused', url, n, t: Date.now() }); ws.terminate(); return; }
        ws.on('message', (m) => {
          let msg;
          try { msg = JSON.parse(String(m)); } catch { return; }
          // An EVENT (export nostr's additions): OK true, or the connection dropped as the n-th arrives.
          if (Array.isArray(msg) && msg[0] === 'EVENT' && msg[1] && typeof msg[1] === 'object') {
            eventsIn += 1;
            log(file, { at: 'live-event', url, conn: n, n: eventsIn, id: msg[1].id, t: Date.now() });
            if (spec.dropOnEvent && eventsIn === spec.dropOnEvent) {
              dropped = true;
              log(file, { at: 'live-drop-event', url, conn: n, n: eventsIn, t: Date.now() });
              ws.terminate();
              return;
            }
            ws.send(JSON.stringify(['OK', msg[1].id, true, '']));
            return;
          }
          if (!Array.isArray(msg) || msg[0] !== 'REQ') return;
          reqs += 1;
          const filters = msg.slice(2);
          log(file, { at: 'live-req', url, conn: n, req: reqs, filters, t: Date.now() });
          if (spec.dropOn && reqs === spec.dropOn) {
            dropped = true;
            log(file, { at: 'live-drop', url, conn: n, req: reqs, t: Date.now() });
            ws.terminate();
            return;
          }
          for (const e of answer(spec, filters)) ws.send(JSON.stringify(['EVENT', msg[1], e]));
          ws.send(JSON.stringify(['EOSE', msg[1]]));
        });
      });
    }, delay);
  });
  return { ready: new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))) };
}

/** Put the fakes in, in the child process, before the catalog loads. */
function install({ root, file }) {
  require('dns').promises.Resolver = fakeResolver(file);
  const fixture = readFixture(file);
  const rel = 'src/operations/catalog/import/_relay.js';
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`${rel} does not exist yet (ADR graph-operations-first-slice/0032, Implementation notes: the reader, with its connect seam)`);
  const seam = require(abs);
  if (!seam || typeof seam.connect !== 'function') throw new Error(`${rel} exports no connect(url), the seam a suite replaces (ADR graph-operations-first-slice/0032 Decision 2)`);
  const real = seam.connect;
  const fake = fakeConnect(file);
  const lives = new Map(Object.entries(fixture.live || {}).map(([url, spec]) => [normalize(url), startLive(file, normalize(url), spec)]));
  seam.connect = async function connect(url) {
    const l = lives.get(normalize(url));
    if (!l) return fake(url);
    const port = await l.ready;
    log(file, { at: 'connect', url: normalize(url), live: true, t: Date.now() });
    return real.call(seam, `ws://127.0.0.1:${port}`);
  };
  // Review round 1's seams: the code reads these through the objects at each call.
  const timing = fixture.timing || {};
  for (const k of ['CONNECT_MS', 'REQUEST_MS']) if (Number.isFinite(timing[k])) seam[k] = timing[k];
  if (Number.isFinite(timing.BUDGET_MS)) require(path.join(root, 'src/operations/catalog/import/nostr.js')).BUDGET_MS = timing.BUDGET_MS;
}

/**
 * Export nostr's sender seam (story graph-operations-first-slice #34; ADR 0034 Decision 6, Implementation notes): put
 * the fake strfry import in, and the fixture's exportTiming, in the child, before the catalog loads.
 */
function installStrfry({ root, file }) {
  const rel = 'src/operations/catalog/export/_send.js';
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`${rel} does not exist yet (ADR graph-operations-first-slice/0034 Decision 6 and Implementation notes: the sender, with its strfryImport seam)`);
  const seam = require(abs);
  if (!seam || typeof seam.strfryImport !== 'function') throw new Error(`${rel} exports no strfryImport(lines), the seam a suite replaces (ADR graph-operations-first-slice/0034, Implementation notes, "Seams for the suites")`);
  seam.strfryImport = async function strfryImport(lines) {
    const events = eventsOfLines(lines);
    log(file, { at: 'strfry-import', ids: events.map((e) => (e && e.id) || null) });
    const cfg = readFixture(file).strfry || {};
    if (cfg.mode === 'fail') throw new Error('strfry import could not run (the fake strfry: mode fail)');
    // A strfry import that never exits (story 34's review round 1, finding 7): nothing stored, and no answer, ever.
    if (cfg.mode === 'hang') return new Promise(() => {});
    storeAdd(file, OWN_RELAY, cfg.mode === 'drop' ? events.filter((e) => !picks(cfg, e)) : events);
    return { code: 0, stdout: '', stderr: '' };
  };
  const t = readFixture(file).exportTiming || {};
  for (const k of ['OK_MS', 'IN_FLIGHT']) if (Number.isFinite(t[k])) seam[k] = t[k];
  if (Number.isFinite(t.NOW)) seam.now = () => t.NOW;
  const onDecl = ['BUDGET_MS', 'SEND_CUTOFF_MS', 'MAX_SCOPE', 'MAX_SEND'].filter((k) => Number.isFinite(t[k]));
  if (onDecl.length) {
    const declFile = path.join(root, 'src/operations/catalog/export/nostr.js');
    if (!fs.existsSync(declFile)) throw new Error('src/operations/catalog/export/nostr.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 1)');
    const decl = require(declFile);
    for (const k of onDecl) decl[k] = t[k];
  }
}

module.exports = {
  writeFixture, readFixture, readLog, normalize, matches, newestFirst, answer, fakeConnect, fakeResolver, install, DEFAULT_CAP,
  OWN_RELAY, storeFile, readStore, storeAdd, storedAt, addressOfEvent, picks, eventsOfLines, installStrfry,
};
