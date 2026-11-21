'use strict';
/**
 * lifecycle seed-firmware's plan: each node's and each relationship's outcome, as a pure function of the target, the
 * graph's state and take — run by test/operations.test.js. In-process: the graph is a state of test/helpers/
 * cypherEngine.js, which the installer's reader reads through a read function, as rules check's findingsIn does.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC4, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Decisions 2, 6, 7 and 8)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *
 * The seam this suite pins (the plan's "Raised at Test Design", item 1): src/operations/catalog/lifecycle/_seed.js
 * exports readState(read, target), whose read is (cypher, params) → Promise<rows> (a tx's read and run are on it too),
 * and plan(target, state, { take, takeAll }) → { nodes, relationships }: nodes holding an entry { address, outcome,
 * noRecord?, parts? } for each node; relationships either a list of { type, from, to, outcome } or Decision 11's lists
 * (added, removed, changed, kept) with the counts of unchanged and others. These states have no install record: the
 * cases a record decides (an edit after an install, a changed file, not-in-source, a removed relationship) are
 * seed-firmware.test.js's, through the route, where the installer's own apply writes the records.
 *
 *   SP1  an empty graph: every node and every relationship of the target is added
 *   SP2  the plan reads and writes nothing: it is the same twice, and the graph isn't asked while it runs
 *   SP3  first contact with today's install's graph: equal nodes unchanged (adopted); the schemas pass 3b filled (four:
 *        it skips dog's, dog-breed having no element), the three concept graphs pass 1c flattened (ADR 0037 Amendment 1,
 *        item 2), an edited header and a re-pointed b kept with noRecord; nothing added, nothing changed
 *   SP4  first contact's relationships: one there is unchanged; one missing is kept with noRecord, not added; one
 *        between two firmware nodes that the target lacks is the instance's own (others), never removed
 *   SP5  take, by address and by tapestryKey, and takeAll: each kept node changed; takeAll takes the kept relationships
 *   SP6  graph-rule's items: one that differs from its file is put back (or changed), never kept; another author's
 *        item with the rule's name, where none is at firmware's address, is blocked
 *   SP7  an element with no node at its address, while another element with its name is in the concept's class
 *        thread, is blocked
 *   SP8  a relationship letter at the random address today's create-set gave it is that set's: unchanged
 *   SP9  word.wordTypes compares as a set: a superset whose wordTypes are only in another order (the set deriver's) is
 *        unchanged, adopted; one whose wordTypes hold another type is kept (ADR 0037 Amendment 3, item 2; review round
 *        1, Blocking 1)
 */

const crypto = require('crypto');
const path = require('path');
const F = require('../../helpers/seedFirmwareFixtures');
const E = require('../../helpers/cypherEngine');
const S = require('../../helpers/graphOpsSuite');

const { assert, show, TA } = F;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware — the plan, a pure function of the target, the graph and take');

const OTHER = 'ee'.repeat(32);
const ROVER = 'concepts/dog/elements/rover.json';
const first = (xs) => show(xs.slice(0, 5)).slice(0, 700);

/** A read over a state, as the graph seam's read gives rows; tx-shaped too. */
function readerOf(state) {
  const asked = [];
  const read = async (cypher, params) => { asked.push(String(cypher).replace(/\s+/g, ' ').slice(0, 120)); return E.run(state, cypher, params || {}, { write: false }).rows; };
  read.read = read;
  read.run = async (cypher, params) => { const r = E.run(state, cypher, params || {}, { write: false }); return { rows: r.rows, counters: r.counters }; };
  read.asked = asked;
  return read;
}
let TARGET = null;
async function target() { if (!TARGET) TARGET = await F.buildTarget(F.ACTIVE, TA); return TARGET; }
async function planOver(state, opts = {}) {
  const seed = F.needSeed();
  const t = await target();
  const st = await seed.readState(readerOf(state), t);
  return { seed, t, st, p: await seed.plan(t, st, opts) };
}
/** The plan's node entries by address, whatever the container. */
function nodeOutcomes(p) {
  const n = p && p.nodes;
  const list = Array.isArray(n) ? n : n instanceof Map ? [...n.values()] : n && typeof n === 'object' ? Object.entries(n).map(([address, e]) => ({ address, ...e })) : [];
  return new Map(list.map((e) => [e.address, e]));
}
const outcomeAt = (p, address) => { const e = nodeOutcomes(p).get(address); return e ? e.outcome : undefined; };
const tally = (p) => { const c = {}; for (const e of nodeOutcomes(p).values()) c[e.outcome] = (c[e.outcome] || 0) + 1; return c; };
/** The plan's outcome for one relationship: a list of entries with outcome, or Decision 11's lists. */
function relOutcome(p, type, from, to) {
  const r = p && p.relationships;
  if (Array.isArray(r)) { const e = r.find((x) => F.relIs(x, type, from, to)); return e ? e.outcome : undefined; }
  if (r && typeof r === 'object') {
    for (const k of ['added', 'removed', 'changed', 'kept', 'unchanged', 'others']) if (Array.isArray(r[k]) && r[k].some((x) => F.relIs(x, type, from, to))) return k;
  }
  return undefined;
}
const relCount = (p, outcome) => {
  const r = p && p.relationships;
  if (Array.isArray(r)) return r.filter((x) => x.outcome === outcome).length;
  const v = r && r[outcome];
  return Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0;
};

let FIRST = null;
/** Today's install's graph, with an edited header (dog's JSON) and a re-pointed b (nostr-relay's), as an admin leaves them. */
async function firstContact() {
  if (FIRST) return FIRST;
  const o = await F.oracle();
  const s = F.todaysGraph(o, {
    edges: [{ from: o.supersetOf('concept-header'), type: 'HAS_ELEMENT', to: o.headerOf('dog') }],
    edit: (st, at) => {
      const tag = (address, type) => F.relsOf(st, { type: 'HAS_TAG', from: address }).map((r) => r.toNode).find((t) => t.props.type === type);
      const json = tag(o.headerOf('dog'), 'json');
      const j = JSON.parse(json.props.value);
      j.conceptHeader.description = 'Dogs, as this instance\'s admins describe them.';
      json.props.value = JSON.stringify(j);
      for (const t of F.relsOf(st, { type: 'HAS_TAG', from: o.headerOf('nostr-relay') }).map((r) => r.toNode).filter((x) => x.props.type === 'b')) t.props.value = `39998:${OTHER}:nostr-relay`;
      void at;
    },
  });
  FIRST = { o, s };
  return FIRST;
}

test('SP1 [AC1, Decision 7]: on an empty graph every node of the target is added, and every relationship added', async () => {
  const { t, p } = await planOver(F.emptyGraph());
  const c = tally(p);
  assert(c.added === F.nodesOf(t).length && Object.keys(c).length === 1, `every node is added; got ${show(c)}`);
  const rels = F.relsOfTarget(t).map(F.relEnds);
  const notAdded = rels.filter((r) => relOutcome(p, r.type, r.from, r.to) !== 'added');
  assert(rels.length > 0 && notAdded.length === 0, `every relationship is added; ${notAdded.length} aren't, the first ${first(notAdded)}`);
});

test('SP2 [Decision 7]: the plan is pure: twice over the same state it is the same, and the graph isn\'t asked while it runs', async () => {
  const { s } = await firstContact();
  const seed = F.needSeed();
  const read = readerOf(s);
  const st = await seed.readState(read, await target());
  assert(read.asked.length > 0, 'readState read the graph (so this isn\'t passing on a reader that reads nothing)');
  const before = read.asked.length;
  const a = await seed.plan(await target(), st, {});
  const b = await seed.plan(await target(), st, {});
  assert(read.asked.length === before, `plan asked the graph nothing; it asked ${read.asked.length - before} more`);
  assert(F.stable(JSON.parse(JSON.stringify(a))) === F.stable(JSON.parse(JSON.stringify(b))), 'the same inputs give the same plan');
});

test('SP3 [AC4 open question 2, Decisions 5 and 7, Amendment 1]: first contact: a node equal to the target is unchanged, adopted; the four schemas pass 3b filled, the three flattened concept graphs, an edited header and a re-pointed b are kept with noRecord', async () => {
  const { o, s } = await firstContact();
  const { p } = await planOver(s);
  const nodes = nodeOutcomes(p);
  const keptAddresses = new Set([...F.keptOnFirstContact(o), o.headerOf('dog'), o.headerOf('nostr-relay')]);
  const want = F.keptOnFirstContact(o).length + 2;
  assert(keptAddresses.size === want, `${want}: the schemas pass 3b filled (an enumeration whose enumerating concept has an element: four on firmware 1.0.0, since dog-breed has none and dog's schema is its file's), the concept graphs pass 1c flattens (three) and the two edits; got ${keptAddresses.size}`);
  for (const address of keptAddresses) {
    const e = nodes.get(address);
    assert(e && e.outcome === 'kept' && e.noRecord === true, `${address.split(':')[2]} differs from the source and has no record: kept, noRecord; got ${show(e)}`);
  }
  const wrong = [...nodes.values()].filter((e) => !keptAddresses.has(e.address) && e.outcome !== 'unchanged');
  assert(wrong.length === 0, `every other node is unchanged (its record written, adopted); ${wrong.length} aren't, the first ${first(wrong)}`);
  assert(nodes.size === F.nodesOf(await target()).length, `an entry for each of the target's ${F.nodesOf(await target()).length} nodes; got ${nodes.size}`);
});

test('SP4 [AC4, Decision 8]: first contact\'s relationships: one there is unchanged; one missing is kept with noRecord, not added; one the target lacks, between two firmware nodes, is the instance\'s own', async () => {
  const { o, s } = await firstContact();
  const { p } = await planOver(s);
  assert(relOutcome(p, 'IS_THE_CONCEPT_FOR', o.headerOf('dog'), o.supersetOf('dog')) === 'unchanged', 'dog\'s IS_THE_CONCEPT_FOR, there, is unchanged');
  assert(relOutcome(p, 'HAS_ELEMENT', o.supersetOf('concept-header'), o.headerOf('dog')) === 'unchanged', 'concept-header\'s superset → dog\'s header, there, is unchanged');
  const missing = relOutcome(p, 'HAS_ELEMENT', o.supersetOf('concept-header'), o.headerOf('word'));
  assert(missing === 'kept', `concept-header's superset → word's header is missing (today's graph here holds only the routes' edges): kept, until taken; got ${show(missing)}`);
  const r = p.relationships;
  const entry = (Array.isArray(r) ? r : (r.kept || [])).find((x) => F.relIs(x, 'HAS_ELEMENT', o.supersetOf('concept-header'), o.headerOf('word')));
  assert(entry && entry.noRecord === true, `with noRecord, as a node without a record (Decision 8); got ${show(entry)}`);
  assert(relCount(p, 'added') === 0 && relCount(p, 'removed') === 0, `first contact adds and removes no relationship; got added ${relCount(p, 'added')}, removed ${relCount(p, 'removed')}`);
  const pruned = relOutcome(p, 'HAS_ELEMENT', o.supersetOf('json-data-type'), o.elementOf('concepts/json-data-type/elements/integer.json'));
  assert(pruned === 'others' || pruned === undefined, `json-data-type's superset → integer, which the routes made and 1e prunes, is the instance's own on first contact (others), never removed; got ${show(pruned)}`);
  assert(relCount(p, 'others') >= 1, 'others counts it');
});

test('SP5 [AC4 open question 3, Decision 7]: take by address and by tapestryKey, and takeAll: each kept node is changed; takeAll takes the kept relationships too', async () => {
  const { o, s } = await firstContact();
  const dogKey = F.nodesAt(s, o.headerOf('dog'))[0].props.tapestryKey;
  const byAddress = await planOver(s, { take: [o.headerOf('nostr-relay')] });
  assert(outcomeAt(byAddress.p, o.headerOf('nostr-relay')) === 'changed' && outcomeAt(byAddress.p, o.headerOf('dog')) === 'kept', 'take by address: that node changed, the others still kept');
  const byKey = await planOver(s, { take: [dogKey] });
  assert(outcomeAt(byKey.p, o.headerOf('dog')) === 'changed' && outcomeAt(byKey.p, o.headerOf('nostr-relay')) === 'kept', 'take by tapestryKey: that node changed');
  const all = await planOver(s, { takeAll: true });
  const c = tally(all.p);
  const kept = F.keptOnFirstContact(o).length + 2;
  assert(!c.kept && c.changed === kept, `takeAll: the ${kept} kept nodes changed, none kept; got ${show(c)}`);
  const missing = relOutcome(all.p, 'HAS_ELEMENT', o.supersetOf('concept-header'), o.headerOf('word'));
  assert(missing === 'added' || missing === 'changed', `takeAll makes a missing relationship; got ${show(missing)}`);
});

test('SP6 [AC5, Decision 7]: graph-rule\'s items: one that differs from its file is put back (or changed), never kept; another author\'s item with a rule\'s name, where none is at firmware\'s address, is blocked', async () => {
  const o = await F.oracle();
  const items = [...o.letters.values()].filter((l) => l.concept === 'graph-rule' && l.role === 'element').sort((a, b) => (a.address < b.address ? -1 : 1));
  const [edited, theirs] = items;
  const s = F.todaysGraph(o, {
    edit: (st) => {
      const t = F.relsOf(st, { type: 'HAS_TAG', from: edited.address }).map((r) => r.toNode).find((x) => x.props.type === 'json');
      const j = JSON.parse(t.props.value);
      t.props.value = JSON.stringify({ ...j, graphRule: { ...j.graphRule, says: `${j.graphRule.says} (edited by hand)` } });
      // theirs: the assistant's item gone, another author's of the same name in graph-rule's class thread.
      const mine = F.nodesAt(st, theirs.address)[0];
      st.rels = st.rels.filter((r) => r.from !== mine.eid && r.to !== mine.eid);
      st.nodes = st.nodes.filter((n) => n.eid !== mine.eid);
      const other = F.addNode(st, ['NostrEvent', 'ListItem'], { uuid: `39999:${OTHER}:${theirs.address.split(':')[2]}`, id: crypto.createHash('sha256').update('their item').digest('hex'), kind: 39999, pubkey: OTHER, name: theirs.name, created_at: 1700000000 });
      F.addTagNodes(st, other, theirs.tags.map((x) => (x[0] === 'json' ? ['json', '{"word":{"slug":"theirs"},"graphRule":{"says":"theirs"}}'] : x)));
      F.addRel(st, F.nodesAt(st, o.supersetOf('graph-rule'))[0], 'HAS_ELEMENT', other);
    },
  });
  const { p } = await planOver(s);
  const e = outcomeAt(p, edited.address);
  assert(e === 'put-back' || e === 'changed', `an item that differs from its file is brought in line (put-back; changed is accepted with no record to tell an edit from a file change); got ${show(e)}`);
  assert(outcomeAt(p, theirs.address) === 'blocked', `the item another author's holds the name of is blocked, never made over theirs; got ${show(outcomeAt(p, theirs.address))}`);
  const others = items.slice(2).filter((l) => outcomeAt(p, l.address) !== 'unchanged');
  assert(items.length === F.census().graphRules && others.length === 0, `the other ${items.length - 2} of the ${F.census().graphRules} are unchanged; got ${first(others.map((l) => [l.file, outcomeAt(p, l.address)]))}`);
});

test('SP7 [Decision 4, 1b; Decision 7]: an element with no node at its address, while another element with its name is in its concept\'s class thread, is blocked', async () => {
  const o = await F.oracle();
  const rover = o.elementOf(ROVER);
  const s = F.todaysGraph(o, {
    edit: (st) => {
      const mine = F.nodesAt(st, rover)[0];
      st.rels = st.rels.filter((r) => r.from !== mine.eid && r.to !== mine.eid);
      st.nodes = st.nodes.filter((n) => n.eid !== mine.eid);
      const twin = F.addNode(st, ['ListItem'], { uuid: `39999:${TA}:${F.dtag.childDTag('Rover', `39998:${TA}:dog`, 1)}`, kind: 39999, pubkey: TA, name: 'Rover', tapestryValue: 'Rover', created_at: 1700000000 });
      F.addRel(st, F.nodesAt(st, o.supersetOf('dog'))[0], 'HAS_ELEMENT', twin);
    },
  });
  const { p } = await planOver(s);
  assert(outcomeAt(p, rover) === 'blocked', `rover is blocked: the name Rover is held in dog's class thread (create-element's own check); got ${show(outcomeAt(p, rover))}`);
});

test('SP8 [Decision 4, 1c½]: a relationship letter at the random address today\'s create-set gave it is that set\'s letter: unchanged, not added', async () => {
  const { o, s } = await firstContact();
  const { p } = await planOver(s);
  const nodes = nodeOutcomes(p);
  for (const r of o.relationshipLetters) {
    const e = nodes.get(r.address);
    if (e) assert(e.outcome === 'unchanged', `the letter for ${r.nodeTo.split(':')[2]}, at today's address ${r.address.split(':')[2]}, is unchanged; got ${show(e)}`);
  }
  const added = [...nodes.values()].filter((e) => e.outcome === 'added');
  assert(added.length === 0, `nothing is added on first contact with today's install: each relationship letter is matched by its nodeFrom, nodeTo and relationshipType, not made again at a new address; got ${first(added)}`);
  assert(nodes.size === F.nodesOf(await target()).length, `one entry for each node of the target, the ${F.census().relationshipLetters} letters included; got ${nodes.size}`);
});

test('SP9 [AC4, Amendment 3, item 2]: word.wordTypes compares as a set: supersets whose wordTypes are only in the set deriver\'s order are unchanged, adopted; one whose wordTypes hold another type is kept', async () => {
  const o = await F.oracle();
  const supersets = [...o.letters.values()].filter((l) => l.role === 'superset').map((l) => l.address);
  const other = o.supersetOf('dog');
  const s = F.todaysGraph(o, {
    edit: (st) => {
      for (const address of supersets) {
        for (const t of F.relsOf(st, { type: 'HAS_TAG', from: address }).map((r) => r.toNode).filter((x) => x.props.type === 'json')) {
          const j = JSON.parse(t.props.value);
          j.word.wordTypes = address === other ? [...j.word.wordTypes, 'thing'] : ['word', 'superset', 'set'];
          t.props.value = JSON.stringify(j);
        }
      }
    },
  });
  const firstSuperset = F.jsonTagOf(s, F.nodesAt(s, o.supersetOf('node-type'))[0]);
  assert(show(firstSuperset.word.wordTypes) === show(['word', 'superset', 'set']) && show(o.letters.get(o.supersetOf('node-type')).json.word.wordTypes) !== show(firstSuperset.word.wordTypes),
    'the fixture: a superset\'s wordTypes are in the set deriver\'s order, not its letter\'s (so this case is about order)');
  const { p } = await planOver(s);
  const notAdopted = supersets.filter((a) => a !== other && outcomeAt(p, a) !== 'unchanged');
  assert(notAdopted.length === 0, `${notAdopted.length} of the 40 supersets whose wordTypes differ only in order aren't unchanged; the first: ${first(notAdopted.map((a) => [a.split(':')[2], outcomeAt(p, a)]))}`);
  assert(outcomeAt(p, other) === 'kept', `dog's superset, whose wordTypes hold another type, is kept (only the order is set aside); got ${show(outcomeAt(p, other))}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
