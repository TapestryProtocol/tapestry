'use strict';
/**
 * lifecycle seed-firmware, through its route and its command — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC1–AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Decisions 1, 5–12)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *
 * Stack-free. The real catalog runs in a child process (test/helpers/operationsHarness.js) over a graph kept in a file,
 * every statement run by test/helpers/cypherEngine.js with Neo4j's uniqueness rules (graphFake engine 'cypher'), with
 * lifecycle's system faked (test/helpers/lifecycleFakes.js: the lock, and the graph's answer to C.begin), the spy on
 * everything that signs or reads a key, every service endpoint dead, and TAPESTRY_FIRMWARE_DIR naming a copy of
 * firmware/active, changed where a case says. Status's firmware part runs in a child of its own whose driver and
 * graph seam answer from the same graph (seedFirmwareFixtures.statusFirmware). The oracle is today's install's letters
 * (test/helpers/todaysFirmwareRoutes.js).
 *
 * The runs: FRESH, an empty graph installed (two calls at once first), then repeated, refused and listed, the command,
 * and graph create-concept; UPDATE, FRESH's graph edited by hand and the firmware changed, installed again, twice;
 * TAKE, after UPDATE: take by key, by address, takeAll, and again; FIRST, today's install's graph met for the first
 * time, again, then takeAll; and one run each for busy, graph-unavailable, no-assistant and firmware-unreadable.
 *
 *   SF1  the declaration: a write for the owner and admins, with run; version, take (≤500) and takeAll; its refusals,
 *        address-held among them (Amendment 3)
 *   SF2  listed for agents with every refusal; /docs has POST /api/tapestry/lifecycle/seed-firmware
 *   SF3  AC1 nodes: each at today's address, once, with today's tags (a set), role labels, JSON, name and slug, and
 *        TapestryNode with a key; no NostrEvent, no id; three concept graphs as create-concept made them (Amendment 1)
 *   SF4  AC1 relationships: the core edges, the existing nodes and sets, the concept manifests', 1d½, ENUMERATES with its
 *        two properties, 1e's prune, and the relationship letters'
 *   SF5  AC1 the six headers carry the pointer b, and the b claim, REFERENCES {source: 'b-tag'}, to a node at its address
 *   SF6  AC1 nothing is signed, published or read from a key store; graph create-concept then makes a concept
 *   SF7  AC2 each node's install record: cameFrom and installed
 *   SF8  AC2 the installed-firmware graph: at its reserved address, 39999:<ta>:installed-firmware (Amendment 3), with
 *        its mark (its installed record and installedFirmware), labels, tags, HAS_ELEMENT from graph's superset, its JSON
 *   SF9  AC2 status: seeded (version, at, by, source, nodes, relationships, changedSince); none before any run, for an
 *        empty graph and for today's install's graph; readInstallState still counts letters
 *   SF10 AC3 again: every node unchanged, nothing written, no entry; with version 1.0.0 and v1.0.0 too
 *   SF11 AC3 two calls at once install once
 *   SF12 AC6 the answer: version, source, nodes, counts, relationships, letterOutOfDate, cacheOutOfDate, rulesCheck,
 *        change, note
 *   SF13 AC6 the change entry: who, and each node made; graph history finds it by each
 *   SF14 AC4 update: an unedited node whose file changed is changed, its record moved; a new file's node added
 *   SF15 AC4 update: an edited node is kept, naming its JSON, its name, or a re-pointed b; its record not moved; the graph
 *        keeps the edit; again, it is kept again and nothing is written
 *   SF16 AC4 update: a node the source no longer has is not-in-source, and stays; nothing is deleted
 *   SF17 AC4 update: relationships: one the firmware no longer makes is removed, a new one added; one removed by hand is
 *        kept; one whose properties were edited is kept; the instance's own stay, a direct link under a firmware
 *        superset included, counted as others
 *   SF18 AC4 the instance's own element under a firmware concept, and its link, stay as they are
 *   SF19 AC5 graph-rule's items: an edited one put back, one whose file changed changed, the rest unchanged
 *   SF20 AC6 rules check reports what it finds over the firmware's nodes, and undoes nothing
 *   SF21 AC4 take by tapestryKey and by address: that node changed, its record moved; takeAll: every kept node and
 *        relationship, the b claim replaced with its tag; then nothing left to change
 *   SF22 AC4 first contact with today's install: equal nodes unchanged and adopted, keeping their letters; the schemas
 *        pass 3b filled (four: it skips dog's), the three concept graphs pass 1c flattened and the edited nodes kept with
 *        noRecord; missing relationships kept with noRecord
 *   SF23 AC4 first contact again: still kept, nothing written; then takeAll: each kept node changed, keeping its
 *        tapestryKey, id, NostrEvent and created_at, its old tag nodes gone, and named in letterOutOfDate
 *   SF24 AC7 unknown-version, naming the version carried; not-firmware, naming each ref; nothing changed
 *   SF25 AC7 firmware-unreadable, naming each file and problem; the graph keeps the firmware it had
 *   SF26 AC7 busy while another lifecycle job runs; graph-unavailable, in words that say what couldn't be installed
 *   SF27 AC7 no-assistant
 *   SF28 AC7 who may call: the owner and an admin, each the entry's; a visitor 401, a stranger 403; 415; unknown input
 *   SF29 AC7 the internal command, with no sign-in: the route's answers, the entry local's; its refusal the route's
 *   SF30 AC7 what stays as it was: today's install, its route and its module
 *   SF31 AC7 the docs: catalog §8, BIBLE §7 and §11 say what it does
 *   SF32 TAPESTRY_FIRMWARE_DIR: the firmware module reads the folder it names, read once at load, firmware/active
 *        otherwise
 * Review round 1 (engineering-team/reviews/graph-operations-first-slice/37-seed-firmware.md; ADR 0037 Amendment 3):
 *   SF33 Blocking 1, items 1–2: after the Dashboard's offload of the installed-firmware graph's json and a superset's,
 *        and a derive: status still reads seeded, and a repeat answers every node unchanged, with no change entry
 *   SF34 Blocking 2, item 3: an admin's own "installed firmware" element of graph, made by graph create-element before
 *        the first run, stays as it was, and what it lists isn't read as the last install's; seed-firmware writes its
 *        own at 39999:<ta>:installed-firmware, with its mark
 *   SF35 Blocking 2, item 3: a node at the reserved address without the mark (neither part; the section and no record;
 *        a record and no section) is refused address-held (409), naming it, and nothing is written
 *   SF36 N2, item 4: an update lists the relationships it kept apart, in installedFirmware.keptRelationships
 *   SF37 N2, item 4: first contact lists a relationship it kept with noRecord apart; a firmware that drops it leaves it
 *        in place, reported kept
 *   SF38 N1, item 5: an alias that isn't a plain name refuses firmware-unreadable, naming the file and the alias
 * Review round 2 ("Round 2" in the same review):
 *   SF39 nit 1: seed-firmware's own installed-firmware graph, its record there, whose offloaded json has no entry in
 *        the store, is refused in words that say its JSON can't be read, not that it isn't seed-firmware's; nothing
 *        is written
 * Review round 4 ("Round 4"; ADR 0037 Amendment 4):
 *   SF40 R4-N2: rulesCheck judges only the firmware's own nodes: rule 12 (word-types-hold-concept-keys) is reported on
 *        a firmware node that breaks it, never on the instance's own element or another author's that break it too;
 *        judged is at most the target's nodes; its shape kept
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('../../helpers/seedFirmwareFixtures');
const S = require('../../helpers/graphOpsSuite');

const { assert, show, TA, ROUTE } = F;
const { OWNER, ADMIN } = S;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware — install and update the firmware as the instance\'s own nodes, keeping local edits');

const OTHER = 'ee'.repeat(32);
const ROVER = 'concepts/dog/elements/rover.json';
const DCOSL = 'concepts/nostr-relay/elements/dcosl-brainstorm-world.json';
const FIDO = 'concepts/dog/elements/fido.json';
const NULL = 'concepts/json-data-type/elements/null.json';
const RULE_EDITED = 'concepts/graph-rule/elements/class-thread-acyclic.json';
const RULE_CHANGED = 'concepts/graph-rule/elements/concept-slug-unique.json';
const CODES = Object.freeze({ 'unknown-version': 409, 'firmware-unreadable': 409, 'not-firmware': 400, 'no-assistant': 409, 'address-held': 409, busy: 409, 'graph-unavailable': 409 });
const first = (xs) => show(xs.slice(0, 5)).slice(0, 800);
const words = (b) => String(b && (b.error || b.message || ''));

// ── the runs ──
let FA = null;
const firmwareA = () => { if (!FA) FA = F.copyFirmware({}, { label: 'seed-firmware-fa-' }); return FA; };
const list = { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'owner' };

let FRESH = null;
function fresh() {
  if (FRESH) return FRESH;
  F.needDecl();
  const many = Array.from({ length: 501 }, (_, i) => `39999:${TA}:n${i}`);
  const a = F.runSeed({
    firmwareDir: firmwareA(), spy: true, label: 'seed-firmware-fresh-',
    requests: [
      F.together(F.seed('a1', 'owner'), F.seed('a2', 'owner')),
      F.seed('again', 'owner'),
      F.seed('admin', 'admin'),
      F.seed('v-plain', 'owner', { version: '1.0.0' }),
      F.seed('v-dir', 'owner', { version: 'v1.0.0' }),
      F.seed('v-unknown', 'owner', { version: '2.0.0' }),
      F.seed('take-unknown', 'owner', { take: [`39999:${TA}:no-such-node`, '00000000-0000-4000-8000-000000000000'] }),
      F.seed('take-many', 'owner', { take: many }),
      F.seed('visitor', 'visitor'),
      F.seed('stranger', 'stranger'),
      { id: 'text', method: 'POST', url: ROUTE, caller: 'owner', contentType: 'text/plain', rawBody: 'version=1.0.0' },
      F.seed('unknown-input', 'owner', { foo: 1 }),
      list,
      { id: 'create-concept', method: 'POST', url: '/api/tapestry/graph/create-concept', caller: 'owner', body: { name: 'widget' } },
    ],
    cli: [
      { id: 'cli', argv: ['lifecycle', 'seed-firmware'] },
      { id: 'cli-refused', argv: ['lifecycle', 'seed-firmware', '--version', '9.9.9'] },
    ],
  });
  const installed = [a.req('a1'), a.req('a2')].find((r) => r.status === 200 && r.body && r.body.data && F.countOf(r.body.data, 'added') > 0);
  FRESH = { a, s: a.state(), installed: installed ? installed.body.data : null, installedId: installed ? installed.id : null };
  return FRESH;
}

/** UPDATE: FRESH's graph, edited as admins and raw queries leave it, and the firmware changed. */
const DOG_EDIT = 'Dogs, as this instance\'s admins describe them.';
let UPDATE = null;
async function update() {
  if (UPDATE) return UPDATE;
  const { s: base } = fresh();
  const o = await F.oracle(firmwareA());
  const s = JSON.parse(JSON.stringify(base));
  const node = (address) => F.nodesAt(s, address)[0];
  const tag = (address, type) => F.relsOf(s, { type: 'HAS_TAG', from: address }).map((r) => r.toNode).filter((t) => t.props.type === type);
  const keyOf = (address) => node(address).props.tapestryKey;
  // E1: dog's header JSON edited.
  for (const t of tag(o.headerOf('dog'), 'json')) { const j = JSON.parse(t.props.value); j.conceptHeader.description = DOG_EDIT; t.props.value = JSON.stringify(j); }
  // E2: nostr-relay's b re-pointed, as b-defer or a raw query leaves it.
  for (const t of tag(o.headerOf('nostr-relay'), 'b')) t.props.value = `39998:${OTHER}:nostr-relay`;
  // E3: rover renamed.
  const rover = node(o.elementOf(ROVER));
  rover.props.name = 'Rover the Brave'; rover.props.tapestryValue = 'Rover the Brave';
  for (const t of tag(o.elementOf(ROVER), 'name')) t.props.value = 'Rover the Brave';
  // E4: a graph-rule item edited by hand.
  for (const t of tag(o.elementOf(RULE_EDITED), 'json')) { const j = JSON.parse(t.props.value); j.graphRule.says = `${j.graphRule.says} (edited by hand)`; t.props.value = JSON.stringify(j); }
  // R1: numeric-types → number removed by hand.
  const numeric = node(o.setOf('concepts/json-data-type/sets/numeric-types.json'));
  const number = node(o.elementOf('concepts/json-data-type/elements/number.json'));
  s.rels = s.rels.filter((r) => !(r.type === 'HAS_ELEMENT' && r.from === numeric.eid && r.to === number.eid));
  // R2: dog-breed's ENUMERATES edited.
  const schemaOf = (slug) => [...o.letters.values()].find((l) => l.role === 'jsonSchema' && l.concept === slug).address;
  const en = F.relsOf(s, { type: 'ENUMERATES', from: o.supersetOf('dog-breed'), to: schemaOf('dog') })[0];
  if (en) s.rels.find((r) => r.eid === en.eid).props.sourcePath = 'dogBreed.slug';
  // R4: a direct link under a firmware superset, which the firmware's prune takes out: the instance's own.
  F.addRel(s, node(o.supersetOf('json-data-type')), 'HAS_ELEMENT', node(o.elementOf('concepts/json-data-type/elements/integer.json')));
  // O1: an element of the instance's own under dog.
  const biscuit = F.addNode(s, ['ListItem'], { uuid: `39999:${TA}:${F.dtag.childDTag('Biscuit', `39998:${TA}:dog`)}`, kind: 39999, pubkey: TA, name: 'Biscuit', tapestryValue: 'Biscuit', created_at: 1700000001 });
  F.addRel(s, node(o.supersetOf('dog')), 'HAS_ELEMENT', biscuit);
  // RC: a firmware property given a second parent, which rules check finds.
  const ppOf = (slug) => [...o.letters.values()].find((l) => l.role === 'primaryProperty' && l.concept === slug).address;
  F.addRel(s, node(ppOf('dog')), 'IS_A_PROPERTY_OF', node(schemaOf('nostr-relay')));
  const before = JSON.parse(JSON.stringify(s));
  const fb = F.copyFirmware({
    [DCOSL]: (j) => ({ ...j, nostrRelay: { ...j.nostrRelay, note: 'changed in the newer firmware' } }),
    'concepts/dog/concept-header.json': (j) => ({ ...j, conceptHeader: { ...j.conceptHeader, description: 'Dogs are good.' } }),
    [FIDO]: { word: { slug: 'dog--fido', name: 'dog: Fido', title: 'Dog: Fido', wordTypes: ['word', 'dog'] }, dog: { slug: 'fido', name: 'Fido', breed: 'goldenRetriever' } },
    [NULL]: null,
    [RULE_CHANGED]: (j) => ({ ...j, graphRule: { ...j.graphRule, says: `${j.graphRule.says} (the newer rulebook)` } }),
    'concepts/nostr-relay/manifest.json': (m) => ({ ...m, HAS_ELEMENT: m.HAS_ELEMENT.filter((e) => !(e.nodeFrom === 'paid-relays' && e.nodeTo === 'nostr-wine')) }),
    'concepts/json-data-type/manifest.json': (m) => ({ ...m, HAS_ELEMENT: [...m.HAS_ELEMENT, { nodeFrom: 'numeric-types', nodeTo: 'string' }] }),
  }, { from: firmwareA(), label: 'seed-firmware-fb-' });
  const keys = { dog: keyOf(o.headerOf('dog')), relay: keyOf(o.headerOf('nostr-relay')), rover: rover.props.tapestryKey, dcosl: keyOf(o.elementOf(DCOSL)), edited: keyOf(o.elementOf(RULE_EDITED)), changed: keyOf(o.elementOf(RULE_CHANGED)), nul: keyOf(o.elementOf(NULL)) };
  const history = (id, key) => ({ id, method: 'GET', url: `/api/tapestry/graph/history?node=${key}&limit=200`, caller: 'owner' });
  const b1 = F.runSeed({ state: s, firmwareDir: fb, label: 'seed-firmware-update-', requests: [F.seed('update', 'owner'), F.seed('update-again', 'owner'), history('h-dcosl', keys.dcosl)] });
  const s1 = b1.state();
  const b2 = F.runSeed({
    state: s1, firmwareDir: fb, label: 'seed-firmware-take-',
    requests: [F.seed('take-key', 'owner', { take: [keys.rover] }), F.seed('take-address', 'owner', { take: [o.headerOf('dog')] }), F.seed('take-all', 'admin', { takeAll: true }), F.seed('after', 'owner')],
  });
  UPDATE = { o, ob: await F.oracle(fb), fb, before, base, b1, s1, b2, s2: b2.state(), keys, biscuit: biscuit.props.uuid, schemaOf, ppOf };
  return UPDATE;
}

/** FIRST: today's install's graph, with dog's header edited and nostr-relay's b re-pointed since. */
let FIRST = null;
async function firstContact() {
  if (FIRST) return FIRST;
  F.needDecl();
  const o = await F.oracle(firmwareA());
  const s = F.todaysGraph(o, {
    edges: [{ from: o.supersetOf('concept-header'), type: 'HAS_ELEMENT', to: o.headerOf('dog') }],
    edit: (st) => {
      for (const t of F.relsOf(st, { type: 'HAS_TAG', from: o.headerOf('dog') }).map((r) => r.toNode).filter((x) => x.props.type === 'json')) { const j = JSON.parse(t.props.value); j.conceptHeader.description = DOG_EDIT; t.props.value = JSON.stringify(j); }
      for (const t of F.relsOf(st, { type: 'HAS_TAG', from: o.headerOf('nostr-relay') }).map((r) => r.toNode).filter((x) => x.props.type === 'b')) t.props.value = `39998:${OTHER}:nostr-relay`;
    },
  });
  const c = F.runSeed({ state: s, firmwareDir: firmwareA(), label: 'seed-firmware-first-', requests: [F.seed('first', 'owner'), F.seed('first-again', 'owner'), F.seed('first-all', 'owner', { takeAll: true })] });
  FIRST = { o, before: s, c, after: c.state() };
  return FIRST;
}

/** What first contact keeps on FIRST's graph: the four schemas pass 3b filled, three concept graphs, and the fixture's two edits. */
const keptFirst = (o) => [...F.keptOnFirstContact(o), o.headerOf('dog'), o.headerOf('nostr-relay')];
const seedEntries = (s) => F.entries(s).filter((e) => e.operation === 'lifecycle seed-firmware');
const firmwareNodes = (s, o) => [...o.letters.keys()].map((a) => F.nodesAt(s, a));

// ── the declaration and its listing ──
test('SF1 [Decision 1, Amendment 3 item 3]: the declaration: a write for the owner and admins, with run; version, take (up to 500) and takeAll, each optional; its seven refusals, address-held among them', () => {
  F.needDecl();
  const d = require(F.DECL);
  assert(d.group === 'lifecycle' && d.name === 'seed-firmware' && d.kind === 'write' && d.access === 'owner-and-admins', `lifecycle seed-firmware, a write for the owner and admins; got ${show({ group: d.group, name: d.name, kind: d.kind, access: d.access })}`);
  assert(typeof d.run === 'function' && d.apply === undefined && d.guards === undefined, 'it has run, as lifecycle\'s writes do; no apply, no guards (the bootstrap path)');
  const ins = d.inputs || {};
  assert(show(Object.keys(ins).sort()) === show(['take', 'takeAll', 'version']), `inputs version, take and takeAll; got ${show(Object.keys(ins))}`);
  assert(Object.values(ins).every((x) => !x.required), 'each is optional');
  assert(ins.version.schema.type === 'string' && ins.take.schema.type === 'array' && ins.take.schema.maxItems === 500 && ins.takeAll.schema.type === 'boolean', `their types: a string, a list of 500 at most, a boolean; got ${show(ins)}`);
  const own = Object.fromEntries((d.refusals || []).map((x) => [x.code, x.status]));
  for (const [code, status] of Object.entries(CODES)) assert(own[code] === status, `it declares ${code} (${status}); got ${show(d.refusals)}`);
});

test('SF2 [AC7]: listed for agents with its inputs and every refusal, and its /docs entry is POST /api/tapestry/lifecycle/seed-firmware', () => {
  const { a } = fresh();
  const e = ((a.req('list').body.data || {}).operations || []).find((x) => x.group === 'lifecycle' && x.name === 'seed-firmware');
  assert(e && e.route === ROUTE && e.method === 'POST' && e.access === 'owner-and-admins', `listed at its route; got ${show(e).slice(0, 300)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of [...Object.keys(CODES), 'unknown-input', 'invalid-input', 'sign-in-required', 'not-allowed']) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(F.ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: F.ROOT, encoding: 'utf8', env: S.childEnv(F.tmp('seed-firmware-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

// ── AC1: a fresh install ──
test('SF3 [AC1, Amendment 1]: each node is at today\'s install\'s address, once, with today\'s tags (as a set), role labels, JSON, name and slug, and TapestryNode with a key; no NostrEvent and no id; three concept graphs as create-concept made them', async () => {
  const { s, installed } = fresh();
  assert(installed, 'one of the two first calls installed (answered 200 with nodes added)');
  const o = await F.oracle(firmwareA());
  const wrong = [];
  for (const [address, l] of F.targetLetters(o)) {
    const at = F.nodesAt(s, address);
    if (at.length !== 1) { wrong.push({ address, nodes: at.length }); continue; }
    const n = at[0];
    const why = [];
    if (!F.sameSet(F.tagSet(F.tagsOf(s, n)), F.tagSet(l.tags))) why.push('tags');
    if (show(F.roleLabels(n.labels)) !== show(F.roleLabels(l.labels))) why.push(`labels ${show(n.labels)}`);
    if (!n.labels.includes('TapestryNode') || typeof n.props.tapestryKey !== 'string') why.push('key');
    if (n.labels.includes('NostrEvent') || n.props.id !== undefined) why.push('a letter\'s NostrEvent or id');
    if (!F.sameJson(F.jsonTagOf(s, n), l.json)) why.push('json');
    if (n.props.name !== l.name) why.push(`name ${show(n.props.name)}`);
    if (l.role === 'element' && n.props.slug !== l.slug) why.push(`slug ${show(n.props.slug)}`);
    if (n.props.pubkey !== TA || n.props.kind !== l.kind) why.push('pubkey or kind');
    if (why.length) wrong.push({ address, role: l.role, why });
  }
  assert(wrong.length === 0, `${wrong.length} of the ${F.census().nodes} nodes aren't in the graph as the target holds them (today's install's, but NostrEvent and id, and the three concept graphs pass 1c flattens); the first: ${first(wrong)}`);
  for (const r of o.relationshipLetters) {
    const n = F.live(s).filter((x) => F.tagsOf(s, x).some((t) => t[0] === 'nodeTo' && t[1] === r.nodeTo) && F.tagsOf(s, x).some((t) => t[0] === 'relationshipType' && t[1] === r.relationshipType));
    assert(n.length === 1 && n[0].labels.includes('ListItem') && !n[0].labels.includes('NostrEvent'), `one relationship letter for ${r.nodeTo.split(':')[2]}, unsigned; got ${n.length}`);
  }
});

test('SF4 [AC1, Decision 4]: the relationships: the core edges, the existing nodes and sets, the concept manifests\', 1d½, ENUMERATES with its two properties, and 1e\'s prune', async () => {
  const { s } = fresh();
  const o = await F.oracle(firmwareA());
  const has = (type, from, to) => F.relsOf(s, { type, from, to }).length === 1;
  const core = o.edges.filter((e) => !['HAS_ELEMENT', 'IS_A_SUPERSET_OF'].includes(e.type));
  const missing = core.filter((e) => !has(e.type, e.from, e.to));
  assert(missing.length === 0, `each of the ${F.census().coreEdges} core edges once; missing ${first(missing)}`);
  for (const [p, c] of [['node-type', 'word'], ['graph-type', 'tapestry'], ['validation-tool-type', 'json-schema']]) assert(has('HAS_ELEMENT', o.supersetOf(p), o.headerOf(c)), `${p}'s superset HAS_ELEMENT ${c}'s header (1c)`);
  const cat = require('../../helpers/todaysFirmwareRoutes').categoryToSlug;
  for (const [c, d] of Object.entries(o.manifest.sets)) for (const e of d['existing-sets']) assert(has('IS_A_SUPERSET_OF', o.supersetOf(cat(c)), o.supersetOf(e.concept)), `${cat(c)} IS_A_SUPERSET_OF ${e.concept} (existing sets)`);
  assert(has('HAS_ELEMENT', o.setOf('concepts/json-data-type/sets/numeric-types.json'), o.elementOf('concepts/json-data-type/elements/integer.json')), 'numeric-types HAS_ELEMENT integer (1c¾)');
  assert(!has('HAS_ELEMENT', o.supersetOf('json-data-type'), o.elementOf('concepts/json-data-type/elements/integer.json')), '1e pruned json-data-type\'s superset → integer');
  assert(has('HAS_ELEMENT', o.supersetOf('json-data-type'), o.elementOf('concepts/json-data-type/elements/string.json')), 'and kept → string');
  const headers = [...o.letters.values()].filter((l) => l.role === 'conceptHeader');
  assert(headers.every((h) => has('HAS_ELEMENT', o.supersetOf('concept-header'), h.address)), 'concept-header\'s superset HAS_ELEMENT every header (1d½)');
  const en = F.relsOf(s, { type: 'ENUMERATES' });
  assert(en.length === 5, `five ENUMERATES; got ${en.length}`);
  const dog = en.find((r) => r.fromNode.props.uuid === o.supersetOf('dog-breed'));
  assert(dog && dog.props.sourcePath === 'dogBreed.oKeys.singular' && dog.props.destinationPath === 'dog.breed', `dog-breed ENUMERATES dog's schema with its two paths; got ${show(dog && dog.props)}`);
  assert(o.relationshipLetters.every((r) => F.relsOf(s, { type: 'HAS_ELEMENT', from: o.supersetOf('relationship') }).some((x) => F.tagsOf(s, x.toNode).some((t) => t[0] === 'nodeTo' && t[1] === r.nodeTo))), 'relationship\'s superset HAS_ELEMENT every relationship letter (1d)');
});

test('SF5 [AC1, Decision 8]: the six community-reference headers carry the firmware\'s pointer b, and each REFERENCES {source: b-tag} the node at its address', async () => {
  const { s } = fresh();
  const o = await F.oracle(firmwareA());
  for (const slug of F.COMMUNITY) {
    const cr = o.manifest.concepts.find((c) => c.slug === slug).communityReference;
    const h = F.nodesAt(s, o.headerOf(slug))[0];
    assert(F.tagsOf(s, h).some((t) => t[0] === 'b' && t[1] === cr.headerATag && t[2] === 'pointer'), `${slug}'s header carries [b, ${cr.headerATag.slice(0, 20)}…, pointer]`);
    const refs = F.relsOf(s, { type: 'REFERENCES', from: o.headerOf(slug) }).filter((r) => r.props.source === 'b-tag');
    assert(refs.length === 1 && refs[0].toNode.props.uuid === cr.headerATag, `${slug}: one b claim, to the node at its b's address (a placeholder the claim makes when the graph holds none); got ${show(refs.map((r) => r.toNode && r.toNode.props.uuid))}`);
  }
});

test('SF6 [AC1]: nothing is signed, published or read from a key store, and graph create-concept then makes a concept instead of answering not-installed', () => {
  const { a } = fresh();
  assert(fresh().installed, 'the install ran (so this isn\'t passing on a call that did nothing)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signed, published (no strfry child) or read from a key store; got ${show(a.spy)}`);
  const cc = a.req('create-concept');
  assert(cc.status === 200 && cc.body.success === true && cc.body.data.outcome === 'created', `graph create-concept made widget; got ${cc.status} ${show(cc.body).slice(0, 400)}`);
});

// ── AC2: the records ──
test('SF7 [AC2, Decision 6]: each node seed-firmware wrote records cameFrom (kind file, its path, its sha256) and installed (version, source, digest, parts, at)', async () => {
  const { s, installed } = fresh();
  const o = await F.oracle(firmwareA());
  const bad = [];
  for (const address of o.letters.keys()) {
    const n = F.nodesAt(s, address)[0];
    const cf = F.propJson(n, 'cameFrom');
    const ins = F.propJson(n, 'installed');
    if (!cf || cf.kind !== 'file' || typeof cf.address !== 'string' || !/^[0-9a-f]{64}$/.test(String(cf.id))) { bad.push({ address, cameFrom: cf }); continue; }
    if (!ins || ins.version !== '1.0.0' || typeof ins.digest !== 'string' || !ins.parts || !Object.prototype.hasOwnProperty.call(ins.parts, 'name') || typeof ins.parts.tags !== 'object' || Number.isNaN(Date.parse(ins.at))) bad.push({ address, installed: ins });
    else if (installed && installed.source && ins.source !== installed.source.digest) bad.push({ address, source: ins.source });
  }
  assert(bad.length === 0, `${bad.length} nodes lack a whole record; the first: ${first(bad)}`);
  const rover = F.propJson(F.nodesAt(s, o.elementOf(ROVER))[0], 'cameFrom');
  assert(rover.address === ROVER && rover.id === F.fileSha(firmwareA(), ROVER), `rover came from its file, by path and sha256; got ${show(rover)}`);
});

test('SF8 [AC2, Decision 9, Amendment 3 item 3]: the installed-firmware graph: an element of graph at its reserved address, 39999:<ta>:installed-firmware, unsigned, with seed-firmware\'s mark (its installed record and installedFirmware), its word, its graph (every node by address, the relationships firmware made)', async () => {
  const { s } = fresh();
  const o = await F.oracle(firmwareA());
  const at = F.nodesAt(s, F.installedGraphAddress());
  assert(at.length === 1, `one node at ${F.installedGraphAddress()}; got ${at.length}`);
  const g = at[0];
  assert(g.labels.includes('ListItem') && !g.labels.includes('NostrEvent') && g.props.id === undefined, `ListItem, with no letter; got ${show(g.labels)}`);
  const tags = F.tagsOf(s, g);
  assert(['d', 'name', 'z', 'json'].every((t) => tags.some((x) => x[0] === t)) && tags.some((x) => x[0] === 'z' && x[1] === `39998:${TA}:graph`), `tags d, name, z (graph) and json; got ${show(tags.map((x) => x[0]))}`);
  assert(tags.some((x) => x[0] === 'd' && x[1] === 'installed-firmware'), `its d tag is the reserved d-tag, installed-firmware; got ${show(tags.filter((x) => x[0] === 'd'))}`);
  const record = F.propJson(g, 'installed');
  assert(record && typeof record === 'object' && !Array.isArray(record), `it carries its own installed record, half of seed-firmware's mark; got ${show(g.props.installed)}`);
  assert(F.relsOf(s, { type: 'HAS_ELEMENT', from: o.supersetOf('graph'), to: F.installedGraphAddress() }).length === 1, 'graph\'s superset HAS_ELEMENT it');
  const j = F.jsonTagOf(s, g);
  assert(j && j.word && j.word.slug === 'graph--installed-firmware' && j.word.name === 'graph: installed firmware' && j.word.title === 'Graph: Installed Firmware' && show(j.word.wordTypes) === show(['word', 'graph']), `its word block; got ${show(j && j.word)}`);
  const slugs = new Set(((j.graph && j.graph.nodes) || []).map((x) => x.slug));
  const allNodes = (j.graph && j.graph.nodes) || [];
  assert(allNodes.every((x) => x.slug === x.uuid && typeof x.name === 'string'), 'each node by address as its slug and uuid, with its name');
  const missing = [...o.letters.keys()].filter((a) => !slugs.has(a));
  assert(missing.length === 0, `graph.nodes lists every node it wrote, by address; missing ${first(missing)}`);
  for (const slug of F.COMMUNITY) { const cr = o.manifest.concepts.find((c) => c.slug === slug).communityReference; assert(slugs.has(cr.headerATag), `the curator's header ${slug}'s b claims is listed, so its slug resolves`); }
  const rels = (j.graph && j.graph.relationships) || [];
  assert(rels.length > F.census().coreEdges && rels.every((r) => slugs.has(r.nodeFrom.slug) && slugs.has(r.nodeTo.slug) && r.relationshipType && r.relationshipType.slug), `graph.relationships, each end a listed node; got ${rels.length}, the first ${first(rels)}`);
  assert(rels.some((r) => r.relationshipType.slug === 'ENUMERATES' && r.properties && r.properties.destinationPath === 'dog.breed'), 'an ENUMERATES carries its properties');
  const types = new Set(((j.graph && j.graph.relationshipTypes) || []).map((x) => x.slug));
  assert(rels.every((r) => types.has(r.relationshipType.slug)) && Array.isArray(j.graph.imports) && j.graph.imports.length === 0, 'relationshipTypes lists each type used; imports is empty');
  const fw = j.installedFirmware;
  assert(fw && fw.version === '1.0.0' && fw.source && fw.source.kind === 'files' && typeof fw.source.digest === 'string' && fw.source.files && !Number.isNaN(Date.parse(fw.at)) && fw.by && fw.by.role === 'owner' && fw.by.pubkey === OWNER && fw.nodes && fw.relationships,
    `installedFirmware: { version, source: { kind: files, digest, files }, at, by, nodes, relationships }; got ${show(fw).slice(0, 400)}`);
});

test('SF9 [AC2, Decision 12]: status\'s firmware part: seeded, read from the installed-firmware graph; null, in words, before any run; changedSince counts edited nodes; readInstallState still counts letters', async () => {
  const { s } = fresh();
  F.needDecl();
  const after = F.statusFirmware(s, { firmwareDir: firmwareA() });
  assert(after.schemaFields && after.schemaFields.includes('seeded'), `the firmware part's schema declares seeded; got ${show(after.schemaFields)}`);
  const sd = after.part.seeded;
  assert(sd && sd.version === '1.0.0' && !Number.isNaN(Date.parse(sd.at)) && sd.by && sd.by.role === 'owner' && sd.source && sd.changedSince === 0 && sd.nodes !== undefined && sd.relationships !== undefined,
    `seeded: { version, at, by, source, nodes, relationships, changedSince: 0 }; got ${show(sd).slice(0, 400)}`);
  assert(after.part.version === '1.0.0' && after.part.installed === 'none', `beside it, the version carried, and readInstallState's count, which counts letters: none for an instance seed-firmware alone installed (story, out of scope); got ${show({ version: after.part.version, installed: after.part.installed })}`);
  const o = await F.oracle(firmwareA());
  const edited = JSON.parse(JSON.stringify(s));
  const t = F.relsOf(edited, { type: 'HAS_TAG', from: o.headerOf('dog') }).map((r) => r.toNode).find((x) => x.props.type === 'json');
  const j = JSON.parse(t.props.value); j.conceptHeader.description = DOG_EDIT; t.props.value = JSON.stringify(j);
  assert(F.statusFirmware(edited, { firmwareDir: firmwareA() }).part.seeded.changedSince === 1, 'one node edited since: changedSince 1');
  for (const [what, st] of [['an empty graph', F.emptyGraph()], ['today\'s install\'s graph', F.todaysGraph(o)]]) {
    const p = F.statusFirmware(st, { firmwareDir: firmwareA() }).part;
    const text = Object.values(p).filter((v) => typeof v === 'string').join(' ');
    assert(p.seeded === null && /seed-firmware/.test(text), `${what}: seeded is null, and the part says in words that seed-firmware has installed nothing yet; got ${show(p).slice(0, 300)}`);
  }
});

// ── AC3: safe to repeat ──
test('SF10 [AC3]: run again with the same source: every node unchanged, nothing written, no change entry; with version 1.0.0 and v1.0.0 too', async () => {
  const { a, s, installedId } = fresh();
  assert(installedId, 'the first install ran');
  for (const id of ['again', 'admin', 'v-plain', 'v-dir']) {
    const d = F.data(a, id);
    assert(F.countOf(d, 'unchanged') === F.census().total && !F.countOf(d, 'added') && !F.countOf(d, 'changed') && !F.countOf(d, 'kept'), `${id}: every one of the ${F.census().total} nodes unchanged; got ${show(d.counts)}`);
    assert(d.change === null && (d.nodes || []).filter((x) => x.outcome !== 'unchanged').length === 0, `${id}: no change entry, and no node listed but unchanged ones; got ${show({ change: d.change, nodes: (d.nodes || []).length })}`);
    const r = F.relsOfAnswer(d);
    assert(!r.added.length && !r.removed.length && !r.changed.length && !r.kept.length, `${id}: no relationship added, removed, changed or kept`);
  }
  assert(seedEntries(s).length === 1, `one change entry for the install, none for the repeats; got ${seedEntries(s).length}`);
});

test('SF11 [AC3, Decision 1]: two calls at once install once: one installs, the other is refused busy or finds nothing to change; each node once, one entry', async () => {
  const { a, s, installedId } = fresh();
  const o = await F.oracle(firmwareA());
  const other = a.req(installedId === 'a1' ? 'a2' : 'a1');
  const fine = other.status === 409 ? other.body.code === 'busy' : other.status === 200 && F.countOf(other.body.data, 'unchanged') === F.census().total;
  assert(installedId && fine, `one call installed, the other was busy or unchanged; got ${installedId}, ${other.status} ${show(other.body).slice(0, 300)}`);
  const twice = [...o.letters.keys()].filter((x) => F.nodesAt(s, x).length !== 1);
  assert(twice.length === 0, `each node once; ${twice.length} aren't`);
  assert(F.nodesAt(s, F.installedGraphAddress()).length === 1, `one installed-firmware graph; got ${F.nodesAt(s, F.installedGraphAddress()).length}`);
  assert(seedEntries(s).length === 1, 'one change entry');
});

// ── AC6: what it reports ──
test('SF12 [AC6, Decision 11]: the answer: version and source (its files), each node added with its tapestryKey, address, role and file, the counts, the relationships, letterOutOfDate, cacheOutOfDate, rulesCheck, change and note', () => {
  const { installed: d, s } = fresh();
  assert(d, 'the install answered');
  assert(d.version === '1.0.0' && d.source && d.source.kind === 'files' && /[0-9a-f]{64}/.test(String(d.source.digest)) && d.source.files, `version and source; got ${show({ version: d.version, source: d.source }).slice(0, 300)}`);
  const listed = (d.nodes || []).filter((x) => x.address !== F.installedGraphAddress());
  assert(F.countOf(d, 'added') === F.census().total && listed.length === F.census().total && listed.every((x) => x.outcome === 'added'), `${F.census().total} added, each listed; got ${F.countOf(d, 'added')} and ${listed.length}`);
  const e = d.nodes.find((x) => x.address === `39998:${TA}:dog`);
  assert(e && e.outcome === 'added' && e.tapestryKey === F.nodesAt(s, e.address)[0].props.tapestryKey && typeof e.role === 'string' && typeof e.file === 'string', `an entry: outcome, tapestryKey, address, role and file; got ${show(e)}`);
  const r = F.relsOfAnswer(d);
  assert(r.added.length > F.census().coreEdges && !r.removed.length && r.others === 0, `the relationships it made are listed as added; got ${show({ added: r.added.length, removed: r.removed.length, others: r.others })}`);
  assert(Array.isArray(d.letterOutOfDate) && d.letterOutOfDate.length === 0, `no node it wrote has a letter: letterOutOfDate is empty; got ${show(d.letterOutOfDate)}`);
  const stale = typeof d.cacheOutOfDate === 'number' ? d.cacheOutOfDate : Array.isArray(d.cacheOutOfDate) ? d.cacheOutOfDate.length : -1;
  assert(stale >= F.census().total, `cacheOutOfDate counts each node whose derive failed after the commit: here every one, since the derive's driver has no Neo4j to read (Decision 10); got ${show(d.cacheOutOfDate).slice(0, 200)}`);
  assert(d.rulesCheck && /property-has-one-parent/.test(show(d.rulesCheck)), `rulesCheck names the rules it ran; got ${show(d.rulesCheck).slice(0, 300)}`);
  assert(d.change && d.change.operation === 'lifecycle seed-firmware' && typeof d.note === 'string' && d.note.length > 0, 'its change entry, and a note in words');
});

test('SF13 [AC6, Decision 10]: the change entry names who installed and every node made; graph history finds it by a node', async () => {
  const { s, installed } = fresh();
  const o = await F.oracle(firmwareA());
  const e = seedEntries(s)[0];
  assert(e && e.byRole === 'owner' && e.byPubkey === OWNER && installed.change.id === e.tapestryKey, `the entry is the owner's, and the answer's change; got ${show(e && { byRole: e.byRole, byPubkey: e.byPubkey })}`);
  const keys = new Set(e.keys);
  const missing = [...o.letters.keys()].filter((a) => !keys.has(F.nodesAt(s, a)[0].props.tapestryKey));
  assert(missing.length === 0, `its keys name every node it made; missing ${missing.length}`);
  const g = F.nodesAt(s, F.installedGraphAddress())[0];
  assert(g && keys.has(g.props.tapestryKey), `and the installed-firmware graph, at ${F.installedGraphAddress()}; ${g ? 'its key isn\'t among the entry\'s keys' : 'no node is there'}`);
  const { b1 } = await update();
  const h = b1.req('h-dcosl');
  const found = h.status === 200 ? h.body.data.entries.filter((x) => x.operation === 'lifecycle seed-firmware') : [];
  assert(found.length === 2, `graph history finds both seed-firmware entries by a node the install made and the update changed; got ${h.status} ${show(h.body).slice(0, 300)}`);
});

// ── AC4: an update ──
test('SF14 [AC4]: update: an unedited node whose file changed is changed, its JSON its file\'s and its record moved; a new file\'s node is added', async () => {
  const { b1, s1, base, o, ob, fb } = await update();
  const d = F.data(b1, 'update');
  const by = F.entriesByAddress(d);
  const dcosl = o.elementOf(DCOSL);
  assert(by.get(dcosl) && by.get(dcosl).outcome === 'changed', `dcosl-brainstorm-world is changed; got ${show(by.get(dcosl))}`);
  const n = F.nodesAt(s1, dcosl)[0];
  assert(F.sameJson(F.jsonTagOf(s1, n), F.readFirmwareJson(fb, DCOSL)), 'its JSON is its new file\'s');
  const was = F.propJson(F.nodesAt(base, dcosl)[0], 'installed');
  assert(F.propJson(n, 'cameFrom').id === F.fileSha(fb, DCOSL) && F.propJson(n, 'installed').digest !== was.digest, 'its record moved: cameFrom names the new file, installed the new content');
  const fido = ob.elementOf(FIDO);
  assert(by.get(fido) && by.get(fido).outcome === 'added' && F.nodesAt(s1, fido).length === 1, `fido, a new file, is added; got ${show(by.get(fido))}`);
  assert(F.countOf(d, 'added') === 1 && F.countOf(d, 'changed') === 2, `one added, two changed (dcosl and a graph-rule item whose file changed); got ${show(d.counts)}`);
});

test('SF15 [AC4]: update: an edited node is kept, naming what differs (its JSON, its name, a re-pointed b), its record not moved and the graph keeping the edit; run again, it is kept again and nothing is written', async () => {
  const { b1, s1, before, o } = await update();
  const d = F.data(b1, 'update');
  const by = F.entriesByAddress(d);
  const cases = [[o.headerOf('dog'), 'json'], [o.elementOf(ROVER), 'name'], [o.headerOf('nostr-relay'), 'b']];
  for (const [address, part] of cases) {
    const e = by.get(address);
    assert(e && e.outcome === 'kept' && partsOf(e).has(part), `${address.split(':')[2]} is kept, naming ${part}; got ${show(e)}`);
    const n = F.nodesAt(s1, address)[0];
    const was = F.nodesAt(before, address)[0];
    assert(show(F.propJson(n, 'installed')) === show(F.propJson(was, 'installed')) && show(F.propJson(n, 'cameFrom')) === show(F.propJson(was, 'cameFrom')), `${address.split(':')[2]}'s record isn't moved`);
    assert(F.sameSet(F.tagSet(F.tagsOf(s1, n)), F.tagSet(F.tagsOf(before, was))) && n.props.name === was.props.name, `${address.split(':')[2]} keeps the edit`);
  }
  assert(F.countOf(d, 'kept') === 3, `three kept; got ${show(d.counts)}`);
  const again = F.data(b1, 'update-again');
  assert(F.countOf(again, 'kept') === 3 && again.change === null, `again: the same three kept, nothing written; got ${show({ counts: again.counts, change: again.change })}`);
  assert(seedEntries(s1).length === seedEntries(before).length + 1, 'the update recorded one entry, the repeat none');
});
function partsOf(e) { return F.partsOf(e); }

test('SF16 [AC4]: update: a node the source no longer has is not-in-source and stays as it was; nothing is deleted', async () => {
  const { b1, s1, before, o } = await update();
  const d = F.data(b1, 'update');
  const nul = o.elementOf(NULL);
  const e = F.entriesByAddress(d).get(nul);
  assert(e && e.outcome === 'not-in-source', `json-data-type's null element is not-in-source; got ${show(e)}`);
  const n = F.nodesAt(s1, nul);
  assert(n.length === 1 && F.sameJson(F.jsonTagOf(s1, n[0]), F.jsonTagOf(before, F.nodesAt(before, nul)[0])), 'it is still there, as it was');
  assert(F.live(s1).length >= F.live(before).length, 'nothing is deleted');
});

test('SF17 [AC4, Decision 8]: update: a relationship the firmware no longer makes is removed and a new one added; one removed by hand, or with its properties edited, is kept; the instance\'s own stay, counted as others', async () => {
  const { b1, s1, o, schemaOf, ppOf } = await update();
  const d = F.data(b1, 'update');
  const r = F.relsOfAnswer(d);
  const key = (address) => { const n = F.nodesAt(s1, address)[0]; return n ? n.props.tapestryKey : null; };
  const listed = (lst, type, from, to) => lst.some((x) => F.relIs(x, type, from, to, key));
  const has = (type, from, to) => F.relsOf(s1, { type, from, to }).length > 0;
  const paid = o.setOf('concepts/nostr-relay/sets/paid-relays.json');
  const wine = o.elementOf('concepts/nostr-relay/elements/nostr-wine.json');
  assert(listed(r.removed, 'HAS_ELEMENT', paid, wine) && !has('HAS_ELEMENT', paid, wine), 'paid-relays → nostr-wine, gone from nostr-relay\'s manifest, is removed');
  assert(listed(r.added, 'HAS_ELEMENT', o.supersetOf('nostr-relay'), wine) && has('HAS_ELEMENT', o.supersetOf('nostr-relay'), wine), 'nostr-relay\'s superset → nostr-wine, which no longer path reaches, is added');
  const numeric = o.setOf('concepts/json-data-type/sets/numeric-types.json');
  const string = o.elementOf('concepts/json-data-type/elements/string.json');
  assert(listed(r.added, 'HAS_ELEMENT', numeric, string) && listed(r.removed, 'HAS_ELEMENT', o.supersetOf('json-data-type'), string), 'numeric-types → string added; json-data-type\'s superset → string, which it now reaches, removed');
  assert(listed(r.removed, 'HAS_ELEMENT', o.supersetOf('json-data-type'), o.elementOf(NULL)) && !has('HAS_ELEMENT', o.supersetOf('json-data-type'), o.elementOf(NULL)), 'the not-in-source node\'s firmware relationship is removed');
  const number = o.elementOf('concepts/json-data-type/elements/number.json');
  assert(listed(r.kept, 'HAS_ELEMENT', numeric, number) && !has('HAS_ELEMENT', numeric, number), 'numeric-types → number, removed by hand, is kept (not made again)');
  const en = F.relsOf(s1, { type: 'ENUMERATES', from: o.supersetOf('dog-breed'), to: schemaOf('dog') })[0];
  assert(listed(r.kept, 'ENUMERATES', o.supersetOf('dog-breed'), schemaOf('dog')) && en.props.sourcePath === 'dogBreed.slug', 'dog-breed\'s ENUMERATES, its sourcePath edited, is kept as the admin left it');
  assert(has('HAS_ELEMENT', o.supersetOf('json-data-type'), o.elementOf('concepts/json-data-type/elements/integer.json')) && has('IS_A_PROPERTY_OF', ppOf('dog'), schemaOf('nostr-relay')), 'the instance\'s own links between firmware nodes stay: a direct link the prune would take out, and a second parent');
  assert(r.others >= 2, `they are counted as others; got ${show(r.others)}`);
});

test('SF18 [AC4]: the instance\'s own element under a firmware concept, and its link, stay as they are', async () => {
  const { b1, s1, s2, biscuit, o } = await update();
  assert(F.countOf(F.data(b1, 'update'), 'changed') >= 1, 'the update ran and changed something (so this isn\'t passing on an update that did nothing)');
  for (const s of [s1, s2]) {
    assert(F.nodesAt(s, biscuit).length === 1 && F.relsOf(s, { type: 'HAS_ELEMENT', from: o.supersetOf('dog'), to: biscuit }).length === 1, 'Biscuit and dog\'s superset → Biscuit stay');
    assert(!F.propJson(F.nodesAt(s, biscuit)[0], 'installed'), 'it gets no install record');
  }
});

test('SF19 [AC5]: graph-rule\'s items: one edited by hand is put back, one whose file changed is changed, the others unchanged', async () => {
  const { b1, s1, o, fb } = await update();
  const by = F.entriesByAddress(F.data(b1, 'update'));
  const edited = o.elementOf(RULE_EDITED);
  const changed = o.elementOf(RULE_CHANGED);
  assert(by.get(edited) && by.get(edited).outcome === 'put-back' && F.sameJson(F.jsonTagOf(s1, F.nodesAt(s1, edited)[0]), F.readFirmwareJson(fb, RULE_EDITED)), `the edited item is put back to its file; got ${show(by.get(edited))}`);
  assert(by.get(changed) && by.get(changed).outcome === 'changed' && F.sameJson(F.jsonTagOf(s1, F.nodesAt(s1, changed)[0]), F.readFirmwareJson(fb, RULE_CHANGED)), `the item whose file changed is changed; got ${show(by.get(changed))}`);
  const items = [...o.letters.values()].filter((l) => l.concept === 'graph-rule' && l.role === 'element' && ![edited, changed].includes(l.address));
  assert(items.length === F.census().graphRules - 2 && items.every((l) => !by.has(l.address)), `the other ${F.census().graphRules - 2} of graph-rule's ${F.census().graphRules} items are unchanged; got ${items.length}, ${items.filter((l) => by.has(l.address)).length} of them not unchanged`);
  assert(F.countOf(F.data(b1, 'update'), 'put-back') === 1, 'one put back');
});

test('SF20 [AC6]: rules check reports what it finds over the firmware\'s nodes, and undoes nothing', async () => {
  const { installed } = fresh();
  const findings = (d) => { const m = show(d.rulesCheck).match(/"(?:findings|count|found|total)"\s*:\s*(\d+)/); return m ? Number(m[1]) : null; };
  assert(installed && findings(installed) === 0, `a fresh install of 1.0.0 has no finding; got ${show(installed && installed.rulesCheck).slice(0, 300)}`);
  const { b1, s1, ppOf, schemaOf } = await update();
  const d = F.data(b1, 'update');
  assert(findings(d) >= 1 && /property-has-one-parent/.test(show(d.rulesCheck)), `a firmware property given a second parent is found; got ${show(d.rulesCheck).slice(0, 400)}`);
  assert(F.relsOf(s1, { type: 'IS_A_PROPERTY_OF', from: ppOf('dog'), to: schemaOf('nostr-relay') }).length === 1, 'and it is left as it was');
});

test('SF21 [AC4 open question 3]: take by tapestryKey and by address: that node changed, its record moved; takeAll (by an admin): every kept node and relationship, the b claim replaced with its tag; then nothing left', async () => {
  const { b2, s1, s2, o, ob, schemaOf } = await update();
  const tk = F.data(b2, 'take-key');
  assert(F.entriesByAddress(tk).get(o.elementOf(ROVER)).outcome === 'changed' && F.countOf(tk, 'kept') === 2, `take by key: rover changed, two still kept; got ${show(tk.counts)}`);
  assert(F.nodesAt(s2, o.elementOf(ROVER))[0].props.name === 'Rover', 'rover is Rover again');
  const ta = F.data(b2, 'take-address');
  assert(F.entriesByAddress(ta).get(o.headerOf('dog')).outcome === 'changed' && F.countOf(ta, 'kept') === 1, `take by address: dog's header changed; got ${show(ta.counts)}`);
  const dog = F.nodesAt(s2, o.headerOf('dog'))[0];
  assert(F.sameJson(F.jsonTagOf(s2, dog), ob.letters.get(o.headerOf('dog')).json), 'dog\'s header now holds the newer firmware\'s definition');
  assert(F.propJson(dog, 'installed').digest !== F.propJson(F.nodesAt(s1, o.headerOf('dog'))[0], 'installed').digest, 'and its record moved');
  const all = F.data(b2, 'take-all');
  assert(F.entriesByAddress(all).get(o.headerOf('nostr-relay')).outcome === 'changed' && !F.countOf(all, 'kept'), `takeAll: nostr-relay's header changed, nothing kept; got ${show(all.counts)}`);
  const relay = F.nodesAt(s2, o.headerOf('nostr-relay'))[0];
  const cr = ob.manifest.concepts.find((c) => c.slug === 'nostr-relay').communityReference;
  assert(F.tagsOf(s2, relay).filter((t) => t[0] === 'b').every((t) => t[1] === cr.headerATag), 'its b is the firmware\'s pointer again');
  const claims = F.relsOf(s2, { type: 'REFERENCES', from: o.headerOf('nostr-relay') }).filter((r) => r.props.source === 'b-tag').map((r) => r.toNode.props.uuid);
  assert(show(claims) === show([cr.headerATag]), `its b claim is replaced with the one its b names; got ${show(claims)}`);
  const numeric = o.setOf('concepts/json-data-type/sets/numeric-types.json');
  assert(F.relsOf(s2, { type: 'HAS_ELEMENT', from: numeric, to: o.elementOf('concepts/json-data-type/elements/number.json') }).length === 1, 'the relationship removed by hand is made again');
  assert(F.relsOf(s2, { type: 'ENUMERATES', from: o.supersetOf('dog-breed'), to: schemaOf('dog') })[0].props.sourcePath === 'dogBreed.oKeys.singular', 'the ENUMERATES is the firmware\'s again');
  const done = F.data(b2, 'after');
  assert(F.countOf(done, 'unchanged') === F.census().total && done.change === null, `then nothing is left to change; got ${show(done.counts)}`);
  assert(F.entries(s2).filter((e) => e.operation === 'lifecycle seed-firmware' && e.byRole === 'admin' && e.byPubkey === ADMIN).length === 1, 'takeAll\'s entry is the admin\'s');
});

// ── AC4: first contact with today's install ──
test('SF22 [AC4 open question 2, Decision 5, Amendment 1]: first contact with today\'s install: equal nodes unchanged and adopted, keeping their letters; the schemas pass 3b filled, the three flattened concept graphs and the edited nodes kept with noRecord; missing relationships kept', async () => {
  const { o, c } = await firstContact();
  const d = F.data(c, 'first');
  const want = keptFirst(o);
  assert(new Set(want).size === want.length && want.length === F.keptOnFirstContact(o).length + 2 && want.length > 2, `the fixture: the schemas pass 3b filled (four on firmware 1.0.0: dog-breed has no element, so it skips dog's), the concept graphs pass 1c flattened (three) and two edits, each once; got ${want.length}`);
  const kept = keptFirst(o).length;
  assert(F.countOf(d, 'kept') === kept && F.countOf(d, 'unchanged') === F.census().total - kept, `${F.census().total - kept} unchanged, ${kept} kept (the schemas pass 3b filled: word's, graph's, property's and relationship's on firmware 1.0.0; the three concept graphs pass 1c flattened; dog's edited header; nostr-relay's re-pointed b); got ${show(d.counts)}`);
  const by = F.entriesByAddress(d);
  for (const address of want) assert(by.get(address) && by.get(address).outcome === 'kept' && by.get(address).noRecord === true, `${address.split(':')[2]} kept with noRecord; got ${show(by.get(address))}`);
  const dogSchema = [...o.letters.values()].find((l) => l.role === 'jsonSchema' && l.concept === 'dog').address;
  assert(!by.has(dogSchema), `dog's schema, which today's pass 3b skips (dog-breed has no element), is its file's on today's install too: unchanged, adopted; got ${show(by.get(dogSchema))}`);
  const r = F.relsOfAnswer(d);
  assert(!r.added.length && !r.removed.length && r.kept.length > 0 && r.kept.every((x) => x.noRecord === true), `relationships: none added or removed; the missing ones kept with noRecord; got ${show({ added: r.added.length, removed: r.removed.length, kept: r.kept.length })}`);
});

test('SF23 [AC4, Decision 10]: first contact again: still kept, nothing written; then takeAll: each kept node changed, keeping its tapestryKey, id, NostrEvent and created_at, its old tag nodes gone, and named in letterOutOfDate', async () => {
  const { o, before, c, after } = await firstContact();
  const again = F.data(c, 'first-again');
  assert(F.countOf(again, 'kept') === keptFirst(o).length && again.change === null, `again: the ${keptFirst(o).length} still kept, nothing written; got ${show({ counts: again.counts, change: again.change })}`);
  const adopted = F.nodesAt(after, o.elementOf(ROVER))[0];
  const was = F.nodesAt(before, o.elementOf(ROVER))[0];
  assert(adopted.props.id === was.props.id && adopted.labels.includes('NostrEvent') && F.propJson(adopted, 'installed'), 'an adopted node keeps its letter (id, NostrEvent) and has a record');
  const all = F.data(c, 'first-all');
  assert(F.countOf(all, 'changed') === keptFirst(o).length && !F.countOf(all, 'kept'), `takeAll: the ${keptFirst(o).length} changed; got ${show(all.counts)}`);
  const late = new Set((all.letterOutOfDate || []).map((x) => (typeof x === 'string' ? x : x.address || x.tapestryKey)));
  for (const address of keptFirst(o)) {
    const n = F.nodesAt(after, address)[0];
    const b = F.nodesAt(before, address)[0];
    assert(n.props.tapestryKey === b.props.tapestryKey && n.props.id === b.props.id && n.labels.includes('NostrEvent') && n.props.created_at === b.props.created_at, `${address.split(':')[2]} keeps its tapestryKey, id, NostrEvent and created_at`);
    assert(late.has(address) || late.has(n.props.tapestryKey), `${address.split(':')[2]} is in letterOutOfDate: its letter is out of date until export nostr sends one`);
    const tags = F.tagsOf(after, n);
    assert(tags.length === F.tagSet(tags).size, `${address.split(':')[2]}'s old tag nodes are gone: one tag node a tag; got ${tags.length} for ${F.tagSet(tags).size}`);
  }
  const schema = [...o.letters.values()].find((l) => l.role === 'jsonSchema' && l.concept === 'word');
  assert(F.sameJson(F.jsonTagOf(after, F.nodesAt(after, schema.address)[0]), schema.json), 'word\'s schema is its file\'s, with nothing pass 3b copied in');
  const graph = [...o.rewrittenBy1c.values()].find((l) => l.concept === 'node-type');
  assert(graph && F.sameJson(F.jsonTagOf(after, F.nodesAt(after, graph.address)[0]), graph.json), 'node-type\'s concept graph is create-concept\'s again, not 1c\'s flattened one');
  assert(F.relsOf(after, { type: 'HAS_ELEMENT', from: o.supersetOf('concept-header'), to: o.headerOf('word') }).length === 1, 'a missing relationship is made');
});

// ── AC7: refusals ──
test('SF24 [AC7, Decision 1]: unknown-version names the version carried; not-firmware names each ref; take beyond 500 is refused; nothing changes', () => {
  const { a, s } = fresh();
  const v = F.refused(a, 'v-unknown', 409, 'unknown-version');
  assert(/2\.0\.0/.test(words(v)) && /1\.0\.0/.test(words(v)), `it names the version asked for and the one carried; got ${words(v)}`);
  const t = F.refused(a, 'take-unknown', 400, 'not-firmware');
  assert(/no-such-node/.test(words(t)) && /00000000-0000-4000-8000-000000000000/.test(words(t)), `it names each ref no node of the firmware answers; got ${words(t)}`);
  assert(a.req('take-many').status === 400, `501 refs are refused 400; got ${a.req('take-many').status}`);
  assert(seedEntries(s).length === 1, 'the refusals wrote nothing');
});

test('SF25 [AC7, Decision 3]: firmware-unreadable names each file and its problem, and the graph keeps the firmware it had', () => {
  const { s } = fresh();
  const broken = F.copyFirmware({ [ROVER]: 'not json', 'concepts/graph/json-schema.json': null, 'manifest.json': (m) => { m.enumerations['graph-types']['existing-nodes'][0].concept = 'chart'; return m; } }, { from: firmwareA(), label: 'seed-firmware-broken-' });
  const r = F.runSeed({ state: s, firmwareDir: broken, label: 'seed-firmware-unreadable-', requests: [F.seed('unreadable', 'owner')] });
  const b = F.refused(r, 'unreadable', 409, 'firmware-unreadable');
  for (const what of [/rover\.json/, /graph\/json-schema\.json/, /\bchart\b/]) assert(what.test(words(b)), `it names ${what}; got ${words(b)}`);
  assert(F.stable(r.state().nodes) === F.stable(s.nodes) && F.stable(r.state().rels) === F.stable(s.rels), 'nothing was written: the instance keeps the firmware it had');
});

test('SF26 [AC7, Decision 1]: busy while another lifecycle job holds the lock; graph-unavailable when the graph doesn\'t answer, saying nothing can be installed; neither writes', () => {
  F.needDecl();
  const busy = F.runSeed({ firmwareDir: firmwareA(), label: 'seed-firmware-busy-', lock: { op: 'backup', pid: process.pid, stage: 'online' }, requests: [F.seed('busy', 'owner')] });
  const b = F.refused(busy, 'busy', 409, 'busy');
  assert(/backup/i.test(words(b)), `it says what is running; got ${words(b)}`);
  assert(busy.state().nodes.length === 0, 'nothing was written');
  const down = F.runSeed({ firmwareDir: firmwareA(), label: 'seed-firmware-down-', lifecycleFailures: { cypherDown: true }, graphFailures: { unreachable: { after: 0 } }, requests: [F.seed('down', 'owner')] });
  const g = F.refused(down, 'down', 409, 'graph-unavailable');
  assert(/install/i.test(words(g)), `in words that say nothing can be installed now (_common.js's words gain "installed"); got ${words(g)}`);
});

test('SF27 [AC7, Decision 1]: no-assistant, when the instance has no assistant key; nothing is written', () => {
  F.needDecl();
  const r = F.runSeed({ firmwareDir: firmwareA(), noAssistant: true, label: 'seed-firmware-no-assistant-', requests: [F.seed('none', 'owner')] });
  F.refused(r, 'none', 409, 'no-assistant');
  assert(r.state().nodes.length === 0, 'nothing was written');
});

test('SF28 [AC7]: who may call: the owner and an admin (each the entry\'s); a visitor 401 and a stranger 403; a body that isn\'t JSON 415; an unknown input 400', () => {
  const { a } = fresh();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `visitor 401, stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  assert(a.req('text').status === 415, `text/plain is refused 415; got ${a.req('text').status}`);
  const u = a.req('unknown-input');
  assert(u.status === 400 && u.body.code === 'unknown-input', `an unknown input is refused 400; got ${u.status} ${show(u.body)}`);
  assert(F.data(a, 'admin') && fresh().installed.change.by.role === 'owner', 'the admin may call it, and the owner\'s install is the owner\'s');
});

test('SF29 [AC7]: the internal command, with no sign-in, answers as the route does; its refusal is the route\'s', () => {
  const { a } = fresh();
  const c = a.cmd('cli');
  const body = JSON.parse(c.stdout || '{}');
  assert(c.code === 0 && body.success === true && F.countOf(body.data, 'unchanged') === F.census().total, `the command answers: every node unchanged; got ${c.code} ${String(c.stdout).slice(0, 300)} ${String(c.stderr).slice(-200)}`);
  assert(c.leaked === '', `the command kept stdout to the answer; leaked ${show(c.leaked).slice(0, 200)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout || '{}');
  assert(rc.code === 1 && rb.code === 'unknown-version', `the command's refusal is the route's; got ${rc.code} ${rc.stdout}`);
});

test('SF30 [AC7, regression]: what stays as it was: today\'s install module, its route POST /api/firmware/install, and its passes', () => {
  const src = fs.readFileSync(path.join(F.ROOT, 'src/api/firmware/index.js'), 'utf8');
  assert(/app\.post\('\/api\/firmware\/install', handleFirmwareInstall\)/.test(src), 'POST /api/firmware/install is still registered');
  const inst = fs.readFileSync(path.join(F.ROOT, 'src/firmware/install.js'), 'utf8');
  assert(/module\.exports = \{ install, pass1_bootstrap, pass2_enrich, pass_communityReferences, handleFirmwareInstall \}/.test(inst), 'install.js still exports today\'s install and its passes');
  assert(/overwrite: true/.test(inst) && /signAndFinalize/.test(inst), 'today\'s install still signs, as it did');
});

test('SF31 [AC7]: the docs: catalog §8\'s row, BIBLE §7 and BIBLE §11 say what seed-firmware does', () => {
  const catalog = fs.readFileSync(path.join(F.ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const row = catalog.split('\n').find((l) => l.startsWith('| `seed-firmware`')) || '';
  assert(/\/api\/tapestry\/lifecycle\/seed-firmware|keep|kept|unsigned/i.test(row) && !/^\| `seed-firmware` \| Install or update the built-in concepts, by the bootstrap path, without undoing local edits \| `version\?` → installed \| Signs: `POST \/api\/firmware\/install`, which can also undo local edits\. \|$/.test(row),
    `catalog §8's row says what was built; got ${show(row)}`);
  const bible = fs.readFileSync(path.join(F.ROOT, 'BIBLE.md'), 'utf8');
  const section = (n) => { const at = bible.indexOf(`\n## ${n}. `); const end = bible.indexOf('\n## ', at + 5); return bible.slice(at, end); };
  assert(/seed-firmware/.test(section(7)), 'BIBLE §7 says seed-firmware installs beside today\'s install');
  assert(/\/api\/tapestry\/lifecycle\/seed-firmware/.test(section(11)), 'BIBLE §11 lists /api/tapestry/lifecycle/seed-firmware');
});

test('SF32 [Decision 3]: TAPESTRY_FIRMWARE_DIR: the firmware module reads the folder it names, read once at load; firmware/active otherwise', () => {
  const dir = F.copyFirmware({ 'manifest.json': (m) => ({ ...m, date: '2099-01-01', description: 'a copy for the suite' }) }, { label: 'seed-firmware-dir-' });
  const script = (env) => spawnSync(process.execPath, ['-e', `
    const f = require(${JSON.stringify(path.join(F.ROOT, 'src/api/normalize/firmware.js'))});
    process.stdout.write('RESULT:' + JSON.stringify({ dir: f.firmwareDir(), date: f.getManifest().date }));
  `], { cwd: F.ROOT, encoding: 'utf8', env: { ...S.childEnv(F.tmp('seed-firmware-env-')), ...env } });
  const read = (r) => { const line = (r.stdout || '').split('RESULT:')[1]; return line ? JSON.parse(line) : { error: (r.stderr || '').slice(-300) }; };
  const set = read(script({ TAPESTRY_FIRMWARE_DIR: dir }));
  assert(set.dir === dir && set.date === '2099-01-01', `with TAPESTRY_FIRMWARE_DIR set, the module reads that folder; got ${show(set)}`);
  const env = S.childEnv(F.tmp('seed-firmware-env-'));
  delete env.TAPESTRY_FIRMWARE_DIR;
  const unset = read(spawnSync(process.execPath, ['-e', `
    const f = require(${JSON.stringify(path.join(F.ROOT, 'src/api/normalize/firmware.js'))});
    process.stdout.write('RESULT:' + JSON.stringify({ dir: f.firmwareDir(), date: f.getManifest().date }));
  `], { cwd: F.ROOT, encoding: 'utf8', env }));
  assert(unset.dir === path.join(F.ROOT, 'firmware/active') && unset.date === '2026-03-28', `left unset, firmware/active; got ${show(unset)}`);
});

// ── Review round 1 (ADR 0037 Amendment 3) ──
/** The installed-firmware graph's JSON at the reserved address, else where Decision 9 first put it (so a test of another item isn't failed by the move). */
const igJsonOf = (st) => { for (const a of [F.installedGraphAddress(), F.oldInstalledGraphAddress()]) { const n = F.nodesAt(st, a)[0]; if (n) return F.jsonTagOf(st, n); } return null; };
const schemaAddress = (o, slug) => [...o.letters.values()].find((l) => l.role === 'jsonSchema' && l.concept === slug).address;
const ppAddress = (o, slug) => [...o.letters.values()].find((l) => l.role === 'primaryProperty' && l.concept === slug).address;

/**
 * ADMIN_GRAPH: today's install's graph, with the instance's own second parent (dog's primary property IS_A_PROPERTY_OF
 * nostr-relay's schema) and dog-breed's ENUMERATES with its paths edited, as an admin leaves them; then an admin makes an
 * element "installed firmware" of graph with graph create-element, listing that second parent (C1); seed-firmware's
 * first run (C2); and a run with a firmware that drops dog-breed's enumeration (C3).
 */
let ADMIN_GRAPH = null;
async function adminGraph() {
  if (ADMIN_GRAPH) return ADMIN_GRAPH;
  F.needDecl();
  const o = await F.oracle(firmwareA());
  const dogPP = ppAddress(o, 'dog');
  const relaySchema = schemaAddress(o, 'nostr-relay');
  const dogSchema = schemaAddress(o, 'dog');
  const s0 = F.todaysGraph(o, { edges: [
    { from: dogPP, type: 'IS_A_PROPERTY_OF', to: relaySchema },
    { from: o.supersetOf('dog-breed'), type: 'ENUMERATES', to: dogSchema, props: { sourcePath: 'dogBreed.slug', destinationPath: 'dog.breed' } },
  ] });
  const graphKey = F.nodesAt(s0, o.headerOf('graph'))[0].props.tapestryKey;
  const fields = {
    nodes: [{ slug: dogPP, uuid: dogPP, name: 'primary property for the concept of dogs' }, { slug: relaySchema, uuid: relaySchema, name: 'JSON schema for the concept of nostr relays' }],
    relationshipTypes: [{ slug: 'IS_A_PROPERTY_OF' }],
    relationships: [{ nodeFrom: { slug: dogPP }, relationshipType: { slug: 'IS_A_PROPERTY_OF' }, nodeTo: { slug: relaySchema } }],
    imports: [],
  };
  const c1 = F.runSeed({ state: s0, firmwareDir: firmwareA(), label: 'seed-firmware-admin-graph-', requests: [{ id: 'element', method: 'POST', url: '/api/tapestry/graph/create-element', caller: 'admin', body: { concept: graphKey, name: 'installed firmware', fields } }] });
  const made = F.data(c1, 'element');
  const sc1 = c1.state();
  const c2 = F.runSeed({ state: sc1, firmwareDir: firmwareA(), label: 'seed-firmware-first-admin-', requests: [F.seed('first', 'owner')] });
  const sc2 = c2.state();
  const fc = F.copyFirmware({ 'manifest.json': (m) => { delete m.enumerations['dog-breeds']; return m; } }, { from: firmwareA(), label: 'seed-firmware-fc-' });
  const c3 = F.runSeed({ state: sc2, firmwareDir: fc, label: 'seed-firmware-dropped-', requests: [F.seed('dropped', 'owner')] });
  ADMIN_GRAPH = { o, made, sc1, c2, sc2, c3, sc3: c3.state(), dogPP, relaySchema, dogSchema };
  return ADMIN_GRAPH;
}

test('SF33 [AC2, AC3, Amendment 3 items 1–2; review round 1, Blocking 1]: after the Dashboard\'s offload of the installed-firmware graph\'s json and a superset\'s, and a derive, status still reads seeded, and a repeat answers every node unchanged with no change entry', async () => {
  const { s } = fresh();
  const o = await F.oracle(firmwareA());
  const ig = F.nodesAt(s, F.installedGraphAddress())[0] || F.nodesAt(s, F.oldInstalledGraphAddress())[0];
  assert(ig, 'the install wrote its installed-firmware graph');
  const sup = F.nodesAt(s, o.supersetOf('node-type'))[0];
  const lmdb = path.join(F.tmp('seed-firmware-lmdb-'), 'lmdb');
  const keys = [ig.props.tapestryKey, sup.props.tapestryKey];
  const off = F.offloadAndDerive(s, { lmdb, offload: keys, derive: keys });
  assert(off.offloaded === 2, `the offload route offloaded the two json tags; got ${off.offloaded}`);
  const jsonTag = (n) => F.tagsOf(off.state, F.nodesAt(off.state, n.props.uuid)[0]).find((t) => t[0] === 'json');
  assert(jsonTag(ig)[1] === `lmdb:${ig.props.tapestryKey}` && jsonTag(sup)[1] === `lmdb:${sup.props.tapestryKey}`, 'each json tag is now its lmdb: reference');
  const wt = off.derived[sup.props.tapestryKey] && off.derived[sup.props.tapestryKey].word.wordTypes;
  assert(show(wt) === show(['word', 'superset', 'set']) && show(wt) !== show(o.letters.get(o.supersetOf('node-type')).json.word.wordTypes), `the derive wrote the superset's wordTypes in the set deriver's order, not its letter's; got ${show(wt)}`);
  const st = F.statusFirmware(off.state, { firmwareDir: firmwareA(), lmdb });
  const sd = st.part.seeded;
  assert(sd && sd.version === '1.0.0' && sd.changedSince === 0, `status reads the installed-firmware graph through the store: seeded 1.0.0, no node edited since; got ${String(show(sd)).slice(0, 300)}`);
  const r = F.runSeed({ state: off.state, firmwareDir: firmwareA(), lmdb, label: 'seed-firmware-offloaded-', requests: [F.seed('again', 'owner')] });
  const d = F.data(r, 'again');
  assert(F.countOf(d, 'unchanged') === F.census().total && !F.countOf(d, 'kept') && d.change === null, `the repeat changes nothing: ${F.census().total} unchanged, none kept, no change entry; got ${show({ counts: d.counts, change: d.change && d.change.id })}`);
  assert(seedEntries(r.state()).length === seedEntries(off.state).length, 'and records no entry');
});

test('SF34 [AC4, Amendment 3 item 3; review round 1, Blocking 2]: an admin\'s own "installed firmware" element of graph, made by graph create-element before seed-firmware\'s first run, stays as it was, and what it lists isn\'t read as the last install\'s; seed-firmware writes its own at 39999:<ta>:installed-firmware, with its mark', async () => {
  const { made, sc1, c2, sc2, dogPP, relaySchema } = await adminGraph();
  assert(made.element.address === F.oldInstalledGraphAddress(), `graph create-element put the admin's element at childDTag('installed firmware', graph); got ${made.element.address}`);
  F.data(c2, 'first');
  const before = F.nodesAt(sc1, made.element.address)[0];
  const after = F.nodesAt(sc2, made.element.address);
  assert(after.length === 1 && after[0].props.tapestryKey === before.props.tapestryKey && F.stable(after[0].props) === F.stable(before.props) && show([...after[0].labels].sort()) === show([...before.labels].sort()),
    `the admin's element keeps its key, labels and properties; got ${show(after.map((n) => ({ labels: n.labels, props: n.props }))).slice(0, 300)}`);
  const tagsBefore = F.tagSet(F.tagsOf(sc1, before));
  const tagsAfter = F.tagSet(F.tagsOf(sc2, after[0]));
  const td = F.setDiff(tagsAfter, tagsBefore);
  assert(F.sameSet(tagsAfter, tagsBefore), `the admin's element keeps its tags, its JSON among them: seed-firmware neither reads it as its record nor rewrites it; got ${String(show({ now: td.onlyFirst.map((t) => String(t).slice(0, 80)), was: td.onlySecond.map((t) => String(t).slice(0, 80)) })).slice(0, 400)}`);
  assert(F.relsOf(sc2, { type: 'IS_A_PROPERTY_OF', from: dogPP, to: relaySchema }).length === 1, 'the relationship its JSON lists, the instance\'s own second parent, stays: it was never the last install\'s');
  const own = F.nodesAt(sc2, F.installedGraphAddress());
  const j = own.length ? F.jsonTagOf(sc2, own[0]) : null;
  assert(own.length === 1 && j && j.installedFirmware && F.propJson(own[0], 'installed'), `seed-firmware writes its own installed-firmware graph at ${F.installedGraphAddress()}, with its mark: an installedFirmware section and its installed record; got ${own.length} node(s) there`);
});

test('SF35 [AC7, Amendment 3 item 3; review round 1, Blocking 2]: a node at 39999:<ta>:installed-firmware without seed-firmware\'s mark is refused address-held (409), naming it, and nothing is written', () => {
  F.needDecl();
  const word = { slug: 'graph--installed-firmware', name: 'graph: installed firmware', wordTypes: ['word', 'graph'] };
  const graph = { nodes: [], relationshipTypes: [], relationships: [], imports: [] };
  const variants = [
    ['held-no-mark', 'a node an admin made there, with no record', { word, graph }],
    ['held-section-only', 'a node with an installedFirmware section but no installed record', { word, graph, installedFirmware: { version: '1.0.0', nodes: 0, relationships: 0 } }],
    ['held-record-only', 'a node with an installed record but no installedFirmware section', { word, graph }, { installed: JSON.stringify({ version: '1.0.0', digest: 'a'.repeat(64), parts: {}, at: '2026-11-20T00:00:00.000Z' }) }],
  ];
  for (const [id, what, json, record = {}] of variants) {
    const s = F.emptyGraph();
    const n = F.addNode(s, ['ListItem'], { uuid: F.installedGraphAddress(), kind: 39999, pubkey: TA, name: 'installed firmware', tapestryValue: 'installed firmware', created_at: 1700000000, ...record });
    F.addTagNodes(s, n, [['d', 'installed-firmware'], ['name', 'installed firmware'], ['z', `39998:${TA}:graph`], ['json', JSON.stringify(json)]]);
    const r = F.runSeed({ state: s, firmwareDir: firmwareA(), label: 'seed-firmware-held-', requests: [F.seed(id, 'owner')] });
    const b = F.refused(r, id, 409, 'address-held');
    assert(words(b).includes(F.installedGraphAddress()) || words(b).includes(n.props.tapestryKey), `${what}: the refusal names the node; got ${words(b)}`);
    const after = r.state();
    assert(F.stable(after.nodes) === F.stable(s.nodes) && F.stable(after.rels) === F.stable(s.rels), `${what}: nothing is written, no entry`);
  }
});

test('SF36 [AC4, Amendment 3 item 4; review round 1, N2]: an update lists the relationships it kept apart: dog-breed\'s ENUMERATES, its paths edited, and numeric-types → number, removed by hand, are in installedFirmware.keptRelationships, not graph.relationships', async () => {
  const { b1, s1, o, schemaOf } = await update();
  assert(F.countOf(F.data(b1, 'update'), 'changed') >= 1, 'the update ran and rewrote its installed-firmware graph');
  const j = igJsonOf(s1);
  assert(j && j.graph && j.installedFirmware, 'the installed-firmware graph is there');
  const kept = j.installedFirmware.keptRelationships;
  const numeric = o.setOf('concepts/json-data-type/sets/numeric-types.json');
  const number = o.elementOf('concepts/json-data-type/elements/number.json');
  for (const [type, from, to, what] of [['ENUMERATES', o.supersetOf('dog-breed'), schemaOf('dog'), 'dog-breed\'s ENUMERATES, its paths edited'], ['HAS_ELEMENT', numeric, number, 'numeric-types → number, removed by hand']]) {
    assert(F.listedIn(kept, type, from, to), `${what} is listed in installedFirmware.keptRelationships; got ${String(show(kept)).slice(0, 300)}`);
    assert(!F.listedIn(j.graph.relationships, type, from, to), `${what} isn't in graph.relationships, which lists what the install made, brought in line or adopted`);
  }
});

test('SF37 [AC4, Amendment 3 item 4; review round 1, N2]: first contact lists a relationship it kept with noRecord apart, in installedFirmware.keptRelationships; then a firmware that drops it leaves it in place, reported kept', async () => {
  const { o, c2, sc2, c3, sc3, dogSchema } = await adminGraph();
  const from = o.supersetOf('dog-breed');
  const d = F.data(c2, 'first');
  assert(F.relsOfAnswer(d).kept.some((x) => F.relIs(x, 'ENUMERATES', from, dogSchema) && x.noRecord === true), `first contact keeps dog-breed's edited ENUMERATES with noRecord; got ${show(F.relsOfAnswer(d).kept).slice(0, 300)}`);
  const j = igJsonOf(sc2);
  assert(j && j.installedFirmware && F.listedIn(j.installedFirmware.keptRelationships, 'ENUMERATES', from, dogSchema), `it is listed in installedFirmware.keptRelationships; got ${String(show(j && j.installedFirmware && j.installedFirmware.keptRelationships)).slice(0, 300)}`);
  assert(!F.listedIn(j.graph.relationships, 'ENUMERATES', from, dogSchema), 'and not in graph.relationships');
  const dropped = F.data(c3, 'dropped');
  const r = F.relsOfAnswer(dropped);
  assert(!r.removed.some((x) => F.relIs(x, 'ENUMERATES', from, dogSchema)) && r.kept.some((x) => F.relIs(x, 'ENUMERATES', from, dogSchema)), `a firmware that drops the enumeration doesn't take it out: it is reported kept; got removed ${show(r.removed).slice(0, 200)}, kept ${show(r.kept).slice(0, 200)}`);
  const left = F.relsOf(sc3, { type: 'ENUMERATES', from, to: dogSchema });
  assert(left.length === 1 && left[0].props.sourcePath === 'dogBreed.slug', 'it stays in place, as the admin left it');
});

test('SF38 [AC7, Amendment 3 item 5; review round 1, N1]: a relationship type whose alias isn\'t a plain name refuses firmware-unreadable, naming its file and the alias; nothing is written', () => {
  F.needDecl();
  const file = 'concepts/relationship-type/elements/core-node-concept-graph.json';
  const alias = 'IS THE CONCEPT GRAPH FOR';
  const dir = F.copyFirmware({ [file]: (j) => ({ ...j, relationshipType: { ...j.relationshipType, alias } }) }, { label: 'seed-firmware-alias-' });
  const r = F.runSeed({ firmwareDir: dir, label: 'seed-firmware-alias-run-', requests: [F.seed('alias', 'owner')] });
  const b = F.refused(r, 'alias', 409, 'firmware-unreadable');
  assert(words(b).includes(file) && words(b).includes(alias), `it names the file and the alias; got ${words(b)}`);
  assert(r.state().nodes.length === 0, 'nothing was written');
});

test('SF39 [AC7, Amendment 3 item 3; review round 2, nit 1]: seed-firmware\'s own installed-firmware graph, its record there, whose offloaded json has no entry in the store, is refused in words that say its JSON can\'t be read, not that it isn\'t seed-firmware\'s; nothing is written', () => {
  const { s } = fresh();
  const ig = F.nodesAt(s, F.installedGraphAddress())[0];
  const j = F.installedGraphJson(s);
  assert(ig && F.propJson(ig, 'installed') && j && j.installedFirmware, 'the install wrote its installed-firmware graph, with its mark: its installed record and installedFirmware');
  const st = JSON.parse(JSON.stringify(s));
  const tag = F.relsOf(st, { type: 'HAS_TAG', from: F.installedGraphAddress() }).map((r) => r.toNode).find((t) => t.props.type === 'json');
  tag.props.value = `lmdb:${ig.props.tapestryKey}`;
  const lmdb = path.join(F.tmp('seed-firmware-no-entry-'), 'lmdb');
  const r = F.runSeed({ state: st, firmwareDir: firmwareA(), lmdb, label: 'seed-firmware-no-entry-run-', requests: [F.seed('no-entry', 'owner')] });
  const b = F.refused(r, 'no-entry', 409, 'address-held');
  const w = words(b);
  assert(w.includes(F.installedGraphAddress()) || w.includes(ig.props.tapestryKey), `it names the node; got ${w}`);
  assert(/seed-firmware/.test(w) && /JSON/.test(w) && /(can['’]t|cannot|can not|couldn['’]t) be read|unreadable/i.test(w), `it says the node is seed-firmware's own installed-firmware graph, whose JSON can't be read (an lmdb: reference with no entry); got ${w}`);
  assert(!/isn['’]t seed-firmware['’]s/i.test(w) && !/lacks seed-firmware['’]s mark/i.test(w), `it doesn't say the node isn't seed-firmware's, since it carries the record; got ${w}`);
  const after = r.state();
  assert(F.stable(after.nodes) === F.stable(st.nodes) && F.stable(after.rels) === F.stable(st.rels), 'nothing is written, no entry');
});

test('SF40 [AC6, Decision 10, Amendment 4; review round 4, R4-N2]: rulesCheck judges only the firmware\'s own nodes: rule 12 is reported on a firmware node that breaks it, and not on the instance\'s own element or another author\'s that break it too; judged is at most the target\'s nodes', async () => {
  const { s } = fresh();
  const o = await F.oracle(firmwareA());
  const st = JSON.parse(JSON.stringify(s));
  const RULE12 = 'word-types-hold-concept-keys';
  // rover, firmware's element, its JSON edited by hand: its wordTypes lose dog's key.
  const rover = F.nodesAt(st, o.elementOf(ROVER))[0];
  const tag = F.relsOf(st, { type: 'HAS_TAG', from: rover.props.uuid }).map((r) => r.toNode).find((t) => t.props.type === 'json');
  const rj = JSON.parse(tag.props.value);
  tag.props.value = JSON.stringify({ ...rj, word: { ...rj.word, wordTypes: rj.word.wordTypes.filter((w) => w !== 'dog') } });
  // Biscuit, the instance's own element of dog, and an element of nostr-relay another author made: neither's wordTypes
  // holds its concept's key. Each is reached through dog's or nostr-relay's class thread, and through word's.
  const biscuitD = F.dtag.childDTag('Biscuit', o.headerOf('dog'));
  const biscuit = F.addNode(st, ['ListItem'], { uuid: `39999:${TA}:${biscuitD}`, kind: 39999, pubkey: TA, name: 'Biscuit', tapestryValue: 'Biscuit', created_at: 1700000003 });
  F.addTagNodes(st, biscuit, [['d', biscuitD], ['name', 'Biscuit'], ['z', o.headerOf('dog')], ['json', JSON.stringify({ word: { slug: 'dog--biscuit', name: 'dog: Biscuit', wordTypes: ['word'] }, dog: { slug: 'biscuit', name: 'Biscuit' } })]]);
  F.addRel(st, F.nodesAt(st, o.supersetOf('dog'))[0], 'HAS_ELEMENT', biscuit);
  const theirs = F.addNode(st, ['NostrEvent', 'ListItem'], { uuid: `39999:${OTHER}:their-relay`, id: F.sha256('their relay'), kind: 39999, pubkey: OTHER, name: 'their relay', created_at: 1700000004 });
  F.addTagNodes(st, theirs, [['d', 'their-relay'], ['name', 'their relay'], ['z', o.headerOf('nostr-relay')], ['json', JSON.stringify({ word: { slug: 'nostr-relay--their-relay', name: 'nostr relay: their relay', wordTypes: ['word'] }, nostrRelay: { slug: 'their-relay', name: 'their relay' } })]]);
  F.addRel(st, F.nodesAt(st, o.supersetOf('nostr-relay'))[0], 'HAS_ELEMENT', theirs);
  const check = (id, key) => ({ id, method: 'GET', url: `/api/tapestry/rules/check?scope=${key}&rules=${RULE12}`, caller: 'owner' });
  const r = F.runSeed({
    state: st, firmwareDir: firmwareA(), label: 'seed-firmware-rules-scope-',
    requests: [F.seed('again', 'owner'), check('c-rover', rover.props.tapestryKey), check('c-biscuit', biscuit.props.tapestryKey), check('c-theirs', theirs.props.tapestryKey)],
  });
  for (const [id, what] of [['c-rover', 'rover'], ['c-biscuit', 'Biscuit'], ['c-theirs', 'their relay']]) {
    const c = F.data(r, id);
    assert(c.found >= 1 && (c.violations || []).some((v) => v.rule === RULE12), `${what} breaks rule 12: rules check over it alone finds it (so this isn't passing on a node that's fine); got ${String(show(c)).slice(0, 300)}`);
  }
  const rc = F.data(r, 'again').rulesCheck;
  assert(rc && Array.isArray(rc.rules) && rc.rules.includes(RULE12) && Array.isArray(rc.first) && Number.isInteger(rc.judged), `rulesCheck keeps its shape (the rules run, judged, the number found, the first 20) and ran rule 12; got ${String(show(rc)).slice(0, 300)}`);
  const on = (n) => rc.first.filter((f) => f && f.node && f.node.tapestryKey === n.props.tapestryKey);
  assert(on(rover).some((f) => f.rule === RULE12), `firmware's rover, its dog key gone, is reported; got ${String(show(rc.first)).slice(0, 400)}`);
  assert(!on(biscuit).length && !on(theirs).length, `the instance's own Biscuit and another author's relay, which seed-firmware never wrote, aren't reported: rules check judges only the firmware's own nodes (Amendment 4); got ${String(show([...on(biscuit), ...on(theirs)])).slice(0, 400)}`);
  const firmware = new Set(st.nodes.filter((n) => n.props.installed).map((n) => n.props.tapestryKey));
  const stray = rc.first.filter((f) => !(f && f.node && firmware.has(f.node.tapestryKey)));
  assert(stray.length === 0, `every finding reported is on a node seed-firmware wrote; got ${String(show(stray)).slice(0, 400)}`);
  const found = (() => { const m = show(rc).match(/"(?:findings|count|found|total)"\s*:\s*(\d+)/); return m ? Number(m[1]) : null; })();
  assert(found !== null && found >= on(rover).length && (found > 20 || found === rc.first.length), `the number found counts what it reports, the first 20 of it; got ${found} and ${rc.first.length}`);
  assert(rc.judged > 0 && rc.judged <= F.census().total, `judged is at most the target's ${F.census().total} nodes, never each concept's scope; got ${rc.judged}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
