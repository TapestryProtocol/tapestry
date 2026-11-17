'use strict';
/**
 * graph delete-node — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/26-delete-node.md (AC1–AC6, and AC7 over the fake; the
 *          live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0026-delete-node.md (Decisions 1–15, Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/26-delete-node.test-plan.md
 *
 * Stack-free: the real catalog, over graphs test/helpers/deleteNodeGraph.js seeds for test/helpers/graphFake.js (it
 * says what each graph holds), with the harness's spy on everything that signs or reads a key. RICH deletes rich, then
 * again, then reads history; MAIN deletes the other kinds of element; REF holds every refusal, so its graph must end as
 * it began; the cap, the locks, the write path's second try and a keyless instance each have runs of their own.
 *
 *   DN0  the fake graph runs U0, D1–D4 and D6 as the plan writes them, and its two new failures (it passes before the
 *        code exists: it holds the fake, and the code, to the plan's statements)
 *   DN1  rich goes with every relationship it had, in and out, and its tags with theirs; every node at the other end
 *        stays, and nothing else changes
 *   DN2  the answer: rich as it was, its concept, each relationship removed once, how many tags went, its letter and
 *        cached copy, the note, and the entry
 *   DN3  the entry records rich whole: labels, properties, concepts, relationships and tags, and the nodes at the other end
 *   DN4  the entry alone restores rich: rebuilt from it, the graph is as it was, but for internal ids
 *   DN5  graph history finds the entry by the node, and by each node at the other end
 *   DN6  the same call again is already-gone: nothing changes or is recorded, and it says when, by whom and how
 *   DN7  a deletion another operation recorded is a repeat too; a key that names no node, a change entry's, and one an
 *        entry names only as another end are unknown-node
 *   DN8  an element of two concepts leaves both; the owner's letter, a node with no author and an element of word alone
 *        are the instance's own to delete
 *   DN9  the cached copy stays in the store, and the entry keeps the JSON the store held; a missing entry is null
 *   DN10 a tag another node has too stays; the deleted node's HAS_TAG to it is a relationship removed
 *   DN11 a class-thread link from a node to itself is no node below it
 *   DN12 nothing is signed; an admin's delete is the admin's; the command deletes a node, as the command's
 *   DN13 it is listed with no guard, repeatKey [node], its input and every refusal, and has its /docs entry
 *   DN14 the change entry's descriptions cover a deleted node
 *   DN15 the catalog's §2 rows: delete-node as built, update-node's two new refusals
 *   DN16 each delete locks the node first, then its concepts' headers, before it deletes; a repeat locks the node alone
 *   DN17 a delete that waited while another transaction deleted the node answers already-gone, naming the other's entry
 *   DN18 the write path runs a write once more when its first attempt fails with EntityNotFound
 *   DN19 … once only: a second EntityNotFound answers 500, and nothing changes
 *   DN20 another write that waited for a node a delete removed answers unknown-node, never a 500
 *   DN21 a delete whose entry can't be recorded keeps nothing, and isn't tried again
 *   DN22 someone else's node is refused not-own-node
 *   DN23 a person node is refused person-node, naming the person's key
 *   DN24 a placeholder is refused placeholder-node, naming what it stands for
 *   DN25 a node another operation looks after is refused made-elsewhere, naming the operation that deletes it
 *   DN26 firmware's own element is refused firmware-node, naming its file
 *   DN27 a node no concept's class thread reaches is refused not-an-element, naming raw delete-node
 *   DN28 a node other nodes are elements through is refused holds-elements, naming how many and the first five
 *   DN29 more than 10,000 relationships is too-many-relationships, by the node's own or with its tags'; 10,000 goes
 *   DN30 with no assistant key it is refused not-installed, and nothing changes
 *   DN31 inputs are checked: missing, not a tapestryKey, unknown
 *   DN32 a visitor gets 401, a stranger 403, a text/plain body 415; the command's refusal is the route's
 *   DN33 the refusal run changed nothing and recorded nothing
 *   DN34 the new and changed modules require nothing that signs, publishes or reads a key
 *   (review round 1; ADR Amendment 3) DN16 reads which nodes each delete locked, from the fake's log, and adds an
 *        element of word alone; DN29 adds a node of 10,000 with a link to itself, which the first count counts twice;
 *        DN35 a node with two HAS_TAGs to one tag is deleted, the tag once; DN36 a relationship to a node with no
 *        tapestryKey stops the delete, naming lifecycle migrate; DN37 a relationship gone between the reads and the
 *        delete rolls the delete back; DN38 a relationship between the node and its own tag is listed once, from the
 *        tag, and recorded under it; DN39 data the store holds that isn't JSON is recorded as it was held
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const D = require('../../helpers/deleteNodeGraph');
const { readerOver, exec, fakeGraph } = require('../../helpers/graphFake');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { OTHER } = D;
const { test, run } = S.makeSuite('operations: graph delete-node');

const ROUTE = '/api/tapestry/graph/delete-node';
const UPDATE = '/api/tapestry/graph/update-node';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/delete-node.js');
const NOBODY = '00000000-0000-4000-8000-0000000000dd';
const CLASS_THREAD = ['IS_THE_CONCEPT_FOR', 'IS_A_SUPERSET_OF', 'HAS_ELEMENT'];

/** The statements the plan writes for delete-node (test plan, "Statements"); DN0 holds the fake graph to them. */
const ST = {
  U0: 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n',
  D1: 'MATCH (c:GraphChange) WHERE $key IN c.keys AND c.changes CONTAINS \'"change":"node-deleted"\' RETURN c.tapestryKey AS id, c.at AS at, c.byRole AS byRole, c.byPubkey AS byPubkey, c.operation AS operation, c.changes AS changes ORDER BY c.at DESC, c.tapestryKey DESC',
  D2: 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT x:GraphChange AND type(r) IN $types AND elementId(m) <> elementId(x) RETURN DISTINCT m.tapestryKey AS tapestryKey, coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address ORDER BY tapestryKey LIMIT 10001',
  D3out: 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT x:GraphChange RETURN count(r) AS n',
  D3in: 'MATCH (x:TapestryNode {tapestryKey: $key})<-[r]-(m) WHERE NOT x:GraphChange RETURN count(r) AS n',
  D4out: 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT x:GraphChange RETURN elementId(r) AS id, type(r) AS type, properties(r) AS properties, m.tapestryKey AS tapestryKey, coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address, m.pubkey AS author, labels(m) AS labels',
  D4in: 'MATCH (x:TapestryNode {tapestryKey: $key})<-[r]-(m) WHERE NOT x:GraphChange RETURN elementId(r) AS id, type(r) AS type, properties(r) AS properties, m.tapestryKey AS tapestryKey, coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address, m.pubkey AS author, labels(m) AS labels',
  D6tag: 'MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t',
  D6node: 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange DETACH DELETE n',
};

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/delete-node.js does not exist yet (ADR graph-operations-first-slice/0026 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const update = (id, body) => ({ id, method: 'POST', url: UPDATE, caller: 'owner', body });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, dir, k, seed }. `mutate(state, keys)` changes it first. */
async function fresh(seeder = D.seedDeleteNode, mutate = null) {
  const seed = await seeder();
  if (mutate) mutate(seed.state, seed.keys);
  const file = seed.file(tmp('delete-node-'));
  return { file, dir: path.dirname(file), k: seed.keys, seed };
}

// ── reading a state ──
const nodeByKey = (g, key) => g.nodes.find((n) => n.props.tapestryKey === key) || null;
const keyOfEid = (g, eid) => { const n = g.nodes.find((x) => x.eid === eid); return n ? n.props.tapestryKey : null; };
const entriesIn = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange'));
const sansEntries = (nodes) => nodes.filter((n) => !n.labels.includes('GraphChange'));
const tagsOf = (g, node) => g.rels.filter((r) => r.from === node.eid && r.type === 'HAS_TAG').map((r) => g.nodes.find((n) => n.eid === r.to));
/** What a delete of `key` must leave: the graph without the node and the tags only it has, and every relationship of theirs. */
function without(g, key) {
  const node = nodeByKey(g, key);
  const own = tagsOf(g, node).filter((t) => t.labels.includes('NostrEventTag') && !g.rels.some((r) => r.type === 'HAS_TAG' && r.to === t.eid && r.from !== node.eid));
  const gone = new Set([node.eid, ...own.map((t) => t.eid)]);
  return { nodes: g.nodes.filter((n) => !gone.has(n.eid)), rels: g.rels.filter((r) => !gone.has(r.from) && !gone.has(r.to)), own };
}
const sortKeys = (o) => Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
const same = (a, b) => show(sortKeys(a)) === show(sortKeys(b));
/** A graph as sets of lines, by tapestryKey, so two graphs compare without their internal ids. */
function canon(g) {
  return {
    nodes: sansEntries(g.nodes).map((n) => show([[...n.labels].sort(), sortKeys(n.props)])).sort(),
    rels: g.rels.map((r) => show([r.type, keyOfEid(g, r.from), keyOfEid(g, r.to), sortKeys(r.props)])).sort(),
  };
}
/** The transactions the fake logged, from `from` on: [{ end: 'commit' | 'rollback', error, steps }]. */
function transactions(log, from = 0) {
  const out = [];
  let cur = null;
  for (const l of log.slice(from)) {
    if (l.call === 'begin') cur = { steps: [] };
    else if ((l.call === 'commit' || l.call === 'rollback') && cur) { out.push({ ...cur, end: l.call, error: l.error || null }); cur = null; } else if (cur) cur.steps.push(l);
  }
  return out;
}
const err = (body) => String(body && body.error);
const changeOf = (d) => (d && d.change && Array.isArray(d.change.changes) ? d.change.changes.find((c) => c.change === 'node-deleted') : null) || null;

// ── RICH: rich deleted, then again, then history ──
let RICH = null;
function rich() {
  if (RICH) return RICH;
  RICH = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const { a } = runOn(file, [
      post('rich', 'owner', { node: k.rich }),
      post('rich-again', 'owner', { node: k.rich }),
      get('h-node', `/api/tapestry/graph/history?node=${k.rich}&limit=50`),
      get('h-superset', `/api/tapestry/graph/history?node=${k.beagleSuperset}&limit=200`),
      get('h-lucky', `/api/tapestry/graph/history?node=${k.lucky}&limit=50`),
      get('h-author', `/api/tapestry/graph/history?node=${k.taUser}&limit=50`),
      get('h-placeholder', `/api/tapestry/graph/history?node=${k.ePlaceholder}&limit=50`),
    ]);
    return { a, k, file, before, after: S.readState(file) };
  })();
  return RICH;
}
async function richOk(id) {
  needDecl();
  const x = (await rich()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body.data;
}

// ── MAIN: the other kinds of element ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, dir, k } = await fresh();
    D.storeEntries(dir, [[k.stored, D.STORED_JSON], [k.storedText, D.STORED_TEXT]]);
    const before = S.readState(file);
    const { a } = runOn(file, [
      post('max', 'owner', { node: k.walkerMax }),
      post('patch', 'owner', { node: k.patch }),
      post('ghosty', 'owner', { node: k.ghosty }),
      post('word', 'owner', { node: k.wordOnly }),
      post('stored', 'owner', { node: k.stored }),
      post('phantom', 'owner', { node: k.phantom }),
      post('share', 'owner', { node: k.shareTag }),
      post('self-held', 'owner', { node: k.selfHeld }),
      post('admin', 'admin', { node: k.gizmo }),
      post('gone', 'owner', { node: k.goneKey }),
      post('double', 'owner', { node: k.doubleTagged }),
      post('unkeyed', 'owner', { node: k.unkeyedLinked }),
      post('self-ref', 'owner', { node: k.selfRef }),
      post('stored-text', 'owner', { node: k.storedText }),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], { spy: true, cli: [{ id: 'cli', argv: ['graph', 'delete-node', '--node', k.handy] }] });
    return { a, k, file, dir, before, after: S.readState(file) };
  })();
  return MAIN;
}
async function ok(id) {
  needDecl();
  const x = (await main()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body.data;
}

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const luckyTag = tagsOf(before, nodeByKey(before, k.lucky))[0].props.tapestryKey;
    const { a } = runOn(file, [
      post('visitor', 'visitor', { node: k.lucky }),
      post('stranger', 'stranger', { node: k.lucky }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ node: k.lucky }) }),
      // whose node it is
      post('other', 'owner', { node: k.snowy }),
      post('admin-letter', 'owner', { node: k.ace }),
      post('drifter', 'owner', { node: k.drifter }),
      post('p-ta', 'owner', { node: k.taUser }),
      post('p-owner', 'owner', { node: k.ownerUser }),
      post('p-other', 'owner', { node: k.otherUser }),
      post('p-element', 'owner', { node: k.personElement }),
      post('ph-e', 'owner', { node: k.ePlaceholder }),
      post('ph-a', 'owner', { node: k.aPlaceholder }),
      post('ph-own', 'owner', { node: k.aOwnPlaceholder }),
      post('ph-b', 'owner', { node: k.bPlaceholder }),
      post('ph-element', 'owner', { node: k.elementPlaceholder }),
      // the node's kind
      post('me-header', 'owner', { node: k.beagle }),
      post('me-superset', 'owner', { node: k.beagleSuperset }),
      post('me-primary', 'owner', { node: k.beagleNodes.primaryProperty }),
      post('me-schema', 'owner', { node: k.beagleNodes.jsonSchema }),
      post('me-property', 'owner', { node: k.propertyNode }),
      post('me-set', 'owner', { node: k.walkers }),
      post('me-set-label', 'owner', { node: k.showBeagles }),
      post('me-rule', 'owner', { node: k.ruleElement }),
      post('fw-rover', 'owner', { node: k.firmwareRover }),
      post('ne-tag', 'owner', { node: luckyTag }),
      post('ne-loner', 'owner', { node: k.loner }),
      post('holder', 'owner', { node: k.holder }),
      post('holder7', 'owner', { node: k.holder7 }),
      // what names no node
      post('un-nobody', 'owner', { node: NOBODY }),
      post('un-entry', 'owner', { node: k.G }),
      post('un-neighbor', 'owner', { node: k.neighborKey }),
      // the inputs
      post('in-missing', 'owner', {}),
      post('in-pattern', 'owner', { node: 'lucky' }),
      post('in-unknown', 'owner', { node: k.lucky, force: true }),
    ], { spy: true, cli: [{ id: 'cli-refused', argv: ['graph', 'delete-node', '--node', k.snowy] }] });
    return { a, k, file, before, luckyTag };
  })();
  return REF;
}
async function refused(id, status, code) {
  needDecl();
  const x = (await ref()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}

// ── DN0: the fake graph and the plan's statements ──
test('DN0: the fake graph runs U0, D1–D4 and D6 as the plan writes them, and fails a first statement as Neo4j would', async () => {
  const seed = await D.seedDeleteNode();
  const g = seed.state;
  const k = seed.keys;
  const read = readerOver(g);
  const u0 = await read(ST.U0, { key: k.rich });
  assert(u0.length === 1 && u0[0].n.tapestryKey === k.rich && u0[0].n._labels.includes('NostrEvent'), `U0 reads a node whole, labels and all; got ${show(u0).slice(0, 300)}`);
  const d1 = await read(ST.D1, { key: k.goneKey });
  assert(d1.length === 1 && d1[0].id === k.goneEntry && d1[0].operation === 'graph merge-nodes' && typeof d1[0].changes === 'string', `D1 finds the entry whose changes record a node-deleted naming the key; got ${show(d1).slice(0, 300)}`);
  assert((await read(ST.D1, { key: k.rich })).length === 0, 'D1 finds nothing for a node no entry has deleted');
  const d2 = await read(ST.D2, { key: k.holder7, types: CLASS_THREAD });
  assert(d2.length === 7 && show(d2.map((x) => x.tapestryKey)) === show([...k.below].sort()), `D2 reads the nodes below holder7, by tapestryKey; got ${show(d2.map((x) => x.tapestryKey))}`);
  assert((await read(ST.D2, { key: k.selfHeld, types: CLASS_THREAD })).length === 0 && (await read(ST.D2, { key: k.rich, types: CLASS_THREAD })).length === 0, 'D2 leaves a link to itself out, and finds none below rich');
  const [o] = await read(ST.D3out, { key: k.rich });
  const [i] = await read(ST.D3in, { key: k.rich });
  assert(o.n === 8 && i.n === 5, `D3 counts rich's relationships out (6 HAS_TAG, CITES, RELATED_TO) and in (HAS_ELEMENT, AUTHORS, DEPENDS_ON, REFERENCES, RELATED_TO): 8 and 5; got ${o.n} and ${i.n}`);
  const out = await read(ST.D4out, { key: k.rich });
  const inn = await read(ST.D4in, { key: k.rich });
  const cites = out.find((x) => x.type === 'CITES');
  assert(out.length === 8 && inn.length === 5 && cites && cites.tapestryKey === k.lucky && same(cites.properties, { note: 'see also', weight: 2 }), `D4 reads each relationship with its properties and its other end; got ${show(cites)}`);
  const loopOut = out.find((x) => x.type === 'RELATED_TO');
  const loopIn = inn.find((x) => x.type === 'RELATED_TO');
  assert(loopOut && loopIn && loopOut.id === loopIn.id, 'D4 reads a link to itself out and in, with one elementId, so the code reads it once');
  const tagIn = await read(ST.D4in, { key: k.richTags.a });
  assert(tagIn.length === 1 && tagIn[0].type === 'HAS_TAG' && tagIn[0].tapestryKey === k.rich, `D4 over a tag reads its HAS_TAG from the node; got ${show(tagIn)}`);
  const copy = JSON.parse(JSON.stringify(g));
  const t = exec(copy, ST.D6tag, { key: k.richTags.a }, { write: true }).counters;
  const n = exec(copy, ST.D6node, { key: k.rich }, { write: true }).counters;
  assert(t.nodesDeleted === 1 && t.relationshipsDeleted === 2 && n.nodesDeleted === 1, `D6 deletes a tag with its two relationships, then the node; got ${show({ t, n })}`);
  const entryKept = exec(copy, ST.D6node, { key: k.goneEntry }, { write: true }).counters;
  assert(entryKept.nodesDeleted === 0 && nodeByKey(copy, k.goneEntry), 'D6 never deletes a change entry');
  // the two failures
  const file = seed.file(tmp('delete-node-fake-'));
  const st = S.readState(file);
  st.failures = { entityNotFound: 1 };
  fs.writeFileSync(file, JSON.stringify(st));
  const fake = fakeGraph(file);
  let first = null;
  try { await fake.writeTransaction(async (tx) => tx.run('UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props RETURN count(n) AS n', { rows: [] })); } catch (e) { first = e; }
  assert(first && first.code === 'Neo.ClientError.Statement.EntityNotFound', `failures.entityNotFound fails the first statement as Neo4j does; got ${show(first && { code: first.code, message: first.message })}`);
  await fake.writeTransaction(async (tx) => tx.run('UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props RETURN count(n) AS n', { rows: [] }));
  const st2 = S.readState(file);
  st2.failures = { vanish: { key: k.rich, add: [{ labels: ['TapestryNode'], props: { tapestryKey: NOBODY, name: 'added' } }] } };
  fs.writeFileSync(file, JSON.stringify(st2));
  let second = null;
  try { await fake.writeTransaction(async (tx) => tx.read(ST.U0, { key: k.rich })); } catch (e) { second = e; }
  const st3 = S.readState(file);
  assert(second && second.code === 'Neo.ClientError.Statement.EntityNotFound' && !nodeByKey(st3, k.rich) && !nodeByKey(st3, k.richTags.json) && nodeByKey(st3, NOBODY) && !st3.failures.vanish,
    'failures.vanish deletes the node and its tags, adds what it is given, and fails the first statement');
});

// ── AC1: an element, deleted ──
test('DN1: rich goes with every relationship it had, in and out, and its tags with theirs; every node at the other end stays, and nothing else changes', async () => {
  const d = await richOk('rich');
  assert(d.outcome === 'deleted', `outcome deleted; got ${show(d.outcome)}`);
  const { k, before, after } = await rich();
  assert(!nodeByKey(after, k.rich), 'rich is gone');
  for (const [type, key] of Object.entries(k.richTags)) assert(!nodeByKey(after, key), `its ${type} tag is gone`);
  const want = without(before, k.rich);
  assert(show(sansEntries(after.nodes)) === show(sansEntries(want.nodes)), 'every other node is as it was: nothing else is deleted or changed (AC1)');
  assert(show(after.rels) === show(want.rels), 'and every other relationship is as it was: only rich\'s, and its tags\', are gone');
  for (const name of ['lucky', 'gizmo', 'taUser', 'ePlaceholder', 'aPlaceholder', 'citer', 'citerETag', 'beagleSuperset']) assert(nodeByKey(after, k[name]), `${name}, at the other end of one of its relationships, stays`);
});

test('DN2: the answer gives rich as it was, its concept, each relationship removed once, how many tags went, its letter and cached copy, and its entry', async () => {
  const d = await richOk('rich');
  const { k, before } = await rich();
  const r0 = nodeByKey(before, k.rich);
  const header = nodeByKey(before, k.beagle);
  const node = d.node || {};
  assert(node.tapestryKey === k.rich && node.name === 'Rich' && node.address === r0.props.uuid && node.author === TA && node.own === true && node.hasLetter === true,
    `node: the read conventions' five facts and hasLetter, as it was (Decision 11); got ${show(node)}`);
  assert(Array.isArray(d.concepts) && d.concepts.length === 1 && same(d.concepts[0], { concept: k.beagle, name: header.props.name, address: header.props.uuid }),
    `concepts: { concept, name, address } for beagle; got ${show(d.concepts)}`);
  const rels = Array.isArray(d.relationships) ? d.relationships : [];
  const find = (type, direction, other, tag = null) => rels.filter((r) => r.type === type && r.direction === direction && r.node && r.node.tapestryKey === other && ((r.tag && r.tag.key) || null) === tag);
  const want = [
    ['HAS_ELEMENT', 'in', k.beagleSuperset, null], ['AUTHORS', 'in', k.taUser, null], ['CITES', 'out', k.lucky, null], ['DEPENDS_ON', 'in', k.gizmo, null],
    ['RELATED_TO', 'out', k.rich, null], ['REFERENCES', 'in', k.citerETag, null],
    ['REFERENCES', 'out', k.aPlaceholder, k.richTags.a], ['REFERENCES', 'out', k.ePlaceholder, k.richTags.e],
  ];
  for (const [type, direction, other, tag] of want) {
    const hits = find(type, direction, other, tag);
    assert(hits.length === 1, `${type} ${direction} ${other}${tag ? ` through its tag ${tag}` : ''} is listed once; got ${hits.length} of ${show(rels).slice(0, 800)}`);
  }
  assert(rels.length === want.length, `each relationship removed is listed once, and its HAS_TAGs to its own tags aren't (Decision 9); got ${rels.length}: ${show(rels.map((r) => `${r.type} ${r.direction}`))}`);
  const cites = find('CITES', 'out', k.lucky)[0];
  assert(cites.from === k.rich && cites.to === k.lucky && same(cites.properties, { note: 'see also', weight: 2 }) && cites.tag === null && cites.node.name === 'Lucky',
    `a relationship is C5's shape: type, direction, from, to, the other end's facts, its properties, and tag null for the node's own; got ${show(cites)}`);
  const a = find('REFERENCES', 'out', k.aPlaceholder, k.richTags.a)[0];
  assert(a.from === k.richTags.a && a.to === k.aPlaceholder && a.tag.type === 'a', `one of its tags' relationships runs from the tag, and names it: { key, type }; got ${show(a)}`);
  assert(d.tags === 6, `tags: the six that went with it; got ${show(d.tags)}`);
  assert(d.letterRemains === true && d.cacheRemains === true && d.deletion === null, `letterRemains, cacheRemains, and deletion null for deleted; got ${show({ l: d.letterRemains, c: d.cacheRemains, del: d.deletion })}`);
  const note = String(d.note || '');
  assert(/sign|sent/i.test(note) && /export retract/.test(note) && /A10\.34/.test(note) && /cache rebuild/.test(note) && /A10\.36/.test(note) && /new node/i.test(note) && /history/.test(note),
    `the note: nothing signed or sent, the letter stays (export retract, A10.34), an import makes a new node, the cached copy stays (cache rebuild, A10.36), and history keeps the node (Decision 11); got ${show(note)}`);
  assert(d.change && d.change.operation === 'graph delete-node' && same(d.change.by, { role: 'owner', pubkey: OWNER }) && d.change.changes.length === 1 && changeOf(d),
    `its entry: one node-deleted change, the owner's; got ${show(d.change).slice(0, 400)}`);
});

// ── AC6: the entry ──
test('DN3: the entry records rich whole: labels, properties, concepts, relationships and tags, and the nodes at the other end', async () => {
  const d = await richOk('rich');
  const { k, before } = await rich();
  const c = changeOf(d);
  const r0 = nodeByKey(before, k.rich);
  assert(c.node === k.rich && c.was && typeof c.was === 'object', `node-deleted names the node and holds was; got ${show(c).slice(0, 300)}`);
  const w = c.was;
  assert(show(w.labels) === show([...r0.labels].sort()), `was.labels: its labels, sorted; got ${show(w.labels)}`);
  assert(show(Object.keys(w.properties)) === show(Object.keys(r0.props).sort()) && same(w.properties, r0.props), `was.properties: every property, keys sorted, its copy and its stamp among them; got ${show(w.properties)}`);
  assert(show(w.concepts) === show(d.concepts), 'was.concepts: as the answer gives them');
  const own = [
    ['HAS_ELEMENT', 'in', k.beagleSuperset], ['AUTHORS', 'in', k.taUser], ['CITES', 'out', k.lucky], ['DEPENDS_ON', 'in', k.gizmo],
    ['RELATED_TO', 'out', k.rich], ['REFERENCES', 'in', k.citerETag],
  ];
  for (const [type, direction, other] of own) {
    const hits = w.relationships.filter((r) => r.type === type && r.direction === direction && r.other === other);
    assert(hits.length === 1, `was.relationships has ${type} ${direction} ${other} once; got ${show(w.relationships)}`);
  }
  assert(w.relationships.length === own.length && w.relationships.every((r) => show(Object.keys(r).sort()) === show(['direction', 'other', 'properties', 'type'])),
    `was.relationships: { type, direction, other, properties } for the node's own, not its tags' or its HAS_TAGs; got ${show(w.relationships)}`);
  assert(same(w.relationships.find((r) => r.type === 'CITES').properties, { note: 'see also', weight: 2 }), 'with their properties');
  assert(Array.isArray(w.tags) && w.tags.length === 6, `was.tags: its six tags; got ${show(w.tags).slice(0, 300)}`);
  const tagNode = (key) => nodeByKey(before, key);
  for (const [type, key] of Object.entries(k.richTags)) {
    const t = w.tags.find((x) => x.properties && x.properties.tapestryKey === key);
    assert(t && same(t.properties, tagNode(key).props) && show([...t.labels].sort()) === show([...tagNode(key).labels].sort()) && Array.isArray(t.relationships), `its ${type} tag, whole: labels and properties; got ${show(t)}`);
    assert(!t.relationships.some((r) => r.type === 'HAS_TAG'), `its ${type} tag's HAS_TAG from rich isn't among its relationships (Decision 9)`);
  }
  const aTag = w.tags.find((x) => x.properties.tapestryKey === k.richTags.a);
  assert(aTag.relationships.length === 1 && same(aTag.relationships[0], { type: 'REFERENCES', direction: 'out', other: k.aPlaceholder, properties: {} }), `the a tag's REFERENCES to the placeholder; got ${show(aTag.relationships)}`);
  const nodes = [k.beagleSuperset, k.taUser, k.lucky, k.gizmo, k.citerETag, k.aPlaceholder, k.ePlaceholder].sort();
  assert(show(c.nodes) === show(nodes), `nodes: the other ends, sorted, without rich or its tags (Decision 12); got ${show(c.nodes)}`);
});

test('DN4: the entry alone restores rich: rebuilt from it, the graph is as it was before the delete, but for internal ids', async () => {
  const d = await richOk('rich');
  const { before, after, k } = await rich();
  const w = changeOf(d).was;
  const g = JSON.parse(JSON.stringify({ nodes: after.nodes, rels: after.rels }));
  let next = Math.max(0, ...g.nodes.map((n) => n.eid), ...g.rels.map((r) => r.eid)) + 1;
  const node = { eid: next++, labels: [...w.labels], props: { ...w.properties } };
  g.nodes.push(node);
  const tags = w.tags.map((t) => {
    const tn = { eid: next++, labels: [...t.labels], props: { ...t.properties } };
    g.nodes.push(tn);
    g.rels.push({ eid: next++, type: 'HAS_TAG', from: node.eid, to: tn.eid, props: {} });
    return tn;
  });
  const put = (from, r) => {
    const other = nodeByKey(g, r.other);
    assert(other, `the entry names ${r.other} at the other end, which is in the graph`);
    const [x, y] = r.direction === 'out' ? [from, other] : [other, from];
    g.rels.push({ eid: next++, type: r.type, from: x.eid, to: y.eid, props: { ...r.properties } });
  };
  for (const r of w.relationships) put(node, r);
  w.tags.forEach((t, i) => { for (const r of t.relationships) put(tags[i], r); });
  const a = canon(before);
  const b = canon(g);
  assert(show(a.nodes) === show(b.nodes), `the nodes are as they were (AC6); differing: ${show(a.nodes.filter((x) => !b.nodes.includes(x)).concat(b.nodes.filter((x) => !a.nodes.includes(x)))).slice(0, 600)}`);
  assert(show(a.rels) === show(b.rels), `and so are the relationships; differing: ${show(a.rels.filter((x) => !b.rels.includes(x)).concat(b.rels.filter((x) => !a.rels.includes(x)))).slice(0, 600)}`);
  void k;
});

test('DN5: graph history finds the entry by the node, and by each node at the other end: its superset, lucky, its author and a placeholder its tag named', async () => {
  const d = await richOk('rich');
  const { a } = await rich();
  for (const id of ['h-node', 'h-superset', 'h-lucky', 'h-author', 'h-placeholder']) {
    const x = a.req(id);
    const ids = x.status === 200 ? x.body.data.entries.map((e) => e.id) : [];
    assert(ids.includes(d.change.id), `${id}: history finds the delete's entry (AC1); got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
});

// ── AC2: a repeat ──
test('DN6: the same call again is already-gone: nothing changes or is recorded, and it says when, by whom and through which operation the node went', async () => {
  const d = await richOk('rich');
  const g = await richOk('rich-again');
  const { before, after } = await rich();
  assert(g.outcome === 'already-gone' && g.change === null, `already-gone, recording nothing (Decision 3); got ${show(g).slice(0, 400)}`);
  assert(g.deletion && g.deletion.id === d.change.id && g.deletion.at === d.change.at && same(g.deletion.by, d.change.by) && g.deletion.operation === 'graph delete-node',
    `deletion: the first delete's entry, { id, at, by, operation }; got ${show(g.deletion)}`);
  assert(same(g.node, d.node) && show(g.concepts) === show(d.concepts), `the node and its concepts as the entry recorded them; got ${show({ node: g.node, concepts: g.concepts })}`);
  assert(Array.isArray(g.relationships) && g.relationships.length === 0 && g.tags === 0, `this call removed nothing; got ${show({ r: g.relationships, t: g.tags })}`);
  assert(entriesIn(after).length === entriesIn(before).length + 1, `one entry in all, the first delete's; ${entriesIn(before).length} before, ${entriesIn(after).length} after`);
  assert(/deleted|went|gone/i.test(String(g.note)) && String(g.note).includes(d.change.at), `the note says when it was deleted; got ${show(g.note)}`);
});

test('DN7: a deletion another operation recorded is a repeat too; a key that names no node, a change entry\'s, and one an entry names only as another end are unknown-node', async () => {
  const g = await ok('gone');
  const { k } = await main();
  assert(g.outcome === 'already-gone' && g.change === null && g.deletion && g.deletion.id === k.goneEntry && g.deletion.operation === 'graph merge-nodes' && g.deletion.at === D.GONE_AT && same(g.deletion.by, { role: 'admin', pubkey: ADMIN }),
    `a node-deleted change recorded by graph merge-nodes is a repeat (Decision 3); got ${show(g).slice(0, 500)}`);
  assert(g.node && g.node.tapestryKey === k.goneKey && g.node.name === 'Gone' && g.node.address === k.goneUuid, `its node, as that entry recorded it; got ${show(g.node)}`);
  for (const id of ['un-nobody', 'un-entry', 'un-neighbor']) {
    const body = await refused(id, 404, 'unknown-node');
    assert(body.input === 'node' && /entry|record/i.test(err(body)), `${id}: unknown-node, naming the input, and saying no entry records its deletion; got ${show(body)}`);
  }
});

test('DN8: an element of two concepts leaves both; the owner\'s letter, a node with no author and an element of word alone are the instance\'s own to delete', async () => {
  const { k, before, after } = await main();
  const max = await ok('max');
  assert(max.outcome === 'deleted' && show((max.concepts || []).map((c) => c.concept)) === show([k.dog, k.pet].sort()), `walkerMax, of dog and pet through walkers: both concepts, by tapestryKey; got ${show(max.concepts)}`);
  assert(!nodeByKey(after, k.walkerMax) && nodeByKey(after, k.walkers), 'walkerMax is gone, and walkers stays');
  const patch = await ok('patch');
  assert(patch.outcome === 'deleted' && patch.node.author === OWNER && patch.node.hasLetter === true && patch.letterRemains === true, `the owner's letter is the instance's own: deleted, its letter remaining; got ${show(patch).slice(0, 300)}`);
  const ghosty = await ok('ghosty');
  assert(ghosty.outcome === 'deleted' && ghosty.node.author === null && ghosty.node.own === true && ghosty.node.hasLetter === false && ghosty.letterRemains === false && ghosty.cacheRemains === false,
    `a node made here with no author: deleted, with no letter and no cached copy; got ${show(ghosty).slice(0, 300)}`);
  assert(/no letter|had none/i.test(String(ghosty.note)) && !/export retract/.test(String(ghosty.note)), `the note says it had no letter; got ${show(ghosty.note)}`);
  const word = await ok('word');
  assert(word.outcome === 'deleted' && show((word.concepts || []).map((c) => c.concept)) === show([k.word]), `an element of word alone is an element, and goes (Decision 5); got ${show(word).slice(0, 300)}`);
  void before;
});

// ── AC5: what stays ──
test('DN9: the cached copy stays in the store, and the entry keeps the JSON the store held; a missing store entry is null', async () => {
  const { k, dir } = await main();
  const s = await ok('stored');
  assert(s.outcome === 'deleted' && s.cacheRemains === true, `stored: deleted, its cached copy remaining; got ${show(s).slice(0, 300)}`);
  assert(same(D.storedData(dir, k.stored), D.STORED_JSON), 'the store still holds its JSON under its tapestryKey (AC5)');
  const jsonTag = changeOf(s).was.tags.find((t) => t.properties.type === 'json');
  assert(jsonTag && jsonTag.properties.value === `lmdb:${k.stored}` && show(jsonTag.stored) === show(D.STORED_JSON), `its json tag's record keeps the JSON the store held, as stored (Decision 12); got ${show(jsonTag)}`);
  assert(/cache rebuild/.test(String(s.note)), `the note names cache rebuild; got ${show(s.note)}`);
  const p = await ok('phantom');
  const phantomJson = changeOf(p).was.tags.find((t) => t.properties.type === 'json');
  assert(p.outcome === 'deleted' && phantomJson && 'stored' in phantomJson && phantomJson.stored === null, `an lmdb: value whose entry is missing is recorded as stored: null; got ${show(phantomJson)}`);
  const d = changeOf(s).was.tags.find((t) => t.properties.type === 'd');
  assert(d && !('stored' in d), `a tag with no lmdb: value has no stored; got ${show(d)}`);
});

test('DN10: a tag another node has too stays; the deleted node\'s HAS_TAG to it is a relationship removed', async () => {
  const { k, after } = await main();
  const d = await ok('share');
  assert(d.outcome === 'deleted' && d.tags === 4, `shareTag: deleted with its four own tags, not the one sharer has too; got ${show({ o: d.outcome, t: d.tags })}`);
  const shared = nodeByKey(after, k.sharedTag);
  const sharer = nodeByKey(after, k.sharer);
  assert(shared && after.rels.some((r) => r.type === 'HAS_TAG' && r.from === sharer.eid && r.to === shared.eid), 'the shared tag stays, with sharer\'s HAS_TAG to it');
  assert((d.relationships || []).some((r) => r.type === 'HAS_TAG' && r.direction === 'out' && r.node && r.node.tapestryKey === k.sharedTag), `its HAS_TAG to the shared tag is a relationship removed; got ${show(d.relationships)}`);
  const w = changeOf(d).was;
  assert(w.relationships.some((r) => r.type === 'HAS_TAG' && r.other === k.sharedTag) && !w.tags.some((t) => t.properties.tapestryKey === k.sharedTag) && changeOf(d).nodes.includes(k.sharedTag),
    'the entry records that HAS_TAG as one of its relationships, not the tag as one of its own');
});

test('DN11: a class-thread link from a node to itself is no node below it: selfHeld is deleted, its link listed once', async () => {
  const { k } = await main();
  const d = await ok('self-held');
  const loops = (d.relationships || []).filter((r) => r.type === 'HAS_ELEMENT' && r.node && r.node.tapestryKey === k.selfHeld);
  assert(d.outcome === 'deleted' && loops.length === 1 && loops[0].direction === 'out', `deleted (Decision 5), its link to itself listed once, as out (Decision 9); got ${show(d).slice(0, 400)}`);
});

// ── AC7: callers, the list and the docs ──
test('DN12: nothing is signed; an admin\'s delete is the admin\'s; the command deletes a node, as the command\'s', async () => {
  assert((await ok('max')).outcome === 'deleted', 'the path under test ran');
  const { a, k, after } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (D1, D2); the spy saw ${show(a.spy)}`);
  const ad = await ok('admin');
  assert(ad.outcome === 'deleted' && same(ad.change.by, { role: 'admin', pubkey: ADMIN }), `the admin's delete is recorded as the admin's; got ${show(ad.change && ad.change.by)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'deleted' && same(body.data.change.by, { role: 'local', pubkey: null }), `the command answers as the route does, its entry the command's; got ${show(body).slice(0, 400)}`);
  assert(!nodeByKey(after, k.handy), 'and handy is gone');
});

test('DN13: it is listed with no guard, repeatKey [node], its one input and every refusal, and has its /docs entry', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'delete-node');
  assert(e, `graph delete-node is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([]) && show(e.repeatKey) === show(['node']),
    `a write for the owner and admins, no guard, repeatKey [node] (Decision 1); got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  assert(show(Object.keys(e.inputs || {})) === show(['node']) && e.inputs.node.required === true, `one input, node, required; got ${show(e.inputs)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = {
    'not-installed': 409, 'unknown-node': 404, 'person-node': 409, 'placeholder-node': 409, 'not-own-node': 409, 'made-elsewhere': 409,
    'firmware-node': 409, 'not-an-element': 409, 'holds-elements': 409, 'too-many-relationships': 409,
  };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `its refusals include ${code} (${st}), Decision 15's; got ${show(status)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include ${code}; got ${show(Object.keys(status))}`);
  const result = ((e.result || {}).schema || {}).properties || {};
  for (const f of ['outcome', 'node', 'concepts', 'relationships', 'tags', 'letterRemains', 'cacheRemains', 'deletion', 'note', 'change']) assert(f in result, `its result schema declares ${f} (Decision 11); got ${show(Object.keys(result))}`);
  assert(show((result.outcome || {}).enum) === show(['deleted', 'already-gone']), `outcome is deleted or already-gone; got ${show(result.outcome)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('delete-node-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('DN14: the change entry\'s descriptions cover a deleted node: node-deleted among change\'s examples, was and nodes', () => {
  needDecl();
  const { CHANGE } = require(path.join(ROOT, 'src/operations/changes.js'));
  const p = CHANGE.properties || {};
  assert(/node-deleted/.test(String(p.change && p.change.description)), `change's description names node-deleted; got ${show(p.change)}`);
  assert(/deleted node/i.test(String(p.was && p.was.description)) && !('type' in p.was), `was covers a deleted node, as it was, with no type; got ${show(p.was)}`);
  assert(/deleted node/i.test(String(p.nodes && p.nodes.description)), `nodes covers a deleted node's other ends; got ${show(p.nodes)}`);
});

test('DN15: the catalog\'s §2 rows give delete-node as built, refusing what Decision 15 lists, and update-node\'s two new refusals', () => {
  needDecl();
  const lines = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8').split('\n');
  const row = lines.find((l) => l.startsWith('| `delete-node` |')) || '';
  for (const word of ['`not-own-node`', '`person-node`', '`placeholder-node`', '`made-elsewhere`', '`firmware-node`', '`not-an-element`', '`holds-elements`', '`too-many-relationships`', '`already-gone`', 'delete-set']) {
    assert(row.includes(word), `delete-node's §2 row names ${word}; got ${show(row)}`);
  }
  assert(!/sets that still have elements/.test(row), `and no longer says it deletes an empty set (the owner's answer, question 1); got ${show(row)}`);
  const up = lines.find((l) => l.startsWith('| `update-node` |')) || '';
  assert(up.includes('`person-node`') && up.includes('`placeholder-node`'), `update-node's row names person-node and placeholder-node (Decision 4); got ${show(up).slice(0, 300)}`);
  const set = lines.find((l) => l.startsWith('| `delete-set` |')) || '';
  assert(/empty set/.test(set), `delete-set's row still deletes an empty set, so the two rows agree; got ${show(set)}`);
});

// ── Decision 7: the locks ──
test('DN16: each delete locks the node first, then each of its concepts\' headers in tapestryKey order, before it deletes; word\'s header is left out; a repeat locks the node alone', async () => {
  needDecl();
  // dog's and pet's headers keyed so that their tapestryKey order (pet first) differs from the order the class thread
  // reaches them in (review round 1, finding 5).
  const PET = '00000000-0000-4000-8000-0000000000a1';
  const DOG = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
  const { file, k } = await fresh(D.seedDeleteNode, (s, keys) => {
    const rekey = (name, key) => { s.nodes.find((n) => n.props.tapestryKey === keys[name]).props.tapestryKey = key; keys[name] = key; };
    rekey('dog', DOG);
    rekey('pet', PET);
  });
  const from = S.readState(file).log.length;
  const { a } = runOn(file, [post('max', 'owner', { node: k.walkerMax }), post('again', 'owner', { node: k.walkerMax }), post('word', 'owner', { node: k.wordOnly })]);
  assert(a.req('max').status === 200 && a.req('max').body.data.outcome === 'deleted' && a.req('again').body.data.outcome === 'already-gone' && a.req('word').body.data.outcome === 'deleted',
    `the path under test ran: deleted, already-gone, deleted; got ${show(['max', 'again', 'word'].map((id) => a.req(id).body)).slice(0, 500)}`);
  const txns = transactions(S.readState(file).log, from);
  assert(txns.length === 3 && txns.every((t) => t.end === 'commit'), `one committed transaction for each call; got ${show(txns.map((t) => t.end))}`);
  const locksBefore = (steps) => {
    const firstDetach = steps.findIndex((x) => x.kind === 'detach');
    return { firstDetach, writes: steps.slice(0, firstDetach < 0 ? steps.length : firstDetach).filter((x) => x.call === 'tx.run') };
  };
  const [del, again, word] = txns.map((t) => t.steps);
  assert(del[0] && del[0].kind === 'copies' && del[1] && del[1].kind === 'copies', `the delete starts with the node's lock, set and removed, before any read; got ${show(del.slice(0, 3))}`);
  const d = locksBefore(del);
  assert(d.firstDetach > 0 && d.writes.every((x) => x.kind === 'copies'), `before it deletes, it writes only locks (Decision 7); got ${show(d.writes.map((x) => x.kind))}`);
  const keys = d.writes.map((x) => (Array.isArray(x.keys) ? x.keys.join(',') : null));
  assert(show(keys) === show([k.walkerMax, k.walkerMax, PET, PET, DOG, DOG]), `the node's lock, then pet's header, then dog's: their tapestryKey order (Decision 7); got ${show(keys)}`);
  const w = locksBefore(word);
  assert(w.firstDetach > 0 && show(w.writes.map((x) => (x.keys || []).join(','))) === show([k.wordOnly, k.wordOnly]), `an element of word alone locks only itself: word's header, keyed word, is left out (Decision 7); got ${show(w.writes)}`);
  const againWrites = again.filter((x) => x.call === 'tx.run');
  assert(againWrites.length === 2 && againWrites.every((x) => x.kind === 'copies' && (x.keys || []).join(',') === k.walkerMax), `the repeat writes only the node's lock; got ${show(againWrites)}`);
});

// ── Decision 6: the write path's second try ──
test('DN17: a delete that waited while another transaction deleted the node answers already-gone, naming the other\'s entry', async () => {
  needDecl();
  const otherEntry = '00000000-0000-4000-8000-0000000000e1';
  const { file, k } = await fresh(D.seedDeleteNode, (s, keys) => {
    const n = s.nodes.find((x) => x.props.tapestryKey === keys.rich);
    const was = { labels: [...n.labels].sort(), properties: sortKeys(n.props), concepts: [], relationships: [], tags: [] };
    s.failures = { vanish: { key: keys.rich, add: [{ labels: ['GraphChange', 'TapestryNode'], props: { tapestryKey: otherEntry, at: '2026-11-17T10:00:00.000Z', byRole: 'admin', byPubkey: ADMIN, operation: 'graph delete-node', keys: [keys.rich], changes: JSON.stringify([{ change: 'node-deleted', node: keys.rich, nodes: [], was }]) } }] } };
  });
  const before = S.readState(file);
  const { a } = runOn(file, [post('late', 'owner', { node: k.rich })]);
  const x = a.req('late');
  assert(x.status === 200 && x.body.data.outcome === 'already-gone' && x.body.data.change === null && x.body.data.deletion && x.body.data.deletion.id === otherEntry && same(x.body.data.deletion.by, { role: 'admin', pubkey: ADMIN }),
    `the second of two deletes answers already-gone, naming the first's entry (Decision 6); got ${x.status} ${show(x.body).slice(0, 500)}`);
  const txns = transactions(S.readState(file).log, before.log.length);
  assert(txns.length === 2 && txns[0].end === 'rollback' && /Unable to load NODE/.test(String(txns[0].error)) && txns[1].end === 'commit', `its first try failed and rolled back, its second committed; got ${show(txns.map((t) => [t.end, t.error]))}`);
  assert(entriesIn(S.readState(file)).length === entriesIn(before).length + 1, 'and it recorded nothing: the one new entry is the other transaction\'s');
});

test('DN18: the write path runs a write once more when its first attempt fails with EntityNotFound, and records it once', async () => {
  const { file, k } = await fresh(D.seedDeleteNode, (s) => { s.failures = { entityNotFound: 1 }; });
  const before = S.readState(file);
  const { a } = runOn(file, [update('again', { node: k.lucky, fields: { description: 'tried twice' } })]);
  const x = a.req('again');
  assert(x.status === 200 && x.body.data.outcome === 'updated', `update-node, whose first try failed with EntityNotFound, answers from its second (Decision 6); got ${x.status} ${show(x.body).slice(0, 400)}`);
  const txns = transactions(S.readState(file).log, before.log.length);
  assert(txns.length === 2 && txns[0].end === 'rollback' && txns[1].end === 'commit', `one rollback, then one commit; got ${show(txns.map((t) => t.end))}`);
  assert(entriesIn(S.readState(file)).length === entriesIn(before).length + 1, 'and one entry is recorded');
});

test('DN19: it runs a write once more only: a second EntityNotFound answers 500, and nothing changes', async () => {
  const { file, k } = await fresh(D.seedDeleteNode, (s) => { s.failures = { entityNotFound: 2 }; });
  const before = S.readState(file);
  const { a } = runOn(file, [update('twice', { node: k.lucky, fields: { description: 'never' } })]);
  const x = a.req('twice');
  const after = S.readState(file);
  const txns = transactions(after.log, before.log.length);
  assert(x.status === 500, `two failures answer 500; got ${x.status} ${show(x.body).slice(0, 300)}`);
  assert(txns.length === 2 && txns.every((t) => t.end === 'rollback'), `the write ran twice, never a third time (Decision 6); got ${show(txns.map((t) => t.end))}`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and nothing changed');
});

test('DN20: another write that waited for a node a delete removed answers unknown-node, never a 500', async () => {
  const { file, k } = await fresh(D.seedDeleteNode, (s, keys) => { s.failures = { vanish: { key: keys.lucky } }; });
  const { a } = runOn(file, [update('vanished', { node: k.lucky, fields: { description: 'too late' } })]);
  const x = a.req('vanished');
  assert(x.status === 404 && x.body.code === 'unknown-node', `update-node of a node deleted while it waited answers unknown-node from its second try (Decision 6); got ${x.status} ${show(x.body).slice(0, 300)}`);
});

test('DN21: a delete whose entry can\'t be recorded keeps nothing, and isn\'t tried again', async () => {
  needDecl();
  const { file, k } = await fresh(D.seedDeleteNode, (s) => { s.failures = { entry: true }; });
  const before = S.readState(file);
  const { a } = runOn(file, [post('fail', 'owner', { node: k.lucky })]);
  const after = S.readState(file);
  const txns = transactions(after.log, before.log.length);
  assert(a.req('fail').status === 500, `the delete fails; got ${a.req('fail').status} ${show(a.req('fail').body).slice(0, 300)}`);
  assert(txns.length === 1 && txns[0].end === 'rollback', `once: an error that isn't EntityNotFound isn't tried again (Decision 6); got ${show(txns.map((t) => t.end))}`);
  assert(nodeByKey(after, k.lucky) && show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and nothing is left half deleted: lucky is as it was (AC2)');
});

// ── AC3: whose node it is ──
test('DN22: someone else\'s node is refused not-own-node: another author\'s letter, an admin\'s, a stranger\'s with none', async () => {
  for (const [id, author] of [['other', OTHER], ['admin-letter', ADMIN], ['drifter', S.STRANGER]]) {
    const body = await refused(id, 409, 'not-own-node');
    assert(body.input === 'node' && err(body).includes(author) && /copy-node/.test(err(body)), `${id}: names the input, the author and graph copy-node (D4); got ${show(body)}`);
  }
});

test('DN23: a person node is refused person-node, naming the person\'s key: the assistant\'s, the owner\'s, another author\'s, and one that is an element', async () => {
  for (const [id, key] of [['p-ta', TA], ['p-owner', OWNER], ['p-other', OTHER], ['p-element', D.PERSON]]) {
    const body = await refused(id, 409, 'person-node');
    assert(body.input === 'node' && err(body).includes(key) && /A10\.30|raw delete-node/.test(err(body)), `${id}: names the person's key and raw delete-node (Decision 4); got ${show(body)}`);
  }
});

test('DN24: a placeholder is refused placeholder-node, naming what it stands for: an e tag\'s, an a tag\'s, one at the assistant\'s address, a b tag\'s, and one that is an element', async () => {
  const { k, before } = await ref();
  for (const [id, name] of [['ph-e', 'ePlaceholder'], ['ph-a', 'aPlaceholder'], ['ph-own', 'aOwnPlaceholder'], ['ph-b', 'bPlaceholder'], ['ph-element', 'elementPlaceholder']]) {
    const body = await refused(id, 409, 'placeholder-node');
    const stands = nodeByKey(before, k[name]).props.uuid;
    assert(body.input === 'node' && err(body).includes(stands) && /import/i.test(err(body)), `${id}: names the id or address it stands for, and the import (Decision 4); got ${show(body)}`);
  }
});

// ── AC4: what else it refuses ──
test('DN25: a node another operation looks after is refused made-elsewhere, naming the operation that deletes it', async () => {
  const cases = [
    ['me-header', /delete-concept/, 'a concept header'], ['me-superset', /delete-concept/, "a concept's superset, which goes with its concept"],
    ['me-primary', /delete-concept/, 'a primary property'], ['me-schema', /delete-concept/, 'a JSON schema'],
    ['me-property', /remove-property/, 'a property'], ['me-set', /delete-set/, 'a set of the set concept'],
    ['me-set-label', /delete-set/, 'a set, by its label'], ['me-rule', /rulebook|GRAPH_RULES/, 'a graph rule'],
  ];
  for (const [id, op, what] of cases) {
    const body = await refused(id, 409, 'made-elsewhere');
    assert(body.input === 'node' && op.test(err(body)), `${id}, ${what}: names ${op} (Decision 5); got ${show(body)}`);
  }
  assert(/A10\.17/.test(err(await refused('me-set', 409, 'made-elsewhere'))) && /A10\.18/.test(err(await refused('me-property', 409, 'made-elsewhere'))), 'with the Loom tasks that build them');
  assert(/set-schema/.test(err(await refused('me-schema', 409, 'made-elsewhere'))), 'and a schema\'s names graph set-schema too, which replaces one');
});

test('DN26: firmware\'s own element is refused firmware-node, naming its file', async () => {
  const body = await refused('fw-rover', 409, 'firmware-node');
  assert(/concepts\/dog\/elements\/rover\.json/.test(err(body)) && /seed-firmware|A10\.37/.test(err(body)), `names the file and lifecycle seed-firmware (Decision 5); got ${show(body)}`);
});

test('DN27: a node no concept\'s class thread reaches is refused not-an-element, naming raw delete-node', async () => {
  for (const id of ['ne-tag', 'ne-loner']) {
    const body = await refused(id, 409, 'not-an-element');
    assert(body.input === 'node' && /A10\.30|raw delete-node/.test(err(body)), `${id}: names raw delete-node (A10.30) (Decision 5); got ${show(body)}`);
  }
});

test('DN28: a node other nodes are elements through is refused holds-elements, naming how many and the first five', async () => {
  const { k } = await ref();
  const one = await refused('holder', 409, 'holds-elements');
  assert(one.input === 'node' && err(one).includes(k.heldBelow) && /\b1\b|\bone\b/i.test(err(one)), `holder: names the one node below it (Decision 5); got ${show(one)}`);
  const seven = await refused('holder7', 409, 'holds-elements');
  const sorted = [...k.below].sort();
  assert(/\b7\b|\bseven\b/i.test(err(seven)) && sorted.slice(0, 5).every((key) => err(seven).includes(key)) && !sorted.slice(5).some((key) => err(seven).includes(key)),
    `holder7: names seven, and the first five by tapestryKey, not the other two; got ${show(seven)}`);
});

test('DN29: more than 10,000 relationships is refused too-many-relationships, by the node\'s own count or with its tags\'; 10,000 goes', async () => {
  needDecl();
  const { file, k } = await fresh(D.seedCrowded);
  const before = S.readState(file);
  const { a } = runOn(file, [post('crowded', 'owner', { node: k.crowded }), post('by-tags', 'owner', { node: k.crowdedByTags }), post('full', 'owner', { node: k.full }), post('full-loop', 'owner', { node: k.fullLoop })]);
  const after = S.readState(file);
  const loop = a.req('full-loop');
  assert(loop.status === 409 && loop.body.code === 'too-many-relationships' && /10,?001/.test(err(loop.body)) && nodeByKey(after, k.fullLoop),
    `fullLoop, 10,000 with a link to itself, is refused: the first count counts that link twice (Amendment 1, item 3); got ${loop.status} ${show(loop.body).slice(0, 300)}`);
  for (const id of ['crowded', 'by-tags']) {
    const x = a.req(id);
    assert(x.status === 409 && x.body.code === 'too-many-relationships' && /10,?001/.test(err(x.body)) && /10,?000/.test(err(x.body)), `${id}: refused, naming its 10,001 and the cap (Decision 8); got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
  assert(nodeByKey(after, k.crowded) && nodeByKey(after, k.crowdedByTags), 'and both are still there');
  const f = a.req('full');
  assert(f.status === 200 && f.body.data.outcome === 'deleted' && f.body.data.relationships.length === 10000 && changeOf(f.body.data).was.relationships.length === 10000, `full, at 10,000, is deleted, each relationship listed and recorded; got ${f.status} ${show(f.body).slice(0, 200)}`);
  assert(!nodeByKey(after, k.full) && nodeByKey(after, k.crowdSource) && after.rels.length === before.rels.length - 10000, 'full is gone with its 10,000, and crowdSource stays');
});

test('DN30: with no assistant key it is refused not-installed, and nothing changes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const { a } = runOn(file, [post('ni', 'owner', { node: k.lucky })], { env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; } });
  const x = a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `with no assistant key, 409 not-installed (Decision 2); got ${x.status} ${show(x.body)}`);
  assert(show(S.readState(file).nodes) === show(before.nodes), 'and nothing changes');
});

test('DN31: inputs are checked: missing, not a tapestryKey, unknown', async () => {
  for (const [id, code] of [['in-missing', 'missing-input'], ['in-pattern', 'invalid-input'], ['in-unknown', 'unknown-input']]) {
    const body = await refused(id, 400, code);
    assert(/node|force/.test(err(body)), `${id}: names the input; got ${show(body)}`);
  }
});

test('DN32: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('other').body;
  assert(rb.code === route.code && rb.error === route.error, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing in the refusal run signed or read a key; the spy saw ${show(a.spy)}`);
});

test('DN33: the refusal run changed nothing and recorded nothing', async () => {
  await refused('other', 409, 'not-own-node');
  const { file, before } = await ref();
  const after = S.readState(file);
  assert(entriesIn(after).length === entriesIn(before).length, `no change entry was recorded; ${entriesIn(before).length} before, ${entriesIn(after).length} after`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and the graph is as it was: every refusal comes before anything is deleted (Decision 2)');
});

// ── review round 1's cases (ADR Amendment 3) ──
test('DN35: a node with two HAS_TAGs to one tag is deleted, that tag once', async () => {
  const { k, before, after } = await main();
  const d = await ok('double');
  const n0 = nodeByKey(before, k.doubleTagged);
  const tagKeys = [...new Set(tagsOf(before, n0).map((t) => t.props.tapestryKey))];
  assert(d.outcome === 'deleted' && d.tags === tagKeys.length && tagKeys.length === 4, `deleted, with its four tags counted once each (finding 1); got ${show({ o: d.outcome, t: d.tags })}`);
  assert(!nodeByKey(after, k.doubleTagged) && tagKeys.every((key) => !nodeByKey(after, key)), 'it and its tags are gone');
  assert(changeOf(d).was.tags.length === 4 && !(d.relationships || []).some((r) => r.type === 'HAS_TAG'), `the entry records each tag once, and no HAS_TAG to its own tags is a relationship removed; got ${show(changeOf(d).was.tags.length)}`);
});

test('DN36: a relationship to a node with no tapestryKey stops the delete, naming lifecycle migrate, and nothing changes', async () => {
  needDecl();
  const { a, k, after } = await main();
  const x = a.req('unkeyed');
  assert(x.status === 500 && /lifecycle migrate/.test(String(x.body && x.body.error)), `a node an unkeyed node links to can't be recorded whole, so it stops (finding 2): 500 naming lifecycle migrate; got ${x.status} ${show(x.body).slice(0, 300)}`);
  assert(nodeByKey(after, k.unkeyedLinked) && after.rels.some((r) => r.type === 'CITES' && r.to === nodeByKey(after, k.unkeyedLinked).eid), 'and the node, and the CITES to it, are still there');
});

test('DN37: a relationship gone between the reads and the delete rolls the delete back, and it isn\'t tried again', async () => {
  needDecl();
  const { file, k } = await fresh(D.seedDeleteNode, (s, keys) => { s.failures = { shrinkBeforeDetach: keys.lucky }; });
  const before = S.readState(file);
  const { a } = runOn(file, [post('shrunk', 'owner', { node: k.lucky })]);
  const after = S.readState(file);
  const x = a.req('shrunk');
  const txns = transactions(after.log, before.log.length);
  assert(x.status === 500 && /changed while it was being deleted/.test(String(x.body && x.body.error)), `the counts differ from what was read: 500, saying the node changed (Decision 10; finding 4); got ${x.status} ${show(x.body).slice(0, 300)}`);
  assert(txns.length === 1 && txns[0].end === 'rollback', `one attempt, rolled back; got ${show(txns.map((t) => t.end))}`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and nothing changed: lucky and every relationship of its are as they were');
});

test('DN38: a relationship between the node and its own tag is listed once, from the tag, and recorded under the tag', async () => {
  const { k } = await main();
  const d = await ok('self-ref');
  const hits = (d.relationships || []).filter((r) => r.type === 'REFERENCES');
  assert(d.outcome === 'deleted' && hits.length === 1 && hits[0].from === k.selfRefATag && hits[0].to === k.selfRef && hits[0].direction === 'out' && hits[0].tag && hits[0].tag.key === k.selfRefATag && hits[0].tag.type === 'a',
    `its a tag's REFERENCES to it, once, from the tag (Decision 9; finding 6); got ${show(hits)}`);
  const w = changeOf(d).was;
  const aTag = w.tags.find((t) => t.properties.tapestryKey === k.selfRefATag);
  assert(!w.relationships.some((r) => r.type === 'REFERENCES') && aTag && aTag.relationships.some((r) => r.type === 'REFERENCES' && r.direction === 'out' && r.other === k.selfRef),
    `recorded under the tag, not among the node's own; got ${show({ own: w.relationships, tag: aTag && aTag.relationships })}`);
  assert(!changeOf(d).nodes.includes(k.selfRef), `and the node isn't among the other ends; got ${show(changeOf(d).nodes)}`);
});

test('DN39: data the store holds for an lmdb: value that isn\'t JSON is recorded as it was held', async () => {
  const { k, dir } = await main();
  const d = await ok('stored-text');
  const jsonTag = changeOf(d).was.tags.find((t) => t.properties.type === 'json');
  assert(d.outcome === 'deleted' && jsonTag && jsonTag.stored === D.STORED_TEXT, `stored is what the store held, parse or not (finding 8); got ${show(jsonTag)}`);
  assert(D.storedData(dir, k.storedText) === D.STORED_TEXT, 'and the store still holds it');
});

test('DN34: the new and changed modules require nothing that signs, publishes or reads a key', () => {
  for (const f of ['src/operations/catalog/graph/delete-node.js', 'src/operations/catalog/graph/_nodes.js', 'src/operations/write.js']) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error(`${f} does not exist yet (ADR graph-operations-first-slice/0026 Implementation notes)`);
    const src = fs.readFileSync(abs, 'utf8');
    const bad = (src.match(/require\(\s*['"][^'"]*['"]\s*\)/g) || []).filter((r) => /nostr-tools|normalize\/helpers|secureKeyStorage|child_process|strfry|signing/.test(r));
    assert(bad.length === 0, `${f} must require nothing that signs (ADR graph-operations-foundation/0004 Decision 10); it requires ${show(bad)}`);
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
