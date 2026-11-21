'use strict';
/**
 * export nostr's letters (story graph-operations-first-slice #34, AC2–AC5; ADR graph-operations-first-slice/0034
 * Decisions 3, 4, 5 and 9, Option A: the node's own tags, corrected where the graph says otherwise; Amendment 1, items
 * 1 and 4).
 *
 *   classOf(entry, { assistant, owner })  whose letter it is, in Amendment 1's order: no-address, then owner-signed or
 *                                         not-own by its author (or, when it records none, the key its address
 *                                         carries), then other-kind; null for a node the assistant signs
 *   prepare(read, entries, ctx)           each signable node read for its letter, the parts that don't depend on what
 *                                         the call sends: its tags as its tag nodes hold them ([type, value, value1,
 *                                         value2]), less its s tags, with an s for each parent of the assistant's and
 *                                         an element's stamps; every lmdb: value resolved; its stored JSON, less
 *                                         graphContext; and the letter it has, read by id from the instance's own relay
 *   targetsOf(read, prepared)             the nodes the tapestry: values and links of those letters name
 *   build(item, ctx)                      the letter for a node, for the call: each tapestry: link and whole value
 *                                         rewritten to nostr:naddr1… or nostr:nevent1…, or dropped and reported; its
 *                                         tags in the order of the letter it has, or d first, json last and the rest by
 *                                         type, then values (Decision 4.8)
 *   compare(tags, kind, existing)         new, changed or unchanged (Decision 5): kind, content and tags as a multiset,
 *                                         each on its first four elements, a json tag by its parsed value
 *   referenceReports(read, items, ctx)    unsent-reference: a tag or a graph list naming an own node with no letter
 *                                         that the call doesn't send
 *   uncarried(read, items, ctx)           uncarried-relationship: a relationship between two nodes the call sends that
 *                                         no letter of the call carries (any type but the nostr category's)
 *
 * It opens nothing when it loads, and never writes, signs or sends: nostr.js signs what build gives it.
 */

const HEX64 = /^[0-9a-f]{64}$/;
const ADDRESS = /^(0|[1-9][0-9]{0,4}):([0-9a-f]{64}):([\s\S]*)$/;
/** A whole value naming a node: tapestry: and a tapestryKey as the graph mints one (graph/_enumerations.js's REF). */
const REF = /^tapestry:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
/** Every tapestryKey a string's tapestry: values could name: a fetch of the nodes, never how a link is found. */
const MENTION = /tapestry:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
const TAPESTRY = 'tapestry:';
const LMDB = 'lmdb:';
/** The tags whose value can name another node, for unsent-reference (Decision 9). */
const REFERRING = Object.freeze(['z', 'n', 's', 'a', 'e', 'o', 'b', 'concept-graph', 'nodeFrom', 'nodeTo']);
const BATCH = 500;
const READ_BATCH = 100;
const LEFT_OUT = Symbol('left out');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

/** An address read: { kind, pubkey, d }, or null. */
function addressParts(text) {
  const m = typeof text === 'string' ? text.match(ADDRESS) : null;
  if (!m) return null;
  const kind = Number(m[1]);
  return kind > 65535 ? null : { kind, pubkey: m[2], d: m[3] };
}
const isAddressable = (k) => k === 0 || k === 3 || (k >= 10000 && k < 20000) || (k >= 30000 && k < 40000);

// ── whose letter it is (Decision 3, Amendment 1 item 4) ──
function classOf(e, { assistant, owner }) {
  if (!e.uuid) return 'no-address';
  const a = addressParts(e.uuid);
  const key = e.author || (a ? a.pubkey : null);
  if (owner && key === owner && key !== assistant) return 'owner-signed';
  if (key !== assistant) return 'not-own';
  const kind = Number.isInteger(e.kind) ? e.kind : a ? a.kind : null;
  if (kind !== 39998 && kind !== 39999) return 'other-kind';
  // A letter of these kinds lands at kind:pubkey:d-tag: a node at anything else can't be given one.
  if (!a || a.kind !== kind) return 'no-address';
  if (a.pubkey !== assistant) return 'not-own';
  return null;
}

// ── reading a node for its letter ──
const TAGS = `UNWIND $keys AS k
  MATCH (n:TapestryNode {tapestryKey: k})-[:HAS_TAG]->(t:NostrEventTag)
  RETURN DISTINCT k AS key, t.uuid AS uuid, t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2`;
const PARENTS = (PROP) => `UNWIND $keys AS k
  MATCH (p:TapestryNode)-[:${PROP}]->(n:TapestryNode {tapestryKey: k})
  WHERE NOT p:NostrEventTag AND NOT p:GraphChange
  RETURN DISTINCT k AS key, p.uuid AS uuid, p.pubkey AS pubkey`;
const CORE_NODES = (types) => `UNWIND $keys AS k
  MATCH (n:TapestryNode {tapestryKey: k})-[:${types}]->(:TapestryNode)
  RETURN DISTINCT k AS key`;
const HEADER_POINTERS = `UNWIND $uuids AS u
  MATCH (h:TapestryNode {uuid: u})
  WHERE h:ConceptHeader OR h:ListHeader
  OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag {type: 'b'})
  RETURN u AS header, h.pubkey AS pubkey, labels(h) AS labels, h.created_at AS created_at, t.value AS value, t.value1 AS type`;

/** A tag node as a letter's tag: [type, value, value1, value2], none missing in between, as regenerateJson reads them. */
function tagOfRow(r) {
  const out = [r.type, r.value, r.value1, r.value2];
  while (out.length > 1 && (out[out.length - 1] === null || out[out.length - 1] === undefined)) out.pop();
  return out.map((x) => (x === null || x === undefined ? '' : String(x)));
}

/** What the store holds for an lmdb: value, or undefined when it holds nothing there. */
function resolvePointer(value) {
  const { resolveValue } = require('../../../lib/tapestry-resolve');
  const v = resolveValue(value);
  return v === null || v === undefined ? undefined : v;
}

/** Every lmdb: whole value inside a JSON value resolved (Decision 4.6.1); one the store lacks is left out and reported. */
function resolveDeep(value, path, report) {
  if (typeof value === 'string') {
    if (!value.startsWith(LMDB)) return value;
    const got = resolvePointer(value);
    if (got === undefined) { report(path, value.slice(LMDB.length)); return LEFT_OUT; }
    return typeof got === 'string' ? got : resolveDeep(got, path, report);
  }
  if (Array.isArray(value)) return value.map((x, i) => resolveDeep(x, [...path, String(i)], report)).filter((x) => x !== LEFT_OUT);
  if (isObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) { const r = resolveDeep(v, [...path, k], report); if (r !== LEFT_OUT) out[k] = r; }
    return out;
  }
  return value;
}

/**
 * Each signable entry read for its letter → [{ entry, key, kind, address, d, tags: [{ tag, where }], json, existing,
 * unbuildable, reports }]. ctx: { assistant, own, conn (the instance's own relay, import's reader) }.
 */
async function prepare(read, entries, { assistant, own, conn }) {
  const Sc = require('./_scope');
  const R = Sc.rel();
  const keys = entries.map((e) => e.key);
  const tagRows = new Map(keys.map((k) => [k, []]));
  const parents = new Map(keys.map((k) => [k, []]));
  const core = new Set();
  for (const part of chunks(keys, BATCH)) {
    for (const r of await read(TAGS, { keys: part })) if (tagRows.has(r.key)) tagRows.get(r.key).push(r);
    for (const r of await read(PARENTS(R.PROP), { keys: part })) if (parents.has(r.key)) parents.get(r.key).push(r);
    for (const r of await read(CORE_NODES([R.SCHEMA, R.PRIMARY, R.PROPERTIES, R.TREE, R.CORE, R.GRAPH].join('|')), { keys: part })) core.add(r.key);
  }
  const items = entries.map((entry) => {
    const a = addressParts(entry.uuid);
    const rows = tagRows.get(entry.key) || [];
    const reports = [];
    const unresolved = (where, key) => reports.push({
      report: 'pointer-unresolved', node: entry.key, where, key,
      words: `${label(entry)} holds lmdb:${key} in its ${where}, and the store holds nothing there, so the letter leaves that value out.`,
    });
    // 4.1: its tags, but s (4.2) and d, which comes from its address, and json (4.5), each made below.
    const tags = [];
    const jsonRaw = [];
    for (const r of rows) {
      const tag = tagOfRow(r);
      if (tag[0] === 's' || tag[0] === 'd') continue;
      if (tag[0] === 'json') { jsonRaw.push(tag[1]); continue; }
      tags.push({ tag, where: `tag ${tag[0]}` });
    }
    // 4.2: an s for each parent of the assistant's, by its address.
    for (const p of parents.get(entry.key) || []) {
      const pa = addressParts(p.uuid);
      const author = typeof p.pubkey === 'string' && p.pubkey ? p.pubkey : (pa ? pa.pubkey : null);
      if (pa && author === assistant && !tags.some((t) => t.tag[0] === 's' && t.tag[1] === p.uuid)) tags.push({ tag: ['s', p.uuid], where: 'tag s' });
    }
    // 4.6.1: an lmdb: whole value resolved, or the tag left out.
    const kept = [];
    for (const t of tags) {
      let gone = false;
      const tag = t.tag.map((v, i) => {
        if (i === 0 || gone || typeof v !== 'string' || !v.startsWith(LMDB)) return v;
        const got = resolvePointer(v);
        if (got === undefined) { unresolved(t.where, v.slice(LMDB.length)); gone = true; return v; }
        return typeof got === 'string' ? got : JSON.stringify(got);
      });
      if (!gone) kept.push({ tag, where: t.where });
    }
    // 4.5: the stored JSON, read through the store for an lmdb: pointer, less graphContext.
    let unbuildable = null;
    const json = [];
    for (const raw of jsonRaw) {
      let value = raw;
      if (typeof raw === 'string' && raw.startsWith(LMDB)) {
        const got = resolvePointer(raw);
        if (got === undefined) {
          unbuildable = { report: 'pointer-unresolved', node: entry.key, where: 'json', key: raw.slice(LMDB.length), words: `${label(entry)} has a json tag that is lmdb:${raw.slice(LMDB.length)}, and the store holds nothing there, so its letter can't be built: it is unbuildable, and nothing was signed or sent for it.` };
          break;
        }
        value = got;
      }
      let parsed = value;
      if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch { parsed = value; } }
      if (isObject(parsed)) {
        const { graphContext, ...rest } = parsed;
        void graphContext;
        parsed = resolveDeep(rest, [], (path, key) => unresolved(`json.${path.join('.')}`, key));
      } else if (typeof parsed !== 'string') {
        parsed = typeof value === 'string' ? value : JSON.stringify(value);
      }
      json.push(parsed);
    }
    return {
      entry, key: entry.key, kind: a.kind, address: entry.uuid, d: a.d, tags: kept, json: unbuildable ? [] : json,
      element: entry.labels.includes('ListItem') && !['Superset', 'Set', 'Property', 'JSONSchema'].some((l) => entry.labels.includes(l)) && !core.has(entry.key),
      existing: null, unbuildable, reports: unbuildable ? [unbuildable] : reports,
    };
  });

  // 4.4: an element's stamps, from the pointer b tags of each own concept header its z tags name.
  const elements = items.filter((it) => it.element && !it.unbuildable);
  const headers = [...new Set(elements.flatMap((it) => it.tags.filter((t) => t.tag[0] === 'z').map((t) => t.tag[1])))].filter((u) => addressParts(u));
  if (headers.length) {
    const { selectPointerTargets } = require('../../../lib/bValueForms');
    const rows = new Map();
    const owned = new Set();
    for (const part of chunks(headers, BATCH)) {
      for (const r of await read(HEADER_POINTERS, { uuids: part })) {
        const f = { author: typeof r.pubkey === 'string' && r.pubkey ? r.pubkey : null, labels: Array.isArray(r.labels) ? r.labels : [], created_at: r.created_at === undefined ? null : r.created_at };
        const placeholder = f.labels.includes('NostrEvent') && (f.created_at === null);
        if (!placeholder && (f.author === null || own.includes(f.author))) owned.add(r.header);
        if (!rows.has(r.header)) rows.set(r.header, []);
        if (typeof r.value === 'string') rows.get(r.header).push({ value: r.value, type: typeof r.type === 'string' && r.type ? r.type : null });
      }
    }
    for (const it of elements) {
      const zs = it.tags.filter((t) => t.tag[0] === 'z').map((t) => t.tag[1]);
      for (const h of zs) {
        if (!owned.has(h)) continue;
        for (const target of selectPointerTargets(rows.get(h) || [], h)) {
          if (!it.tags.some((t) => t.tag[0] === 'z' && t.tag[1] === target)) it.tags.push({ tag: ['z', target], where: 'tag z' });
        }
      }
    }
  }

  // Decision 5: the letter each node has, read by id from the instance's own relay.
  const withId = items.filter((it) => it.entry.id);
  for (const part of chunks(withId, READ_BATCH)) {
    const got = conn && !conn.error ? await conn.request({ ids: part.map((it) => it.entry.id) }) : { ok: false };
    if (!got.ok) continue;
    for (const it of part) {
      const e = got.events.find((x) => isObject(x) && x.id === it.entry.id && x.pubkey === assistant && Array.isArray(x.tags));
      if (e) it.existing = e;
    }
  }
  return items;
}

/** The tapestryKeys the prepared letters' strings could name, for targetsOf. */
function mentioned(items) {
  const keys = new Set();
  const walk = (v) => {
    if (typeof v === 'string') { if (v.includes(TAPESTRY)) for (const m of v.matchAll(MENTION)) keys.add(m[1]); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (isObject(v)) for (const x of Object.values(v)) walk(x);
  };
  for (const it of items) { for (const t of it.tags) walk(t.tag.slice(1)); walk(it.json); }
  return [...keys];
}

/** The nodes the letters' tapestry: values and links name: Map(key → facts, as _scope.js's factsOf gives them). */
async function targetsOf(read, items) {
  const keys = mentioned(items);
  return keys.length ? require('./_scope').factsOf(read, keys) : new Map();
}

/**
 * What a tapestry:<key> becomes in a letter of this call (Decision 7): { to } (its naddr, or its nevent when its
 * address is an event's id), or { drop: true, name, why }.
 */
function decide(key, { targets, sent }) {
  const { nip19 } = require('nostr-tools');
  const t = targets.get(key);
  if (!t) return { drop: true, why: 'no node of this graph has that key' };
  const name = t.name || undefined;
  if (t.person || t.tag || t.change || t.placeholder) return { drop: true, name, why: 'it names no node that has a letter' };
  const hasLetter = !!t.id && !t.placeholder;
  const a = addressParts(t.uuid);
  if (a && isAddressable(a.kind)) {
    if (hasLetter || sent.has(key)) return { to: `nostr:${nip19.naddrEncode({ kind: a.kind, pubkey: a.pubkey, identifier: a.d })}` };
    return { drop: true, name, why: 'its node has no letter yet, and this call sends it none' };
  }
  if (t.uuid && HEX64.test(t.uuid) && hasLetter) return { to: `nostr:${nip19.neventEncode({ id: t.uuid })}` };
  return { drop: true, name, why: 'its node has no nostr address' };
}

/** One string of a letter, rewritten for the call (Decision 4.6, steps 2 and 3): its new value, or LEFT_OUT. */
async function rewriteString(value, where, item, ctx, reports) {
  if (typeof value !== 'string' || !value.includes(TAPESTRY)) return value;
  const whole = value.match(REF);
  if (whole) {
    const d = decide(whole[1], ctx);
    if (d.to) return d.to;
    reports.push({
      report: 'value-left-out', node: item.key, where, key: whole[1],
      words: `${label(item.entry)} holds tapestry:${whole[1]} as the whole of its ${where}, and ${d.why}, so the letter leaves that value out. The node keeps it: a later export, once that node has a letter, sends it as its naddr.`,
    });
    return LEFT_OUT;
  }
  const { rewriteLinks } = require('../../../lib/markdownLinks');
  const answers = new Map();
  const out = await rewriteLinks(value, (destination) => {
    const m = destination.match(REF);
    const d = m ? decide(m[1], ctx) : { drop: true, why: "it isn't tapestry: and a tapestryKey" };
    answers.set(destination, d);
    return d.to ? { to: d.to } : { drop: true, ...(d.name ? { name: d.name } : {}) };
  });
  for (const l of out.links) {
    if (l.action !== 'dropped' || l.form === 'reference') continue;
    const key = l.destination.slice(TAPESTRY.length);
    const why = (answers.get(l.destination) || {}).why || 'it names no node with a letter';
    reports.push({
      report: 'link-dropped', node: item.key, where, key,
      words: `${label(item.entry)} links to tapestry:${key} in its ${where}, and ${why}, so the letter keeps the link's text and drops the link. The node keeps the link.`,
    });
  }
  return out.text;
}

async function rewriteDeep(value, path, item, ctx, reports) {
  if (typeof value === 'string') return rewriteString(value, `json.${path.join('.')}`, item, ctx, reports);
  if (Array.isArray(value)) {
    const out = [];
    for (let i = 0; i < value.length; i += 1) { const r = await rewriteDeep(value[i], [...path, String(i)], item, ctx, reports); if (r !== LEFT_OUT) out.push(r); }
    return out;
  }
  if (isObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) { const r = await rewriteDeep(v, [...path, k], item, ctx, reports); if (r !== LEFT_OUT) out[k] = r; }
    return out;
  }
  return value;
}

// ── a tag's identity, and the order of a letter's tags ──
function canonical(x) {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (isObject(x)) return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
/** A tag as Decision 5 compares it: its first four elements; a json tag by its parsed value. */
function tagKey(t) {
  if (t[0] === 'json') {
    try { return `json\u0000${canonical(JSON.parse(t[1]))}`; } catch { return `json\u0000${String(t[1])}`; }
  }
  return JSON.stringify(t.slice(0, 4).map((x) => (x === undefined || x === null ? '' : String(x))));
}
const cmpTag = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] === undefined ? '' : a[i];
    const y = b[i] === undefined ? '' : b[i];
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
};
/** d first, json last, the rest by type, then values (Decision 4.8). */
function defaultOrder(tags) {
  const ds = tags.filter((t) => t[0] === 'd');
  const js = tags.filter((t) => t[0] === 'json');
  const rest = tags.filter((t) => t[0] !== 'd' && t[0] !== 'json').sort(cmpTag);
  return [...ds, ...rest, ...js];
}

/** The letter for one prepared node, for this call: { tags, reports } (the item's own reports first). */
async function build(item, ctx) {
  const reports = [...item.reports];
  const tags = [['d', item.d]];
  for (const t of item.tags) {
    let gone = false;
    const tag = [t.tag[0]];
    for (let i = 1; i < t.tag.length; i += 1) {
      const v = gone ? t.tag[i] : await rewriteString(t.tag[i], t.where, item, ctx, reports);
      if (v === LEFT_OUT) { gone = true; tag.push(t.tag[i]); } else tag.push(v);
    }
    if (!gone) tags.push(tag);
  }
  for (const j of item.json) {
    const v = typeof j === 'string' ? await rewriteString(j, 'json', item, ctx, reports) : await rewriteDeep(j, [], item, ctx, reports);
    if (v === LEFT_OUT) continue;
    tags.push(['json', typeof v === 'string' ? v : JSON.stringify(v)]);
  }
  return { tags: orderTags(tags, item.existing), reports };
}

/** The tags in the order of the letter the node has, each that matches it taken from it whole; the rest after. */
function orderTags(tags, existing) {
  if (!existing) return defaultOrder(tags);
  const pool = [...tags];
  const out = [];
  for (const lt of existing.tags) {
    if (!Array.isArray(lt)) continue;
    const i = pool.findIndex((b) => tagKey(b) === tagKey(lt));
    if (i < 0) continue;
    out.push(lt.map((x) => String(x)));
    pool.splice(i, 1);
  }
  return [...out, ...defaultOrder(pool)];
}

/**
 * Decision 5: { outcome, added, removed } for a built letter against the letter the node has: new when the node has no
 * id; changed when its letter isn't in the instance's own relay, or differs; else unchanged.
 */
function compare(tags, kind, existing, hasId) {
  if (!hasId) return { outcome: 'new', added: tags, removed: [] };
  if (!existing) return { outcome: 'changed', added: tags, removed: [] };
  const counts = (list) => { const m = new Map(); for (const t of list) { const k = tagKey(t); m.set(k, (m.get(k) || 0) + 1); } return m; };
  // The tags of `list` that `other` doesn't hold, as many times over as `list` has more of them.
  const beyond = (list, other) => {
    const left = counts(other);
    const out = [];
    for (const t of list) { const k = tagKey(t); if (left.get(k) > 0) left.set(k, left.get(k) - 1); else out.push(t); }
    return out;
  };
  const added = beyond(tags, existing.tags);
  const removed = beyond(existing.tags, tags);
  const same = existing.kind === kind && existing.content === '' && !added.length && !removed.length;
  return { outcome: same ? 'unchanged' : 'changed', added: same ? [] : added, removed: same ? [] : removed };
}

// ── what the letters name, and carry (Decision 9) ──
/**
 * unsent-reference: each tag (REFERRING) or graph list of a letter of the call that names one of the instance's own
 * nodes with no letter, which the call doesn't send. The letter still names it. items: [{ key, entry, tags }].
 */
async function referenceReports(read, items, { own, sent }) {
  const Sc = require('./_scope');
  const named = [];
  for (const it of items) {
    for (const t of it.tags) if (REFERRING.includes(t[0]) && typeof t[1] === 'string' && (addressParts(t[1]) || HEX64.test(t[1]))) named.push({ it, where: `tag ${t[0]}`, ref: t[1] });
    const j = it.tags.find((t) => t[0] === 'json');
    let json = null;
    try { json = j ? JSON.parse(j[1]) : null; } catch { json = null; }
    const g = isObject(json) && isObject(json.graph) ? json.graph : null;
    for (const [where, list] of [['json.graph.nodes', g && g.nodes], ['json.graph.imports', g && g.imports]]) {
      for (const x of Array.isArray(list) ? list : []) if (isObject(x) && typeof x.uuid === 'string' && x.uuid) named.push({ it, where, ref: x.uuid });
    }
  }
  if (!named.length) return [];
  const keyOf = await Sc.nodesNamed(read, named.map((n) => n.ref));
  const facts = await Sc.factsOf(read, [...new Set(keyOf.values())]);
  const out = [];
  const seen = new Set();
  for (const n of named) {
    const k = keyOf.get(n.ref);
    const f = k ? facts.get(k) : null;
    if (!f || k === n.it.key || !Sc.isOwn(f, own) || f.id || sent.has(k)) continue;
    const once = `${n.it.key}|${n.where}|${n.ref}`;
    if (seen.has(once)) continue;
    seen.add(once);
    out.push({
      report: 'unsent-reference', node: n.it.key, where: n.where, address: n.ref, key: k,
      words: `${label(n.it.entry)} names ${f.name ? `"${f.name}" ` : ''}(${n.ref}) in its ${n.where}: one of this instance's own nodes, which has no letter and isn't sent in this call. The letter still names it; export it too for the name to lead somewhere.`,
    });
  }
  return out;
}

let NOSTR = null;
/** The relationship types of firmware's nostr category, which a letter's tags make themselves (Amendment 1, item 1). */
function nostrTypes() {
  if (NOSTR) return NOSTR;
  const firmware = require('../../../api/normalize/firmware');
  const out = new Set();
  for (const data of Object.values(firmware.allRelationshipTypes() || {})) {
    const rt = data && data.relationshipType;
    if (rt && rt.category === 'nostr' && typeof rt.alias === 'string') out.add(rt.alias);
  }
  NOSTR = out;
  return NOSTR;
}

const RELS_AMONG = `UNWIND $from AS k
  MATCH (a:TapestryNode {tapestryKey: k})-[r]->(b:TapestryNode)
  WHERE b.tapestryKey IN $keys
  RETURN a.tapestryKey AS from, type(r) AS type, b.tapestryKey AS to`;
const SUPERSETS_OF = (INIT) => `UNWIND $uuids AS u
  MATCH (h:TapestryNode {uuid: u})-[:${INIT}]->(s:TapestryNode)
  RETURN u AS header, s.tapestryKey AS key`;

/**
 * uncarried-relationship (Decision 9, Amendment 1 item 1): each relationship between two nodes of the call's letters,
 * of any type but the nostr category's, that none of them carries, as import nostr reads a letter: a z (from the
 * concept's superset), an n or s within the assistant's graph, a b, a relationship letter, or a graph's
 * graph.relationships, each of a type import nostr makes. items: [{ key, address, tags }]. Nothing is made to carry one.
 */
async function uncarried(read, items, { assistant }) {
  if (items.length < 2) return [];
  const Sc = require('./_scope');
  const R = Sc.rel();
  const keys = items.map((it) => it.key);
  const rels = [];
  for (const part of chunks(keys, BATCH)) rels.push(...await read(RELS_AMONG, { from: part, keys }));
  const nostr = nostrTypes();
  const candidates = rels.filter((r) => typeof r.type === 'string' && !nostr.has(r.type) && r.from !== r.to);
  if (!candidates.length) return [];
  const structure = require('../import/_letters').structureTypes();
  const byAddress = new Map(items.map((it) => [it.address, it.key]));
  const carried = new Set();
  const carry = (from, type, to) => { if (from && to) carried.add(`${from}|${type}|${to}`); };
  const zHeaders = [];
  const jsonOf = (it) => { const j = it.tags.find((t) => t[0] === 'json'); try { const v = j ? JSON.parse(j[1]) : null; return isObject(v) ? v : null; } catch { return null; } };
  const slugs = new Map();
  for (const it of items) {
    const g = (jsonOf(it) || {}).graph;
    for (const n of isObject(g) && Array.isArray(g.nodes) ? g.nodes : []) if (isObject(n) && typeof n.slug === 'string' && typeof n.uuid === 'string' && !slugs.has(n.slug)) slugs.set(n.slug, n.uuid);
  }
  for (const it of items) {
    for (const t of it.tags) {
      const v = t[1];
      const a = addressParts(v);
      if (t[0] === 'z' && a && a.d !== 'word') zHeaders.push({ it, header: v });
      else if (t[0] === 'n' && a && a.pubkey === assistant) carry(byAddress.get(v), R.TERM, it.key);
      else if (t[0] === 's' && a && a.pubkey === assistant) carry(byAddress.get(v), R.PROP, it.key);
      else if (t[0] === 'b' && typeof v === 'string') carry(it.key, t[2] === 'inherit' ? 'INHERITS_FROM' : 'REFERENCES', byAddress.get(v));
    }
    const from = (it.tags.find((t) => t[0] === 'nodeFrom') || [])[1];
    const to = (it.tags.find((t) => t[0] === 'nodeTo') || [])[1];
    const type = (it.tags.find((t) => t[0] === 'relationshipType') || [])[1];
    if (from && to && type && structure.has(type)) carry(byAddress.get(from), type, byAddress.get(to));
    const g = (jsonOf(it) || {}).graph;
    if (isObject(g) && Array.isArray(g.relationships)) {
      const own = new Map();
      for (const n of Array.isArray(g.nodes) ? g.nodes : []) if (isObject(n) && typeof n.slug === 'string' && typeof n.uuid === 'string') own.set(n.slug, n.uuid);
      const uuidOf = (x) => (isObject(x) && typeof x.slug === 'string' ? own.get(x.slug) || slugs.get(x.slug) : null);
      for (const r of g.relationships) {
        if (!isObject(r)) continue;
        const ty = isObject(r.relationshipType) ? r.relationshipType.slug : null;
        if (typeof ty === 'string' && structure.has(ty)) carry(byAddress.get(uuidOf(r.nodeFrom)), ty, byAddress.get(uuidOf(r.nodeTo)));
      }
    }
  }
  const headers = [...new Set(zHeaders.map((z) => z.header))];
  if (headers.length) {
    const supersets = new Map();
    for (const part of chunks(headers, BATCH)) {
      for (const r of await read(SUPERSETS_OF(R.INIT), { uuids: part })) {
        if (!supersets.has(r.header)) supersets.set(r.header, []);
        supersets.get(r.header).push(r.key);
      }
    }
    for (const z of zHeaders) for (const s of supersets.get(z.header) || []) carry(s, R.TERM, z.it.key);
  }
  const byKey = new Map(items.map((it) => [it.key, it]));
  const out = [];
  const seen = new Set();
  for (const r of candidates) {
    const id = `${r.from}|${r.type}|${r.to}`;
    if (carried.has(id) || seen.has(id)) continue;
    seen.add(id);
    const a = byKey.get(r.from);
    const b = byKey.get(r.to);
    out.push({
      report: 'uncarried-relationship', node: r.from, type: r.type, from: r.from, to: r.to,
      words: `(${a.address}) ${r.type} (${b.address}): both nodes are sent in this call, and no letter of it carries this relationship, so an instance that imports the letters won't have it. Nothing was made up to carry it.`,
    });
  }
  return out;
}

/** "<name>" (<address>), or the key, for words. */
function label(e) {
  return e.name ? `"${e.name}" (${e.uuid || e.key})` : (e.uuid || e.key);
}

module.exports = {
  LEFT_OUT, REF, addressParts, classOf, prepare, targetsOf, decide, build, compare, tagKey, defaultOrder,
  referenceReports, uncarried, label,
};
