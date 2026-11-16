'use strict';
/**
 * graph list-relationships — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/13-list-relationships.md (AC1–AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md
 *
 * Stack-free: every request goes through test/helpers/operationsHarness.js, over a graph
 * test/helpers/relationshipsGraph.js seeds for test/helpers/graphFake.js. A page's cursor is read from one harness run
 * and sent in the next, over the same graph, and the graph is changed between runs where a test says so. Only what the
 * story and the ADR pin is checked: which relationships come back, in what order, with which facts, what is counted,
 * and what is refused; how the read finds them is the Implementer's.
 *
 *   LR1  a node's relationships, out and in, of every type, each once, and nothing else
 *   LR2  type narrows to one type, declared or not; a type no relationship has answers an empty list
 *   LR3  direction out, in or both (the default); a relationship from the node to itself under each
 *   LR4  the answer gives the node with its five facts, and what it listed by; no relationships answers an empty list
 *   LR5  with no type, relationships to tag nodes are left out and counted as tagsLeftOut; with a type, listed
 *   LR6  each relationship is { type, direction, from, to, node, properties }, and nothing more
 *   LR7  what a relationship records about itself, integers as numbers, keys sorted; {} for most
 *   LR8  two relationships of one type between the same two nodes, the same way, are each listed
 *   LR9  pages of 50 by default, out before in, by type then the other node's key; the cursors page through once
 *   LR10 a limit from 1 to 200 caps the page; 0 or 201 is refused naming limit; a page of 1 parts parallel ones
 *   LR11 a relationship added or taken out between two pages moves no other
 *   LR12 a cursor this read didn't give, for this same list, is refused invalid-cursor
 *   LR13 the owner's point of view, by default: a relationship counts when the node at its other end counts
 *   LR14 the node asked about is never left out; a relationship from it to itself is judged by it
 *   LR15 kept and leftOut count the whole list, not the page
 *   LR16 everyone keeps every relationship
 *   LR17 nothing about a point of view is stored: new scores answer differently, with no write between
 *   LR18 before the owner's scores exist, only the instance's own count, and the answer says so
 *   LR19 a pov the instance can't read from is refused unknown-pov; a malformed one invalid-input
 *   LR20 no node, or one that names no node (a change entry is not one), is refused, naming node
 *   LR21 malformed node, type and direction, and an unknown input, are refused, naming them
 *   LR22 a visitor gets 401 and a stranger 403; an admin reads what the owner reads
 *   LR23 it writes nothing: reads only, the graph as it was, no change entry
 *   LR24 the command answers what the route answers, refusals included
 *   LR25 it is listed for an admin, with its inputs and refusals, and has its /docs entry
 *   LR26 its paging, point of view, node and relationship are reads.js's, and the catalog says so
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { writeState } = require('../../helpers/graphFake');
const { seedRelationships, HUB, PEERS, ALICE_TAGS, FOLLOWED_AT } = require('../../helpers/relationshipsGraph');

const { ROOT, OWNER, ADMIN, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph list-relationships');

const ROUTE = '/api/tapestry/graph/list-relationships';
const READ = 'graph list-relationships';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/list-relationships.js');
const READS = path.join(ROOT, 'src/operations/reads.js');
const CATALOG = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const NODE_KEYS = ['address', 'author', 'name', 'own', 'tapestryKey'];
const REL_KEYS = ['direction', 'from', 'node', 'properties', 'to', 'type'];
const POV_KEYS = ['cutoff', 'name', 'observer', 'scored'];
const INPUTS = ['cursor', 'direction', 'limit', 'node', 'pov', 'type'];

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/list-relationships.js does not exist yet (ADR graph-operations-first-slice/0013 Decision 2)');
}

const q = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.set(k, String(v));
  const text = u.toString();
  return text ? `${ROUTE}?${text}` : ROUTE;
};
const get = (id, caller, params = {}) => ({ id, method: 'GET', url: q(params), caller });
/** One harness run of `requests` (and `cli`) over the graph in `file`. */
const runOver = (file, requests, cli = [], opts = {}) => S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: tmp('list-relationships-run-'), ...opts }));
/** A fresh copy of a seed's graph, in a file of its own. */
const fileOf = (seed) => seed.file(tmp('list-relationships-graph-'));

function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  assert(x.body && x.body.data && Array.isArray(x.body.data.relationships), `${id} answers { relationships, … }; got ${show(x.body && x.body.data)}`);
  return x.body.data;
}
function refused(a, id, status, code, input) {
  needDecl();
  const x = a.req(id);
  assert(x.status === status && x.body && x.body.code === code, `${id}: ${status} ${code}; got ${x.status} ${show(x.body)}`);
  if (input !== undefined) assert(x.body.input === input, `${id}: the refusal names the input ${input}; got ${show(x.body.input)}`);
  assert(typeof x.body.error === 'string' && x.body.error.length > 0, `${id}: the refusal says in words what was wrong; got ${show(x.body)}`);
  return x.body;
}

/** A relationship as [direction, type, the other node's tapestryKey], the facts that place it. */
const placed = (r) => [r.direction, r.type, r.node && r.node.tapestryKey];
const DIR_RANK = { out: 0, in: 1 };
/** The order ADR 0013 Decision 2 pins: out before in, then by type, then by the other node's tapestryKey. */
const inOrder = (list) => [...list].sort((a, b) => (DIR_RANK[a[0]] - DIR_RANK[b[0]]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
/** The expected placings of [type, name] pairs in one direction, named by seed `k`. */
const want = (k, direction, pairs) => pairs.map(([type, name]) => [direction, type, k[name]]);
const named = (k) => (key) => Object.keys(k).find((n) => k[n] === key) || key;
const describe = (k, rels) => rels.map((r) => `${r.direction} ${r.type} ${named(k)(r.node && r.node.tapestryKey)}`);

/** A cursor's JSON, [read, scope, position], and a cursor made from one. */
const opened = (cursor) => JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
const sealed = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');

// ── the main run: one seeded graph, most of the requests ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const seed = seedRelationships();
  const file = fileOf(seed);
  const k = seed.keys;
  const before = S.readState(file);
  const everyone = { pov: 'everyone', limit: 200 };
  const a = runOver(file, [
    get('hub', 'owner', { node: k.hub, ...everyone }),
    get('hub-out', 'owner', { node: k.hub, direction: 'out', ...everyone }),
    get('hub-in', 'owner', { node: k.hub, direction: 'in', ...everyone }),
    get('hub-both', 'owner', { node: k.hub, direction: 'both', ...everyone }),
    get('hub-cites', 'owner', { node: k.hub, type: 'CITES', ...everyone }),
    get('hub-mentions', 'owner', { node: k.hub, type: 'MENTIONS', ...everyone }),
    get('hub-mentions-out', 'owner', { node: k.hub, type: 'MENTIONS', direction: 'out', ...everyone }),
    get('hub-mentions-in', 'owner', { node: k.hub, type: 'MENTIONS', direction: 'in', ...everyone }),
    get('hub-nope', 'owner', { node: k.hub, type: 'NO_SUCH_TYPE', ...everyone }),
    get('hub-has-tag', 'owner', { node: k.hub, type: 'HAS_TAG', ...everyone }),
    get('hub-references', 'owner', { node: k.hub, type: 'REFERENCES', ...everyone }),
    get('hub-has-tag-owner', 'owner', { node: k.hub, type: 'HAS_TAG', limit: 200 }),
    get('other-tag', 'owner', { node: k.otherTag, ...everyone }),
    get('alice', 'owner', { node: k.alice, ...everyone }),
    get('alice-follows', 'owner', { node: k.alice, type: 'FOLLOWS', ...everyone }),
    get('alice-tags-out', 'owner', { node: k.alice, type: 'TAGS', direction: 'out', ...everyone }),
    get('bob-in', 'owner', { node: k.bob, direction: 'in', ...everyone }),
    get('empty', 'owner', { node: k.empty }),
    get('tags-only', 'owner', { node: k.tagsOnly }),
    get('tags-only-has-tag', 'owner', { node: k.tagsOnly, type: 'HAS_TAG' }),
    get('bulk-1', 'owner', { node: k.bulkHub }),
    get('limit-3', 'owner', { node: k.hub, pov: 'everyone', limit: 3 }),
    get('limit-200', 'owner', { node: k.bulkHub, limit: 200 }),
    get('limit-0', 'owner', { node: k.hub, limit: 0 }),
    get('limit-201', 'owner', { node: k.hub, limit: 201 }),
    get('owner', 'owner', { node: k.hub, limit: 200 }),
    get('owner-named', 'owner', { node: k.hub, pov: 'owner', limit: 200 }),
    get('owner-pubkey', 'owner', { node: k.hub, pov: OWNER, limit: 200 }),
    get('owner-out', 'owner', { node: k.hub, direction: 'out', limit: 200 }),
    get('owner-in', 'owner', { node: k.hub, direction: 'in', limit: 200 }),
    get('owner-cites', 'owner', { node: k.hub, type: 'CITES', limit: 200 }),
    get('owner-limit-2', 'owner', { node: k.hub, limit: 2 }),
    get('citer', 'owner', { node: k.citer, limit: 200 }),
    get('pov-stranger', 'owner', { node: k.hub, pov: PEERS.stranger }),
    get('pov-admin', 'owner', { node: k.hub, pov: ADMIN }),
    get('pov-house', 'owner', { node: k.hub, pov: 'house' }),
    get('no-node', 'owner', {}),
    get('no-node-paged', 'owner', { limit: 5, pov: 'everyone', direction: 'out' }),
    get('unknown-node', 'owner', { node: crypto.randomUUID() }),
    get('entry', 'owner', { node: k.G }),
    get('bad-node', 'owner', { node: 'not-a-key' }),
    get('bad-type-space', 'owner', { node: k.hub, type: 'HAS ELEMENT' }),
    get('bad-type-digit', 'owner', { node: k.hub, type: '1CITES' }),
    get('bad-type-dash', 'owner', { node: k.hub, type: 'IS-A' }),
    get('bad-type-tick', 'owner', { node: k.hub, type: 'CITES`]->(m) DETACH DELETE m //' }),
    get('bad-direction', 'owner', { node: k.hub, direction: 'sideways' }),
    get('bad-direction-case', 'owner', { node: k.hub, direction: 'OUT' }),
    get('unknown-input', 'owner', { node: k.hub, foo: '1' }),
    get('visitor', 'visitor', { node: k.hub }),
    get('stranger', 'stranger', { node: k.hub }),
    get('admin', 'admin', { node: k.hub, limit: 200 }),
    get('route-5', 'owner', { node: k.hub, limit: 5 }),
    get('route-refusal', 'owner', { node: k.G }),
    get('route-in-cites', 'owner', { node: k.hub, direction: 'in', type: 'CITES', pov: 'everyone' }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], [
    { id: 'cli-5', argv: ['graph', 'list-relationships', '--node', k.hub, '--limit', '5'] },
    { id: 'cli-refusal', argv: ['graph', 'list-relationships', '--node', k.G] },
    { id: 'cli-in-cites', argv: ['graph', 'list-relationships', '--node', k.hub, '--direction', 'in', '--type', 'CITES', '--pov', 'everyone'] },
  ]);
  MAIN = { a, seed, k, file, before };
  return MAIN;
}

/** hub's relationships from everyone's point of view, with no type: its placings, in order. */
const hubAll = (k) => inOrder([...want(k, 'out', HUB.out), ...want(k, 'in', HUB.in)]);

test('LR1: a node\'s relationships are every one that runs from it or to it, of any type, each once, and nothing else', () => {
  const { a, k } = main();
  const d = ok(a, 'hub');
  const got = d.relationships.map(placed);
  assert(show(got) === show(hubAll(k)), `hub: its 9 relationships out (the loop among them, as out) and its 3 in, of every type, in order, each once; got ${show(describe(k, d.relationships))}`);
  for (const not of ['nokey', 'legacy']) assert(!d.relationships.some((r) => r.node && r.node.address === `39999:${TA}:${not}`), `the relationship to ${not} (no tapestryKey, or '{}') is never listed`);
  assert(!d.relationships.some((r) => r.node && r.node.tapestryKey === '{}'), 'no node is answered with the key \'{}\'');
  assert(d.cursor === null, `all of them fit one page of 200, so the cursor is null; got ${show(d.cursor)}`);
});

test('LR2: type narrows the list to one type, declared or not; a type no relationship has answers an empty list', () => {
  const { a, k } = main();
  const cites = ok(a, 'hub-cites');
  const citing = inOrder([...want(k, 'out', HUB.out.filter(([t]) => t === 'CITES')), ...want(k, 'in', HUB.in.filter(([t]) => t === 'CITES'))]);
  assert(show(cites.relationships.map(placed)) === show(citing), `type CITES: the 7 hub cites and the 1 that cites hub; got ${show(describe(k, cites.relationships))}`);
  assert(cites.type === 'CITES', `the answer gives the type it listed; got ${show(cites.type)}`);
  const follows = ok(a, 'alice-follows');
  assert(show(follows.relationships.map(placed)) === show([['out', 'FOLLOWS', k.bob]]), `FOLLOWS, which the graph doesn't declare as a relationship type, is listed like any other; got ${show(describe(k, follows.relationships))}`);
  const nope = ok(a, 'hub-nope');
  assert(nope.relationships.length === 0 && nope.cursor === null && nope.kept === 0 && nope.leftOut === 0 && nope.tagsLeftOut === 0, `a type no relationship has: an empty list, nothing counted, not a refusal; got ${show(nope)}`);
});

test('LR3: direction out lists those from the node, in those to it, both (the default) both; the node\'s relationship to itself under each', () => {
  const { a, k } = main();
  const out = ok(a, 'hub-out');
  assert(show(out.relationships.map(placed)) === show(inOrder(want(k, 'out', HUB.out))), `direction out: the 9 from hub, the loop among them; got ${show(describe(k, out.relationships))}`);
  const inn = ok(a, 'hub-in');
  assert(show(inn.relationships.map(placed)) === show(inOrder([...want(k, 'in', HUB.in), ['in', 'MENTIONS', k.hub]])), `direction in: the 3 to hub, and the loop, which runs to hub as well; got ${show(describe(k, inn.relationships))}`);
  const both = ok(a, 'hub-both');
  assert(show(both) === show(ok(a, 'hub')), 'direction both answers what the default answers');
  assert(ok(a, 'hub').direction === 'both' && out.direction === 'out' && inn.direction === 'in', `the answer gives the direction it listed by, both by default; got ${show([ok(a, 'hub').direction, out.direction, inn.direction])}`);
  const loops = (id) => ok(a, id).relationships.filter((r) => r.node && r.node.tapestryKey === k.hub);
  assert(show(loops('hub-mentions').map(placed)) === show([['out', 'MENTIONS', k.hub]]), `under both, hub's relationship to itself is answered once, as out; got ${show(loops('hub-mentions').map(placed))}`);
  assert(show(loops('hub-mentions-out').map(placed)) === show([['out', 'MENTIONS', k.hub]]), 'under out, once, as out');
  assert(show(loops('hub-mentions-in').map(placed)) === show([['in', 'MENTIONS', k.hub]]), `under in, once, as in; got ${show(loops('hub-mentions-in').map(placed))}`);
});

test('LR4: the answer gives the node asked about with its five facts, and what it listed by; no relationships answers an empty list', () => {
  const { a, k, seed } = main();
  const d = ok(a, 'hub');
  assert(d.node && show(Object.keys(d.node).sort()) === show(NODE_KEYS), `the node asked about comes with exactly the five facts; got ${show(d.node)}`);
  assert(d.node.tapestryKey === k.hub && d.node.name === 'hub' && d.node.address === seed.uuids.hub && d.node.author === TA && d.node.own === true, `hub: its key, name, address, the assistant as author, own; got ${show(d.node)}`);
  assert(d.type === null && d.direction === 'both', `with no type, type is null; got ${show({ type: d.type, direction: d.direction })}`);
  assert(d.pov && show(Object.keys(d.pov).sort()) === show(POV_KEYS), `pov is { name, observer, cutoff, scored }; got ${show(d.pov)}`);
  const empty = ok(a, 'empty');
  assert(empty.relationships.length === 0 && empty.cursor === null && empty.kept === 0 && empty.leftOut === 0 && empty.tagsLeftOut === 0, `a node with no relationships: an empty list, nothing counted; got ${show(empty)}`);
  assert(empty.node && empty.node.tapestryKey === k.empty, 'and it still gives the node asked about');
});

test('LR5: with no type, relationships to tag nodes are left out and counted as tagsLeftOut; with a type they\'re listed', () => {
  const { a, k } = main();
  const d = ok(a, 'hub');
  assert(!d.relationships.some((r) => ['tagD', 'tagName', 'tagZ', 'otherTag'].includes(named(k)(r.node && r.node.tapestryKey))), `no relationship to a tag node is listed with no type; got ${show(describe(k, d.relationships))}`);
  assert(d.tagsLeftOut === 4, `tagsLeftOut counts the 3 HAS_TAG out and the 1 REFERENCES in from a tag node; got ${show(d.tagsLeftOut)}`);
  assert(ok(a, 'hub-out').tagsLeftOut === 3 && ok(a, 'hub-in').tagsLeftOut === 1, `out alone, 3; in alone, 1; got ${show([ok(a, 'hub-out').tagsLeftOut, ok(a, 'hub-in').tagsLeftOut])}`);
  const hasTag = ok(a, 'hub-has-tag');
  assert(show(hasTag.relationships.map(placed)) === show(inOrder(want(k, 'out', HUB.tagsOut))) && hasTag.tagsLeftOut === 0, `type HAS_TAG lists hub's 3 tag nodes, and leaves none out; got ${show(describe(k, hasTag.relationships))} ${hasTag.tagsLeftOut}`);
  const refs = ok(a, 'hub-references');
  assert(show(refs.relationships.map(placed)) === show(want(k, 'in', HUB.tagsIn)), `type REFERENCES lists the tag node that names hub; got ${show(describe(k, refs.relationships))}`);
  const tagOwner = ok(a, 'hub-has-tag-owner');
  assert(tagOwner.relationships.length === 3 && tagOwner.kept === 3 && tagOwner.leftOut === 0, `from the owner's point of view, a tag node (no author) counts; got ${show({ n: tagOwner.relationships.length, kept: tagOwner.kept, leftOut: tagOwner.leftOut })}`);
  const tagged = ok(a, 'other-tag');
  assert(show(tagged.relationships.map(placed)) === show(inOrder([['out', 'REFERENCES', k.hub], ['in', 'HAS_TAG', k.other]])) && tagged.tagsLeftOut === 0, `a tag node asked about lists its relationships to the nodes that aren't tags; got ${show(describe(k, tagged.relationships))}`);
  const only = ok(a, 'tags-only');
  assert(only.relationships.length === 0 && only.tagsLeftOut === 2 && only.kept === 0 && only.leftOut === 0, `a node with only tag nodes: an empty list, and tagsLeftOut 2; got ${show(only)}`);
  assert(ok(a, 'tags-only-has-tag').relationships.length === 2, 'and type HAS_TAG lists the two');
});

test('LR6: each relationship is { type, direction, from, to, node, properties }, and nothing more', () => {
  const { a, k, seed } = main();
  const d = ok(a, 'hub');
  for (const r of d.relationships) {
    assert(show(Object.keys(r).sort()) === show(REL_KEYS), `a relationship has exactly the six facts; got ${show(r)}`);
    assert(r.node && show(Object.keys(r.node).sort()) === show(NODE_KEYS), `the node at its other end has exactly the five facts; got ${show(r.node)}`);
    assert(r.direction === 'out' || r.direction === 'in', `its direction is out or in; got ${show(r.direction)}`);
    if (r.direction === 'out') assert(r.from === k.hub && r.to === r.node.tapestryKey, `out: from hub, to the other node; got ${show({ from: r.from, to: r.to, node: r.node.tapestryKey })}`);
    else assert(r.to === k.hub && r.from === r.node.tapestryKey, `in: from the other node, to hub; got ${show({ from: r.from, to: r.to, node: r.node.tapestryKey })}`);
  }
  const loop = d.relationships.find((r) => r.type === 'MENTIONS');
  assert(loop && loop.from === k.hub && loop.to === k.hub && loop.node.tapestryKey === k.hub, `the loop runs from hub to hub, and its other end is hub; got ${show(loop)}`);
  const by = (name) => d.relationships.find((r) => r.node && r.node.tapestryKey === k[name]);
  const ta = by('citedTa');
  assert(ta && ta.node.name === 'citedTa' && ta.node.address === seed.uuids.citedTa && ta.node.author === TA && ta.node.own === true, `citedTa: its name, address, the assistant, own; got ${show(ta)}`);
  const anon = by('citedAnon');
  assert(anon && anon.node.author === null && anon.node.address === null && anon.node.own === true, `citedAnon: no author or address, so the instance's own; got ${show(anon)}`);
  const hi = by('citedHi');
  assert(hi && hi.node.author === PEERS.hi && hi.node.own === false, `citedHi: a peer's, not own; got ${show(hi)}`);
});

test('LR7: each relationship gives what it records about itself, integers as numbers and keys sorted; {} for most', () => {
  const { a, k } = main();
  const d = ok(a, 'hub');
  for (const r of d.relationships) assert(r.properties && typeof r.properties === 'object' && !Array.isArray(r.properties) && Object.keys(r.properties).length === 0, `hub's relationships record nothing about themselves, so properties is {}; got ${show(r.properties)}`);
  const alice = ok(a, 'alice');
  const follows = alice.relationships.find((r) => r.type === 'FOLLOWS');
  assert(follows && show(follows.properties) === show({ timestamp: Number(FOLLOWED_AT) }), `alice's FOLLOWS records its timestamp, an integer, as a number; got ${show(follows && follows.properties)}`);
  const tags = alice.relationships.filter((r) => r.type === 'TAGS' && r.direction === 'out');
  for (const t of tags) {
    assert(show(Object.keys(t.properties)) === show([...Object.keys(t.properties)].sort()), `properties' keys come sorted; got ${show(Object.keys(t.properties))}`);
    assert(typeof t.properties.createdAt === 'number', `createdAt, an integer, comes as a number, not as the driver's Integer; got ${show(t.properties.createdAt)}`);
    assert(show(Object.keys(t.properties)) === show(['address', 'createdAt', 'eventId', 'polarity', 'tagSlug']), `a TAGS gives every property it records; got ${show(Object.keys(t.properties))}`);
  }
  const developer = tags.find((t) => t.properties.tagSlug === 'developer');
  assert(developer && developer.properties.createdAt === Number(ALICE_TAGS[0].created) && developer.properties.polarity === 'positive' && developer.properties.address === `39999:${PEERS.alice}:tagging-1`, `the developer tag's facts; got ${show(developer)}`);
  const bob = ok(a, 'bob-in');
  assert(bob.relationships.every((r) => r.to === k.bob), 'bob\'s are all in');
});

test('LR8: two relationships of one type between the same two nodes, running the same way, are each listed', () => {
  const { a, k } = main();
  const tags = ok(a, 'alice-tags-out');
  assert(tags.relationships.length === 3 && tags.relationships.every((r) => r.type === 'TAGS' && r.direction === 'out' && r.from === k.alice && r.to === k.bob), `alice's three TAGS to bob, each listed; got ${show(describe(k, tags.relationships))}`);
  assert(show(tags.relationships.map((r) => r.properties.tagSlug).sort()) === show(ALICE_TAGS.map((t) => t.tagSlug).sort()), `told apart by what each records: developer, nostr and artist, once each; got ${show(tags.relationships.map((r) => r.properties.tagSlug))}`);
  const alice = ok(a, 'alice');
  assert(show(alice.relationships.map(placed)) === show(inOrder([['out', 'FOLLOWS', k.bob], ['out', 'TAGS', k.bob], ['out', 'TAGS', k.bob], ['out', 'TAGS', k.bob], ['in', 'TAGS', k.carol]])), `alice: FOLLOWS and the three TAGS out, then carol's TAGS in; got ${show(describe(k, alice.relationships))}`);
  assert(alice.kept === 5 && alice.leftOut === 0, `kept 5; got ${show({ kept: alice.kept, leftOut: alice.leftOut })}`);
});

test('LR9: pages of 50 by default, out before in, by type then the other node\'s key; the cursors page through each relationship once', () => {
  const { a, seed, file } = main();
  const k = seed.keys;
  const order = inOrder([...seed.linkTargets.map((n) => ['out', 'LINKS', k[n]]), ...seed.citeSources.map((n) => ['in', 'CITES', k[n]])]);
  const p1 = ok(a, 'bulk-1');
  assert(p1.relationships.length === 50 && typeof p1.cursor === 'string' && p1.cursor.length > 0, `page 1: 50 and a cursor; got ${p1.relationships.length} and ${show(p1.cursor)}`);
  const p2 = ok(runOver(file, [get('bulk-2', 'owner', { node: k.bulkHub, cursor: p1.cursor })]), 'bulk-2');
  assert(p2.relationships.length === 50 && typeof p2.cursor === 'string', `page 2: 50 more and a cursor; got ${p2.relationships.length} and ${show(p2.cursor)}`);
  assert(p2.relationships.slice(0, 20).every((r) => r.direction === 'out') && p2.relationships.slice(20).every((r) => r.direction === 'in'), `page 2 runs from the last 20 out into the first 30 in; got ${show(p2.relationships.map((r) => r.direction).join(','))}`);
  const p3 = ok(runOver(file, [get('bulk-3', 'owner', { node: k.bulkHub, cursor: p2.cursor })]), 'bulk-3');
  assert(p3.relationships.length === 30 && p3.cursor === null, `page 3: the last 30, and a null cursor; got ${p3.relationships.length} and ${show(p3.cursor)}`);
  const all = [...p1.relationships, ...p2.relationships, ...p3.relationships].map(placed);
  assert(show(all) === show(order), 'the three pages hold every relationship of bulkHub exactly once: the 70 LINKS out by key, then the 60 CITES in by key');
  for (const p of [p1, p2, p3]) assert(p.kept === 130 && p.leftOut === 0 && p.tagsLeftOut === 0, `every page counts the whole list, 130; got ${show({ kept: p.kept, leftOut: p.leftOut })}`);
});

test('LR10: a limit from 1 to 200 caps the page; 0 or 201 is refused naming limit; a page of 1 parts relationships that share everything else', () => {
  const { a, k, file } = main();
  const three = ok(a, 'limit-3');
  assert(show(three.relationships.map(placed)) === show(hubAll(k).slice(0, 3)) && typeof three.cursor === 'string', `limit 3: the first 3 in order, and a cursor; got ${show(describe(k, three.relationships))}`);
  const max = ok(a, 'limit-200');
  assert(max.relationships.length === 130 && max.cursor === null, `limit 200: all 130 of bulkHub, and a null cursor; got ${max.relationships.length}`);
  refused(a, 'limit-0', 400, 'invalid-input', 'limit');
  refused(a, 'limit-201', 400, 'invalid-input', 'limit');
  const slugs = [];
  let cursor = null;
  let pages = 0;
  do {
    const p = ok(runOver(file, [get('one', 'owner', { node: k.alice, type: 'TAGS', direction: 'out', limit: 1, ...(cursor ? { cursor } : {}) })]), 'one');
    assert(p.relationships.length <= 1, `a page of 1 holds at most 1; got ${p.relationships.length}`);
    slugs.push(...p.relationships.map((r) => r.properties.tagSlug));
    cursor = p.cursor;
    pages++;
  } while (cursor && pages < 6);
  assert(cursor === null && show([...slugs].sort()) === show(ALICE_TAGS.map((t) => t.tagSlug).sort()) && slugs.length === 3, `one a page, alice's three TAGS to bob come once each, and the last cursor is null; got ${show(slugs)} after ${pages} pages`);
});

test('LR11: a relationship added or taken out between two pages makes no other appear twice or go missing', () => {
  needDecl();
  const seed = seedRelationships();
  const file = fileOf(seed);
  const k = seed.keys;
  const order = inOrder([...seed.linkTargets.map((n) => ['out', 'LINKS', k[n]]), ...seed.citeSources.map((n) => ['in', 'CITES', k[n]])]);
  const p1 = ok(runOver(file, [get('p1', 'owner', { node: k.bulkHub, limit: 40 })]), 'p1');
  assert(show(p1.relationships.map(placed)) === show(order.slice(0, 40)), 'page 1: the first 40 in order');
  // Between the pages: take out one relationship already answered and one not yet; add one that sorts first and one last.
  const st = S.readState(file);
  const eidOf = (key) => st.nodes.find((n) => n.props.tapestryKey === key).eid;
  const seenGone = order[10];
  const laterGone = order[90];
  for (const [dir, type, key] of [seenGone, laterGone]) {
    const other = eidOf(key);
    const hub = eidOf(k.bulkHub);
    st.rels = st.rels.filter((r) => !(r.type === type && (dir === 'out' ? r.from === hub && r.to === other : r.from === other && r.to === hub)));
  }
  const hub = st.nodes.find((n) => n.props.tapestryKey === k.bulkHub);
  const make = (key, name) => { const n = { eid: st.nextEid++, labels: ['NostrEvent', 'ListItem', 'TapestryNode'], props: { tapestryKey: key, name, pubkey: TA } }; st.nodes.push(n); return n; };
  const first = make('00000000-0000-4000-8000-000000000000', 'sorts first');
  const last = make('ffffffff-ffff-4fff-bfff-ffffffffffff', 'sorts last');
  st.rels.push({ eid: st.nextEid++, type: 'AAA_FIRST', from: hub.eid, to: first.eid, props: {} });
  st.rels.push({ eid: st.nextEid++, type: 'ZZZ_LAST', from: last.eid, to: hub.eid, props: {} });
  writeState(file, st);
  const rest = [];
  let cursor = p1.cursor;
  for (let i = 0; cursor && i < 6; i++) {
    const p = ok(runOver(file, [get('next', 'owner', { node: k.bulkHub, limit: 40, cursor })]), 'next');
    rest.push(...p.relationships.map(placed));
    cursor = p.cursor;
  }
  assert(cursor === null, 'the pages end with a null cursor');
  const answered = [...p1.relationships.map(placed), ...rest].map((x) => show(x));
  assert(new Set(answered).size === answered.length, 'no relationship is answered twice');
  for (const x of order) {
    if (show(x) === show(seenGone) || show(x) === show(laterGone)) continue;
    assert(answered.filter((y) => y === show(x)).length === 1, `a relationship there throughout is answered exactly once; ${show(x)} was answered ${answered.filter((y) => y === show(x)).length} times`);
  }
  assert(!rest.some((x) => show(x) === show(laterGone)), 'a relationship taken out before its page is not answered');
  assert(rest.some((x) => x[1] === 'ZZZ_LAST') && !answered.some((x) => x.includes('AAA_FIRST')), 'a relationship added after the cursor is answered, and one added before it is not');
});

test('LR12: a cursor this read didn\'t give, for this same list, is refused invalid-cursor', () => {
  const { a, k, file } = main();
  const cursor = ok(a, 'limit-3').cursor; // hub, pov everyone, no type, both
  assert(typeof cursor === 'string', 'limit 3 gave a cursor');
  const [read, scope, position] = opened(cursor);
  assert(read === READ && /^[0-9a-f]{16}$/.test(scope) && Array.isArray(position), `the cursor is [read, scope, position], as C1 makes one; got ${show([read, scope, position])}`);
  const typed = ok(runOver(file, [get('typed', 'owner', { node: k.hub, type: 'CITES', direction: 'out', pov: 'everyone', limit: 2 })]), 'typed').cursor;
  assert(typeof typed === 'string', 'type CITES, out, limit 2 gave a cursor');
  const [, typedScope, typedPosition] = opened(typed);
  const listElements = sealed(['graph list-elements', scope, k.hub]);
  const b = runOver(file, [
    get('same-list', 'owner', { node: k.hub, pov: 'everyone', limit: 3, cursor }),
    get('other-node', 'owner', { node: k.alice, pov: 'everyone', limit: 3, cursor }),
    get('other-pov', 'owner', { node: k.hub, limit: 3, cursor }),
    get('other-type', 'owner', { node: k.hub, type: 'CITES', pov: 'everyone', limit: 3, cursor }),
    get('other-direction', 'owner', { node: k.hub, direction: 'out', pov: 'everyone', limit: 3, cursor }),
    get('garbage', 'owner', { node: k.hub, cursor: 'garbage!!' }),
    get('list-elements', 'owner', { node: k.hub, pov: 'everyone', cursor: listElements }),
    get('position-not-a-list', 'owner', { node: k.hub, pov: 'everyone', cursor: sealed([READ, scope, k.hub]) }),
    get('position-direction', 'owner', { node: k.hub, pov: 'everyone', cursor: sealed([READ, scope, ['sideways', ...position.slice(1)]]) }),
    get('position-type', 'owner', { node: k.hub, pov: 'everyone', cursor: sealed([READ, scope, [position[0], 'not a type', ...position.slice(2)]]) }),
    get('position-key', 'owner', { node: k.hub, pov: 'everyone', cursor: sealed([READ, scope, [...position.slice(0, 2), 'not-a-key', ...position.slice(3)]]) }),
    get('position-short', 'owner', { node: k.hub, pov: 'everyone', cursor: sealed([READ, scope, position.slice(0, 3)]) }),
    get('position-in-for-out', 'owner', { node: k.hub, type: 'CITES', direction: 'out', pov: 'everyone', limit: 2, cursor: sealed([READ, typedScope, ['in', ...typedPosition.slice(1)]]) }),
    get('position-type-for-cites', 'owner', { node: k.hub, type: 'CITES', direction: 'out', pov: 'everyone', limit: 2, cursor: sealed([READ, typedScope, [typedPosition[0], 'DEPENDS_ON', ...typedPosition.slice(2)]]) }),
    get('typed-next', 'owner', { node: k.hub, type: 'CITES', direction: 'out', pov: 'everyone', limit: 2, cursor: typed }),
  ]);
  const next = ok(b, 'same-list');
  assert(show(next.relationships.map(placed)) === show(hubAll(k).slice(3, 6)), `the cursor pages its own list: the next 3; got ${show(describe(k, next.relationships))}`);
  for (const id of ['other-node', 'other-pov', 'other-type', 'other-direction', 'garbage', 'list-elements', 'position-not-a-list', 'position-direction', 'position-type', 'position-key', 'position-short', 'position-in-for-out', 'position-type-for-cites']) {
    refused(b, id, 400, 'invalid-cursor', 'cursor');
  }
  const typedNext = ok(b, 'typed-next');
  assert(typedNext.relationships.length === 2 && typedNext.relationships.every((r) => r.type === 'CITES' && r.direction === 'out'), `a typed list's cursor pages its own list; got ${show(describe(k, typedNext.relationships))}`);
});

test('LR13: from the owner\'s point of view, by default, a relationship counts when the node at its other end counts', () => {
  const { a, k } = main();
  const d = ok(a, 'owner');
  const kept = inOrder([
    ...want(k, 'out', HUB.out.filter(([, n]) => !HUB.leftOut.includes(n))),
    ...want(k, 'in', HUB.in.filter(([, n]) => !HUB.leftOut.includes(n))),
  ]);
  assert(show(d.relationships.map(placed)) === show(kept), `the owner's point of view keeps the relationships to the assistant's, the owner's, the author-less and hi (0.2), and to hub itself; got ${show(describe(k, d.relationships))}`);
  for (const gone of HUB.leftOut) assert(!d.relationships.some((r) => r.node && r.node.tapestryKey === k[gone]), `the relationship to ${gone} is left out: its node's author is scored 0.01, unscored, or not in the web of trust`);
  assert(d.kept === 8 && d.leftOut === 4 && d.tagsLeftOut === 4, `kept 8, left out 4, and 4 to tag nodes; got ${show({ kept: d.kept, leftOut: d.leftOut, tagsLeftOut: d.tagsLeftOut })}`);
  assert(show(d.pov) === show({ name: 'owner', observer: OWNER, cutoff: 0.05, scored: true }), `pov: the owner's, as observer, with the default cutoff and scores; got ${show(d.pov)}`);
  for (const id of ['owner-named', 'owner-pubkey']) {
    const x = ok(a, id);
    assert(show(x) === show(d), `${id}: pov=owner, and the owner's own pubkey, read exactly as the default; got ${show(x.pov)} ${x.kept}/${x.leftOut}`);
  }
  const out = ok(a, 'owner-out');
  const inn = ok(a, 'owner-in');
  assert(out.kept === 6 && out.leftOut === 3 && inn.kept === 3 && inn.leftOut === 1, `out: 6 kept and 3 left out; in: 3 kept (the loop among them) and 1 left out; got ${show([out.kept, out.leftOut, inn.kept, inn.leftOut])}`);
  const cites = ok(a, 'owner-cites');
  assert(cites.kept === 4 && cites.leftOut === 4, `type CITES: 4 kept, 4 left out (citedLo, citedNoscore, citedNouser, and citer's in); got ${show({ kept: cites.kept, leftOut: cites.leftOut })}`);
});

test('LR14: the node asked about is never left out, whoever its author; a relationship from it to itself is judged by it', () => {
  const { a, k } = main();
  const d = ok(a, 'citer');
  assert(d.node && d.node.tapestryKey === k.citer && d.node.author === PEERS.lo && d.node.own === false, `citer, by a peer scored 0.01, is still answered as the node asked about; got ${show(d.node)}`);
  assert(show(d.relationships.map(placed)) === show([['out', 'CITES', k.hub]]) && d.kept === 1 && d.leftOut === 0, `its relationship to hub (the assistant's) counts, judged by hub; got ${show(describe(k, d.relationships))} ${d.kept}/${d.leftOut}`);
  const owner = ok(a, 'owner');
  assert(owner.relationships.some((r) => r.type === 'MENTIONS' && r.node.tapestryKey === k.hub), 'hub\'s relationship to itself counts: hub is the assistant\'s');
});

test('LR15: kept and leftOut count the whole list, not the page', () => {
  const { a } = main();
  const d = ok(a, 'owner-limit-2');
  assert(d.relationships.length === 2 && d.kept === 8 && d.leftOut === 4 && d.tagsLeftOut === 4 && typeof d.cursor === 'string', `a page of 2 still says 8 kept, 4 left out and 4 to tag nodes; got ${show({ n: d.relationships.length, kept: d.kept, leftOut: d.leftOut, tagsLeftOut: d.tagsLeftOut })}`);
});

test('LR16: pov=everyone keeps every relationship and leaves nothing out', () => {
  const { a } = main();
  const d = ok(a, 'hub');
  assert(d.relationships.length === 12 && d.kept === 12 && d.leftOut === 0, `everyone: all 12, nothing left out; got ${show({ n: d.relationships.length, kept: d.kept, leftOut: d.leftOut })}`);
  assert(show(d.pov) === show({ name: 'everyone', observer: null, cutoff: null, scored: null }), `pov: everyone's, with no observer, cutoff or scores; got ${show(d.pov)}`);
});

test('LR17: nothing about a point of view is stored: new scores answer differently, with no write between', () => {
  needDecl();
  const seed = seedRelationships();
  const file = fileOf(seed);
  const k = seed.keys;
  const keysOf = (d) => d.relationships.map((r) => r.node.tapestryKey);
  const first = ok(runOver(file, [get('before', 'owner', { node: k.hub, limit: 200 })]), 'before');
  assert(keysOf(first).includes(k.citedHi) && !keysOf(first).includes(k.citedLo), 'at first citedHi (0.2) counts and citedLo (0.01) does not');
  // GrapeRank writes new scores: hi falls to 0.01, lo rises to 0.3.
  const st = S.readState(file);
  for (const n of st.nodes) {
    if (!n.labels.includes('NostrUser')) continue;
    if (n.props.pubkey === PEERS.hi) n.props.influence = 0.01;
    if (n.props.pubkey === PEERS.lo) n.props.influence = 0.3;
  }
  const logLength = st.log.length;
  writeState(file, st);
  const second = ok(runOver(file, [get('after', 'owner', { node: k.hub, limit: 200 })]), 'after');
  assert(!keysOf(second).includes(k.citedHi) && keysOf(second).includes(k.citedLo) && keysOf(second).includes(k.citer), `after the new scores, citedLo and citer count and citedHi does not; got ${show(describe(k, second.relationships))}`);
  assert(second.kept === 9 && second.leftOut === 3, `9 kept and 3 left out; got ${show({ kept: second.kept, leftOut: second.leftOut })}`);
  const log = S.readState(file).log.slice(logLength);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `the read only reads; nothing is written for a point of view; the log: ${show(log)}`);
});

test('LR18: before the owner\'s scores exist, only the instance\'s own count, and the answer says the scores aren\'t there yet', () => {
  needDecl();
  const seed = seedRelationships({ unscored: true });
  const k = seed.keys;
  const d = ok(runOver(fileOf(seed), [get('unscored', 'owner', { node: k.hub, limit: 200 })]), 'unscored');
  assert(!d.relationships.some((r) => r.node.tapestryKey === k.citedHi), `citedHi is left out too; got ${show(describe(k, d.relationships))}`);
  assert(d.kept === 7 && d.leftOut === 5, `kept 7, left out 5; got ${show({ kept: d.kept, leftOut: d.leftOut })}`);
  assert(d.pov && d.pov.name === 'owner' && d.pov.scored === false, `pov.scored is false: the owner's scores aren't there yet; got ${show(d.pov)}`);
});

test('LR19: a pov the instance can\'t read from is refused unknown-pov, saying which it can; a malformed one invalid-input', () => {
  const { a } = main();
  for (const id of ['pov-stranger', 'pov-admin']) {
    const b = refused(a, id, 400, 'unknown-pov', 'pov');
    assert(/owner/.test(b.error) && /everyone/.test(b.error), `${id}: the refusal says it reads from the owner's point of view or everyone's; got ${show(b.error)}`);
  }
  refused(a, 'pov-house', 400, 'invalid-input', 'pov');
});

test('LR20: no node, or one that names no node of the graph (a change entry is not one), is refused, naming node', () => {
  const { a } = main();
  for (const id of ['no-node', 'no-node-paged']) refused(a, id, 400, 'missing-input', 'node');
  refused(a, 'unknown-node', 404, 'unknown-node', 'node');
  refused(a, 'entry', 404, 'unknown-node', 'node');
});

test('LR21: a malformed node, type or direction, and an input it doesn\'t take, are refused, naming them', () => {
  const { a } = main();
  refused(a, 'bad-node', 400, 'invalid-input', 'node');
  for (const id of ['bad-type-space', 'bad-type-digit', 'bad-type-dash', 'bad-type-tick']) refused(a, id, 400, 'invalid-input', 'type');
  for (const id of ['bad-direction', 'bad-direction-case']) refused(a, id, 400, 'invalid-input', 'direction');
  refused(a, 'unknown-input', 400, 'unknown-input', 'foo');
});

test('LR22: a visitor gets 401 and a stranger 403; an admin reads what the owner reads', () => {
  const { a } = main();
  needDecl();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  assert(show(ok(a, 'admin')) === show(ok(a, 'owner')), 'an admin reads exactly what the owner reads, from the owner\'s point of view');
});

test('LR23: it writes nothing: it only reads, the graph is as it was, and no change entry is recorded', () => {
  const { a, file, before } = main();
  ok(a, 'hub');
  ok(a, 'owner');
  const after = S.readState(file);
  const log = after.log.slice(before.log.length);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `list-relationships opens no write transaction; the log: ${show(log.filter((e) => e.call !== 'read').slice(0, 5))}`);
  assert(after.nodes.length === before.nodes.length && after.rels.length === before.rels.length, 'the graph has the same nodes and relationships');
  assert(S.entriesOf(after).length === S.entriesOf(before).length, 'no change entry was recorded');
});

test('LR24: the command answers what the route answers, refusals included', () => {
  const { a } = main();
  needDecl();
  const cases = [['cli-5', 'route-5', 0], ['cli-refusal', 'route-refusal', 1], ['cli-in-cites', 'route-in-cites', 0]];
  for (const [c, r, code] of cases) {
    const cmd = a.cmd(c);
    assert(cmd.code === code, `${c} exits ${code}; got ${cmd.code} ${String(cmd.stderr).slice(-300)}`);
    let body = null;
    try { body = JSON.parse(cmd.stdout); } catch { /* reported below */ }
    assert(body && show(body) === show(a.req(r).body), `${c} prints what ${r} answers; command ${show(body).slice(0, 300)}, route ${show(a.req(r).body).slice(0, 300)}`);
  }
  const inCites = ok(a, 'route-in-cites');
  assert(inCites.direction === 'in' && inCites.type === 'CITES' && inCites.relationships.length === 1, `--direction in --type CITES lists citer's; got ${show(inCites)}`);
});

test('LR25: it is listed for an admin with its inputs and refusals, and has its /docs entry', () => {
  const { a } = main();
  needDecl();
  const list = a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'list-relationships');
  assert(e, `graph list-relationships is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'read' && e.method === 'GET' && e.access === 'owner-and-admins' && e.route === ROUTE && e.command === 'tapestry graph list-relationships', `a GET read for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs).sort()) === show(INPUTS), `its inputs: node, type, direction, pov, limit and cursor; got ${show(Object.keys(e.inputs))}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['unknown-node:404', 'unknown-pov:400', 'invalid-cursor:400', 'missing-input:400', 'unknown-input:400', 'invalid-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    const names = p && p.get ? (p.get.parameters || []).map((x) => x.name).sort() : null;
    process.stdout.write('RESULT:' + JSON.stringify({ methods: p ? Object.keys(p) : null, names }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('list-relationships-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const docs = line ? JSON.parse(line) : null;
  assert(docs && show(docs.methods) === show(['get']), `/docs has GET ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
  assert(show(docs.names) === show(INPUTS), `/docs gives its six query parameters; got ${show(docs.names)}`);
});

test('LR26: its paging, point of view, node and relationship are reads.js\'s, and the catalog says so', () => {
  needDecl();
  const child = spawnSync(process.execPath, ['-e', `
    const R = require(${JSON.stringify(READS)});
    const d = require(${JSON.stringify(DECL)});
    const pick = (r) => r && { code: r.code, status: r.status };
    const props = (d.result && d.result.schema && d.result.schema.properties) || {};
    process.stdout.write('RESULT:' + JSON.stringify({
      limit: [d.inputs.limit && d.inputs.limit.schema, R.LIMIT_INPUT && R.LIMIT_INPUT.schema],
      cursor: [d.inputs.cursor && d.inputs.cursor.schema, R.CURSOR_INPUT && R.CURSOR_INPUT.schema],
      pov: [d.inputs.pov && d.inputs.pov.schema, R.POV_INPUT && R.POV_INPUT.schema],
      direction: d.inputs.direction && d.inputs.direction.schema,
      type: d.inputs.type && d.inputs.type.schema,
      node: d.inputs.node,
      refusals: (d.refusals || []).map(pick),
      invalidCursor: pick(R.INVALID_CURSOR), unknownPov: pick(R.UNKNOWN_POV),
      answered: [props.node, R.NODE],
      relationship: [props.relationships && props.relationships.items, R.RELATIONSHIP || null],
      povSchema: [props.pov, R.POV],
      counts: ['kept', 'leftOut', 'tagsLeftOut'].map((c) => props[c] && props[c].type),
    }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('list-relationships-once-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const x = line ? JSON.parse(line) : null;
  assert(x, `the declaration and reads.js load; ${(child.stderr || '').slice(-400)}`);
  for (const input of ['limit', 'cursor', 'pov']) {
    assert(x[input][1] && show(x[input][0]) === show(x[input][1]), `its ${input} input is reads.js's; got ${show(x[input])}`);
  }
  assert(x.direction && x.direction.type === 'string' && show([...x.direction.enum].sort()) === show(['both', 'in', 'out']) && x.direction.default === 'both', `direction takes out, in or both, both by default; got ${show(x.direction)}`);
  assert(x.type && x.type.type === 'string' && typeof x.type.pattern === 'string', `type is text with a pattern; got ${show(x.type)}`);
  const typeRe = new RegExp(x.type.pattern);
  for (const good of ['CITES', 'HAS_ELEMENT', 'is_a_superset_of', 'A1']) assert(typeRe.test(good), `type's pattern takes ${good}`);
  for (const bad of ['HAS ELEMENT', '1CITES', 'IS-A', '', '_X', 'A`B']) assert(!typeRe.test(bad), `type's pattern refuses ${show(bad)}`);
  assert(x.node && x.node.required === true, `node is required; got ${show(x.node)}`);
  for (const r of [x.invalidCursor, x.unknownPov]) assert(r && x.refusals.some((y) => y.code === r.code && y.status === r.status), `it declares reads.js's ${show(r)}; got ${show(x.refusals)}`);
  assert(x.refusals.some((y) => y.code === 'unknown-node' && y.status === 404), `it declares unknown-node, 404; got ${show(x.refusals)}`);
  assert(x.answered[1] && show(x.answered[0]) === show(x.answered[1]), `the node asked about is answered as reads.js's NODE; got ${show(x.answered[0])}`);
  assert(x.relationship[1] && show(x.relationship[0]) === show(x.relationship[1]), `its relationships are reads.js's RELATIONSHIP; got ${show(x.relationship)}`);
  assert(x.povSchema[1] && show(x.povSchema[0]) === show(x.povSchema[1]), `its pov is reads.js's POV; got ${show(x.povSchema)}`);
  assert(show(x.counts) === show(['integer', 'integer', 'integer']), `kept, leftOut and tagsLeftOut are integers; got ${show(x.counts)}`);
  const text = fs.readFileSync(CATALOG, 'utf8');
  const conventions = (text.split(/\n## Conventions\n/)[1] || '').split(/\n## /)[0];
  for (const words of ['0013', '`direction`', '`from`', '`to`', '`properties`', 'other end']) {
    assert(conventions.includes(words), `the catalog's Conventions say how a relationship is answered and judged, mentioning ${words}`);
  }
  const row = text.split('\n').find((l) => l.startsWith('| `list-relationships` |')) || '';
  assert(/kept/.test(row) && /leftOut/.test(row) && /tagsLeftOut/.test(row) && /cursor/.test(row), `§1's list-relationships row gives the answer as built; got ${show(row)}`);
  const reads = (text.split(/\n## 1\. Graph reads\n/)[1] || '').split(/\n## /)[0];
  assert(!/A walk follows only the edges whose authors its point of view trusts/.test(reads), '§1 no longer says a walk follows only the edges whose authors its point of view trusts: no relationship records its author');
  assert(/No relationship records its author yet/.test(reads), '§1 says no relationship records its author yet, so a walk follows a relationship only to a node its point of view counts');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
