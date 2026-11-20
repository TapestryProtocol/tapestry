'use strict';
/**
 * import nostr — record nostr events as nodes, with the claims they make as relationships (catalog §5; story
 * graph-operations-first-slice #32; ADR graph-operations-first-slice/0032).
 *
 * A write with run, not the write path (Decision 10): one call records many events, each in a transaction of its own,
 * with its change entry, so one that fails rolls back alone and no transaction holds locks across the call. No guard
 * runs (D4): every event whose id and signature verify is recorded, whoever signed it, and whether a claim counts is
 * decided at read time, per point of view. Nothing is signed or published, and nothing is sent to any relay.
 *
 * Four ways in, one record of an event (_letters.js): ids and addresses (Decision 2), a graph's address, followed
 * through what its graphs list (Decision 6), or a filter, paged through the relay (Decision 5). The relay is the one
 * named, which the relay host guard must find public, or the instance's own, ws://127.0.0.1:7777, when it's left out.
 * The caps and the time below are Decision 12's.
 */

const { refusal } = require('../../refusal');

const MAX_REFS = 200;
const ID_BATCH = 100;
const D_BATCH = 100;
const PAGE = 500;
const MAX_READ = 1000;
const MAX_DEPTH = 4;
const MAX_GRAPHS = 50;
const BUDGET_MS = 40000;
const MAX_FILTER_TEXT = 10000;
const MAX_RELAY = 2000;
const OWN_RELAY = 'ws://127.0.0.1:7777';
const NARROWER = 'More events may be held in this second than the relay answers one request: a narrower filter (fewer kinds or authors, or a tag) may read the rest';

const NO_SOURCE = Object.freeze({ code: 'no-source', status: 400, when: 'None of ids, addresses, graph and filter: nothing to import' });
const TWO_SOURCES = Object.freeze({ code: 'two-sources', status: 400, when: 'More than one of ids and addresses (which go together), graph and filter' });
const TOO_MANY = Object.freeze({ code: 'too-many', status: 400, when: `More than ${MAX_REFS} ids and addresses together` });
const BAD_ID = Object.freeze({ code: 'bad-id', status: 400, when: "An id that isn't 64 lowercase hex characters, or a note or an nevent that doesn't decode; the refusal names it" });
const BAD_ADDRESS = Object.freeze({ code: 'bad-address', status: 400, when: "An address that isn't kind:pubkey:d-tag, with a kind from 0 to 65535 and a pubkey of 64 lowercase hex characters, or an naddr that doesn't decode; for graph, also an event id. The refusal names it" });
const BAD_FILTER = Object.freeze({ code: 'bad-filter', status: 400, when: "A filter whose JSON text doesn't parse, or with a field other than ids, authors, kinds, #<letter>, since, until, limit and search, or one of the wrong type; the refusal names it" });
const BAD_RELAY = Object.freeze({ code: 'bad-relay', status: 400, when: "A relay that isn't a ws:// or wss:// URL with a host and no user name" });
const PRIVATE_RELAY = Object.freeze({ code: 'private-relay', status: 403, when: "A relay whose host doesn't resolve to public addresses only (the relay host guard), whoever calls; the instance's own relay is read by leaving relay out" });
const UNREACHABLE = Object.freeze({ code: 'relay-unreachable', status: 409, when: "The relay didn't connect, or answered no request to its end, before anything was read; a relay that holds none of what was asked is answered, each not-found" });

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const quote = (x) => JSON.stringify(x);
const L = () => require('./_letters');

const OUTCOMES = Object.freeze(['recorded', 'updated', 'unchanged', 'older', 'own', 'not-found', 'invalid', 'unread', 'failed']);
const COUNT_OF = Object.freeze({ 'not-found': 'notFound' });

const EVENT = {
  type: 'object',
  required: ['ref', 'id', 'address', 'outcome', 'node', 'reason'],
  properties: {
    ref: { type: 'string', nullable: true, description: 'What was asked for, as given: an id, note, nevent, address or naddr, or what a graph listed; null for an event a filter read' },
    id: { type: 'string', nullable: true, description: "The event's id; for a ref that wasn't read or found, the id it names, if it names one" },
    address: { type: 'string', nullable: true, description: "The event's address, kind:pubkey:d-tag, for a replaceable or addressable event; null for any other" },
    outcome: { type: 'string', enum: [...OUTCOMES], description: "recorded (a new node, or a placeholder filled), updated (a newer version, or a node today's importers made brought into the recorder's shape), unchanged, older (a version older than the one recorded), own (the instance's own node is at its address or holds its id, and nothing changed), not-found, invalid, unread (a request to the relay didn't finish) or failed (the graph refused its write twice)" },
    node: { type: 'string', nullable: true, description: "The tapestryKey of its node, or of the node that holds a newer version or is the instance's own; null for one not recorded" },
    reason: { type: 'string', nullable: true, description: 'Why, for invalid and failed' },
  },
};

module.exports = {
  group: 'import',
  name: 'nostr',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Record nostr events as nodes, with the claims they make as relationships',
  description: [
    "Reads nostr events from one relay, `relay` (a ws:// or wss:// URL whose host resolves to public addresses only), or this instance's own relay when it's left out, and records each one whose id and signature verify as one node: `NostrEvent` and `TapestryNode` with a tapestryKey, `ListHeader` for kinds 9998 and 39998, `ListItem` for 9999 and 39999, `Reaction` for 7, with the role labels its JSON's word types give (`Superset`, `Set`, `Property`, `JSONSchema`). A replaceable event (kinds 0, 3 and 10000–19999) is keyed at kind:pubkey:, an addressable one (30000–39999) at kind:pubkey:d-tag, and any other at its id, as NIP-01 keys them; one node holds an address's newest version (the later created_at, on a tie the lower id).",
    "Each event's claims become relationships, whatever order the events arrive in: its author's person node AUTHORS it; a tag node for each tag (`<event id>_<index>`) it HAS_TAG; each `e` and `a` tag REFERENCES what it names, and each `b` tag gives INHERITS_FROM or REFERENCES {source: 'b-tag'}; a `z` tag gives HAS_ELEMENT from the concept's superset; an `n` or `s` tag gives HAS_ELEMENT or IS_A_SUPERSET_OF from a set or parent in the claimant's own graph; and a relationship letter, or a graph's `graph.relationships`, gives the relationship it names between two of its author's nodes, of a type firmware declares outside its nostr category or IMPORT, SUPERCEDES or PROVIDED_THE_TEMPLATE_FOR. A claim whose other end isn't in the graph yet gets a placeholder (a NostrEvent with no created_at), which the event fills when it arrives; a z claim waits for its concept instead.",
    "Claims are recorded, never judged: no rule is checked as it writes, and each point of view decides at read time whether a claim counts. The instance's own nodes stay as the owner made them: a letter at one of their addresses, whoever signed it, answers `own` and changes nothing, and another author's claim reaches them only as a membership (z) or a reference (e, a, b).",
    `Give one source: \`ids\` and \`addresses\` (together, ${MAX_REFS} at most), \`graph\` (a graph element's address: the element, the letters its \`graph.nodes\` list and the graphs its \`graph.imports\` list, ${MAX_DEPTH} levels below it at most and ${MAX_GRAPHS} graphs a call, the rest under \`next.graphs\`), or \`filter\` (a NIP-01 filter, read newest first by until in pages of ${PAGE}, each page's oldest second swept, up to ${MAX_READ} events or the filter's limit; a call stopped by that or by time answers \`next.until\` to go on from). Each event is its own transaction, with its own change entry, so the same call again changes nothing and answers unchanged. Nothing is signed or published, and nothing is sent to any relay.`,
  ].join('\n\n'),
  inputs: {
    ids: {
      schema: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_REFS },
      description: `Event ids to import: 64 lowercase hex characters, a note or an nevent (a relay hint inside one isn't followed), ${MAX_REFS} at most with addresses`,
    },
    addresses: {
      schema: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_REFS },
      description: `Addresses to import, kind:pubkey:d-tag (kind:pubkey: for a replaceable kind) or an naddr, ${MAX_REFS} at most with ids; each address's newest version is recorded`,
    },
    graph: {
      schema: { type: 'string', minLength: 1, maxLength: MAX_RELAY },
      description: "A graph element's address, kind:pubkey:d-tag or an naddr: the element, each letter its graph.nodes lists and each graph its graph.imports lists are imported, and the relationships each graph lists",
    },
    filter: {
      schema: { oneOf: [{ type: 'object' }, { type: 'string', maxLength: MAX_FILTER_TEXT }] },
      description: `A NIP-01 filter, as an object or its JSON text: ids, authors, kinds, #<letter> tags, since, until, limit (the most this call reads, ${MAX_READ} at most) and search, passed to the relay as given`,
    },
    relay: {
      schema: { type: 'string', maxLength: MAX_RELAY },
      description: "The relay to read, one ws:// or wss:// URL; its host must resolve to public addresses only. Left out, this instance's own relay",
    },
  },
  result: {
    description: 'Where it read, how many events had each outcome, each event with its outcome and its node, the graphs a graph import followed, the seconds a filter found too crowded to read whole, where to go on, and how many change entries the call wrote',
    schema: {
      type: 'object',
      required: ['source', 'relay', 'counts', 'events', 'graphs', 'crowded', 'next', 'changes'],
      properties: {
        source: { type: 'string', enum: ['ids', 'graph', 'filter'], description: 'ids (ids and addresses), graph or filter' },
        relay: { type: 'string', description: "own, for this instance's own relay, or the URL read" },
        counts: {
          type: 'object',
          required: OUTCOMES.map((o) => COUNT_OF[o] || o),
          properties: Object.fromEntries(OUTCOMES.map((o) => [COUNT_OF[o] || o, { type: 'integer', minimum: 0 }])),
          description: 'How many events had each outcome',
        },
        events: { type: 'array', items: EVENT, description: 'Each id and address asked for, once; or each letter a graph import read, once; or each event a filter read' },
        graphs: {
          type: 'array',
          nullable: true,
          description: 'For a graph import, each graph it followed or tried to: null otherwise',
          items: {
            type: 'object',
            required: ['graph', 'depth', 'outcome'],
            properties: {
              graph: { type: 'string', description: "The graph's address" },
              depth: { type: 'integer', minimum: 0, description: 'How many levels below the element given' },
              outcome: { type: 'string', enum: ['followed', 'not-found', 'unreadable', 'invalid', 'unread'], description: "followed; not-found; unreadable, when its JSON doesn't parse (its letter is still recorded); invalid; or unread, when the request for it didn't finish (it is named under next.graphs)" },
            },
          },
        },
        crowded: {
          type: 'array',
          nullable: true,
          description: 'For a filter import, each second whose events one request could not read whole, even split by kinds and authors; null otherwise',
          items: {
            type: 'object',
            required: ['second', 'read', 'note'],
            properties: { second: { type: 'integer' }, read: { type: 'integer', description: 'How many of its events were read' }, note: { type: 'string' } },
          },
        },
        next: {
          type: 'object',
          nullable: true,
          description: 'Where a call that stopped at a cap or the time goes on: { until } for a filter, the second before the last one finished; { graphs } for a graph import, each to import in a later call. Null when it read everything',
          properties: { until: { type: 'integer' }, graphs: { type: 'array', items: { type: 'string' } } },
        },
        changes: { type: 'integer', minimum: 0, description: 'How many change entries the call wrote: one for each event that changed the graph' },
      },
    },
  },
  refusals: [NO_SOURCE, TWO_SOURCES, TOO_MANY, BAD_ID, BAD_ADDRESS, BAD_FILTER, BAD_RELAY, PRIVATE_RELAY, UNREACHABLE],

  async run(inputs, ctx) {
    const source = sourceOf(inputs);
    const refs = source === 'ids' ? refsOf(inputs) : null;
    const start = source === 'graph' ? graphOf(inputs.graph) : null;
    const filter = source === 'filter' ? filterOf(inputs.filter) : null;
    const relay = await relayOf(inputs.relay);
    const conn = await require('./_relay').open(relay.url);
    if (conn.error) throw unreachable(relay, conn.error);
    const call = {
      conn, relay, read: false, changes: 0, best: new Map(), deadline: Date.now() + BUDGET_MS,
      own: require('../../reads').ownKeys(), caller: ctx.caller,
    };
    try {
      let out;
      if (source === 'ids') out = { events: await importRefs(call, refs), graphs: null, crowded: null, next: null };
      else if (source === 'graph') out = await importGraph(call, start);
      else out = await importFilter(call, filter);
      return { source, relay: relay.out, counts: countsOf(out.events), events: out.events, graphs: out.graphs, crowded: out.crowded, next: out.next, changes: call.changes };
    } finally {
      conn.close();
    }
  },
};

// ── the inputs (Decision 1) ──

function sourceOf(inputs) {
  const given = ['ids', 'addresses', 'graph', 'filter'].filter((k) => inputs[k] !== undefined);
  if (!given.length) {
    throw refusal(NO_SOURCE.code, 'Give import nostr something to import: ids (event ids, as 64 lowercase hex, a note or an nevent), addresses (kind:pubkey:d-tag, or an naddr), graph (a graph element\'s address) or filter (a NIP-01 filter). Nothing changed.');
  }
  const ways = [...new Set(given.map((k) => (k === 'addresses' ? 'ids' : k)))];
  if (ways.length > 1) {
    const list = `${given.slice(0, -1).join(', ')} and ${given[given.length - 1]}`;
    throw refusal(TWO_SOURCES.code, `You gave ${list}: import nostr reads one source a call, ids and addresses together, or a graph, or a filter. Make a call for each. Nothing changed.`, { input: given[1] });
  }
  return ways[0];
}

function refsOf(inputs) {
  const ids = inputs.ids || [];
  const addresses = inputs.addresses || [];
  if (ids.length + addresses.length > MAX_REFS) {
    throw refusal(TOO_MANY.code, `One call takes at most ${MAX_REFS} ids and addresses together; this one gave ${ids.length} ids and ${addresses.length} addresses. Split them over several calls. Nothing changed.`, { input: ids.length ? 'ids' : 'addresses' });
  }
  const out = [];
  const seen = new Set();
  for (const text of ids) {
    const r = L().parseRef(text, 'id');
    if (!r) throw refusal(BAD_ID.code, `The id ${quote(text)} can't be read: an id is 64 lowercase hex characters, or a note or an nevent (note1…, nevent1…). Nothing changed.`, { input: 'ids' });
    if (!seen.has(r.ref)) { seen.add(r.ref); out.push(r); }
  }
  for (const text of addresses) {
    const r = L().parseRef(text, 'address');
    if (!r) throw refusal(BAD_ADDRESS.code, `The address ${quote(text)} can't be read: an address is kind:pubkey:d-tag, with a kind from 0 to 65535 and a pubkey of 64 lowercase hex characters, or an naddr (naddr1…). Nothing changed.`, { input: 'addresses' });
    if (!seen.has(r.ref)) { seen.add(r.ref); out.push(r); }
  }
  return out;
}

function graphOf(text) {
  const r = L().parseRef(text, 'address');
  if (!r) throw refusal(BAD_ADDRESS.code, `The graph ${quote(text)} can't be read: graph takes a graph element's address, kind:pubkey:d-tag, or its naddr (naddr1…), not an event id. Nothing changed.`, { input: 'graph' });
  return r;
}

function filterOf(raw) {
  const bad = (why) => refusal(BAD_FILTER.code, `${why}. Nothing changed.`, { input: 'filter' });
  let f = raw;
  if (typeof raw === 'string') {
    try { f = JSON.parse(raw); } catch (e) { throw bad(`The filter isn't JSON that parses (${e.message})`); }
  }
  if (!isObject(f)) throw bad('The filter must be a JSON object, such as {"kinds": [1], "authors": ["<64 hex characters>"]}');
  const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  for (const [k, v] of Object.entries(f)) {
    if (k === 'ids' || k === 'authors' || /^#[A-Za-z]$/.test(k)) {
      if (!strings(v)) throw bad(`The filter's ${k} must be a list of strings; got ${quote(v)}`);
    } else if (k === 'kinds') {
      if (!Array.isArray(v) || !v.every((x) => Number.isInteger(x) && x >= 0 && x <= 65535)) throw bad(`The filter's kinds must be a list of whole numbers from 0 to 65535; got ${quote(v)}`);
    } else if (k === 'since' || k === 'until') {
      if (!Number.isSafeInteger(v) || v < 0) throw bad(`The filter's ${k} must be a whole number of seconds, a unix time; got ${quote(v)}`);
    } else if (k === 'limit') {
      if (!Number.isSafeInteger(v) || v < 1) throw bad(`The filter's limit must be a whole number from 1; got ${quote(v)}`);
    } else if (k === 'search') {
      if (typeof v !== 'string') throw bad(`The filter's search must be text; got ${quote(v)}`);
    } else {
      throw bad(`The filter's field ${quote(k)} isn't one import nostr takes: ids, authors, kinds, #<letter> (a tag, by one letter), since, until, limit and search`);
    }
  }
  return f;
}

/** The relay to read: the one named, if its host is public, else the instance's own (Decision 2). */
async function relayOf(text) {
  if (text === undefined) return { url: OWN_RELAY, out: 'own', given: false, label: `This instance's own relay, ${OWN_RELAY},` };
  let u = null;
  try { u = new URL(text); } catch { u = null; }
  if (!u || (u.protocol !== 'ws:' && u.protocol !== 'wss:') || !u.hostname || u.username || u.password) {
    throw refusal(BAD_RELAY.code, `The relay ${quote(text)} can't be read: relay takes one ws:// or wss:// URL with a host and no user name, such as wss://relay.example.com. Leave it out to read this instance's own relay. Nothing changed.`, { input: 'relay' });
  }
  // Required here, never at load (ADR graph-operations-foundation/0001 Decision 10).
  const { isPublicRelayHostWithin } = require('../../../utils/relayHostGuard');
  if (!(await isPublicRelayHostWithin(u.hostname))) {
    throw refusal(PRIVATE_RELAY.code, `The relay ${text} is refused: its host, ${u.hostname}, doesn't resolve to public addresses only, and an outside relay is read from inside the instance, where a private address could reach what only the server can. To read this instance's own relay, leave relay out. Nothing changed.`, { input: 'relay' });
  }
  return { url: text, out: text, given: true, label: `The relay ${text}` };
}

function unreachable(relay, why) {
  return refusal(UNREACHABLE.code, `${relay.label} couldn't be reached: ${why}. Nothing was read, and nothing changed.`, relay.given ? { input: 'relay' } : {});
}

// ── reading and recording ──

/** One request; the first that doesn't finish, with nothing read yet in the call, is relay-unreachable (Decision 2). */
async function ask(call, filter) {
  const answer = await call.conn.request(filter);
  if (answer.ok) { call.read = true; return answer; }
  if (!call.read) throw unreachable(call.relay, answer.error);
  return answer;
}

/** Record one verified event: its own transaction, once more after a uniqueness failure (Decision 7.9). */
async function recordOne(call, event, slugs) {
  const graph = require('../../graph');
  const ctx = { own: call.own, caller: call.caller, slugs };
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await graph.writeTransaction((tx) => L().record(tx, event, ctx));
    } catch (err) {
      // The graph database gone: the call stops and fails, and what it recorded stays.
      if (L().isUnreachable(err)) throw err;
      if (attempt === 1 && err && err.code === L().UNIQUE) continue;
      return { outcome: 'failed', node: null, entry: null, reason: L().words(err) };
    }
  }
}

/** Record an event once a call: a second time it is the first's answer, and an older version than one recorded is older. */
async function recordEvent(call, event, { slugs = null, again = false } = {}) {
  const key = L().keyOf(event).uuid;
  const best = call.best.get(key);
  if (best && !again) {
    if (best.id === event.id) return best.result;
    if (L().newer(best, event)) return { outcome: 'older', node: best.result.node, entry: null };
  }
  const result = await recordOne(call, event, slugs);
  if (result.entry) call.changes += 1;
  // Only a version now in the graph decides a later one's outcome in this call.
  if (['recorded', 'updated', 'unchanged'].includes(result.outcome)) call.best.set(key, { id: event.id, created_at: event.created_at, result });
  return result;
}

const entry = (ref, id, address, outcome, node = null, reason = null) => ({ ref, id, address, outcome, node, reason });
const entryOf = (ref, event, result) => entry(ref, event.id, L().keyOf(event).address, result.outcome, result.node || null, result.reason || null);

/** The address of anything shaped enough to have one, else null. */
function addressOfAny(e) {
  if (!isObject(e) || !Number.isInteger(e.kind) || typeof e.pubkey !== 'string' || !Array.isArray(e.tags) || !e.tags.every(Array.isArray)) return null;
  return L().keyOf(e).address;
}

/** The requests for refs (Decision 2): ids 100 a request; addresses grouped by kind and pubkey, 100 d-tags a request. */
function requestsFor(refs) {
  const out = [];
  const idRefs = refs.filter((r) => r.id);
  const ids = [...new Set(idRefs.map((r) => r.id))];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const chunk = ids.slice(i, i + ID_BATCH);
    out.push({ filter: { ids: chunk }, refs: idRefs.filter((r) => chunk.includes(r.id)) });
  }
  const groups = new Map();
  for (const r of refs.filter((x) => x.address)) {
    const g = `${r.kind}:${r.pubkey}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  for (const list of groups.values()) {
    const { kind, pubkey } = list[0];
    const replaceable = kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
    if (replaceable) { out.push({ filter: { kinds: [kind], authors: [pubkey] }, refs: list }); continue; }
    const ds = [...new Set(list.map((r) => r.d))];
    for (let i = 0; i < ds.length; i += D_BATCH) {
      const chunk = ds.slice(i, i + D_BATCH);
      out.push({ filter: { kinds: [kind], authors: [pubkey], '#d': chunk }, refs: list.filter((r) => chunk.includes(r.d)) });
    }
  }
  return out;
}

/**
 * Read refs: → Map(ref → { status }), status unread (its request didn't finish, or the time was up), none, invalid (with
 * the event and the reason), or found (with the event: an id's, or an address's newest version that verifies). An event
 * no ref asked for is left out (Decision 3).
 */
async function readRefs(call, refs) {
  const out = new Map();
  for (const q of requestsFor(refs)) {
    const answer = Date.now() > call.deadline ? { ok: false } : await ask(call, q.filter);
    for (const r of q.refs) {
      if (!answer.ok) { out.set(r.ref, { status: 'unread' }); continue; }
      const mine = answer.events.filter((e) => (r.id ? isObject(e) && e.id === r.id : addressOfAny(e) === r.address));
      const valid = mine.filter((e) => !L().checkEvent(e));
      if (valid.length) out.set(r.ref, { status: 'found', event: valid.reduce((a, b) => (L().newer(b, a) ? b : a)) });
      else if (mine.length) out.set(r.ref, { status: 'invalid', event: mine[0], reason: L().checkEvent(mine[0]) });
      else out.set(r.ref, { status: 'none' });
    }
  }
  return out;
}

/** What a ref that found nothing to record answers. */
function missEntry(r, got) {
  const ev = got.event;
  if (got.status === 'invalid') return entry(r.ref, isObject(ev) && typeof ev.id === 'string' ? ev.id : r.id || null, r.address || null, 'invalid', null, got.reason);
  return entry(r.ref, r.id || null, r.address || null, got.status === 'unread' ? 'unread' : 'not-found');
}

/**
 * Settle refs read: each address's newest version and each id recorded once, in the order asked, the others older.
 * → [{ r, entry, event }], one for each ref.
 */
async function settle(call, refs, got, slugs) {
  const winners = new Map();
  for (const r of refs) {
    const g = got.get(r.ref);
    if (g.status !== 'found') continue;
    const k = L().keyOf(g.event).uuid;
    const w = winners.get(k);
    if (!w || L().newer(g.event, w)) winners.set(k, g.event);
  }
  const results = new Map();
  const out = [];
  for (const r of refs) {
    const g = got.get(r.ref);
    if (g.status !== 'found') { out.push({ r, entry: missEntry(r, g), event: null }); continue; }
    const w = winners.get(L().keyOf(g.event).uuid);
    if (!results.has(w.id)) results.set(w.id, await recordEvent(call, w, { slugs }));
    const result = w.id === g.event.id ? results.get(w.id) : { outcome: 'older', node: results.get(w.id).node };
    out.push({ r, entry: entryOf(r.ref, g.event, result), event: g.event, winner: w.id === g.event.id });
  }
  return out;
}

/** ids and addresses: one answer for each asked (Decisions 2 and 3). */
async function importRefs(call, refs) {
  const got = await readRefs(call, refs);
  return (await settle(call, refs, got, null)).map((x) => x.entry);
}

/** A graph, followed breadth first (Decision 6). */
async function importGraph(call, start) {
  const graphs = [];
  const events = [];
  const letters = new Map(); // a letter's key → { event, entry }, each read once a call
  const asked = new Set(); // what refs named, read once a call
  const slugs = new Map(); // the slugs of every graph followed so far
  const queue = [{ r: start, depth: 0 }];
  const named = new Set([start.address]);
  const later = [];
  let followed = 0;
  let lettersRead = 0;

  const read = async (refs) => {
    const todo = refs.filter((r) => !asked.has(r.address || r.id));
    for (const r of todo) asked.add(r.address || r.id);
    lettersRead += todo.length;
    if (!todo.length) return;
    for (const x of await settle(call, todo, await readRefs(call, todo), slugs)) {
      if (!x.event) { events.push(x.entry); continue; }
      const k = L().keyOf(x.event).uuid;
      if (letters.has(k)) continue; // each letter answered once a call
      events.push(x.entry);
      if (x.winner) letters.set(k, { event: x.event, entry: x.entry });
    }
  };

  while (queue.length) {
    const { r, depth } = queue.shift();
    if (followed >= MAX_GRAPHS || lettersRead >= MAX_READ || Date.now() > call.deadline) { later.push(r.address); continue; }
    followed += 1;
    const before = letters.get(r.address);
    if (before) {
      // Read earlier in the call as another graph's node: its relationships are made again with every graph followed
      // since, as if read now.
      const again = await recordEvent(call, before.event, { slugs, again: true });
      if (before.entry.outcome === 'unchanged' && again.outcome === 'updated') before.entry.outcome = 'updated';
    } else {
      await read([r]);
    }
    const letter = letters.get(r.address);
    if (!letter) {
      const miss = events.find((x) => x.ref === r.ref && x.node === null);
      const outcome = miss && miss.outcome === 'invalid' ? 'invalid' : miss && miss.outcome === 'unread' ? 'unread' : 'not-found';
      graphs.push({ graph: r.address, depth, outcome });
      if (outcome === 'unread') later.push(r.address);
      continue;
    }
    const json = graphJson(letter.event);
    if (!json) { graphs.push({ graph: r.address, depth, outcome: 'unreadable' }); continue; }
    graphs.push({ graph: r.address, depth, outcome: 'followed' });
    const g = isObject(json.graph) ? json.graph : {};
    const nodes = Array.isArray(g.nodes) ? g.nodes.filter((n) => isObject(n) && typeof n.uuid === 'string') : [];
    for (const n of nodes) if (typeof n.slug === 'string' && n.slug) slugs.set(n.slug, n.uuid);
    // 1. The letters its graph.nodes names, by address, or by id when a node's uuid is one.
    await read(nodes.map((n) => L().parseRef(n.uuid, 'address') || L().parseRef(n.uuid, 'id')).filter(Boolean)
      .filter((x) => !letters.has(x.address || x.id)));
    // 2. Its relationships were made with its letter (Decision 8). 3. Each graph its graph.imports names, a level deeper.
    for (const imp of Array.isArray(g.imports) ? g.imports : []) {
      const a = isObject(imp) ? L().parseRef(imp.uuid, 'address') : null;
      if (!a || named.has(a.address)) continue;
      named.add(a.address);
      if (depth + 1 > MAX_DEPTH) later.push(a.address);
      else queue.push({ r: a, depth: depth + 1 });
    }
  }
  return { events, graphs, crowded: null, next: later.length ? { graphs: later } : null };
}

/** A graph letter's JSON, its json tag's value, or null when it doesn't parse to an object. */
function graphJson(event) {
  const t = event.tags.find((x) => x[0] === 'json');
  if (!t || typeof t[1] !== 'string') return null;
  try { const v = JSON.parse(t[1]); return isObject(v) ? v : null; } catch { return null; }
}

/** A filter, read newest first by until, each page's oldest second swept and judged on evidence (Decision 5). */
async function importFilter(call, filter) {
  const { matchFilter } = require('nostr-tools');
  const cap = Math.min(MAX_READ, Number.isSafeInteger(filter.limit) ? filter.limit : MAX_READ);
  const base = { ...filter };
  delete base.limit;
  const since = Number.isSafeInteger(filter.since) ? filter.since : null;
  let until = Number.isSafeInteger(filter.until) ? filter.until : null;
  const events = [];
  const crowded = [];
  const seen = new Set();
  let stopShortAt = null; // once the relay is seen to stop short: the most it answered then
  let lastPage = null;
  let pending = null; // the page before's oldest second, swept, judged once this page is read
  let lastFinished = null;
  let taken = 0;
  let stop = false;

  const matching = (list) => list.filter((e) => { try { return matchFilter(base, e); } catch { return false; } });
  const fresh = (list) => list.filter((e) => {
    const id = isObject(e) && typeof e.id === 'string' ? e.id : null;
    if (id === null || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const full = (n) => n >= PAGE || (stopShortAt !== null && n >= stopShortAt);
  const stoppedShort = (n) => { stopShortAt = stopShortAt === null ? n : Math.min(stopShortAt, n); };
  const timed = (list) => list.filter((e) => {
    if (Number.isSafeInteger(e.created_at)) return true;
    events.push(entry(null, e.id, null, 'invalid', null, L().checkEvent(e)));
    return false;
  });
  // A second finished: its events recorded, the lower id first. → true when the call stops after it.
  const finish = async (second, list) => {
    for (const e of [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      const why = L().checkEvent(e);
      events.push(why ? entry(null, e.id, addressOfAny(e), 'invalid', null, why) : entryOf(null, e, await recordEvent(call, e)));
    }
    taken += list.length;
    lastFinished = second;
    return taken >= cap || Date.now() > call.deadline;
  };
  const sweep = async (second, extra = {}) => {
    const answer = await ask(call, { ...base, ...extra, since: second, until: second, limit: PAGE });
    if (!answer.ok) return null;
    const got = matching(answer.events);
    return { n: got.length, events: timed(fresh(got)).filter((e) => e.created_at === second) };
  };
  // A full sweep may have missed some: split by kinds, then by authors; a part still full is crowded. → false when a
  // request didn't finish.
  const judge = async (p) => {
    if (!full(p.n)) return true;
    const several = (list) => (Array.isArray(list) && list.length > 1 ? list : null);
    const kinds = several(base.kinds);
    const authors = several(base.authors);
    const part = async (extra) => {
      const s = await sweep(p.second, extra);
      if (!s) return null;
      p.events.push(...s.events);
      return full(s.n);
    };
    const byAuthors = async (extra) => {
      let crowd = false;
      for (const a of authors) {
        const f = await part({ ...extra, authors: [a] });
        if (f === null) return null;
        if (f) crowd = true;
      }
      return crowd;
    };
    let crowd = false;
    if (kinds) {
      for (const k of kinds) {
        const f = await part({ kinds: [k] });
        if (f === null) return false;
        const c = f ? (authors ? await byAuthors({ kinds: [k] }) : true) : false;
        if (c === null) return false;
        if (c) crowd = true;
      }
    } else if (authors) {
      const c = await byAuthors({});
      if (c === null) return false;
      crowd = c;
    } else crowd = true;
    if (crowd) crowded.push({ second: p.second, read: p.events.length, note: NARROWER });
    return true;
  };

  for (;;) {
    let page = null;
    let got = [];
    const sincePassed = since !== null && until !== null && until < since;
    if (!sincePassed) {
      if (Date.now() > call.deadline) stop = true;
      else {
        const answer = await ask(call, { ...base, ...(until !== null ? { until } : {}), limit: PAGE });
        if (answer.ok) { page = matching(answer.events); got = timed(fresh(page)); } else stop = true;
      }
    }
    // Evidence the relay stops short: the page before answered fewer than it asked, and this one found older events.
    if (lastPage && lastPage.n < PAGE && got.length) stoppedShort(lastPage.n);
    if (pending) {
      if (stop) break;
      if (!(await judge(pending))) { stop = true; break; }
      if (await finish(pending.second, pending.events)) { stop = true; break; }
      pending = null;
    }
    if (stop || !got.length) break;
    const seconds = [...new Set(got.map((e) => e.created_at))].sort((a, b) => b - a);
    const T = seconds[seconds.length - 1];
    for (const s of seconds.slice(0, -1)) if (await finish(s, got.filter((e) => e.created_at === s))) { stop = true; break; }
    if (stop) break;
    const sw = await sweep(T);
    if (!sw) { stop = true; break; }
    // Evidence too: the sweep found more in the second the page stopped in.
    if (page.length < PAGE && sw.events.length) stoppedShort(page.length);
    pending = { second: T, events: [...got.filter((e) => e.created_at === T), ...sw.events], n: sw.n };
    lastPage = { n: page.length };
    until = T - 1;
  }
  const at = lastFinished !== null ? lastFinished - 1 : until;
  return { events, graphs: null, crowded, next: stop && at !== null ? { until: at } : null };
}

function countsOf(events) {
  const c = Object.fromEntries(OUTCOMES.map((o) => [COUNT_OF[o] || o, 0]));
  for (const e of events) c[COUNT_OF[e.outcome] || e.outcome] += 1;
  return c;
}
