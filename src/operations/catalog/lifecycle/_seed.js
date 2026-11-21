'use strict';
/**
 * lifecycle seed-firmware's installer (story graph-operations-first-slice #37, ADR graph-operations-first-slice/0037
 * Decisions 6 to 12): what the graph holds at the target's addresses, each node's and relationship's outcome, and the
 * writes, unsigned, by the bootstrap path.
 *
 *   readState(read, target)                 what the graph holds for the target; read is (cypher, params) → rows,
 *                                           and nothing else is asked
 *   plan(target, state, { take, takeAll })  → { nodes, relationships, notInSource, writes, listing }: a pure function.
 *                                           nodes holds an entry { address, outcome, noRecord?, parts?, fromSource?,
 *                                           target, tapestryKey } for each node of the target (Decision 7);
 *                                           relationships Decision 11's lists, added, removed, changed and kept, and
 *                                           the counts of unchanged and others (Decision 8); a take ref no node of the
 *                                           target answers refuses not-firmware, and a node at the installed-firmware
 *                                           graph's address without seed-firmware's mark refuses address-held
 *                                           (Amendment 3, item 3), as does seed-firmware's own there whose JSON can't
 *                                           be read, in words that say so (review round 2, nit 1)
 *   apply(tx, target, state, plan, { caller, at })  the plan's writes in one transaction, in today's order: nodes,
 *                                           records, b claims, relationships, the installed-firmware graph, one change
 *                                           entry (Decision 10) → { change, written, letterOutOfDate, addresses }
 *   refreshCache(written)                   after the commit: each written json's cached entry removed, and each
 *                                           written node derived again → how many failed (cacheOutOfDate)
 *   rulesCheck(target)                      rules check over each firmware concept's scope, in a transaction of its
 *                                           own after the cache → { findings, rules, judged, first }
 *   seeded(read, ta)                        status's seeded, from the installed-firmware graph, or null (Decision 12)
 *   contentOf(node), installedGraphAddress(ta)
 *
 * A node's content (Decision 6) is its name, its tags other than json as a sorted set, and its json by value, read as
 * the derive reads it (an lmdb: reference resolved; graphContext, cameFrom and installed set aside). A node is edited
 * when its content's digest isn't its record's, installed.digest; the record's parts say which part differs.
 *
 * It never signs, publishes or reads a key, and it opens nothing when it loads: the graph seam, the store and the
 * derive are required when first called. Its name starts with `_`, so the loader skips it.
 */

const crypto = require('crypto');
const { refusal } = require('../../refusal');
const { keyNode } = require('../../../lib/tapestry-key-cypher');

const OPERATION = 'lifecycle seed-firmware';
const SET_ASIDE = Object.freeze(['graphContext', 'cameFrom', 'installed']);
const RULES_SHOWN = 20;
const TYPE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NOT_FIRMWARE = Object.freeze({ code: 'not-firmware', status: 400, when: 'A take ref that names no node of the firmware: neither the address of one of its nodes nor the tapestryKey of the node at one; the refusal names each such ref' });
const ADDRESS_HELD = Object.freeze({ code: 'address-held', status: 409, when: "A node at the installed-firmware graph's address, 39999:<assistant>:installed-firmware, that isn't seed-firmware's record: it lacks seed-firmware's mark, its own installed record and an installedFirmware section; or seed-firmware's own, its record there, whose JSON can't be read (an LMDB reference with no entry). The refusal names it and says which, and nothing is written" });

const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const relKey = (type, from, to) => `${from}\u0000${type}\u0000${to}`;
/** Order-free JSON text: every object's keys sorted. */
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (isObject(x)) return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x === undefined ? null : x);
}
const parseJson = (text) => { if (typeof text !== 'string') return isObject(text) ? text : null; try { return JSON.parse(text); } catch { return null; } };

/**
 * The installed-firmware graph's d-tag, reserved: no element write gives it, since theirs end in a hash of their
 * concept's address (Decision 9, as Amendment 3 item 3 moves it).
 */
const INSTALLED_D = 'installed-firmware';
/** Where the installed-firmware graph is. */
function installedGraphAddress(ta) {
  return `39999:${ta}:${INSTALLED_D}`;
}
/**
 * An installed-firmware graph's JSON, read through the LMDB when its json is offloaded (Amendment 3, item 1), if it
 * carries seed-firmware's mark: its own installed record, and an installedFirmware section (item 3). → { json } when
 * it is seed-firmware's; { held: true, unreadable } when it carries the record but its JSON can't be read, so whether
 * it holds the section can't be told (review round 2, nit 1); { held: true } when it isn't seed-firmware's.
 */
function installedGraphOf(installedText, rawJson) {
  const recorded = isObject(parseJson(installedText));
  let unreadable = null;
  if (typeof rawJson !== 'string' || !rawJson) unreadable = 'it has no json tag';
  else if (rawJson.startsWith('lmdb:')) {
    let value = null;
    try { value = require('../../../lib/tapestry-resolve').resolveValue(rawJson); } catch { value = null; }
    if (value === null || value === undefined) unreadable = `its json tag is an LMDB reference (${rawJson}) whose entry is missing from the store`;
    else if (!isObject(value)) unreadable = `its json tag's entry in the store (${rawJson}) isn't a JSON object`;
  } else if (!isObject(parseJson(rawJson))) unreadable = "its json tag isn't JSON of an object";
  if (recorded && unreadable) return { held: true, unreadable };
  const j = unreadable ? null : jsonValueOf(rawJson);
  return recorded && isObject(j) && isObject(j.installedFirmware) ? { json: j } : { held: true };
}

// ── a node's content (Decision 6) ──
/** A tag as the graph keeps it: [type, value, value1?, value2?], the empty values dropped from the end. */
function tagOf(t) {
  const x = [t[0], t[1], t[2], t[3]].map((v) => (v === null || v === undefined ? '' : String(v)));
  while (x.length > 2 && x[x.length - 1] === '') x.pop();
  return x;
}
/**
 * A json tag's value, read as the derive reads it: an lmdb: reference resolved, the three local sections set aside, and
 * word.wordTypes as a set, sorted, since its order isn't content: a node's memberships are its edges (D10), and the set
 * deriver writes a superset's in its own order (Amendment 3, item 2).
 */
function jsonValueOf(raw) {
  let value = raw;
  if (typeof raw === 'string' && raw.startsWith('lmdb:')) {
    try { value = require('../../../lib/tapestry-resolve').resolveValue(raw); } catch { value = null; }
  } else if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return { unreadable: raw }; }
  }
  if (!isObject(value)) return value === undefined ? null : value;
  const out = { ...value };
  for (const k of SET_ASIDE) delete out[k];
  if (isObject(out.word) && Array.isArray(out.word.wordTypes)) out.word = { ...out.word, wordTypes: [...new Set(out.word.wordTypes)].sort() };
  return out;
}
/** A node's content → { parts: { name, json, tags: { type → digest } }, digest } from its name and tags. */
function contentOf({ name, tags }) {
  const list = (tags || []).map(tagOf);
  const json = list.find((t) => t[0] === 'json');
  const byType = {};
  for (const t of list) {
    if (t[0] === 'json') continue;
    (byType[t[0]] = byType[t[0]] || new Set()).add(JSON.stringify(t));
  }
  const parts = {
    name: sha256(stable(name === undefined ? null : name)),
    json: sha256(stable(json ? jsonValueOf(json[1]) : null)),
    tags: Object.fromEntries(Object.keys(byType).sort().map((k) => [k, sha256([...byType[k]].sort().join('\n'))])),
  };
  return { parts, digest: sha256(stable(parts)) };
}
/** The parts that differ between two contents' parts: 'name', 'json', and 'tags:<type>' for each tag type. */
function partsDiffering(a, b) {
  const out = [];
  if (!a || !b) return out;
  if (a.name !== b.name) out.push('name');
  if (a.json !== b.json) out.push('json');
  const at = isObject(a.tags) ? a.tags : {};
  const bt = isObject(b.tags) ? b.tags : {};
  for (const k of [...new Set([...Object.keys(at), ...Object.keys(bt)])].sort()) if (at[k] !== bt[k]) out.push(`tags:${k}`);
  return out;
}
/** A record read from a node's property: { cameFrom, installed } with installed { digest, parts }, or null. */
function recordOf(cameFromText, installedText) {
  const installed = parseJson(installedText);
  if (!isObject(installed) || typeof installed.digest !== 'string' || !isObject(installed.parts)) return null;
  return { cameFrom: parseJson(cameFromText), installed };
}

// ── reading the graph ──
const NODE_FIELDS = `n.tapestryKey AS key, n.uuid AS uuid, labels(n) AS labels, n.name AS name, n.pubkey AS pubkey, n.id AS id,
       n.cameFrom AS cameFrom, n.installed AS installed,
       t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2`;
/** Rows of NODE_FIELDS, one node per address (the first by key), each { key, uuid, labels, name, hasLetter, tags, record }. */
function nodesOf(rows) {
  const byNode = new Map();
  for (const r of rows) {
    if (typeof r.uuid !== 'string' || typeof r.key !== 'string') continue;
    const id = `${r.uuid}\u0000${r.key}`;
    if (!byNode.has(id)) {
      const labels = Array.isArray(r.labels) ? r.labels : [];
      byNode.set(id, { key: r.key, address: r.uuid, labels, name: r.name === undefined ? null : r.name, hasLetter: labels.includes('NostrEvent') || (r.id !== null && r.id !== undefined), tags: [], record: recordOf(r.cameFrom, r.installed), installedText: r.installed === undefined ? null : r.installed });
    }
    if (r.type !== null && r.type !== undefined) byNode.get(id).tags.push([r.type, r.value, r.value1, r.value2]);
  }
  const out = new Map();
  for (const n of [...byNode.values()].sort((a, b) => byText(a.key, b.key))) if (!out.has(n.address)) out.set(n.address, n);
  return out;
}
const tagValue = (tags, type) => { const t = (tags || []).find((x) => x[0] === type); return t ? (t[1] === null || t[1] === undefined ? '' : String(t[1])) : undefined; };
const letterKey = (from, type, to) => `${from}\u0000${type}\u0000${to}`;

/** What the graph holds for the target (see the file's header). */
async function readState(read, target) {
  const ask = typeof read === 'function' ? read : read.read;
  const ta = target.ta;
  const R = target.aliases;
  const igAddress = installedGraphAddress(ta);
  const own = target.nodes.filter((n) => !n.letter).map((n) => n.address);

  // The nodes at the target's addresses, and the installed-firmware graph.
  const found = nodesOf(await ask(
    `UNWIND $uuids AS u
     MATCH (n:NostrEvent|TapestryNode {uuid: u})
     WHERE NOT n:NostrEventTag
     OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
     RETURN ${NODE_FIELDS}`,
    { uuids: [...own, igAddress] },
  ));
  const installed = found.get(igAddress) || null;
  found.delete(igAddress);

  // The assistant's relationship letters, matched to the target's by nodeFrom, relationshipType and nodeTo.
  const letterNodes = nodesOf(await ask(
    `MATCH (lt:NostrEventTag {type: 'relationshipType'})<-[:HAS_TAG]-(n)
     WHERE n.pubkey = $ta AND NOT n:GraphChange
     MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
     RETURN ${NODE_FIELDS}`,
    { ta },
  ));
  const byEnds = new Map();
  for (const n of [...letterNodes.values()].sort((a, b) => byText(a.address, b.address))) {
    const k = letterKey(tagValue(n.tags, 'nodeFrom'), tagValue(n.tags, 'relationshipType'), tagValue(n.tags, 'nodeTo'));
    if (!byEnds.has(k)) byEnds.set(k, n);
  }
  const letters = new Map();
  for (const t of target.nodes) {
    if (!t.letter) continue;
    const n = byEnds.get(letterKey(t.letter.nodeFrom, t.letter.relationshipType, t.letter.nodeTo));
    if (n) letters.set(t.address, n);
  }

  // The last install's lists (Decision 9): its nodes but the curators' headers, the relationships it made, brought in
  // line or adopted, but the b claims, and apart from them the ones it kept (Amendment 3, item 4). Only a node with
  // seed-firmware's mark is its record; anything else at the address is held, and the plan refuses (item 3).
  let last = null;
  let held = null;
  const ig = installed ? installedGraphOf(installed.installedText, tagValue(installed.tags, 'json')) : null;
  if (ig && ig.held) held = { address: installed.address, key: installed.key, unreadable: ig.unreadable || null };
  if (ig && ig.json) {
    const j = ig.json;
    const graph = isObject(j.graph) ? j.graph : null;
    const fw = j.installedFirmware;
    const references = new Set(Array.isArray(fw.references) ? fw.references : []);
    if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.relationships)) {
      const nodes = new Set(graph.nodes.map((x) => x && x.slug).filter((x) => typeof x === 'string' && !references.has(x)));
      last = { nodes, relationships: listedRelationships(graph.relationships), kept: listedRelationships(fw.keptRelationships), version: fw.version || null, source: fw.source || null, references: [...references], json: j };
    }
  }

  // The nodes the last install listed that the target lacks.
  const inTarget = new Set([...own, ...[...letters.values()].map((n) => n.address)]);
  const leftAddresses = last ? [...last.nodes].filter((a) => !inTarget.has(a)) : [];
  const leftovers = leftAddresses.length ? nodesOf(await ask(
    `UNWIND $uuids AS u
     MATCH (n:NostrEvent|TapestryNode {uuid: u})
     WHERE NOT n:NostrEventTag
     OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
     RETURN ${NODE_FIELDS}`,
    { uuids: leftAddresses },
  )) : new Map();

  // The relationships out of the firmware's nodes: those between two of them, and each header's b claims.
  const firmwareAddresses = new Set([...found.keys(), ...[...letters.values()].map((n) => n.address), ...leftovers.keys()]);
  const relRows = firmwareAddresses.size ? await ask(
    `UNWIND $uuids AS u
     MATCH (a:NostrEvent|TapestryNode {uuid: u})-[r]->(b)
     WHERE type(r) <> 'HAS_TAG'
     RETURN u AS from, type(r) AS type, b.uuid AS to, properties(r) AS props`,
    { uuids: [...firmwareAddresses] },
  ) : [];
  const rels = new Map();
  const claims = new Map();
  for (const r of relRows) {
    if (typeof r.to !== 'string') continue;
    const claim = isClaim({ type: r.type, properties: r.props });
    if (!claim && !firmwareAddresses.has(r.to)) continue;
    const into = claim ? claims : rels;
    const k = relKey(r.type, r.from, r.to);
    if (!into.has(k)) into.set(k, { type: r.type, from: r.from, to: r.to, properties: isObject(r.props) ? r.props : {} });
  }

  // An element with no node at its address, whose name another element in its concept's class thread holds.
  const asks = target.nodes.filter((t) => t.role === 'element' && !found.has(t.address))
    .map((t) => ({ address: t.address, header: `39998:${ta}:${t.concept}`, name: t.name }));
  const blocked = new Map();
  if (asks.length) {
    const rows = await ask(
      `UNWIND $asks AS q
       MATCH (h:NostrEvent|TapestryNode {uuid: q.header})-[:\`${R.INIT}\`]->(sup:Superset)
       MATCH (sup)-[:\`${R.PROP}\`*0..5]->(s)-[:\`${R.TERM}\`]->(e:NostrEvent|ListItem)
       WHERE e.name = q.name
       RETURN DISTINCT q.address AS address, e.uuid AS uuid, e.pubkey AS author`,
      { asks },
    );
    for (const r of rows) {
      if (typeof r.uuid !== 'string' || r.uuid === r.address) continue;
      if (!blocked.has(r.address)) blocked.set(r.address, []);
      blocked.get(r.address).push({ address: r.uuid, author: r.author || null });
    }
  }
  return { ta, found, letters, installed: held ? null : installed, held, last, leftovers, rels, claims, blocked };
}

/** A list of the installed-firmware graph's relationships, in graph.relationships' form, as a Map key → properties, the b claims left out. */
function listedRelationships(list) {
  const out = new Map();
  for (const x of Array.isArray(list) ? list : []) {
    const type = x && x.relationshipType && x.relationshipType.slug;
    const from = x && x.nodeFrom && x.nodeFrom.slug;
    const to = x && x.nodeTo && x.nodeTo.slug;
    if (typeof type !== 'string' || typeof from !== 'string' || typeof to !== 'string' || isClaim({ type, properties: x.properties })) continue;
    out.set(relKey(type, from, to), isObject(x.properties) ? x.properties : {});
  }
  return out;
}

/** Whether a relationship is a b tag's claim, which goes with its header's tags (Decision 8). */
function isClaim(r) {
  return r && r.type === 'REFERENCES' && isObject(r.properties) && r.properties.source === 'b-tag';
}

// ── the plan (Decisions 7 and 8) ──
/** A target node's tags with its d as the graph's node has it (a relationship letter's d-tag is its own). */
function tagsFor(t, g) {
  if (!t.letter || !g) return t.tags;
  const d = tagValue(g.tags, 'd');
  return t.tags.map((x) => (x[0] === 'd' ? ['d', d === undefined ? x[1] : d] : x));
}
const sameProps = (a, b) => stable(isObject(a) ? a : {}) === stable(isObject(b) ? b : {});

/** Each node's and relationship's outcome; see the file's header. Pure. */
function plan(target, state, { take, takeAll = false } = {}) {
  // A node at the installed-firmware graph's address without seed-firmware's mark is someone's own: it is never read
  // as the last install's lists, nor rewritten (Amendment 3, item 3).
  if (state.held && state.held.unreadable) {
    // Seed-firmware's own graph, its record there, whose JSON can't be read: what the last install listed can't be
    // known, so nothing is installed over it (review round 2, nit 1).
    throw refusal(ADDRESS_HELD.code, `The node at ${state.held.address} (tapestryKey ${state.held.key}) is seed-firmware's own installed-firmware graph, its installed record there, but its JSON can't be read: ${state.held.unreadable}. What the last install listed can't be known without it, so the firmware isn't installed over it. Bring its JSON back, its entry in the store or its json tag inline, then try again. Nothing changed.`);
  }
  if (state.held) {
    throw refusal(ADDRESS_HELD.code, `The node at ${state.held.address} (tapestryKey ${state.held.key}) isn't seed-firmware's record of what it installed: it lacks seed-firmware's mark, its own installed record and an installedFirmware section. That address is the installed-firmware graph's, so the firmware can't be installed while it is held. Nothing changed.`);
  }
  const all = takeAll === true;
  const graphOf = (t) => (t.letter ? state.letters.get(t.address) : state.found.get(t.address)) || null;
  // take: by an address of the target, a letter's address in the graph, or the tapestryKey of the node at one.
  const refs = Array.isArray(take) ? take : [];
  const answers = new Map();
  for (const t of target.nodes) {
    answers.set(t.address, t.address);
    const g = graphOf(t);
    if (g) { answers.set(g.address, t.address); answers.set(g.key, t.address); }
  }
  const unknown = refs.filter((ref) => !answers.has(ref));
  if (unknown.length) {
    throw refusal(NOT_FIRMWARE.code, `${unknown.length === 1 ? 'This ref names' : 'These refs name'} no node of the firmware the instance carries: ${unknown.map((x) => JSON.stringify(x)).join(', ')}. A take ref is a firmware node's address or the tapestryKey of the node at one. Nothing changed.`, { input: 'take' });
  }
  const taken = new Set(refs.map((ref) => answers.get(ref)));

  const nodes = [];
  const addressOf = new Map(); // target address → the address it has in the graph
  for (const t of target.nodes) {
    const g = graphOf(t);
    const address = g ? g.address : t.address;
    addressOf.set(t.address, address);
    const base = { address, target: t.address, tapestryKey: g ? g.key : null, role: t.role, file: t.file, concept: t.concept };
    if (!g) {
      const by = state.blocked.get(t.address);
      nodes.push(by ? { ...base, outcome: 'blocked', heldBy: by } : { ...base, outcome: 'added' });
      continue;
    }
    const source = contentOf({ name: t.name, tags: tagsFor(t, g) });
    const have = contentOf({ name: g.name, tags: g.tags });
    const rec = g.record;
    const rule = t.updateElements === true;
    const pick = taken.has(t.address) || all;
    if (rec) {
      const edited = partsDiffering(have.parts, rec.installed.parts);
      const fileChanged = source.digest !== rec.installed.digest;
      if (rule) nodes.push({ ...base, outcome: edited.length ? 'put-back' : fileChanged ? 'changed' : 'unchanged', ...(edited.length ? { parts: edited } : {}) });
      else if (!edited.length) nodes.push({ ...base, outcome: fileChanged ? 'changed' : 'unchanged' });
      else if (pick) nodes.push({ ...base, outcome: 'changed', parts: edited });
      else nodes.push({ ...base, outcome: 'kept', parts: edited, fromSource: partsDiffering(have.parts, source.parts) });
      continue;
    }
    // No record: today's install made it, or a run kept it (story, open question 2).
    if (have.digest === source.digest) nodes.push({ ...base, outcome: 'unchanged', adopt: true });
    else if (rule) nodes.push({ ...base, outcome: 'put-back', noRecord: true, parts: partsDiffering(have.parts, source.parts) });
    else if (pick) nodes.push({ ...base, outcome: 'changed', noRecord: true, parts: partsDiffering(have.parts, source.parts) });
    else nodes.push({ ...base, outcome: 'kept', noRecord: true, parts: partsDiffering(have.parts, source.parts) });
  }

  // The nodes the last install listed that the target lacks: left as they are (Decision 7).
  const notInSource = [...state.leftovers.values()].sort((a, b) => byText(a.address, b.address))
    .map((n) => ({ address: n.address, tapestryKey: n.key, outcome: 'not-in-source', role: null, file: null }));

  // Relationships (Decision 8), by the addresses their ends have in the graph.
  const blocked = new Set(nodes.filter((e) => e.outcome === 'blocked').map((e) => e.target));
  const at = (a) => addressOf.get(a) || a;
  const want = [];
  const claims = [];
  for (const r of target.relationships) {
    if (blocked.has(r.from) || blocked.has(r.to)) continue;
    (isClaim(r) ? claims : want).push({ type: r.type, from: at(r.from), to: at(r.to), properties: isObject(r.properties) ? r.properties : {} });
  }
  // The last install's relationships: those it made, brought in line or adopted, and apart from them those it kept,
  // which no install takes out (Amendment 3, item 4).
  const last = state.last ? state.last.relationships : null;
  const keptBefore = state.last ? state.last.kept : new Map();
  // A node made by this run: its relationships are new with it, whatever the graph held before.
  const made = new Set(nodes.filter((e) => e.outcome === 'added').map((e) => e.address));
  const out = [];
  // The b claims go with their node's tags: made or taken out when its tags are written, and otherwise left as they
  // are (Decision 8).
  const tagsWritten = new Set(nodes.filter((e) => ['added', 'changed', 'put-back'].includes(e.outcome)).map((e) => e.address));
  const claimed = new Set();
  for (const r of claims) {
    const k = relKey(r.type, r.from, r.to);
    claimed.add(k);
    const entry = { type: r.type, from: r.from, to: r.to, properties: r.properties };
    if (state.claims.has(k)) out.push({ ...entry, outcome: 'unchanged' });
    else if (tagsWritten.has(r.from)) out.push({ ...entry, outcome: 'added' });
    else out.push({ ...entry, outcome: 'kept', missing: true, ...(last ? {} : { noRecord: true }) });
  }
  for (const [k, g] of state.claims) if (!claimed.has(k) && tagsWritten.has(g.from)) out.push({ type: g.type, from: g.from, to: g.to, properties: g.properties, outcome: 'removed' });
  const wanted = new Set();
  for (const r of want) {
    const k = relKey(r.type, r.from, r.to);
    wanted.add(k);
    const entry = { type: r.type, from: r.from, to: r.to, ...(Object.keys(r.properties).length ? { properties: r.properties } : {}) };
    const g = state.rels.get(k);
    // No record: the installed-firmware graph doesn't list it as made, brought in line or adopted.
    const listed = !!last && last.has(k);
    const record = listed ? {} : { noRecord: true };
    if (g) {
      if (sameProps(g.properties, r.properties)) out.push({ ...entry, outcome: 'unchanged' });
      else if (listed && sameProps(g.properties, last.get(k))) out.push({ ...entry, outcome: 'changed' });
      else if (all) out.push({ ...entry, outcome: 'changed', ...record });
      else out.push({ ...entry, outcome: 'kept', was: g.properties, ...record });
    } else if (made.has(r.from) || made.has(r.to) || (last && !listed && !keptBefore.has(k))) {
      out.push({ ...entry, outcome: 'added' });
    } else if (all) {
      out.push({ ...entry, outcome: 'added', ...record });
    } else {
      // Missing between two nodes that were there: removed since it was installed, kept before, or, on first contact
      // with no installed-firmware graph, a relationship with no record (Decision 8).
      out.push({ ...entry, outcome: 'kept', missing: true, ...record });
    }
  }
  // One the last install made, brought in line or adopted, which the firmware no longer makes, is taken out.
  for (const [k, props] of last ? last.entries() : []) {
    if (wanted.has(k) || !state.rels.has(k)) continue;
    const g = state.rels.get(k);
    out.push({ type: g.type, from: g.from, to: g.to, ...(Object.keys(props).length ? { properties: props } : {}), outcome: 'removed' });
  }
  // One it kept, which the firmware no longer makes, stays as the instance has it, and is reported kept (Amendment 3,
  // item 4).
  for (const k of keptBefore.keys()) {
    if (wanted.has(k) || (last && last.has(k)) || !state.rels.has(k)) continue;
    const g = state.rels.get(k);
    out.push({ type: g.type, from: g.from, to: g.to, outcome: 'kept', was: g.properties, noRecord: true });
  }
  for (const [k, g] of state.rels) if (!wanted.has(k) && !(last && last.has(k)) && !keptBefore.has(k)) out.push({ type: g.type, from: g.from, to: g.to, outcome: 'others' });

  // What the installed-firmware graph lists after this run (Decision 9), and whether anything is to be written.
  const listing = listingOf(target, nodes, out);
  const writes = nodes.some((e) => ['added', 'changed', 'put-back'].includes(e.outcome) || e.adopt === true)
    || out.some((r) => ['added', 'changed', 'removed'].includes(r.outcome))
    || !state.installed || !sameListing(state.last, listing, target);
  return { nodes, notInSource, relationships: out, listing, writes };
}

/** The answer's relationships (Decision 11): the added, removed, changed and kept, and how many were unchanged or the instance's own. */
function relationshipsAnswer(list) {
  const pick = (o) => list.filter((r) => r.outcome === o).map(({ outcome, ...r }) => r);
  return { added: pick('added'), removed: pick('removed'), changed: pick('changed'), kept: pick('kept'), unchanged: list.filter((r) => r.outcome === 'unchanged').length, others: list.filter((r) => r.outcome === 'others').length };
}

/**
 * What the installed-firmware graph lists after a run: each node not blocked; in `relationships` each one the run
 * made, brought in line or adopted as the target has it; and in `kept` each one it kept, apart (Amendment 3, item 4),
 * with the properties the graph holds, or, when it is missing, the firmware's.
 */
function listingOf(target, nodes, out) {
  const byTarget = new Map(target.nodes.map((t) => [t.address, t]));
  const listed = nodes.filter((e) => e.outcome !== 'blocked').map((e) => ({ address: e.address, name: byTarget.get(e.target).name }));
  const props = (r) => (isObject(r.was) ? r.was : isObject(r.properties) ? r.properties : {});
  const relationships = out.filter((r) => ['added', 'changed', 'unchanged'].includes(r.outcome)).map((r) => ({ type: r.type, from: r.from, to: r.to, properties: isObject(r.properties) ? r.properties : {} }));
  const kept = out.filter((r) => r.outcome === 'kept').map((r) => ({ type: r.type, from: r.from, to: r.to, properties: props(r) }));
  return { nodes: listed, relationships, kept, references: [...target.references] };
}
/** A listed relationship as text, for comparing two listings. */
const listedText = (x) => `${x.from}\u0000${x.type}\u0000${x.to}\u0000${stable(isObject(x.properties) ? x.properties : {})}`;
/** A list in graph.relationships' form as { type, from, to, properties }. */
const fromGraphForm = (list) => (Array.isArray(list) ? list : []).map((x) => ({ from: x && x.nodeFrom && x.nodeFrom.slug, type: x && x.relationshipType && x.relationshipType.slug, to: x && x.nodeTo && x.nodeTo.slug, properties: x && x.properties }));
/** Whether the installed-firmware graph already lists what a run would list, from the same source. */
function sameListing(last, listing, target) {
  if (!last) return false;
  if (last.version !== target.version || !isObject(last.source) || last.source.digest !== target.source.digest) return false;
  const j = last.json;
  const had = (j.graph.nodes || []).map((x) => x && x.slug).filter((x) => typeof x === 'string').sort();
  const now = [...listing.nodes.map((n) => n.address), ...listing.references].sort();
  if (stable(had) !== stable(now)) return false;
  const same = (a, b) => stable(a.map(listedText).sort()) === stable(b.map(listedText).sort());
  return same(fromGraphForm(j.graph.relationships), listing.relationships) && same(fromGraphForm(j.installedFirmware.keptRelationships), listing.kept);
}

/** A listed relationship in graph.relationships' form. */
const graphForm = (r) => ({ nodeFrom: { slug: r.from }, relationshipType: { slug: r.type }, nodeTo: { slug: r.to }, ...(isObject(r.properties) && Object.keys(r.properties).length ? { properties: r.properties } : {}) });
/** The installed-firmware graph's JSON (Decision 9), in elementJson's form, with installedFirmware and its kept list. */
function installedGraphJson(target, listing, { at, by }) {
  const nodes = [...listing.nodes.map((n) => ({ slug: n.address, uuid: n.address, name: n.name })), ...listing.references.map((a) => ({ slug: a, uuid: a, name: a }))];
  const types = [...new Set(listing.relationships.map((r) => r.type))].sort();
  return {
    word: { slug: 'graph--installed-firmware', name: 'graph: installed firmware', title: 'Graph: Installed Firmware', wordTypes: ['word', 'graph'] },
    graph: { nodes, relationshipTypes: types.map((slug) => ({ slug })), relationships: listing.relationships.map(graphForm), imports: [] },
    installedFirmware: {
      version: target.version,
      source: { kind: target.source.kind, digest: target.source.digest, files: target.source.files },
      at,
      by,
      nodes: listing.nodes.length,
      relationships: listing.relationships.length,
      references: listing.references,
      keptRelationships: listing.kept.map(graphForm),
    },
  };
}

// ── the writes (Decision 10) ──
/** The labels a written node may be given, never from input. */
const LABELS = require('../graph/_eventless').LABELS;
const labelsOf = (labels) => labels.filter((l) => LABELS.includes(l));
const quoted = (type) => { if (!TYPE_NAME.test(type)) throw new Error(`a relationship type that isn't a plain name: ${JSON.stringify(type)}`); return `\`${type}\``; };

/** Rewrite a node's tags, name and role labels, keeping its key, id, NostrEvent, created_at and links. */
async function rewrite(tx, { key, address, name, labels, tags }) {
  const EV = require('../graph/_eventless');
  await tx.run('MATCH (n:TapestryNode {tapestryKey: $key})-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE t', { key });
  await EV.addTags(tx, key, EV.tagRows(address, tags));
  const set = labelsOf(labels).map((l) => `n:${l}`);
  await tx.run(`MATCH (n:TapestryNode {tapestryKey: $key}) SET n.name = $name, n.tapestryValue = $name${set.length ? `, ${set.join(', ')}` : ''}`, { key, name });
}

/** The plan's writes in `tx`; see the file's header. */
async function apply(tx, target, state, p, { caller, at }) {
  const EV = require('../graph/_eventless');
  const { randomDTag } = require('../../../api/normalize/helpers');
  const { recordChange, byOf } = require('../../changes');
  const ta = target.ta;
  const byTarget = new Map(target.nodes.map((t) => [t.address, t]));
  const createdAt = Math.floor(Date.parse(at) / 1000);
  const addresses = new Map(); // target address → where it is now
  const written = { json: [], records: [] };
  const records = [];
  const tagsWritten = []; // { key, tags }: each node whose tags were written, whose b claims follow them
  const letterOutOfDate = [];
  const keys = { added: [], changed: [], putBack: [], adopted: [] };
  const record = (t, key, tags) => {
    const c = contentOf({ name: t.name, tags });
    records.push({ key, slug: t.slug || null, cameFrom: JSON.stringify(t.cameFrom), installed: JSON.stringify({ version: target.version, source: target.source.digest, digest: c.digest, parts: c.parts, at }) });
    written.records.push(key);
  };

  // The nodes, in today's order.
  for (const e of p.nodes) {
    const t = byTarget.get(e.target);
    addresses.set(t.address, e.address);
    if (e.outcome === 'added') {
      let address = t.address;
      let tags = t.tags;
      if (t.letter) {
        // A relationship letter's first d-tag is random, as today's create-set gives it (Decision 4, 1c½).
        const d = randomDTag();
        address = `39999:${ta}:${d}`;
        tags = t.tags.map((x) => (x[0] === 'd' ? ['d', d] : x));
      }
      const key = await EV.makeNode(tx, { uuid: address, kind: t.kind, labels: labelsOf(t.labels), name: t.name, tags, pubkey: ta, createdAt });
      e.address = address;
      e.tapestryKey = key;
      addresses.set(t.address, address);
      keys.added.push(key);
      written.json.push(key);
      tagsWritten.push({ key, tags });
      record(t, key, tags);
    } else if (e.outcome === 'changed' || e.outcome === 'put-back') {
      const g = t.letter ? state.letters.get(t.address) : state.found.get(t.address);
      const tags = tagsFor(t, g);
      await rewrite(tx, { key: g.key, address: g.address, name: t.name, labels: t.labels, tags });
      (e.outcome === 'changed' ? keys.changed : keys.putBack).push(g.key);
      written.json.push(g.key);
      tagsWritten.push({ key: g.key, tags, hadClaims: true });
      if (g.hasLetter) letterOutOfDate.push({ address: g.address, tapestryKey: g.key });
      record(t, g.key, tags);
    } else if (e.adopt === true) {
      // Adopted: its content is the target's, so only its record is written (Decision 7).
      const g = t.letter ? state.letters.get(t.address) : state.found.get(t.address);
      keys.adopted.push(g.key);
      record(t, g.key, tagsFor(t, g));
    }
  }
  const at2 = (a) => addresses.get(a) || a;

  // Each written or adopted node's record, and an element's slug (Decision 6).
  if (records.length) {
    await tx.run(
      `UNWIND $rows AS r
       MATCH (n:TapestryNode {tapestryKey: r.key})
       SET n.cameFrom = r.cameFrom, n.installed = r.installed, n.slug = coalesce(r.slug, n.slug)`,
      { rows: records },
    );
  }

  // The b claims go with the tags (Decision 8): a node whose tags were written has the claims its b tags name, and
  // no other. Only a node that was there can have one already.
  const rewritten = tagsWritten.filter((w) => w.hadClaims).map((w) => w.key);
  if (rewritten.length) {
    await tx.run(
      `UNWIND $keys AS k
       MATCH (n:TapestryNode {tapestryKey: k})-[r:REFERENCES]->()
       WHERE r.source = 'b-tag'
       DELETE r`,
      { keys: rewritten },
    );
  }
  const { classifyBValue } = require('../../../lib/bValueForms');
  const claims = [];
  for (const w of tagsWritten) {
    for (const t of w.tags) if (t[0] === 'b' && t[2] !== 'inherit' && ['a-tag', 'event-id'].includes(classifyBValue(t[1]))) claims.push({ key: w.key, to: String(t[1]) });
  }
  if (claims.length) {
    // As the import makes a claim (src/api/neo4j/eventSync.js): to the node at the b's address, or to a placeholder
    // made there, with no letter, which the import takes over when the curator's letter arrives.
    await tx.run(
      `UNWIND $claims AS c
       MATCH (n:TapestryNode {tapestryKey: c.key})
       OPTIONAL MATCH (held:NostrEvent|TapestryNode {uuid: c.to})
       WITH n, c.to AS to, count(held) AS holders
       FOREACH (absent IN CASE WHEN holders = 0 THEN [1] ELSE [] END |
         MERGE (p:TapestryNode {uuid: to})
         ${keyNode('p')})
       WITH n, to
       MATCH (b:NostrEvent|TapestryNode {uuid: to})
       MERGE (n)-[r:REFERENCES {source: 'b-tag'}]->(b)`,
      { claims },
    );
  }

  // The relationships: the ones firmware no longer makes taken out, then the new and the changed (Decision 8).
  const byType = (list) => { const m = new Map(); for (const r of list) { if (!m.has(r.type)) m.set(r.type, []); m.get(r.type).push({ from: at2(r.from), to: at2(r.to), props: isObject(r.properties) ? r.properties : {} }); } return m; };
  // The b claims were written with their tags, above.
  const of = (o) => p.relationships.filter((r) => r.outcome === o && !isClaim(r));
  const R = { added: of('added'), removed: of('removed'), changed: of('changed') };
  for (const [type, rows] of byType(R.removed)) {
    await tx.run(
      `UNWIND $rows AS x
       MATCH (a:NostrEvent|TapestryNode {uuid: x.from})-[r:${quoted(type)}]->(b:NostrEvent|TapestryNode {uuid: x.to})
       DELETE r`,
      { rows },
    );
  }
  for (const [type, rows] of byType(R.added)) {
    await tx.run(
      `UNWIND $rows AS x
       MATCH (a:NostrEvent|TapestryNode {uuid: x.from})
       MATCH (b:NostrEvent|TapestryNode {uuid: x.to})
       MERGE (a)-[r:${quoted(type)}]->(b)
       SET r += x.props`,
      { rows },
    );
  }
  for (const [type, rows] of byType(R.changed)) {
    await tx.run(
      `UNWIND $rows AS x
       MATCH (a:NostrEvent|TapestryNode {uuid: x.from})-[r:${quoted(type)}]->(b:NostrEvent|TapestryNode {uuid: x.to})
       SET r = x.props`,
      { rows },
    );
  }
  for (const r of p.relationships) { r.from = at2(r.from); r.to = at2(r.to); }

  // The installed-firmware graph (Decision 9), at its reserved address: made the first time, its tags rewritten after,
  // and its own installed record set each time, which with its installedFirmware section is seed-firmware's mark
  // (Amendment 3, item 3).
  const by = byOf(caller);
  const moved = (r) => ({ ...r, from: at2(r.from), to: at2(r.to) });
  const listing = {
    nodes: p.listing.nodes.map((n) => ({ ...n, address: at2(n.address) })),
    relationships: p.listing.relationships.map(moved),
    kept: p.listing.kept.map(moved),
    references: p.listing.references,
  };
  const json = installedGraphJson(target, listing, { at, by });
  const igAddress = installedGraphAddress(ta);
  const igTags = [['d', INSTALLED_D], ['name', 'installed firmware'], ['z', `39998:${ta}:graph`], ['json', JSON.stringify(json)]];
  let igKey;
  if (state.installed) {
    igKey = state.installed.key;
    await rewrite(tx, { key: igKey, address: igAddress, name: 'installed firmware', labels: ['ListItem'], tags: igTags });
  } else {
    igKey = await EV.makeNode(tx, { uuid: igAddress, kind: 39999, labels: ['ListItem'], name: 'installed firmware', tags: igTags, pubkey: ta, createdAt });
  }
  const igContent = contentOf({ name: 'installed firmware', tags: igTags });
  await tx.run(
    'MATCH (n:TapestryNode {tapestryKey: $key}) SET n.installed = $installed',
    { key: igKey, installed: JSON.stringify({ version: target.version, source: target.source.digest, digest: igContent.digest, parts: igContent.parts, at }) },
  );
  const graphSuperset = (target.nodes.find((t) => t.role === 'superset' && t.concept === 'graph') || {}).address;
  if (graphSuperset) {
    await tx.run(
      `MATCH (s:NostrEvent|TapestryNode {uuid: $sup})
       MATCH (n:TapestryNode {tapestryKey: $key})
       MERGE (s)-[:${quoted(target.aliases.TERM)}]->(n)`,
      { sup: at2(graphSuperset), key: igKey },
    );
  }
  written.json.push(igKey);

  // One change entry, naming each node the install made, changed, put back or adopted (Decision 10).
  const changes = [];
  const named = (change, list) => { if (list.length) changes.push({ change, count: list.length, nodes: list }); };
  named('nodes-added', keys.added);
  named('nodes-changed', keys.changed);
  named('nodes-put-back', keys.putBack);
  named('nodes-adopted', keys.adopted);
  for (const [change, list] of [['relationships-added', R.added], ['relationships-changed', R.changed], ['relationships-removed', R.removed]]) if (list.length) changes.push({ change, count: list.length });
  changes.push({ change: state.installed ? 'installed-firmware-rewritten' : 'installed-firmware-recorded', node: igKey });
  const change = await recordChange(tx, { at, caller, operation: OPERATION, changes });
  return { change, written, letterOutOfDate, addresses, installedGraph: igKey };
}

// ── after the commit ──
/**
 * The cache (Decision 10): each written json's cached entry removed, then each written node derived again, so `cache
 * get` answers its record → how many could not be (cacheOutOfDate). A failure undoes nothing.
 */
async function refreshCache(written) {
  const derive = require('../../../lib/tapestry-derive');
  if (!derive.registeredLabels().length) require('../../../lib/derivers').registerAll();
  const store = require('../../../lib/tapestry-store');
  const keys = [...new Set([...written.json, ...written.records])];
  const json = new Set(written.json);
  let failed = 0;
  for (const key of keys) {
    try {
      if (json.has(key)) await store.remove(key);
      if (!(await derive.deriveByKey(key))) failed++;
    } catch {
      failed++;
    }
  }
  return failed;
}

/**
 * rules check over each firmware concept's scope (Decision 10), in a transaction of its own, so that its reads see
 * one state of the graph → { findings, rules, judged, first, more }. It reports and undoes nothing.
 */
async function rulesCheck(target) {
  const graph = require('../../graph');
  const X = require('../rules/_rules');
  try {
    return await graph.writeTransaction(async (tx) => {
      const read = (cypher, params) => tx.read(cypher, params);
      const rules = X.rulesNamed();
      const headers = target.nodes.filter((t) => t.role === 'conceptHeader').map((t) => t.address);
      const rows = await read(
        `UNWIND $uuids AS u
         MATCH (h:NostrEvent|TapestryNode {uuid: u})
         WHERE h:ConceptHeader OR h:ListHeader
         RETURN h.tapestryKey AS key, coalesce(h.tapestryValue, h.name) AS name`,
        { uuids: headers },
      );
      const seen = new Map();
      let judged = 0;
      for (const r of rows.filter((x) => typeof x.key === 'string').sort((a, b) => byText(a.key, b.key))) {
        const found = await X.findingsIn(read, { kind: 'concept', key: r.key, name: r.name || null }, rules);
        judged += found.judged;
        for (const f of found.findings) { const id = X.idOf(f.rule, f.finding); if (!seen.has(id)) seen.set(id, X.answerOf(f.rule, f.finding)); }
      }
      const all = [...seen.values()];
      return { findings: all.length, rules: rules.map((x) => x.name), judged, first: all.slice(0, RULES_SHOWN), more: all.length > RULES_SHOWN };
    });
  } catch (err) {
    return { findings: null, rules: [], judged: 0, first: [], more: false, problem: String((err && err.message) || err) };
  }
}

// ── status (Decision 12) ──
/** What seed-firmware last installed, from the installed-firmware graph, or null when there is none. */
async function seeded(read, ta) {
  if (!ta) return null;
  const rows = await read(
    `MATCH (n:NostrEvent|TapestryNode {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
     RETURN t.value AS json, n.installed AS installed`,
    { uuid: installedGraphAddress(ta) },
  );
  // Read through the LMDB when its json is offloaded, and only when it carries seed-firmware's mark (Amendment 3,
  // items 1 and 3).
  const ig = rows.length ? installedGraphOf(rows[0].installed, rows[0].json) : null;
  const j = ig && ig.json ? ig.json : null;
  const fw = j ? j.installedFirmware : null;
  if (!fw) return null;
  const references = new Set(Array.isArray(fw.references) ? fw.references : []);
  const listed = (isObject(j.graph) && Array.isArray(j.graph.nodes) ? j.graph.nodes : []).map((x) => x && x.slug).filter((x) => typeof x === 'string' && !references.has(x));
  const nodes = listed.length ? nodesOf(await read(
    `UNWIND $uuids AS u
     MATCH (n:NostrEvent|TapestryNode {uuid: u})
     WHERE NOT n:NostrEventTag
     OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
     RETURN ${NODE_FIELDS}`,
    { uuids: listed },
  )) : new Map();
  let changedSince = 0;
  for (const n of nodes.values()) if (n.record && contentOf(n).digest !== n.record.installed.digest) changedSince++;
  return {
    version: fw.version || null,
    at: fw.at || null,
    by: isObject(fw.by) ? fw.by : null,
    source: isObject(fw.source) ? { kind: fw.source.kind || null, digest: fw.source.digest || null, files: isObject(fw.source.files) ? Object.keys(fw.source.files).length : 0 } : null,
    nodes: Number.isInteger(fw.nodes) ? fw.nodes : listed.length,
    relationships: Number.isInteger(fw.relationships) ? fw.relationships : 0,
    changedSince,
  };
}

module.exports = {
  OPERATION, NOT_FIRMWARE, ADDRESS_HELD, INSTALLED_D,
  readState, plan, apply, refreshCache, rulesCheck, seeded, relationshipsAnswer,
  contentOf, partsDiffering, installedGraphAddress, isClaim, stable,
};
