'use strict';
/**
 * word-types-hold-concept-keys: a node's wordTypes hold the key of each concept whose class thread reaches it, word and
 * graphContext aside (design D10: "edges are the authority on which concepts a node belongs to; the JSON's wordTypes
 * and coreMemberOf are computed from them"; story graph-operations-first-slice #47, ADR graph-operations-first-slice/0047
 * Decisions 1 to 4). Its entry in the rules document is docs/GRAPH_RULES.md, entry 12.
 *
 * It only reports. Its items are { node }, a tapestryKey. scan(read, scope) lists the items a check over a scope judges
 * (Decision 3); it never judges. violations(items, read) judges each node's JSON as the writes keep it: its json tag,
 * with the owner's sections kept beside it laid over, as the writes and the derive step read a node (Decision 2).
 *
 * It gives, for each node, one finding for each key the node lacks (Decision 4):
 *   { item, code: 'missing-concept-key', message, node, concepts: [the one concept], key, fix: null, choice }
 * and, for a node some concept other than word reaches whose JSON it can't read, one entry that isn't a finding:
 *   { item, unjudged: true, code: 'no-json' | 'unreadable-json', message }
 * which rules check counts in its answer's notJudged and doesn't name (Decision 5).
 *
 * Its reads go through `read` and nothing else, and it requires what it reads with only when violations() or scan() runs.
 */

const NAME = 'word-types-hold-concept-keys';

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x) => (typeof x === 'string' && x.length > 0 ? x : null);
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The nodes, each a node a rule judges: labelled TapestryNode, not a change entry, not a tag. */
const JUDGEABLE = (v) => `${v}:TapestryNode AND NOT ${v}:GraphChange AND NOT ${v}:NostrEventTag`;

// ── scan (Decision 3) ──
async function scan(read, scope) {
  const K = require('../catalog/graph/_concepts');
  const { INIT, PROP, TERM, SCHEMA, PRIMARY, PROPERTIES, TREE, CORE, GRAPH } = K.rel();
  const keysOf = (rows) => rows.map((r) => r.key).filter((k) => typeof k === 'string' && k);
  let keys = [];
  if (!isObject(scope) || scope.kind === 'graph') {
    keys = keysOf(await read(
      `MATCH (h)-[:${INIT}]->(:Superset)-[:${PROP}*0..]->()-[:${TERM}]->(e)
       WHERE (h:ConceptHeader OR h:ListHeader) AND ${JUDGEABLE('e')}
       RETURN DISTINCT e.tapestryKey AS key`,
      {},
    ));
  } else if (scope.kind === 'concept') {
    const params = { key: scope.key };
    keys = [
      // The header itself, an element of the concept of concept headers.
      ...keysOf(await read(`MATCH (h:TapestryNode {tapestryKey: $key}) WHERE ${JUDGEABLE('h')} RETURN h.tapestryKey AS key`, params)),
      // Its superset and the sets of its class thread.
      ...keysOf(await read(
        `MATCH (h:TapestryNode {tapestryKey: $key})-[:${INIT}]->(:Superset)-[:${PROP}*0..]->(s)
         WHERE ${JUDGEABLE('s')}
         RETURN DISTINCT s.tapestryKey AS key`,
        params,
      )),
      // The nodes its class thread reaches.
      ...keysOf(await read(
        `MATCH (h:TapestryNode {tapestryKey: $key})-[:${INIT}]->(:Superset)-[:${PROP}*0..]->()-[:${TERM}]->(e)
         WHERE ${JUDGEABLE('e')}
         RETURN DISTINCT e.tapestryKey AS key`,
        params,
      )),
      // Its other core nodes, each wired to the header.
      ...keysOf(await read(
        `MATCH (n)-[:${SCHEMA}|${PRIMARY}|${PROPERTIES}|${TREE}|${CORE}|${GRAPH}]->(h:TapestryNode {tapestryKey: $key})
         WHERE ${JUDGEABLE('n')}
         RETURN DISTINCT n.tapestryKey AS key`,
        params,
      )),
    ];
  } else if (scope.kind === 'node' && typeof scope.key === 'string' && scope.key) {
    keys = [scope.key];
  }
  return [...new Set(keys)].sort(byKey).map((node) => ({ node }));
}

// ── the nodes' JSON (Decision 2) ──
const NODES = (columns) => `UNWIND $keys AS key
  MATCH (n:TapestryNode {tapestryKey: key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
  WHERE t.type = 'json'
  RETURN key, ${columns}, n.tapestryOwnSections AS own, collect(DISTINCT t.value) AS json`;

/** A node's view (Decision 2) → { view } or { why: 'no-json' | 'unreadable-json', problem }. */
function viewOf(F, row) {
  const values = (Array.isArray(row.json) ? row.json : []).filter((v) => v !== null && v !== undefined);
  const hasOwn = row.own !== null && row.own !== undefined;
  if (!values.length && !hasOwn) return { why: 'no-json', problem: 'it has no json tag, and no sections kept beside it' };
  if (values.length > 1) return { why: 'unreadable-json', problem: `it has ${values.length} json tags that differ, and which one counts isn't guessed` };
  let base = {};
  if (values.length) {
    const got = F.readJson(values[0]);
    if (got.problem) return { why: 'unreadable-json', problem: got.problem };
    if (!isObject(got.json)) return { why: 'unreadable-json', problem: "its JSON isn't an object" };
    base = got.json;
  }
  if (!hasOwn) return { view: base };
  const own = F.ownSectionsOf(row.own);
  if (own.problem) return { why: 'unreadable-json', problem: own.problem };
  return { view: own.sections ? F.overlaySections(base, own.sections) : base };
}

/** The string entries of the view's word.wordTypes when it is a list, else none. */
function wordTypesOf(view) {
  const w = isObject(view) && isObject(view.word) ? view.word : null;
  return w && Array.isArray(w.wordTypes) ? w.wordTypes.filter((x) => typeof x === 'string') : [];
}

const WHY = "It only reports: no operation gives a node a key it lacks yet (ADR graph-operations-first-slice/0047).";
const WAY_ON = "A firmware reinstall gives firmware's own nodes their keys. For any other node a repair for this rule is still to come; graph add-to-concept adds a concept's key to one of the instance's own nodes when it gives the node the concept's section, or puts it in one of the concept's sets, and changes nothing for a node that already holds both.";

module.exports = {
  name: NAME,
  summary: "A node's wordTypes hold the key of each concept whose class thread reaches it (design D10), word and graphContext aside. It only reports.",
  refuses: false,
  refusals: [],
  scan,

  async violations(items, read) {
    const list = Array.isArray(items) ? items.filter((i) => isObject(i) && typeof i.node === 'string' && i.node) : [];
    const keys = [...new Set(list.map((i) => i.node))].sort(byKey);
    if (!keys.length) return [];
    // Required here, not at load: the rules' loader opens nothing.
    const F = require('../catalog/graph/_fields');
    const K = require('../catalog/graph/_concepts');
    const R = require('../reads');
    const { RESERVED_KEYS } = require('../catalog/graph/_elements');

    // 1. The concepts whose class thread reaches each node.
    const reaching = new Map();
    for (const r of await F.conceptsOfNodes(read, keys)) {
      if (!reaching.has(r.key)) reaching.set(r.key, []);
      if (!reaching.get(r.key).includes(r.concept)) reaching.get(r.key).push(r.concept);
    }
    const conceptKeys = [...new Set([...reaching.values()].flat())];
    if (!conceptKeys.length) return [];
    // 2. Their headers: each one's key (oKeys.singular), name and address. A reserved key, or one that can't be read, is
    // expected of no node.
    const headers = new Map((await K.headersByKey(read, conceptKeys)).map((h) => [h.key, h]));
    const expectedOf = (key) => (reaching.get(key) || [])
      .map((c) => headers.get(c))
      .filter((h) => h && typeof h.oKey === 'string' && h.oKey && !RESERVED_KEYS.includes(h.oKey))
      .sort((a, b) => byKey(a.key, b.key));
    const judged = keys.filter((k) => expectedOf(k).length);
    if (!judged.length) return [];
    // 3. Each node's JSON, all in one read.
    const rows = new Map((await read(NODES(R.nodeColumns('n')), { keys: judged })).filter((r) => typeof r.key === 'string').map((r) => [r.key, r]));
    const own = R.ownKeys();
    const ta = K.assistant();
    const conceptOf = (h) => ({ tapestryKey: h.key, name: text(h.name), address: text(h.uuid), own: !!ta && text(h.author) === ta, firmware: K.isFirmware(h.uuid) });
    const conceptName = (h) => (text(h.name) ? `"${h.name}"` : h.key);

    // 4. Judged.
    const out = [];
    for (const key of judged) {
      const row = rows.get(key);
      if (!row) continue;
      const item = list.find((i) => i.node === key);
      const node = R.nodeOf(row, own);
      const label = node.name ? `"${node.name}" (${key})` : key;
      const v = viewOf(F, row);
      if (v.why) {
        out.push({ item, unjudged: true, code: v.why, message: `${label} can't be judged: ${v.problem}` });
        continue;
      }
      const wt = wordTypesOf(v.view);
      for (const h of expectedOf(key)) {
        if (wt.includes(h.oKey)) continue;
        out.push({
          item,
          code: 'missing-concept-key',
          // No closing full stop, as rule 11's: rules repair goes on after a finding's message.
          message: `${label} is an element of ${conceptName(h)}, whose key ${h.oKey} its wordTypes, ${JSON.stringify(wt)}, lack: a node's wordTypes hold the key of each concept whose class thread reaches it (design D10)`,
          node,
          concepts: [conceptOf(h)],
          key: h.oKey,
          fix: null,
          choice: { why: WHY, wayOn: WAY_ON },
        });
      }
    }
    return out;
  },
};
