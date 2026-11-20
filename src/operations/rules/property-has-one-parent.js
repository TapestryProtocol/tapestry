'use strict';
/**
 * property-has-one-parent: every property node that hangs under anything hangs, by IS_A_PROPERTY_OF, under exactly one
 * node — a concept's primary property under its own concept's JSON schema node, every other property under a Property:
 * its concept's primary property at the top level, or its parent property when nested (BIBLE §6; story
 * graph-operations-first-slice #45, ADR graph-operations-first-slice/0045 Decision 1 and Amendment 1). Its entry in the
 * rules document is docs/GRAPH_RULES.md, entry 11.
 *
 * It only reports. Its items are { node }, a tapestryKey; an item that isn't a Property, or that hangs under nothing,
 * gives no finding (the story's open question 3). scan(read, scope) lists the items a check over a scope judges
 * (Decision 2); it never judges.
 *
 * Each finding is { item, code, message } plus what rules check answers (Decision 3): node, primary, concepts, parents,
 * and either fix (the links rules repair takes off) or choice ({ why, wayOn }). A fix is planned only for a property
 * under one parent in its one concept's tree that also hangs on that concept's own JSON schema node, and only when that
 * concept is the instance's own (its header's author is the instance's assistant), firmware's marked so (Amendment 1).
 *
 * Its reads go through `read` and nothing else, and it requires what it reads with only when violations() or scan() runs.
 */

const NAME = 'property-has-one-parent';
const MAX_DEPTH = 33;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x) => (typeof x === 'string' && x.length > 0 ? x : null);
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniq = (xs) => [...new Set(xs)];

function rels() {
  const K = require('../catalog/graph/_concepts');
  return K.rel();
}

// ── the reads, each over every item at once ──
const NODES = `UNWIND $keys AS key
  MATCH (p:Property {tapestryKey: key})
  WHERE NOT p:GraphChange
  RETURN key, coalesce(p.tapestryValue, p.name) AS name, p.uuid AS address, p.pubkey AS author`;
const PRIMARY_OF = (PRIMARY) => `UNWIND $keys AS key
  MATCH (p:TapestryNode {tapestryKey: key})-[:${PRIMARY}]->(h:TapestryNode)
  RETURN key, h.tapestryKey AS header`;
const PARENTS = (MEMBER) => `UNWIND $keys AS key
  MATCH (p:Property {tapestryKey: key})-[:${MEMBER}]->(up:TapestryNode)
  RETURN key, up.tapestryKey AS tapestryKey, coalesce(up.tapestryValue, up.name) AS name, up.uuid AS address, up.pubkey AS author, labels(up) AS labels`;
const SCHEMA_OF = (SCHEMA) => `UNWIND $keys AS key
  MATCH (s:TapestryNode {tapestryKey: key})-[:${SCHEMA}]->(h:TapestryNode)
  RETURN key, h.tapestryKey AS header`;
const TREES_OF = (MEMBER, PRIMARY) => `UNWIND $keys AS key
  MATCH (p:Property {tapestryKey: key})-[:${MEMBER}*1..${MAX_DEPTH}]->(pp:Property)-[:${PRIMARY}]->(h:TapestryNode)
  WHERE h:ConceptHeader OR h:ListHeader
  RETURN DISTINCT key, h.tapestryKey AS header`;
const HEADERS = `UNWIND $keys AS key
  MATCH (h:TapestryNode {tapestryKey: key})
  RETURN key, coalesce(h.tapestryValue, h.name) AS name, h.uuid AS address, h.pubkey AS author`;

/** rows → Map<key, [value]> of one column. */
function grouped(rows, col) {
  const out = new Map();
  for (const r of rows) {
    if (typeof r.key !== 'string' || typeof r[col] !== 'string') continue;
    if (!out.has(r.key)) out.set(r.key, []);
    if (!out.get(r.key).includes(r[col])) out.get(r.key).push(r[col]);
  }
  for (const v of out.values()) v.sort(byKey);
  return out;
}

// ── scan (Decision 2) ──
async function scan(read, scope) {
  const { MEMBER, PRIMARY, SCHEMA } = rels();
  const keysOf = (rows) => rows.map((r) => r.key).filter((k) => typeof k === 'string');
  let keys = [];
  if (!isObject(scope) || scope.kind === 'graph') {
    keys = keysOf(await read(`MATCH (p:Property)-[:${MEMBER}]->(x:TapestryNode) RETURN DISTINCT p.tapestryKey AS key`, {}));
  } else if (scope.kind === 'concept') {
    const params = { key: scope.key };
    keys = [
      ...keysOf(await read(`MATCH (pp:Property)-[:${PRIMARY}]->(h:TapestryNode {tapestryKey: $key}) RETURN DISTINCT pp.tapestryKey AS key`, params)),
      ...keysOf(await read(`MATCH (p:Property)-[:${MEMBER}*1..${MAX_DEPTH}]->(pp:Property)-[:${PRIMARY}]->(h:TapestryNode {tapestryKey: $key}) RETURN DISTINCT p.tapestryKey AS key`, params)),
      ...keysOf(await read(`MATCH (p:Property)-[:${MEMBER}]->(js:JSONSchema)-[:${SCHEMA}]->(h:TapestryNode {tapestryKey: $key}) RETURN DISTINCT p.tapestryKey AS key`, params)),
    ];
  } else if (scope.kind === 'node') {
    keys = keysOf(await read('MATCH (p:Property {tapestryKey: $key}) WHERE NOT p:GraphChange RETURN p.tapestryKey AS key', { key: scope.key }));
  }
  return uniq(keys).sort(byKey).map((node) => ({ node }));
}

// ── violations (Decision 1) ──
async function violations(items, read) {
  const keys = uniq((items || []).map((it) => (isObject(it) && typeof it.node === 'string' ? it.node : null)).filter(Boolean));
  if (!keys.length) return [];
  const { MEMBER, PRIMARY, SCHEMA } = rels();
  const R = require('../reads');
  const K = require('../catalog/graph/_concepts');
  const own = R.ownKeys();

  // V1: the nodes, whether each is a primary property, and its parents.
  const nodes = new Map((await read(NODES, { keys })).filter((r) => typeof r.key === 'string').map((r) => [r.key, r]));
  const primaryOf = grouped(await read(PRIMARY_OF(PRIMARY), { keys: [...nodes.keys()] }), 'header');
  const parentRows = await read(PARENTS(MEMBER), { keys: [...nodes.keys()] });
  const parentsOf = new Map();
  for (const r of parentRows) {
    if (typeof r.key !== 'string' || typeof r.tapestryKey !== 'string') continue;
    if (!parentsOf.has(r.key)) parentsOf.set(r.key, []);
    const list = parentsOf.get(r.key);
    if (!list.some((p) => p.tapestryKey === r.tapestryKey)) list.push({ ...r, labels: Array.isArray(r.labels) ? r.labels : [] });
  }

  // Judge each node's shape.
  const judged = [];
  for (const key of keys) {
    const n = nodes.get(key);
    if (!n) continue;
    const ups = (parentsOf.get(key) || []).sort((a, b) => byKey(a.tapestryKey, b.tapestryKey));
    if (!ups.length) continue;
    judged.push({ key, n, ups, primaryFor: primaryOf.get(key) || [] });
  }
  if (!judged.length) return [];

  // V2, for nodes that may break it: what each parent is, and whose trees hold the node and its property parents.
  const parentKeys = uniq(judged.flatMap((j) => j.ups.map((u) => u.tapestryKey)));
  const parentPrimary = grouped(await read(PRIMARY_OF(PRIMARY), { keys: parentKeys }), 'header');
  const parentSchema = grouped(await read(SCHEMA_OF(SCHEMA), { keys: parentKeys }), 'header');
  const propertyParents = parentKeys.filter((k) => judged.some((j) => j.ups.some((u) => u.tapestryKey === k && u.labels.includes('Property'))));
  const trees = grouped(await read(TREES_OF(MEMBER, PRIMARY), { keys: uniq([...judged.map((j) => j.key), ...propertyParents]) }), 'header');

  const findings0 = [];
  for (const j of judged) {
    const { key, ups, primaryFor } = j;
    const primary = primaryFor.length > 0;
    let code = null;
    if (primary) {
      const ownSchema = ups.length === 1 && ups[0].labels.includes('JSONSchema') && (parentSchema.get(ups[0].tapestryKey) || []).some((h) => primaryFor.includes(h));
      if (!ownSchema) code = 'primary-property-misplaced';
    } else if (ups.length > 1) code = 'more-than-one-parent';
    else if (!ups[0].labels.includes('Property')) code = 'parent-not-a-property';
    if (code) findings0.push({ ...j, primary, code, concepts: primary ? primaryFor : (trees.get(key) || []) });
  }
  if (!findings0.length) return [];

  // The headers the findings name, read once.
  const headerKeys = uniq(findings0.flatMap((f) => [...f.concepts, ...f.ups.flatMap((u) => [...(parentPrimary.get(u.tapestryKey) || []), ...(parentSchema.get(u.tapestryKey) || []), ...(trees.get(u.tapestryKey) || [])])]));
  const headers = new Map((await read(HEADERS, { keys: headerKeys })).filter((r) => typeof r.key === 'string').map((r) => [r.key, r]));
  const ta = K.assistant();
  const conceptOf = (h) => {
    const r = headers.get(h) || {};
    const address = text(r.address);
    return { tapestryKey: h, name: text(r.name), address, author: text(r.author), own: !!ta && text(r.author) === ta, firmware: K.isFirmware(address) };
  };
  const nameOfConcept = (h) => (conceptOf(h).name ? `"${conceptOf(h).name}"` : h);

  const out = [];
  for (const f of findings0) {
    const concepts = f.concepts.map(conceptOf);
    const mine = new Set(f.concepts);
    const parents = f.ups.map((u) => {
      const base = R.nodeOf({ tapestryKey: u.tapestryKey, name: u.name, address: u.address, author: u.author }, own);
      const pp = parentPrimary.get(u.tapestryKey) || [];
      const sc = parentSchema.get(u.tapestryKey) || [];
      let kind;
      let of;
      if (pp.length && u.labels.includes('Property')) { kind = 'primary-property'; of = pp; } else if (u.labels.includes('Property')) { kind = 'property'; of = trees.get(u.tapestryKey) || []; } else if (u.labels.includes('JSONSchema')) { kind = 'json-schema'; of = sc; } else { kind = 'other'; of = []; }
      const inMine = of.filter((h) => mine.has(h));
      return { ...base, kind, concept: inMine[0] || of[0] || null, ofItsConcept: inMine.length > 0, _of: of };
    });
    const node = R.nodeOf({ tapestryKey: f.key, name: f.n.name, address: f.n.address, author: f.n.author }, own);
    const label = `${concepts.length === 1 ? `${nameOfConcept(concepts[0].tapestryKey)}'s ` : ''}${f.primary ? 'primary property' : 'property'} ${node.name || f.key} (${f.key})`;
    const names = parents.map((p) => p.name || p.tapestryKey);
    const message = f.primary
      ? `${label} hangs under ${parents.length === 1 ? `${names[0]}, which isn't its own concept's JSON schema node` : `${parents.length} nodes, ${names.join(' and ')}`}, where a primary property hangs under its own concept's JSON schema node alone`
      : `${label} hangs under ${parents.length === 1 ? `${names[0]}, which isn't a property` : `${parents.length} nodes, ${names.join(' and ')}`}, where a property hangs under one: its concept's primary property, or its parent property`;

    let fix = null;
    let choice = null;
    if (f.code === 'more-than-one-parent' && f.concepts.length === 1) {
      const H = f.concepts[0];
      const tree = parents.filter((p) => p.kind === 'primary-property' || p.kind === 'property');
      const rest = parents.filter((p) => !tree.includes(p));
      const shapeFixable = tree.length === 1 && tree[0]._of.includes(H) && rest.length > 0 && rest.every((p) => p.kind === 'json-schema' && p._of.includes(H));
      if (shapeFixable) {
        const c = conceptOf(H);
        if (c.own) {
          fix = { concept: H, removes: rest.map((p) => ({ type: MEMBER, from: f.key, to: p.tapestryKey })), firmware: c.firmware };
        } else {
          choice = {
            why: `${nameOfConcept(H)}'s property tree is its author's claim (${c.author || 'unknown'}), not this instance's own: its header's author isn't the instance's assistant (design D4)`,
            wayOn: "rules repair changes only the instance's own concepts, and firmware's with firmwareOverride. The concept's author changes it, in their own letters.",
          };
        }
      }
    }
    if (!fix && !choice) choice = choiceFor(f, parents, concepts, nameOfConcept);
    out.push({
      item: { node: f.key }, code: f.code, message,
      node, primary: f.primary, concepts: concepts.map(({ tapestryKey, name, address, own: o, firmware }) => ({ tapestryKey, name, address, own: o, firmware })),
      parents: parents.map(({ _of, ...p }) => p), fix, choice,
    });
  }
  return out.sort((a, b) => byKey(a.node.tapestryKey, b.node.tapestryKey));
}

const NO_OPERATION_YET = "No operation takes one of its links out yet: the property writes, graph remove-property among them, refuse its concept (tangled-tree). A10.31's later repairs, or the owner, decide which link stays.";

/** Why a finding has no fix, and how to go on (Decision 3). */
function choiceFor(f, parents, concepts, nameOfConcept) {
  if (f.code === 'primary-property-misplaced') {
    return {
      why: `a primary property hangs under its own concept's JSON schema node alone, and this one hangs under ${parents.map((p) => p.name || p.tapestryKey).join(' and ')}`,
      wayOn: "POST /api/normalize/skeleton rebuilds a concept's missing core nodes; otherwise the owner decides. No operation takes out one of its links yet.",
    };
  }
  if (f.code === 'parent-not-a-property') {
    const p = parents[0];
    if (p.kind === 'json-schema') {
      return {
        why: `its only parent is ${p.name || p.tapestryKey}, a JSON schema node, so it is in no concept's property tree, as today's create-property hung a top-level property`,
        wayOn: "The concept's property writes give its field a node in its tree: graph add-property, or graph set-schema. Nothing takes this node out yet.",
      };
    }
    return {
      why: `its only parent is ${p.name || p.tapestryKey}, which is neither a property nor a JSON schema node`,
      wayOn: "No operation moves it yet: A10.31's later repairs, or the owner, decide.",
    };
  }
  if (concepts.length > 1) {
    return { why: `it hangs in the property trees of ${concepts.length} concepts (${concepts.map((c) => nameOfConcept(c.tapestryKey)).join(', ')}), where a property node is one concept's`, wayOn: NO_OPERATION_YET };
  }
  const tree = parents.filter((p) => p.kind === 'primary-property' || p.kind === 'property');
  const others = parents.filter((p) => p.kind === 'json-schema' && !p.ofItsConcept);
  if (others.length) {
    return {
      why: `besides its place in its tree, it hangs on ${others.map((p) => p.name || p.tapestryKey).join(' and ')}, another concept's JSON schema node, so which concept it is a field of isn't for the repair to guess`,
      wayOn: NO_OPERATION_YET,
    };
  }
  if (tree.length > 1) return { why: `it hangs under ${tree.length} properties of its concept's tree, where a property hangs under one`, wayOn: NO_OPERATION_YET };
  return { why: `it hangs under ${parents.length} nodes, and no one of them is plainly the extra one`, wayOn: NO_OPERATION_YET };
}

module.exports = {
  name: NAME,
  summary: 'Every property node that hangs under anything hangs under exactly one node: a primary property under its own concept\'s JSON schema node, every other property under a property.',
  refuses: false,
  refusals: [],
  violations,
  scan,
};
