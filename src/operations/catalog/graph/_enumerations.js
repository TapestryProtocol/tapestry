'use strict';
/**
 * What graph enumerate, graph unenumerate and the rule enumerated-value-allowed share (catalog §2, Properties and
 * schema; story graph-operations-first-slice #19; ADR graph-operations-first-slice/0019 and its Amendments 1 and 2).
 *
 * A link is one ENUMERATES from a source concept's superset to one of a concept's property nodes, carrying only its
 * type (Decision 1). The property's values are then the source's elements: each value is `tapestry:<tapestryKey>`,
 * naming one element of the source that counts from the owner's point of view (Decision 6). Nothing about the values
 * is kept, in the link, the property's piece or the schema node. The rule enumerated-value-allowed, the rulebook's rule
 * 10, asks the graph whenever an element write stores a value (Decision 7), so the values follow the source however it
 * changes, and whoever changes it (CLAUDE.md, principle 3).
 *
 *   REF, refOf(value)                   a value's form, and the tapestryKey it names, or null (Decision 6)
 *   holdsReference(piece)               'one' or 'list' for a piece that can hold a reference, else null (Decision 4)
 *   acceptsReference(piece)             whether the piece, compiled alone with rule 4's ajv options, accepts one, or a
 *                                       list of as many different ones as its minItems asks, at most 10,000
 *   sourceOf(read, key)                 the source, { concept, name, uuid, superset }, or a refusal (Decision 3)
 *   linksInto(read, property)           every ENUMERATES into a property: its start, and the start's concept
 *   enumeratedFieldsOf(read, concept)   rule 10's first read: the concept's enumerated properties, each chain's path
 *   judgeValues(read, pairs, pov)       rule 10's second read: which references are allowed, all in one UNWIND
 *   check(read, items, { fields, pov }) rule 10's findings for items { concept, json }, given its first read's fields
 *   allowedOf(read, superset, pov)      the elements a value may name, the first 50 by tapestryKey (Decision 9)
 *   valuesReport(read, concept, fields, pov)  the property's concept's elements, judged by rule 10 (Decision 9)
 *   the refusals' declarations (Amendment 1), their words (say), and SOURCE, ALLOWED, VALUES and LETTERS_ENUM
 *
 * Like the other _*.js modules, it opens nothing when it loads: firmware's relationship names, ajv, the config and the
 * assistant's key are required when first called. It never signs, publishes or reads a secret key.
 */

const { refusal } = require('../../refusal');
const R = require('../../reads');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_schemas');
const EL = require('./_elements');
const P = require('./_properties');

/** A value: tapestry: and a tapestryKey as the graph mints one, lowercase, in the UUID's 8-4-4-4-12 form (Decision 6). */
const REF = /^tapestry:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
/** The reference a piece must accept (Decision 4). Every reference is 45 characters long, as this one is. */
const SAMPLE = 'tapestry:00000000-0000-4000-8000-000000000000';
/** `n` references, each naming a different key, SAMPLE first: what a list piece is tried with (Amendment 2, item 1). */
const samples = (n) => Array.from({ length: n }, (_, i) => `tapestry:00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`);
/** The most elements the allowed list and the report name, and the most the report judges, as the property writes' report (Decision 9). */
const MAX_LISTED = P.MAX_LISTED;
const LIMIT = P.LIMIT;
/** How far the allowed list counts: one past the most the report judges, so 10,001 says "more than 10,000". */
const COUNTED = LIMIT + 1;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const count = (n) => Number(n).toLocaleString('en-US');
/** A value as a message shows it: as JSON, shortened past 80 characters. */
const show = (v) => { const s = JSON.stringify(v === undefined ? null : v); return s.length > 80 ? `${s.slice(0, 77)}…` : s; };

// ── the refusals (Decision 2; Amendment 1, item 1: each is 409, as the refusals of its kind are) ──
const D = (code, status, when) => Object.freeze({ code, status, when });
const NOT_ENUMERABLE = D('not-enumerable', 409, "A property that can't hold a reference: its type is neither string nor a list of types whose only one other than null is string, and it isn't a list (type array) whose items have such a type. graph update-property changes its type");
const REFUSES_REFERENCES = D('refuses-references', 409, "A property whose own schema would refuse every tapestry:<tapestryKey> value: its own enum or const, a pattern or a length a reference (45 characters) can't meet, or any other keyword that leaves no reference, such as a list's maxItems of 0 or a not, on the property or on a list's items; or a piece that doesn't compile on its own. A list is tried with as many different references as its minItems asks, and a minItems above 10,000, the most it tries, is refused. A format never refuses one. The refusal names each keyword that refuses, read from the check (one inside anyOf, oneOf, allOf, not or if by the outermost), and graph update-property, to take it out first");
const ENUMERATED_ELSEWHERE = D('enumerated-elsewhere', 409, 'A property already linked to another source: an ENUMERATES runs into it from another concept\'s superset, or from a set. A property has one source; the refusal names that start, its concept when it is a superset, and graph unenumerate, which takes the link out first');
const RESERVED_SOURCE = D('reserved-source', 409, 'A source keyed word or graphContext, whose class threads reach nearly every node');
const NO_SUPERSET = D('no-superset', 409, 'A source with no superset, or more than one, so no one class thread holds the elements a value may name');

// ── a value, and a piece that can hold one (Decisions 4 and 6) ──
/** The tapestryKey a value names, or null when it isn't a reference: a name, a slug, an address, a bare or an uppercase key. */
function refOf(value) {
  const m = typeof value === 'string' ? REF.exec(value) : null;
  return m ? m[1] : null;
}

/** Whether a type is string, or a list of types whose members other than null are string alone (Decision 4). */
function isStringType(t) {
  if (t === 'string') return true;
  if (!Array.isArray(t)) return false;
  const others = t.filter((x) => x !== 'null');
  return others.length > 0 && others.every((x) => x === 'string');
}

/** 'one' for a piece that holds one reference, 'list' for a list (type array) of them, null for one that can hold none (Decision 4). */
function holdsReference(piece) {
  if (!isObject(piece)) return null;
  if (isStringType(piece.type)) return 'one';
  if (piece.type === 'array' && isObject(piece.items) && isStringType(piece.items.type)) return 'list';
  return null;
}

/**
 * The keywords that refuse the sample, from ajv's errors on it (Amendment 2, item 2) → { own, items }, each named once,
 * in ajv's order. An error's keyword is the first of its schemaPath, or the second under #/items/, which is the items':
 * so a keyword inside anyOf, oneOf, allOf, not or if is named by the outermost, then and else are named as if, and
 * contains names itself.
 */
function refusingKeywords(errors) {
  const own = [];
  const items = [];
  for (const e of Array.isArray(errors) ? errors : []) {
    const path = String((e && e.schemaPath) || '').replace(/^[^#]*#/, '').split('/').filter(Boolean);
    const inItems = path[0] === 'items' && path.length > 1;
    let kw = inItems ? path[1] : path[0] || (e && e.keyword);
    if (typeof kw !== 'string' || !kw) continue;
    if (kw === 'then' || kw === 'else') kw = 'if';
    const to = inItems ? items : own;
    if (!to.includes(kw)) to.push(kw);
  }
  return { own, items };
}

/**
 * The piece tried with references (Decision 4; Amendment 2, items 1 and 2): compiled alone with rule 4's ajv options
 * (_schemas.js's validatorOf), which load no formats, so a format never refuses one (Amendment 1, item 2), and checked
 * against one reference, or for a list against max(1, minItems) different ones. → { accepts: true }, or { accepts:
 * false } with why: problem, when the piece doesn't compile alone; tooMany, a list's minItems above the LIMIT tried; or
 * own and items, the keywords that refuse what was tried, and tried, how many references that was.
 */
function tryReference(piece) {
  const v = X.validatorOf(piece);
  if (v.problem) return { accepts: false, problem: v.problem };
  const list = holdsReference(piece) === 'list';
  const tried = list && Number.isInteger(piece.minItems) && piece.minItems > 1 ? piece.minItems : 1;
  if (tried > LIMIT) return { accepts: false, tooMany: tried };
  const r = v.check(list ? samples(tried) : SAMPLE);
  return r.fits ? { accepts: true } : { accepts: false, tried, list, ...refusingKeywords(r.errors) };
}

/** Whether the piece accepts a reference, or for a list a list of as many different ones as its minItems asks (tryReference). */
function acceptsReference(piece) {
  return tryReference(piece).accepts === true;
}
const listed = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// ── the reads ──
const SUPERSETS = (INIT) => `MATCH (h:TapestryNode {tapestryKey: $key})-[:${INIT}]->(s:Superset)
  RETURN DISTINCT s.tapestryKey AS key`;
/** Every ENUMERATES into a node, with its start, and the concept whose header the start is the superset of. */
const LINKS_INTO = (ENUM, INIT) => `MATCH (p:TapestryNode {tapestryKey: $key})<-[:${ENUM}]-(s)
  OPTIONAL MATCH (s)<-[:${INIT}]-(h)
  WHERE h:ConceptHeader OR h:ListHeader
  RETURN s.tapestryKey AS start, s.uuid AS uuid, s.name AS name, labels(s) AS labels, h.tapestryKey AS concept`;
/**
 * Rule 10's first read (Decision 7): each ENUMERATES from a superset to a property that reaches the concept's primary
 * property by IS_A_PROPERTY_OF, and each link of the chains above it, a property and one of its parents, from which
 * enumeratedFieldsOf puts the chains back together. A parent that isn't a property node, such as a JSON schema node,
 * ends no chain, and an ENUMERATES that ends at a JSON schema node, as firmware install writes its own, is no property's.
 */
const FIELDS = (T) => `MATCH (h:TapestryNode {tapestryKey: $concept})<-[:${T.PRIMARY}]-(pp:Property)
  MATCH (sup:Superset)-[:${T.ENUM}]->(p:Property)-[:${T.MEMBER}*1..${P.MAX_DEPTH + 1}]->(pp)
  MATCH (p)-[:${T.MEMBER}*0..${P.MAX_DEPTH}]->(a:Property)-[:${T.MEMBER}]->(up)
  WHERE a <> pp
  OPTIONAL MATCH (sup)<-[:${T.INIT}]-(src)
  WHERE src:ConceptHeader OR src:ListHeader
  RETURN DISTINCT p.tapestryKey AS property, sup.tapestryKey AS superset, src.tapestryKey AS source, pp.tapestryKey AS root,
         a.tapestryKey AS node, a.name AS name, up.tapestryKey AS up`;
/**
 * Rule 10's second read (Decision 7): for each pair { key, superset }, whether the key names a node (not a change entry
 * or a tag), whether the superset's class thread reaches it, down through any sets below the superset to an element,
 * and whether it counts from the point of view, all in one UNWIND. `trust` is reads.js's fragment for n, carrying pair
 * and held.
 */
const JUDGE = (T, trust) => `UNWIND $pairs AS pair
  OPTIONAL MATCH (n:TapestryNode {tapestryKey: pair.key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  WITH pair, n, EXISTS { MATCH (:TapestryNode {tapestryKey: pair.superset})-[:${T.PROP}*0..]->()-[:${T.TERM}]->(n) } AS held
  ${trust}
  RETURN pair.key AS key, pair.superset AS superset, n.tapestryKey AS found, coalesce(n.tapestryValue, n.name) AS name,
         n.uuid AS address, held, counts`;
/** The elements the superset's class thread reaches that count from the point of view, as list-elements reads them. */
const ALLOWED_READ = (T, trust) => `MATCH (s:TapestryNode {tapestryKey: $superset})-[:${T.PROP}*0..]->()-[:${T.TERM}]->(e)
  WITH DISTINCT e
  WHERE e.tapestryKey IS NOT NULL AND e.tapestryKey <> '{}'
  ${trust}
  WHERE counts
  RETURN ${R.nodeColumns('e')}
  ORDER BY tapestryKey
  LIMIT ${COUNTED}`;
const NAMES = `MATCH (n:TapestryNode)
  WHERE n.tapestryKey IN $keys
  RETURN n.tapestryKey AS key, coalesce(n.tapestryValue, n.name) AS name`;

/**
 * The source a tapestryKey names (Decision 3) → { concept, name, uuid, superset }: a concept header, ConceptHeader or
 * ListHeader, by any author, firmware's included, with one superset. Refuses unknown-concept for a key that names no
 * node or one that isn't a header (for a superset or a set, naming the headers whose class threads reach it, the key
 * to pass), reserved-source for a header keyed word or graphContext, and no-superset.
 */
async function sourceOf(read, key) {
  const node = await S.nodeOf(read, key);
  const isHeader = !!node && (node.labels.includes('ConceptHeader') || node.labels.includes('ListHeader'));
  if (!isHeader) {
    const reaching = node && S.kindOf(node) !== 'other' ? await EL.conceptsReaching(read, key) : [];
    throw refusal(P.UNKNOWN_CONCEPT.code, say.unknownSource(key, node, reaching), { input: 'source' });
  }
  const [h] = await K.headersByKey(read, [key]);
  if (EL.RESERVED_KEYS.includes(h.oKey)) throw refusal(RESERVED_SOURCE.code, say.reservedSource(h), { input: 'source' });
  const { INIT } = K.rel();
  const supersets = [...new Set((await read(SUPERSETS(INIT), { key })).map((r) => r.key).filter((k) => typeof k === 'string'))].sort();
  if (supersets.length !== 1) throw refusal(NO_SUPERSET.code, say.noSuperset(h, supersets), { input: 'source' });
  return { concept: key, name: h.names.singular || null, uuid: h.uuid || null, superset: supersets[0] };
}

/**
 * Every ENUMERATES into the node keyed `property`, one for each start, by the start's tapestryKey → [{ start, uuid,
 * name, superset, set (whether the start is a superset, or a set), concept (the header of the concept it is the
 * superset of, or null) }]. Read whatever made the link: graph enumerate, today's route, or a set as its start.
 */
async function linksInto(read, property) {
  const { ENUM, INIT } = K.rel();
  const byStart = new Map();
  for (const r of await read(LINKS_INTO(ENUM, INIT), { key: property })) {
    if (typeof r.start !== 'string') continue;
    if (!byStart.has(r.start)) {
      const labels = Array.isArray(r.labels) ? r.labels : [];
      byStart.set(r.start, { start: r.start, uuid: typeof r.uuid === 'string' ? r.uuid : null, name: typeof r.name === 'string' ? r.name : null, superset: labels.includes('Superset'), set: labels.includes('Set') && !labels.includes('Superset'), concepts: new Set() });
    }
    if (typeof r.concept === 'string') byStart.get(r.start).concepts.add(r.concept);
  }
  return [...byStart.values()]
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .map(({ concepts, ...l }) => ({ ...l, concept: [...concepts].sort()[0] || null }));
}

/**
 * Rule 10's first read (Decision 7): the enumerated properties of the concept keyed `concept` → [{ property, path,
 * superset, source }], one for each chain: the property's key, the keys from the concept's section down to it, the
 * superset its ENUMERATES starts at, and that superset's concept header (null for none). A chain runs through property
 * nodes only, from the property to the concept's primary property; a property with more than one chain is judged at
 * each, and one linked from two supersets at each (Decision 7). A concept with none answers [] after this one read.
 */
async function enumeratedFieldsOf(read, concept) {
  const T = K.rel();
  const groups = new Map();
  for (const r of await read(FIELDS(T), { concept })) {
    if (![r.property, r.superset, r.root, r.node, r.up].every((x) => typeof x === 'string')) continue;
    const id = `${r.property} ${r.superset} ${r.root}`;
    if (!groups.has(id)) groups.set(id, { property: r.property, superset: r.superset, root: r.root, sources: new Set(), ups: new Map(), names: new Map() });
    const g = groups.get(id);
    if (typeof r.source === 'string') g.sources.add(r.source);
    if (!g.ups.has(r.node)) g.ups.set(r.node, new Set());
    g.ups.get(r.node).add(r.up);
    g.names.set(r.node, typeof r.name === 'string' ? r.name : '');
  }
  const out = [];
  for (const g of groups.values()) {
    const source = [...g.sources].sort()[0] || null;
    // Up from the property, one parent at a time; a parent that is no property of the read (a JSON schema node, as
    // Grok Bots' project has today) ends no chain, and a node already on the chain isn't walked again.
    const walk = (node, below, seen) => {
      for (const up of [...(g.ups.get(node) || [])].sort()) {
        const path = [g.names.get(node), ...below];
        if (up === g.root) out.push({ property: g.property, path, superset: g.superset, source });
        else if (g.ups.has(up) && !seen.has(up) && path.length < P.MAX_DEPTH) walk(up, path, new Set([...seen, up]));
      }
    };
    walk(g.property, [], new Set([g.property]));
  }
  const order = (f) => `${f.path.join('\u0000')}\u0001${f.superset}`;
  return out.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0));
}

/**
 * Rule 10's second read (Decision 7): each pair { key, superset } judged → Map('<key>|<superset>' → { found, name,
 * address, held, counts }): whether a node has the key, its name and address, whether the superset's class thread
 * reaches it, and whether it counts from the point of view `pov` (reads.js's trust test). No pairs, no read.
 */
async function judgeValues(read, pairs, pov) {
  const out = new Map();
  if (!pairs.length) return out;
  const T = K.rel();
  const rows = await read(JUDGE(T, R.trust('n', ['pair', 'held'])), { pairs, ...R.trustParams(pov) });
  for (const r of rows) {
    const id = `${r.key}|${r.superset}`;
    const now = { found: typeof r.found === 'string', name: typeof r.name === 'string' && r.name ? r.name : null, address: typeof r.address === 'string' && r.address ? r.address : null, held: r.held === true, counts: r.counts === true };
    const was = out.get(id);
    // A node read twice, as two NostrUser nodes for one author give it, counts when either row does.
    out.set(id, was ? { ...now, held: was.held || now.held, counts: was.counts || now.counts } : now);
  }
  return out;
}

/** The value at a path under the concept's key in an element's JSON, or undefined; only own keys are read. */
function valueAt(json, oKey, path) {
  let v = has(json, oKey) ? json[oKey] : undefined;
  for (const k of path) {
    if (!has(v, k)) return undefined;
    v = v[k];
  }
  return v;
}

/**
 * Rule 10's check (Decision 7) of items { concept, json }, given `fields`, Map(concept → its enumerated fields, the
 * first read's), and the point of view `pov`. For each field of each item, the values it holds: a list's each on its
 * own; a null, as the field's value or as an item of a list, and a field left out, not judged (Amendment 2, item 3), so
 * a finding's values hold no null. Every reference is judged in one read; then one finding for each field
 * of each item that holds a value the link doesn't allow → [{ item, concept, code, field, values, source, message }],
 * `item` the item itself, `field` its place under the concept's key (bot.team.lead), `values` those not allowed, and
 * `source` { concept, name, superset }.
 */
async function check(read, items, { fields, pov }) {
  const fieldsOf = (c) => (fields && typeof fields.get === 'function' && fields.get(c)) || [];
  const list = (Array.isArray(items) ? items : []).filter((i) => isObject(i) && typeof i.concept === 'string' && fieldsOf(i.concept).length);
  if (!list.length) return [];
  const concepts = [...new Set(list.map((i) => i.concept))];
  const sources = [...new Set(concepts.flatMap((c) => fieldsOf(c).map((f) => f.source)).filter((s) => typeof s === 'string'))];
  const headers = new Map((await K.headersByKey(read, [...new Set([...concepts, ...sources])])).map((h) => [h.key, h]));
  const held = [];
  const pairs = new Map();
  for (const item of list) {
    const h = headers.get(item.concept);
    if (!h || !h.oKey) continue;
    for (const field of fieldsOf(item.concept)) {
      const v = valueAt(item.json, h.oKey, field.path);
      if (v === undefined || v === null) continue;
      // A null is never judged, a list's item included: whether one may be there is rule 4's (Amendment 2, item 3).
      const values = Array.isArray(v) ? v.filter((x) => x !== null) : [v];
      if (!values.length) continue;
      held.push({ item, field, oKey: h.oKey, values });
      for (const x of values) {
        const key = refOf(x);
        if (key) pairs.set(`${key}|${field.superset}`, { key, superset: field.superset });
      }
    }
  }
  const judged = await judgeValues(read, [...pairs.values()], pov);
  const out = [];
  for (const { item, field, oKey, values } of held) {
    const src = field.source ? headers.get(field.source) || null : null;
    const name = src ? src.names.singular || null : null;
    const bad = [];
    const reasons = [];
    for (const x of values) {
      const key = refOf(x);
      const j = key ? judged.get(`${key}|${field.superset}`) : null;
      const why = !key ? say.notAReference(x)
        : !j || !j.found ? say.namesNoNode(x, key)
          : !j.held ? say.notHeld(x, j, name || field.superset)
            : !j.counts ? say.notCounted(x, j, name || field.superset) : null;
      if (why) { bad.push(x); reasons.push(why); }
    }
    if (!bad.length) continue;
    const place = P.placeOf(oKey, field.path);
    out.push({
      item,
      concept: item.concept,
      code: 'value-not-allowed',
      field: place,
      values: bad,
      source: { concept: field.source, name, superset: field.superset },
      message: say.notAllowed({ place, reasons, src, superset: field.superset }),
    });
  }
  return out;
}

/**
 * The elements a value may name (Decision 9): those the superset's class thread reaches that count from the point of
 * view, as graph list-elements lists a concept's by default → { count, elements: [{ node, name, address }], more }: the
 * first 50 by tapestryKey, and counted to 10,001.
 */
async function allowedOf(read, superset, pov) {
  const T = K.rel();
  const rows = await read(ALLOWED_READ(T, R.trust('e')), { superset, ...R.trustParams(pov) });
  const elements = rows.slice(0, MAX_LISTED).map((r) => {
    const n = R.nodeOf(r, pov.own);
    return { node: n.tapestryKey, name: n.name, address: n.address };
  });
  return { count: rows.length, elements, more: rows.length > MAX_LISTED };
}

/**
 * The report on the concept's elements (Decision 9), judged by rule 10's check from each element's JSON as
 * F.elementsOf gives it, the JSON the element writes check: everyone's elements, at most 10,000 of them (beyond says
 * when there are more), an element made since the last derive pass among them, named in tapestryKey order. `fields`
 * are the concept's enumerated fields, the rule's first read. → { judged, notAllowed: { count, elements: [{ node,
 * name, address, field, values }] }, limit, beyond }, one entry for each element and field, at most 50 named. It never
 * refuses (AC3).
 */
async function valuesReport(read, concept, fields, pov) {
  // The concept's key is only for the marks' copies, which the report doesn't read.
  const found = await F.elementsOf(read, { key: concept, oKey: null }, LIMIT + 1);
  const beyond = found.length > LIMIT;
  const list = found.slice(0, LIMIT).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const items = list.filter((e) => isObject(e.json)).map((e) => ({ concept, json: e.json, key: e.key, uuid: e.uuid }));
  const findings = await check(read, items, { fields: new Map([[concept, fields]]), pov });
  const named = findings.slice(0, MAX_LISTED);
  const names = new Map();
  const keys = [...new Set(named.map((f) => f.item.key))];
  if (keys.length) for (const r of await read(NAMES, { keys })) if (!names.has(r.key)) names.set(r.key, typeof r.name === 'string' && r.name ? r.name : null);
  return {
    judged: items.length,
    notAllowed: {
      count: findings.length,
      elements: named.map((f) => ({ node: f.item.key, name: names.get(f.item.key) || null, address: f.item.uuid || null, field: f.field, values: f.values })),
    },
    limit: LIMIT,
    beyond,
  };
}

// ── the words ──
const conceptOf = (h) => `${P.conceptLabel(h)}, whose tapestryKey is ${h.key}`;
const nodeLabel = (j) => (j.name ? `"${j.name}" (${j.address || 'no address'})` : (j.address || 'a node with no name'));
const say = {
  unknownProperty(key) {
    return refusal(P.UNKNOWN_PROPERTY.code, `No concept's property tree has a property with the tapestryKey ${key}: it names no node, a node that isn't a property, a concept's primary property (which isn't a field: a link ends at one of a concept's fields), or a property its concept's schema doesn't list, which bringing the concept's properties in line with its schema takes out. graph resolve turns a name into a key. Nothing changed.`, { input: 'property' });
  },
  notEnumerable(key, place, h, piece) {
    const t = isObject(piece) ? piece.type : undefined;
    const holds = t === 'array' ? `a list whose items ${isObject(piece.items) && piece.items.type !== undefined ? `have type ${show(piece.items.type)}` : 'have no type'}` : `type ${show(t)}`;
    return `The property ${key}, ${place} in ${P.conceptLabel(h)}, holds ${holds}, so it can't hold a reference, tapestry:<tapestryKey>. A field linked to another concept is a string, or a list of types whose only one other than null is string, or a list whose items are strings. Change its type first with graph update-property, or link another field. Nothing changed.`;
  },
  refusesReferences(key, place, h, piece) {
    // What refuses, read from the check itself (Amendment 2, item 2).
    const t = tryReference(piece);
    const head = `The property ${key}, ${place} in ${P.conceptLabel(h)},`;
    if (t.problem) return `${head} has a schema that doesn't compile on its own, as enumerate tries it with a reference (${t.problem}), so no reference can be checked against it. Change it first with graph update-property so that it compiles alone, then link it. Nothing changed.`;
    if (t.tooMany) return `${head} is a list whose minItems asks for at least ${count(t.tooMany)} references, and enumerate tries a list of at most ${count(LIMIT)} references, as many as its report judges, so it doesn't link one it can't try. Change it first with graph update-property, where '{"minItems": null}' takes minItems out, or give it a minItems of ${count(LIMIT)} or less, then link it. Nothing changed.`;
    const own = t.own || [];
    const items = t.items || [];
    const kw = [...own.map((k) => `its ${k}`), ...items.map((k) => `its items' ${k}`)];
    const what = kw.length ? `${listed(kw)} ${kw.length === 1 ? 'leaves' : 'leave'}` : 'its schema leaves';
    const tried = t.list ? `, in a list of ${t.tried === 1 ? 'one' : `${count(t.tried)} different ones, as its minItems asks`}` : '';
    // update-property's schema input takes out a keyword given as null, and replaces items whole.
    const how = [
      ...own.map((k) => `'{"${k}": null}' takes ${k} out`),
      ...(items.length ? [`'{"items": {"type": "string"}}' gives the items again without what they had`] : []),
    ];
    const fix = how.length ? `change it first with graph update-property, where ${listed(how)}` : 'change it first with graph update-property';
    return `${head} has a schema that would refuse every reference: ${what} no tapestry:<tapestryKey> value it allows${tried} (a reference is 45 characters: tapestry: and a lowercase tapestryKey). A link makes its values the source's elements instead, so ${fix}, then link it. Nothing changed.`;
  },
  enumeratedElsewhere(key, place, links, headers) {
    const l = links[0];
    const h = l.concept ? headers.get(l.concept) : null;
    const node = S.describe({ key: l.start, name: l.name });
    const start = l.superset && h ? `${node}, the superset of ${conceptOf(h)}`
      : l.superset ? `the superset ${node}`
        : `${node}, ${l.set ? 'a set' : 'a node that is neither a superset nor a set'}, where no link to a concept starts: such a link starts at the concept's superset`;
    const more = links.length > 1 ? `, and from ${links.length - 1} more start${links.length > 2 ? 's' : ''}` : '';
    return `The property ${key}, ${place}, is already linked to another source: an ENUMERATES runs into it from ${start}${more}. A property has one source. Take that link out first with graph unenumerate, then link it again. Nothing changed.`;
  },
  unknownSource(key, node, reaching) {
    if (!node) return `No node of this graph has the tapestryKey ${key}, which source names. Name the source concept by its header's tapestryKey: graph resolve turns a name into one. Nothing changed.`;
    if (reaching.length) {
      const kind = S.kindOf(node) === 'superset' ? 'a superset' : 'a set';
      return `${S.describe(node)}, which source names, is ${kind}, not a concept header. A source is a concept, named by its header: pass ${reaching.length === 1 ? 'the header of its concept' : 'the header of one of the concepts whose class threads reach it'}, ${reaching.map((c) => c.concept).join(' or ')}. Nothing changed.`;
    }
    return `${S.describe(node)}, which source names, isn't a concept header (a node labelled ConceptHeader, or ListHeader for one the nostr import brought in), so it has no elements for a value to name. Name the source concept by its header's tapestryKey. Nothing changed.`;
  },
  reservedSource(h) {
    return `${conceptOf(h)}, is keyed ${h.oKey}, whose class thread reaches nearly every node, so a value could name almost anything: it can't be a source. Link the property to a concept whose elements are the values it may hold. Nothing changed.`;
  },
  noSuperset(h, supersets) {
    return supersets.length
      ? `${conceptOf(h)}, has ${supersets.length} supersets (${supersets.join(', ')}), where a source has one: which class thread holds the elements a value may name isn't guessed. Nothing changed.`
      : `${conceptOf(h)}, has no superset, so no class thread holds elements for a value to name (BIBLE §10, rule 1). Nothing changed.`;
  },
  notAReference(x) {
    return `${show(x)} isn't a reference: a value is tapestry: and a node's tapestryKey, in lowercase, as the graph stores it`;
  },
  namesNoNode(x, key) {
    return `${show(x)} names no node: no node of this graph has the tapestryKey ${key} (a change entry or a tag isn't one)`;
  },
  notHeld(x, j, source) {
    return `${show(x)} names ${nodeLabel(j)}, which isn't an element of ${source}`;
  },
  notCounted(x, j, source) {
    return `${show(x)} names ${nodeLabel(j)}, an element of ${source} that doesn't count from the owner's point of view: its author isn't the instance's own, and the owner's web of trust doesn't score them above the verified cutoff`;
  },
  notAllowed({ place, reasons, src, superset }) {
    const values = reasons.length === 1 ? 'a value' : `${reasons.length} values`;
    const of = src ? conceptOf(src) : `the concept whose superset is ${superset}`;
    const lists = src ? `graph list-elements with concept ${src.key} lists the elements ${src.names.singular || 'it'} holds` : `graph list-elements with set ${superset} lists the elements it holds`;
    return `${place} holds ${values} its link doesn't allow: ${reasons.join('; ')}. Its link makes its values the elements of ${of}, from the owner's point of view, each given as tapestry:<tapestryKey>. graph resolve turns a name into its key, ${lists}, and graph create-element there adds one. Nothing changed.`;
  },
};

// ── the answers' shapes (Decision 10) ──
const NAMED = Object.freeze({
  type: 'object',
  required: ['node', 'name', 'address'],
  properties: {
    node: { type: 'string', description: "The element's tapestryKey: tapestry:<this> is the value that names it" },
    name: { type: 'string', nullable: true, description: 'Its name: its tapestryValue, else its name' },
    address: { type: 'string', nullable: true, description: 'Its nostr address, or null' },
  },
});
const SOURCE = Object.freeze({
  type: 'object',
  required: ['concept', 'name', 'superset'],
  description: "The source concept, whose elements the property's values name: its header's tapestryKey, its name, and the tapestryKey of its superset, where the ENUMERATES starts",
  properties: {
    concept: { type: 'string', description: "The tapestryKey of the source concept's header" },
    name: { type: 'string', nullable: true, description: 'Its name' },
    superset: { type: 'string', description: 'The tapestryKey of its superset, where the link starts' },
  },
});
const ALLOWED = Object.freeze({
  type: 'object',
  required: ['count', 'elements', 'more'],
  description: `The elements a value may name, as they are now: those the source's class thread reaches that count from the owner's point of view, as graph list-elements lists the source by default. The values follow the source, so an element added to it later is allowed then too`,
  properties: {
    count: { type: 'integer', minimum: 0, description: `How many, counted to ${count(COUNTED)}: ${count(COUNTED)} means more than ${count(LIMIT)}` },
    elements: { type: 'array', items: NAMED, description: `The first ${MAX_LISTED} by tapestryKey; graph list-elements on the source gives the rest` },
    more: { type: 'boolean', description: `Whether there are more than the ${MAX_LISTED} named` },
  },
});
const VALUES = Object.freeze({
  type: 'object',
  required: ['judged', 'notAllowed', 'limit', 'beyond'],
  description: "The property's concept's elements, everyone's, each judged by its JSON as the element writes judge it, by the rule enumerated-value-allowed over every enumerated field of the concept: those whose values a link doesn't allow, which a later write to them is refused for until each value is a reference. None of it stops the call",
  properties: {
    judged: { type: 'integer', minimum: 0, description: "How many elements were judged: those whose JSON could be read" },
    notAllowed: {
      type: 'object',
      required: ['count', 'elements'],
      description: `One entry for each element and field holding a value a link doesn't allow, at most ${MAX_LISTED} named`,
      properties: {
        count: { type: 'integer', minimum: 0 },
        elements: {
          type: 'array',
          items: {
            type: 'object',
            required: [...NAMED.required, 'field', 'values'],
            properties: {
              ...NAMED.properties,
              field: { type: 'string', description: "The field, by its place under the concept's key, such as bot.project" },
              values: { type: 'array', items: { description: 'A value, as the element holds it' }, description: 'The values it holds that the link doesn\'t allow' },
            },
          },
        },
      },
    },
    limit: { type: 'integer', description: `The most elements one call judges, ${count(LIMIT)}` },
    beyond: { type: 'boolean', description: "Whether the concept has more elements than that, which weren't judged" },
  },
});
const LETTERS_ENUM = Object.freeze({
  type: 'object',
  required: ['addresses', 'searched'],
  description: "The instance's own letters that still claim a link this call took out: the relationship events today's POST /api/normalize/enumerate signs. Nothing makes a link again from one; export nostr (A10.34) is what takes a letter back",
  properties: {
    addresses: { type: 'array', items: { type: 'string' }, description: "Each such letter's address" },
    searched: { type: 'string', description: 'What the search covered, in words' },
  },
});

/** What the letters' search covers (Decision 5), as _memberships.js's LETTERS says it. */
const SEARCHED = "The instance's own relationship events among the elements of its relationship concept, through its class thread, that name a removed link's start, the property and ENUMERATES. One signed since the last firmware reinstall, as today's POST /api/normalize/enumerate signs one, can be missing until a reinstall wires it into that concept";
const NOT_SEARCHED = 'Nothing: no link was taken out, so no letter was looked for';

module.exports = {
  REF, SAMPLE, MAX_LISTED, LIMIT, COUNTED,
  NOT_ENUMERABLE, REFUSES_REFERENCES, ENUMERATED_ELSEWHERE, RESERVED_SOURCE, NO_SUPERSET,
  SOURCE, ALLOWED, VALUES, LETTERS_ENUM, SEARCHED, NOT_SEARCHED,
  refOf, holdsReference, acceptsReference, sourceOf, linksInto, enumeratedFieldsOf, judgeValues, check, allowedOf, valuesReport,
  say,
};
