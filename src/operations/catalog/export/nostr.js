'use strict';
/**
 * export nostr — publish a scope as letters the instance's assistant signs, and record what was sent (catalog §6;
 * story graph-operations-first-slice #34; ADR graph-operations-first-slice/0034).
 *
 * A write with run, not the write path (Decision 1): it signs, and the write path's context carries nothing that signs
 * or publishes. The call's flow, each part in a file of its own:
 *   1. its inputs: one scope (node, graph or everything), up to ten relays (each through the relay host guard), a
 *      cursor, and the assistant's key (getOwnerAssistantKeys), else a refusal, before anything is read or sent;
 *   2. the scope, in rank order, from the cursor on (_scope.js, Decision 2);
 *   3. each node classed, and each the assistant signs given its letter, built from the node as the graph holds it now
 *      and compared with the letter it has (_letters.js, Decisions 3–5 and 9), until MAX_SCOPE nodes are classed,
 *      MAX_SEND letters would be signed, or SEND_CUTOFF_MS has passed;
 *   4. unless a dry run: the new and changed letters signed and put into the instance's own relay, read back by id, and
 *      sent to each relay named, an unchanged one to each that doesn't hold it yet (_send.js, Decision 6);
 *   5. what was accepted, recorded on its node and in one change entry, and a letter whose read-back didn't answer in
 *      that entry and in its node's sentIds only (_record.js, Decision 8; Amendment 2 item 1, Amendment 3 item 2).
 * BUDGET_MS, SEND_CUTOFF_MS, MAX_SCOPE and MAX_SEND are read through the declaration at each call, so a suite can
 * shrink them. It requires nothing at load that opens anything (ADR graph-operations-foundation/0001 Decision 10).
 */

const { refusal } = require('../../refusal');
const { BAD_REF, UNKNOWN_REF, AMBIGUOUS_REF } = require('../../resolve');
const { CHANGE_ENTRY } = require('../../changes');

const BUDGET_MS = 40000;
const SEND_CUTOFF_MS = 30000;
const MAX_SCOPE = 2000;
const MAX_SEND = 500;
const MAX_RELAYS = 10;
const MAX_RELAY = 2000;
const MAX_REF = 1000;
const CLASS_BATCH = 100;
const OWN = 'own';
const OWN_RELAY = 'ws://127.0.0.1:7777';
const SCOPES = Object.freeze(['node', 'graph', 'everything']);

const NO_SCOPE = Object.freeze({ code: 'no-scope', status: 400, when: 'None of node, graph and everything: nothing to export' });
const TWO_SCOPES = Object.freeze({ code: 'two-scopes', status: 400, when: 'More than one of node, graph and everything' });
const NOT_A_GRAPH = Object.freeze({ code: 'not-a-graph', status: 400, when: "A graph that names a node which isn't a graph element: the class thread of this instance's graph concept doesn't reach it, and its stored JSON holds no graph object" });
const BAD_RELAY = Object.freeze({ code: 'bad-relay', status: 400, when: "A relay that isn't a ws:// or wss:// URL with a host and no user name; the refusal names it" });
const PRIVATE_RELAY = Object.freeze({ code: 'private-relay', status: 403, when: "A relay whose host doesn't resolve to public addresses only (the relay host guard), whoever calls; this instance's own relay is always sent to, and is never named" });
const TOO_MANY_RELAYS = Object.freeze({ code: 'too-many-relays', status: 400, when: `More than ${MAX_RELAYS} relays` });
const BAD_CURSOR = Object.freeze({ code: 'bad-cursor', status: 400, when: "An after that isn't a cursor export nostr gave, for the same scope" });
const NO_ASSISTANT_KEY = Object.freeze({ code: 'no-assistant-key', status: 409, when: "This instance's assistant key can't be read, so nothing can be signed" });

const OUTCOMES = Object.freeze(['new', 'changed', 'unchanged', 'not-own', 'owner-signed', 'other-kind', 'no-address', 'unbuildable']);
const COUNT_OF = Object.freeze({ 'not-own': 'notOwn', 'owner-signed': 'ownerSigned', 'other-kind': 'otherKind', 'no-address': 'noAddress' });
const STATUSES = Object.freeze(['accepted', 'refused', 'timeout', 'unreachable', 'held', 'not-sent', 'unread']);
const REPORTS = Object.freeze(['link-dropped', 'value-left-out', 'pointer-unresolved', 'unsent-reference', 'uncarried-relationship', 'not-found', 'graph-not-followed']);
const SIGNED = Object.freeze(['new', 'changed']);

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const quote = (x) => { const s = JSON.stringify(String(x)); return s.length > 80 ? `${s.slice(0, 77)}…"` : s; };
const T = () => ({ type: 'array', items: { type: 'array', items: { type: 'string' } } });

const RELAY_ANSWER = {
  type: 'object',
  required: ['relay', 'status', 'reason'],
  properties: {
    relay: { type: 'string', description: "own, for this instance's own relay, or a relay named, by its URL" },
    status: { type: 'string', enum: [...STATUSES], description: "accepted (OK true, a duplicate included; for the instance's own relay, read back by id), refused (OK false, or the instance's own relay didn't store it), timeout (no OK in time), unreachable (no connection, it closed, or strfry import couldn't run), held (it has this letter already), not-sent (a dry run, the instance's own relay doesn't hold it, the instance publishes locally only, or the call's time to send ran out) or unread (the instance's own relay couldn't be read back, so nothing is claimed)" },
    reason: { type: 'string', nullable: true, description: "The relay's words, or why it wasn't sent; null when there is nothing to say" },
  },
};
const LETTER = {
  type: 'object',
  required: ['node', 'address', 'name', 'outcome', 'sent', 'id', 'kind', 'created_at', 'relays'],
  properties: {
    node: { type: 'string', description: "The node's tapestryKey" },
    address: { type: 'string', nullable: true, description: 'Its address, kind:pubkey:d-tag, or an event id; null when it has none' },
    name: { type: 'string', nullable: true, description: 'Its name' },
    outcome: { type: 'string', enum: [...OUTCOMES], description: "new (the node has no letter yet), changed (the letter it would sign differs from the one the node has, or that one isn't in the instance's own relay), unchanged (the same, so not signed again), not-own (another author's, an admin's included), owner-signed (the owner's own letter, which the assistant can't sign), other-kind (a kind other than 39998 and 39999), no-address (no address a letter can have) or unbuildable (its json tag points into the store at nothing)" },
    sent: { type: 'boolean', description: 'Whether some relay accepted this letter in this call' },
    id: { type: 'string', nullable: true, description: "The letter's id: the one signed in this call for a new or changed one, or the one the node has; null in a dry run for a letter not yet signed" },
    kind: { type: 'integer', nullable: true, description: 'Its kind' },
    created_at: { type: 'integer', nullable: true, description: "The letter's created_at: one second after the node's last letter at the least, so each version is newer" },
    relays: { type: 'array', items: RELAY_ANSWER, description: "What each relay did with it: the instance's own first, then each named, in order; empty for a node whose letter isn't the assistant's to sign" },
    added: { ...T(), description: 'In a dry run, for a changed letter: the tags it would add' },
    removed: { ...T(), description: 'In a dry run, for a changed letter: the tags it would take out' },
  },
};
const REPORT = {
  type: 'object',
  required: ['report', 'node', 'words'],
  properties: {
    report: { type: 'string', enum: [...REPORTS], description: "link-dropped (a tapestry: link to a node with no letter, kept as its text), value-left-out (a whole tapestry: value with no letter, left out), pointer-unresolved (an lmdb: value the store doesn't hold, left out; for a json tag, the node is unbuildable), unsent-reference (a tag or a graph list naming an own node that has no letter and isn't sent in this call; the letter still names it), uncarried-relationship (a relationship between two nodes sent that no letter carries), not-found (an address or id a graph lists that no node holds) or graph-not-followed (a graph past the fourth level of imports, or past the 50th, sent as it is, its lists not followed)" },
    node: { type: 'string', description: 'The tapestryKey of the node whose letter it is about (for a relationship, the one it runs from)' },
    words: { type: 'string', description: 'What it means, in words' },
    key: { type: 'string', description: 'The tapestryKey the value or link named, or the store key an lmdb: value named' },
    where: { type: 'string', description: "Where in the letter: tag <type>, or json.<path>" },
    address: { type: 'string', description: "The address or id a tag or graph list named; for graph-not-followed, the graph's own address" },
    type: { type: 'string', description: "An uncarried relationship's type" },
    from: { type: 'string', description: 'The tapestryKey of the node it runs from' },
    to: { type: 'string', description: 'The tapestryKey of the node it runs to' },
  },
};

module.exports = {
  group: 'export',
  name: 'nostr',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Publish a scope as letters the assistant signs, and record what was sent',
  description: [
    "Publishes one node (`node`, a ref), a graph (`graph`, a ref to a graph element: a concept graph, a Tapestry, or a selection saved as a graph) or everything of this instance's own (`everything: true`) as nostr letters this instance's assistant signs, to this instance's own relay and to each relay in `relays` (up to ten ws:// or wss:// URLs whose hosts resolve to public addresses only). A graph brings what its graph.nodes lists, the graphs its graph.imports lists (four levels, 50 graphs; a graph past them is sent with its lists unfollowed, and reported graph-not-followed), and for a concept graph that concept's header, core nodes, superset, sets to six levels and their elements, the instance's own only.",
    "Each node's letter is built from the node as the graph holds it now: its tags as its tag nodes hold them, a set's s tags from its parent links, an element's z stamps for its concept's pointer b tags, its stored JSON without graphContext, every lmdb: value resolved, and each tapestry: link and whole tapestry:<key> value rewritten to the target's nostr:naddr1… (or nostr:nevent1… for an event id) when it has a letter or gets one in this call, else dropped to its text or left out, and reported. Only the assistant's own nodes are signed: another author's node, the owner's included, is named by its address and never signed or sent. The graph never changes but for what is recorded of the letters.",
    "Only what is new or changed since it was last sent is signed again, dated one second after the node's last letter at the least; an unchanged letter is sent as it was signed to a relay named that doesn't hold it. Letters go out by kind of node first, concept headers, then supersets, then sets (parents first), then the rest, and within a kind each comes after the call's letters of that kind it names, a cycle by tapestryKey. Each is put into this instance's own relay with strfry import and read back by id, and only one it holds goes to the relays named, each relay's answer given as that relay gave it. The node then holds the letter's id and created_at, sentTo (the relays that hold it) and sentIds (the newest 20 letters export signed for it, any whose read-back didn't answer included), and one change entry records the letters sent, and any whose read-back didn't answer. `dryRun: true` signs, sends and records nothing, and answers what the call would do, reports first. A scope bigger than one call (2,000 nodes classed, 500 letters signed, or 30 s of sending) answers `next.after`, the cursor the next call goes on from.",
  ].join('\n\n'),
  inputs: {
    node: { schema: { type: 'string', maxLength: MAX_REF }, description: "The one node to export: its tapestryKey, or a ref graph resolve reads (an address, an event id, a name or a slug)" },
    graph: { schema: { type: 'string', maxLength: MAX_REF }, description: 'The graph element to export, with what it lists and imports: its tapestryKey, or a ref graph resolve reads' },
    everything: { schema: { type: 'boolean' }, description: "true: every node of this instance's own of kind 39998 or 39999 that has an address" },
    relays: { schema: { type: 'array', items: { type: 'string', maxLength: MAX_RELAY } }, description: `Relays to send to besides this instance's own, which is always sent to: up to ${MAX_RELAYS} ws:// or wss:// URLs, each host public. Left out or empty, the instance's own relay only` },
    dryRun: { schema: { type: 'boolean' }, description: 'true: sign, send and record nothing, and answer what the call would do: each outcome, a changed letter\'s added and removed tags, and the reports' },
    after: { schema: { type: 'string', maxLength: 4000 }, description: 'The cursor a previous call of the same scope answered as next.after, to go on from there' },
  },
  result: {
    description: "The relays sent to, the reports, the letter of each node classed with its outcome and each relay's answer, the counts of each outcome, where the next call goes on, and the change entry (null when no letter was accepted, and none is unread)",
    schema: {
      type: 'object',
      required: ['dryRun', 'relays', 'reports', 'letters', 'counts', 'next', 'change'],
      properties: {
        dryRun: { type: 'boolean', description: 'Whether this was a dry run' },
        relays: { type: 'array', items: { type: 'string' }, description: "own, then each relay named, by its URL" },
        reports: { type: 'array', items: REPORT, description: "What the letters couldn't name or carry, before the letters" },
        letters: { type: 'array', items: LETTER, description: 'One for each node of the scope this call classed, in rank order' },
        counts: {
          type: 'object',
          required: OUTCOMES.map((o) => COUNT_OF[o] || o),
          properties: Object.fromEntries(OUTCOMES.map((o) => [COUNT_OF[o] || o, { type: 'integer', minimum: 0 }])),
          description: 'How many letters had each outcome',
        },
        next: {
          type: 'object',
          nullable: true,
          properties: { after: { type: 'string', description: 'The cursor to pass as after' } },
          description: "Where the next call goes on, when this one stopped short of the scope's end: { after }. Null when it finished",
        },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [NO_SCOPE, TWO_SCOPES, BAD_REF, UNKNOWN_REF, AMBIGUOUS_REF, NOT_A_GRAPH, BAD_RELAY, PRIVATE_RELAY, TOO_MANY_RELAYS, BAD_CURSOR, NO_ASSISTANT_KEY],
  // The call's limits, read through the declaration at each call, so a suite can shrink them (the test plan's seams).
  BUDGET_MS,
  SEND_CUTOFF_MS,
  MAX_SCOPE,
  MAX_SEND,

  async run(inputs, ctx) {
    const D = module.exports;
    const started = Date.now();
    const form = formOf(inputs);
    const relays = await relaysOf(inputs.relays);
    const graph = require('../../graph');
    const read = (cypher, params) => graph.read(cypher, params);
    const key = form === 'everything' ? null : await refOf(read, form, inputs[form]);
    if (form === 'graph' && !(await require('./_scope').isGraphElement(read, key))) {
      throw refusal(NOT_A_GRAPH.code, `The graph ${quote(inputs.graph)} names ${key}, which isn't a graph element: the class thread of this instance's graph concept doesn't reach it, and its JSON holds no graph object. Pass a concept graph, a Tapestry or a selection saved as a graph, or export the node itself with node. Nothing was signed or sent.`, { input: 'graph' });
    }
    const Sc = require('./_scope');
    const scope = Sc.fingerprint(form, key);
    let after = null;
    if (inputs.after !== undefined) {
      after = Sc.decodeCursor(inputs.after, scope);
      if (!after) throw refusal(BAD_CURSOR.code, 'That after is not a cursor export nostr gave for this scope. Pass the next.after a call with the same node, graph or everything answered, or leave after out to start from the first node. Nothing was signed or sent.', { input: 'after' });
    }
    const signer = await signerOf();
    return exportScope({ D, ctx, read, form, key, scope, after, relays, signer, dryRun: inputs.dryRun === true, started });
  },
};

// ── the inputs (Decision 1) ──

/** Which of the three forms of a scope the inputs give: exactly one, else no-scope or two-scopes. */
function formOf(inputs) {
  const given = SCOPES.filter((k) => (k === 'everything' ? inputs.everything === true : inputs[k] !== undefined));
  if (!given.length) {
    throw refusal(NO_SCOPE.code, 'Give export nostr a scope: node (one node, by its tapestryKey or a ref), graph (a graph element, by its tapestryKey or a ref) or everything (true, for every node of this instance\'s own). Nothing was signed or sent.');
  }
  if (given.length > 1) {
    throw refusal(TWO_SCOPES.code, `You gave ${given.join(' and ')}: export nostr takes one scope a call, node, graph or everything. Make a call for each. Nothing was signed or sent.`, { input: given[1] });
  }
  return given[0];
}

/** A relay as it is compared and recorded: new URL()'s, without a trailing slash. */
function normalizeRelay(u) {
  const p = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
  return `${u.protocol}//${u.host.toLowerCase()}${p}${u.search}`;
}

/** The relays named, each checked and then asked of the relay host guard (Decision 1) → [url], each once. */
async function relaysOf(list) {
  const given = Array.isArray(list) ? list : [];
  if (given.length > MAX_RELAYS) {
    throw refusal(TOO_MANY_RELAYS.code, `relays names ${given.length} relays; export nostr sends to ${MAX_RELAYS} at most a call, besides this instance's own. Split them over several calls. Nothing was signed or sent.`, { input: 'relays' });
  }
  const urls = [];
  for (const text of given) {
    let u = null;
    try { u = new URL(text); } catch { u = null; }
    if (!u || (u.protocol !== 'ws:' && u.protocol !== 'wss:') || !u.hostname || u.username || u.password) {
      throw refusal(BAD_RELAY.code, `The relay ${quote(text)} in relays can't be sent to: each relay is a ws:// or wss:// URL with a host and no user name, such as wss://relay.example.com. This instance's own relay is always sent to, and isn't named. Nothing was signed or sent.`, { input: 'relays' });
    }
    urls.push({ text, u });
  }
  // Required here, never at load (ADR graph-operations-foundation/0001 Decision 10).
  const { isPublicRelayHostWithin } = require('../../../utils/relayHostGuard');
  for (const { text, u } of urls) {
    if (!(await isPublicRelayHostWithin(u.hostname))) {
      throw refusal(PRIVATE_RELAY.code, `The relay ${text} in relays is refused: its host, ${u.hostname}, doesn't resolve to public addresses only, and the letters are sent from inside the instance, where a private address could reach what only the server can. This instance's own relay is always sent to, and isn't named. Nothing was signed or sent.`, { input: 'relays' });
    }
  }
  return [...new Set(urls.map(({ u }) => normalizeRelay(u)))];
}

/** The node a ref names (resolve.js's resolveOne, from the owner's point of view), refused unknown-ref when none has a key. */
async function refOf(read, input, ref) {
  const { resolveOne, readingsOf } = require('../../resolve');
  const R = require('../../reads');
  // A tapestryKey is used as given, so the point of view is read only for a ref that needs it.
  const pov = readingsOf(ref, input).family === 'key' ? { name: 'owner', own: R.ownKeys() } : await R.resolvePov(read, 'owner');
  const key = await resolveOne(read, { input, ref, kind: 'node', pov });
  const rows = await read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange AND NOT n:NostrEventTag RETURN n.tapestryKey AS key LIMIT 1', { key });
  if (!rows.length) {
    throw refusal(UNKNOWN_REF.code, `The ${input} ${quote(String(ref).trim())} names no node of this graph: no node has that tapestryKey. Pass a node's tapestryKey, or a name, slug or address that names one node; graph resolve lists what a ref names. Nothing was signed or sent.`, { input });
  }
  return key;
}

/** The assistant's key: { sk, pubkey }, or the refusal no-assistant-key (Decision 1). */
async function signerOf() {
  let keys = null;
  try { keys = await require('../../../utils/assistantKeys').getOwnerAssistantKeys(); } catch { keys = null; }
  if (!keys || typeof keys.privkey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(keys.privkey)) {
    throw refusal(NO_ASSISTANT_KEY.code, "This instance's assistant key can't be read, so export nostr can't sign a letter. The assistant's key is made at the container's first start (setup/create_nostr_identity.sh) and kept in the secure key store. Nothing was signed or sent.");
  }
  const sk = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
  return { sk, pubkey: require('nostr-tools').getPublicKey(sk) };
}

/** The owner's hex pubkey, or null. */
function ownerKey() {
  const k = require('../../../utils/config').getOwnerPubkey();
  const lower = typeof k === 'string' ? k.trim().toLowerCase() : '';
  return /^[0-9a-f]{64}$/.test(lower) ? lower : null;
}

// ── the call (Decisions 2–8) ──

async function exportScope({ D, ctx, read, form, key, scope, after, relays, signer, dryRun, started }) {
  const Sc = require('./_scope');
  const L = require('./_letters');
  const S = require('./_send');
  const cutoffAt = started + D.SEND_CUTOFF_MS;
  const deadline = started + D.BUDGET_MS;
  const own = require('../../reads').ownKeys();
  const owner = ownerKey();
  const assistant = signer.pubkey;
  const relayNames = [OWN, ...relays];

  // 2. The scope, from the cursor on.
  const found = await Sc.scopeOf(read, { form, key, own });
  const entries = (await Sc.entriesOf(read, found.keys)).filter((e) => !after || Sc.isAfter(e, after));

  let conn = null;
  const ownRelay = async () => { if (!conn) conn = await require('../import/_relay').open(OWN_RELAY); return conn; };
  try {
    // 3. Classed, in rank order, until MAX_SCOPE nodes or the time to send.
    const page = [];
    let j = 0;
    while (j < entries.length && page.length < D.MAX_SCOPE) {
      if (j > 0 && Date.now() > cutoffAt) break;
      const batch = entries.slice(j, j + Math.min(CLASS_BATCH, D.MAX_SCOPE - page.length));
      j += batch.length;
      const signable = batch.filter((e) => L.classOf(e, { assistant, owner }) === null);
      const prepared = signable.length ? await L.prepare(read, signable, { assistant, own, conn: signable.some((e) => e.id) ? await ownRelay() : null }) : [];
      const byKey = new Map(prepared.map((it) => [it.key, it]));
      for (const e of batch) page.push({ entry: e, cls: L.classOf(e, { assistant, owner }), item: byKey.get(e.key) || null });
    }
    const targets = await L.targetsOf(read, page.filter((p) => p.item).map((p) => p.item));

    // The letters, for the nodes this call gives letters; MAX_SEND letters signed at most, the page cut before the next.
    let end = page.length;
    let built;
    let sent;
    for (;;) {
      sent = new Set(page.slice(0, end).filter((p) => p.item && !p.item.unbuildable && !p.entry.id).map((p) => p.entry.key));
      built = await buildPage(page.slice(0, end), { targets, sent });
      let signings = 0;
      let cut = -1;
      for (let i = 0; i < built.length; i += 1) {
        if (!SIGNED.includes(built[i].outcome)) continue;
        signings += 1;
        if (signings > D.MAX_SEND) { cut = i; break; }
      }
      if (cut < 0) break;
      end = cut;
    }

    // Decision 9's reports: the letters' own, then what they name, then what they carry, then what the graphs list.
    const lettered = built.filter((b) => b.tags);
    const reports = [
      ...built.flatMap((b) => b.reports || []),
      ...await L.referenceReports(read, lettered.map((b) => ({ key: b.entry.key, entry: b.entry, tags: b.tags })), { own, sent }),
      ...await L.uncarried(read, lettered.map((b) => ({ key: b.entry.key, address: b.entry.uuid, tags: b.tags })), { assistant }),
      ...found.reports,
    ];

    // The order letters go out in (Decision 2).
    const order = Sc.sendOrder(lettered.map((b) => ({ key: b.entry.key, rank: b.entry.rank, depth: b.entry.depth, refs: [b.entry.uuid, b.entry.id], names: Sc.namesOf(b.tags) })));
    const rank = new Map(order.map((o, i) => [o.key, i]));
    const inOrder = [...lettered].sort((a, b) => rank.get(a.entry.key) - rank.get(b.entry.key));

    const answers = new Map(built.map((b) => [b.entry.key, new Map()]));
    let change = null;
    if (dryRun) {
      for (const b of lettered) {
        const a = answers.get(b.entry.key);
        a.set(OWN, b.outcome === 'unchanged' ? { status: 'held', reason: null } : { status: 'not-sent', reason: 'a dry run sends nothing' });
        for (const r of relays) a.set(r, b.outcome === 'unchanged' && b.entry.sentTo.includes(r) ? { status: 'held', reason: null } : { status: 'not-sent', reason: 'a dry run sends nothing' });
      }
    } else {
      // 4. Signed, put into the instance's own relay and read back, then sent to the relays named.
      const { finalizeEvent } = require('nostr-tools');
      for (const b of inOrder) {
        if (!SIGNED.includes(b.outcome)) { b.event = b.existing; continue; }
        const last = b.existing && Number.isSafeInteger(b.existing.created_at) ? b.existing.created_at : b.entry.id && Number.isSafeInteger(b.entry.created_at) ? b.entry.created_at : null;
        const createdAt = Math.max(S.now(), last === null ? 0 : last + 1);
        b.event = finalizeEvent({ kind: b.kind, created_at: createdAt, tags: b.tags, content: '' }, signer.sk);
      }
      const signed = inOrder.filter((b) => SIGNED.includes(b.outcome));
      const ownAnswers = signed.length ? await S.toOwn(signed.map((b) => b.event), await ownRelay(), { deadline }) : new Map();
      const unread = { status: 'unread', reason: "the instance's own relay gave no answer for it, so nothing is claimed" };
      for (const b of inOrder) answers.get(b.entry.key).set(OWN, SIGNED.includes(b.outcome) ? ownAnswers.get(b.event.id) || unread : { status: 'held', reason: null });
      const holds = (b) => ['accepted', 'held'].includes(answers.get(b.entry.key).get(OWN).status);
      const localOnly = require('../../../api/publish-policy').isPublishLocalOnly();
      await Promise.all(relays.map(async (r) => {
        const toSend = [];
        for (const b of inOrder) {
          const a = answers.get(b.entry.key);
          if (localOnly) a.set(r, { status: 'not-sent', reason: 'this instance publishes to its own relay only (BRAINSTORM_PUBLISH_LOCAL_ONLY is true), so nothing goes to an outside relay' });
          else if (!holds(b)) a.set(r, { status: 'not-sent', reason: "the instance's own relay doesn't hold this letter, so it isn't sent anywhere else" });
          else if (b.outcome === 'unchanged' && b.entry.sentTo.includes(r)) a.set(r, { status: 'held', reason: null });
          else toSend.push(b);
        }
        if (!toSend.length) return;
        const got = await S.toRelay(r, toSend.map((b) => b.event), { cutoffAt });
        for (const b of toSend) answers.get(b.entry.key).set(r, got.get(b.event.id));
      }));

      // 5. What was accepted, recorded on its node and in one change entry. An unread letter may be on the instance's
      //    own relay, so it is in the entry too, and on its node only in sentIds (Amendment 2 item 1, Amendment 3
      //    item 2).
      const records = [];
      for (const b of inOrder) {
        const a = answers.get(b.entry.key);
        const accepted = relays.filter((r) => (a.get(r) || {}).status === 'accepted');
        const now = { id: b.event.id, created_at: b.event.created_at };
        const answered = relayNames.map((r) => { const x = a.get(r) || { status: 'not-sent', reason: null }; return { relay: r, status: x.status, reason: x.reason === undefined ? null : x.reason }; });
        if (SIGNED.includes(b.outcome)) {
          const ownStatus = a.get(OWN).status;
          if (ownStatus !== 'accepted' && ownStatus !== 'unread') continue;
          const was = b.entry.id ? { id: b.entry.id, created_at: b.entry.created_at } : null;
          records.push({ key: b.entry.key, address: b.entry.uuid, kind: b.kind, was, now, relays: answered, ...(ownStatus === 'accepted' ? { sentTo: [OWN, ...accepted] } : { unread: true }) });
        } else if (accepted.length) {
          records.push({ key: b.entry.key, address: b.entry.uuid, kind: b.kind, was: now, now, relays: answered, add: [OWN, ...accepted] });
        }
      }
      change = await require('./_record').record({ caller: ctx.caller, letters: records });
    }

    // Where the next call goes on: before the first node whose sends the time cut short, else after the last one
    // classed, when the call stopped short of the scope's end.
    const pageEntries = page.slice(0, end).map((p) => p.entry);
    const cutShort = (k) => [...(answers.get(k) || new Map()).values()].some((x) => x && x.cut === true);
    const firstCut = pageEntries.findIndex((e) => cutShort(e.key));
    let next = null;
    if (firstCut >= 0) next = { after: Sc.encodeCursor(scope, firstCut > 0 ? Sc.positionOf(pageEntries[firstCut - 1]) : after || Sc.START) };
    else if (end < page.length || j < entries.length) next = { after: Sc.encodeCursor(scope, end > 0 ? Sc.positionOf(pageEntries[end - 1]) : after || Sc.START) };

    // The answer: the relays, the reports first, then each letter (Amendment 1, item 5).
    const letters = built.map((b) => {
      const e = b.entry;
      const a = answers.get(e.key);
      const event = b.event || null;
      const signedNow = !dryRun && SIGNED.includes(b.outcome) && event;
      const relaysOut = b.tags ? relayNames.map((r) => { const x = a.get(r) || { status: 'not-sent', reason: null }; return { relay: r, status: x.status, reason: x.reason === undefined ? null : x.reason }; }) : [];
      return {
        node: e.key,
        address: e.uuid,
        name: e.name,
        outcome: b.outcome,
        sent: relaysOut.some((x) => x.status === 'accepted'),
        id: signedNow ? event.id : SIGNED.includes(b.outcome) ? null : e.id,
        kind: b.kind || (Number.isInteger(e.kind) ? e.kind : null),
        created_at: signedNow ? event.created_at : SIGNED.includes(b.outcome) ? null : (Number.isSafeInteger(e.created_at) ? e.created_at : null),
        relays: relaysOut,
        ...(dryRun && b.outcome === 'changed' ? { added: b.added, removed: b.removed } : {}),
      };
    });
    const counts = Object.fromEntries(OUTCOMES.map((o) => [COUNT_OF[o] || o, 0]));
    for (const l of letters) counts[COUNT_OF[l.outcome] || l.outcome] += 1;
    return { dryRun, relays: relayNames, reports, letters, counts, next, change };
  } finally {
    if (conn && !conn.error) conn.close();
  }
}

/**
 * Each page entry's letter, for the call: { entry, outcome, kind, tags, added, removed, existing, reports }, tags null
 * for a node whose letter isn't the assistant's to sign, or that is unbuildable.
 */
async function buildPage(page, { targets, sent }) {
  const L = require('./_letters');
  const out = [];
  for (const p of page) {
    if (p.cls) { out.push({ entry: p.entry, outcome: p.cls, kind: null, tags: null, reports: [] }); continue; }
    const it = p.item;
    if (it.unbuildable) { out.push({ entry: p.entry, outcome: 'unbuildable', kind: it.kind, tags: null, reports: it.reports }); continue; }
    const letter = await L.build(it, { targets, sent });
    const cmp = L.compare(letter.tags, it.kind, it.existing, !!p.entry.id);
    out.push({ entry: p.entry, outcome: cmp.outcome, kind: it.kind, tags: letter.tags, added: cmp.added, removed: cmp.removed, existing: it.existing, reports: letter.reports });
  }
  return out;
}
