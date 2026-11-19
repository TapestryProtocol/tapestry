'use strict';
/**
 * graph move-element — move an element from one set of a concept to another, in one step: one link out of `from`, at
 * most one into `to`, the node's concepts unchanged (catalog §2, Nodes; story graph-operations-first-slice #23, AC1–AC7;
 * ADR graph-operations-first-slice/0023, Option A, Decisions 1–14).
 *
 * A write through the write path (src/operations/write.js), with no guard (Decision 7): every check comes before anything
 * is written, so a refusal changes nothing. It locks the node alone, before any read (Decision 3). It takes out only the
 * owner's own link from `from`, every copy, and MERGEs the one into `to`; for one of the instance's own nodes, kept in
 * its json tag, the `n` tags follow the move (Decision 9). No section, `wordTypes`, schema check or mark is touched, and
 * the field mapping isn't run: the node's concepts don't change. It is safe to repeat by node, from and to, records a
 * change entry when it moves, and signs nothing.
 *
 * What it uses, all already exported:
 *   M (_memberships.js)  lookedAfterElsewhere, keptIn, keysOf, tagsOf, waysIn (M1), reaches (M2), isElementLink,
 *                        firmwareMembership, authorClaim, ownLetters, nodeOf, say.notInstalled, say.firmwareMembership;
 *                        NOT_INSTALLED_REMOVE, TAG_NODE, MADE_ELSEWHERE_REMOVE, FIRMWARE_MEMBERSHIP, AUTHOR_CLAIM; NODE,
 *                        CONCEPT_KEYS, LETTERS
 *   S (_sets.js)         lockNode, nodeOf, kindOf, supersetOf, aliases
 *   X (_elements.js)     conceptsReaching (E2), link, RESERVED_KEYS, conceptLabel
 *   F (_fields.js)       conceptsOfNodes, with `without`
 *   K (_concepts.js)     assistant, headersByKey
 *   E (_eventless.js)    addTags, tagRows
 *   N (_nodes.js)        keyInput, whoseNode
 *   R (reads.js)         ownKeys
 * The pair delete, C11's tag delete and R1 are copied from remove-from-concept.js (Decision 15, Implementation notes).
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const R = require('../../reads');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_elements');
const E = require('./_eventless');
const N = require('./_nodes');
const M = require('./_memberships');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** remove-from-concept.js's pair delete: one pair's links, every copy (Decision 8, step 1). */
const pairDelete = (TERM) => `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${TERM}\`]->(b:TapestryNode {tapestryKey: $to})
   WHERE NOT a:GraphChange AND NOT b:GraphChange
   DELETE r
   RETURN count(r) AS removed`;
/** remove-from-concept.js's C11: one tag (Decision 9). */
const TAG_DELETE = 'MATCH (t:NostrEventTag {tapestryKey: $key}) DETACH DELETE t';
/** remove-from-concept.js's R1: the node read whole, for its cache stamp (Decision 10). */
const R1 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n';

// ── its own refusals (Decision 14) ──
const SAME_SET = Object.freeze({ code: 'same-set', status: 400, when: 'A to that is from: a move of nothing; it needs no graph, so it is answered first' });
const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A node, from or to that names no node of the graph (a change entry is not one); the refusal names the first such input, of node, from and to' });
const NOT_A_SET = Object.freeze({ code: 'not-a-set', status: 409, when: "A from or to that is neither a set nor a superset: an element, a concept header (the refusal names its superset, the key to pass), a node with no address, such as one of the trust pipeline's card sets, or any other node; the refusal names which" });
const DIFFERENT_CONCEPTS = Object.freeze({ code: 'different-concepts', status: 409, when: "Sets no concept but word has both of in its class thread (word's and graphContext's never count): a move between them would change the node's concepts; the refusal names each set's concepts, and says how to go on: graph add-to-concept with the other concept, then graph remove-from-concept" });
const NOT_IN_FROM = Object.freeze({ code: 'not-in-from', status: 409, when: "A node from doesn't hold directly, when to doesn't either: the refusal names the sets of the concept that hold it directly, or, when none does, says it isn't an element of the concept and names graph add-to-concept; also a node another write took out of from while the call ran" });
const LEAVES_CONCEPT = Object.freeze({ code: 'leaves-concept', status: 409, when: "A move that would take the node out of a concept: from is in that concept's class thread, to isn't, and nothing else of it reaches the node; the refusal names the concept, and says how to go on: graph add-to-concept into to, then graph remove-from-concept of that concept" });
const JOINS_CONCEPT = Object.freeze({ code: 'joins-concept', status: 409, when: "A move that would put the node into a concept it isn't in: to is in that concept's class thread too; the refusal names the concept, and says how to go on: graph add-to-concept with that concept, set to and its section, then this call again" });

/** "<name>" (<address>, tapestryKey <key>), for a node, a set or a concept header in messages (Decision 2). */
function named(x) {
  if (!x) return 'a node';
  const name = typeof x.name === 'string' && x.name ? x.name : null;
  const bits = [typeof x.uuid === 'string' && x.uuid ? x.uuid : null, typeof x.key === 'string' && x.key ? `tapestryKey ${x.key}` : null].filter(Boolean);
  if (name) return bits.length ? `"${name}" (${bits.join(', ')})` : `"${name}"`;
  return bits.length ? bits.join(', ') : 'a node';
}
/** A concept header in messages, as `named` gives a node: its name, its address and its tapestryKey, the key its inputs take. */
const conceptNamed = (h) => named(h);
/** "a", "a and b", "a, b and c". */
function and(list) {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** What each of its refusals says, in words (Decision 2): each way on gives its inputs as tapestryKeys. */
const say = {
  sameSet(to) {
    return `from and to both name ${to}: a move from a set to itself moves nothing. Nothing changed. Pass the tapestryKey of another set or superset of the concept as to.`;
  },
  unknownNode(input, key) {
    return `No node of this graph has the tapestryKey ${key}, which ${input} names (a change entry is not a node). Nothing changed.`;
  },
  tagNode(facts) {
    return `${named(facts)} is a tag (NostrEventTag): part of a letter's event, which records no author and is no element of any concept, so it isn't moved between sets. Nothing changed.`;
  },
  /** made-elsewhere for the node: what looks after that kind of node's place. */
  madeElsewhere(facts, { slug, operation, what }) {
    const label = named(facts);
    if (slug === 'set') return `${label} is ${what}: where a set sits in a class thread, the sets and supersets it is directly under, is graph link-set's and unlink-set's, so it isn't moved here. Nothing changed.`;
    if (slug === 'superset') return `${label} is ${what}, which graph update-concept changes with its concept; graph link-set and unlink-set put it under a parent or take it out from under one. It isn't moved here. Nothing changed.`;
    if (slug === 'graph-rule') return `${label} is ${what}, made from the rulebook, docs/GRAPH_RULES.md, and each rule's code by node src/firmware/graph-rules.js, and installed by firmware: its memberships are firmware's, never changed in the graph. Nothing changed.`;
    return `${label} is ${what}, which ${operation} looks after, with the wiring such a node needs: it isn't moved between sets here. Nothing changed.`;
  },
  notASet(input, node, superset) {
    return superset
      ? `${named(node)}, which ${input} names, is a concept header, not a set or a superset. To move an element into or out of its concept's superset, pass the superset's tapestryKey, ${superset}. Nothing changed.`
      : `${named(node)}, which ${input} names, is neither a set nor a superset. A set or a superset is a node labelled Set or Superset that has an address, its uuid; a node with no address, such as one of the trust pipeline's card sets, isn't one. Pass the tapestryKey of a set or of a concept's superset. Nothing changed.`;
  },
  /**
   * different-concepts (Decision 4): each set's concepts, word's and graphContext's aside, and the way on. `fromIn` and
   * `toIn` are the headers counted, `fromAside` and `toAside` the reserved keys set aside; `fromFirst` and `toFirst`
   * the concept each way-on step names.
   */
  differentConcepts(facts, { fromNode, toNode, fromIn, toIn, fromAside, toAside, fromFirst, toFirst }) {
    const where = (node, input, list, aside) => (list.length
      ? `${named(node)}, which ${input} names, is in the class thread of ${and(list.map(conceptNamed))}`
      : `${named(node)}, which ${input} names, is in no concept's class thread${aside.length ? ` but ${and(aside)}'s, which never count` : ''}`);
    const head = `${where(fromNode, 'from', fromIn, fromAside)}; ${where(toNode, 'to', toIn, toAside)}. No concept but word has both in its class thread, so moving ${named(facts)} between them would change its concepts, which a move never does. Nothing changed.`;
    if (!toFirst) return `${head} No concept a node can be put in has ${toNode.key} in its class thread, so pass as to a set or superset of a concept the node is in.`;
    const add = `add it to ${conceptNamed(toFirst)} first, with graph add-to-concept, node ${facts.key}, concept ${toFirst.key}, set ${toNode.key} and the fields its schema asks for`;
    if (!fromFirst) return `${head} To put the node in ${named(toNode)}, ${add}.`;
    return `${head} To move it across concepts, ${add}; then take it out of ${conceptNamed(fromFirst)} with graph remove-from-concept, node ${facts.key}, concept ${fromFirst.key} and set ${fromNode.key}.`;
  },
  /** not-in-from (Decision 5): where the node is directly in the concept, or that it isn't in the concept at all. */
  notInFrom(facts, { fromNode, toNode, concept, holders }) {
    const head = `${named(facts)} isn't directly in ${named(fromNode)}, which from names, nor in ${named(toNode)}, which to names.`;
    if (!holders.length) {
      return `${head} It isn't an element of ${conceptNamed(concept)}: no superset or set of it holds the node. Nothing changed. To put it in ${named(toNode)}, use graph add-to-concept with node ${facts.key}, concept ${concept.key} and set ${toNode.key}.`;
    }
    const pass = holders.length === 1 ? `pass ${holders[0].key} as from` : `pass the one to move it out of as from: ${and(holders.map((h) => h.key))}`;
    return `${head} It is directly in ${and(holders.map(named))}. Nothing changed. To move it from where it is, ${pass}.`;
  },
  /** not-in-from when another write took the link out between this call's reads and its delete (Decision 8). */
  takenMeanwhile(facts, { fromNode, toNode }) {
    return `Another write took ${named(facts)} out of ${named(fromNode)} while this call ran, and ${named(toNode)} doesn't hold it either, so there was nothing to move. Nothing changed. Read where it is now (graph list-elements, or graph history with node ${facts.key}), then try again.`;
  },
  /** author-claim (Decision 6): what makes the claim again, by its tag. */
  authorClaim(facts, claim, fromNode) {
    const again = claim.tag === 'n'
      ? "The next pull of their class thread makes that link again, so the move wouldn't last"
      : "The move would take the node out of that concept, and a firmware reinstall (pass 1d) links the concept's superset to it again from that tag";
    return `${named(facts)}'s link from ${named(fromNode)} is its author's claim: their letter, ${claim.address}, signed by ${claim.author}, names ${claim.value} in its ${claim.tag} tag. ${again}. The instance records an author's claims as theirs, and whether one counts is each point of view's call, when the graph is read. Nothing changed.`;
  },
  leavesConcept(facts, { fromNode, toNode, concept, left }) {
    const them = left.length === 1 ? 'it' : 'them';
    return `Moving ${named(facts)} from ${named(fromNode)} to ${named(toNode)} would take it out of ${and(left.map(conceptNamed))}: ${fromNode.key} is in ${left.length === 1 ? 'its' : 'their'} class thread, ${toNode.key} isn't, and nothing else of ${them} reaches the node. A move changes only which sets of one concept hold a node, never its concepts. Nothing changed. To go on, put the node in ${named(toNode)} first, with graph add-to-concept, node ${facts.key}, concept ${concept.key} and set ${toNode.key}; then take it out of ${and(left.map((c) => `${conceptNamed(c)} with graph remove-from-concept, node ${facts.key} and concept ${c.key}`))}.`;
  },
  joinsConcept(facts, { fromNode, toNode, joined }) {
    return `Moving ${named(facts)} to ${named(toNode)} would put it into ${and(joined.map(conceptNamed))}, which it isn't in: ${toNode.key} is in ${joined.length === 1 ? 'its' : 'their'} class thread too. A move changes only which sets of one concept hold a node, never its concepts. Nothing changed. To go on, add the node to ${and(joined.map((c) => `${conceptNamed(c)} with graph add-to-concept, node ${facts.key}, concept ${c.key}, set ${toNode.key} and the fields its schema asks for`))}. Then make this call again, which then takes out only the link from ${fromNode.key}.`;
  },
};

module.exports = {
  group: 'graph',
  name: 'move-element',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Move an element from one set of a concept to another, in one step: its concepts stay the same',
  description: [
    "Moves the node whose tapestryKey is `node` out of `from`, a set or superset that holds it directly, into `to`, a set or superset of the same concept, in one write: no reader sees it in both, or in neither. Either end may be the concept's superset, so a move files an element into a set, or takes it back up to the superset. Only the link from `from` goes, every copy of it, and the link into `to` comes, unless it was there. Any node is taken: one of this instance's own, one that came from another author's event, a person node, a placeholder the import made, or one of firmware's own elements. Nothing is signed or sent anywhere.",
    "The node stays an element of the same concepts, so its JSON, its sections and `wordTypes`, its address and tapestryKey, its other memberships and its marked-field node properties stay as they were. One of this instance's own nodes, kept in its json tag, has its tags follow the move: the `n` naming `from` goes, and one naming `to` comes when `to` is a set, so the letter export nostr (A10.34) sends names where it is. Another author's letter, or firmware's definition, is never written.",
    "It refuses a `to` that is `from` (`same-set`); a `node`, `from` or `to` that names no node; a tag (`tag-node`) and a node another operation looks after (`made-elsewhere`); a `from` or `to` that is neither a set nor a superset (`not-a-set`, naming a concept header's superset); sets no concept but word has both of in its class thread (`different-concepts`, word's and graphContext's never counting); a node `from` doesn't hold directly (`not-in-from`, naming the sets that do); a link from `from` that firmware's definition makes (`firmware-membership`) or another author's letter claims (`author-claim`), since the next pull of their class thread or a firmware reinstall would make it again; and a move that would take the node out of a concept (`leaves-concept`) or put it into one (`joins-concept`). Each way on names its operations' inputs as tapestryKeys: moving across concepts is graph add-to-concept, then graph remove-from-concept.",
    "Safe to repeat: when the node is directly in `to` and not in `from`, it changes nothing, records nothing and answers `already-moved`. What lasts: a backup restored on a fresh instance keeps the move. A firmware reinstall keeps a move between two sets. It links a concept's superset again, from the node's `z` tag, to a node filed out of it into a set, and its prune may take out a superset's link to a node another set of its concept still holds: the node's concepts and sets are the same either way. The change entry records the links and tags. The node's letter and the derive step's cached copy of its JSON, whose graphContext names its parents, are left as they are: `letterOutOfDate` and `cacheOutOfDate` say when they now differ from it.",
  ].join('\n\n'),
  inputs: {
    node: N.keyInput("The tapestryKey of the node to move: any node, one of this instance's own or another author's, a person node, a placeholder or one of firmware's own elements"),
    from: N.keyInput('The tapestryKey of the set or superset that holds the node directly, which it leaves'),
    to: N.keyInput('The tapestryKey of the set or superset of the same concept it goes into'),
  },
  result: {
    description: "The node, whether this call moved it or it was already in `to` and not in `from`; the two sets and the concept the move is in; where its sections are kept; each concept it is an element of; the instance's own letters that still state its old place; whether its letter and its cached copy now differ from it; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'node', 'from', 'to', 'concept', 'kept', 'concepts', 'letters', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['moved', 'already-moved'], description: 'moved, or already-moved when the node was directly in to and not in from' },
        node: M.NODE,
        from: { type: 'string', description: 'The tapestryKey of the set or superset it left' },
        to: { type: 'string', description: 'The tapestryKey of the set or superset it is directly in' },
        concept: { type: 'string', description: "The tapestryKey of the concept's header the move is in: the innermost one both sets share, of several the lowest tapestryKey" },
        kept: { type: 'string', enum: ['json-tag', 'beside'], description: "Where the node's sections are kept: json-tag, in its own JSON, for one of this instance's own nodes, whose tags follow the move; beside, for any other, whose tags and JSON stay as they are" },
        concepts: { ...M.CONCEPT_KEYS, description: 'Each concept the node is an element of, word included, by tapestryKey' },
        letters: { ...M.LETTERS, description: "The instance's own letters that still state the node's old place: its own letter, for one of this instance's own nodes whose tags the move changed, and each relationship event of the instance's own that names from HAS_ELEMENT the node, found among the relationship concept's elements. export nostr (A10.34) is what sends letters that match" },
        letterOutOfDate: { type: 'boolean', description: "Whether this call changed the tags of one of this instance's own nodes that has a letter, which now differs from it until export nostr (A10.34) sends a new one" },
        cacheOutOfDate: { type: 'boolean', description: "Whether the node has a cached copy of its JSON from the derive step (tapestryJsonUpdatedAt), whose graphContext still lists from among its parents until cache rebuild (A10.36)" },
        note: { type: 'string', description: 'When it moved: where the change is kept, what its letters and cached copy now say, and what a firmware reinstall does to a superset\'s link to it' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [SAME_SET, M.NOT_INSTALLED_REMOVE, UNKNOWN_NODE, M.TAG_NODE, M.MADE_ELSEWHERE_REMOVE, NOT_A_SET, DIFFERENT_CONCEPTS, NOT_IN_FROM, M.FIRMWARE_MEMBERSHIP, M.AUTHOR_CLAIM, LEAVES_CONCEPT, JOINS_CONCEPT],
  // No guard (Decision 7): the node is in every shared concept before the move and after it, and AC4 keeps the rest, so
  // it can't be left in no concept but word (D9).
  guards: [],
  repeatKey: ['node', 'from', 'to'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.node;
    const from = inputs.from;
    const to = inputs.to;

    // 1–2. What needs no graph (Decision 2).
    if (from === to) throw refusal(SAME_SET.code, say.sameSet(to), { input: 'to' });
    if (!K.assistant()) throw refusal(M.NOT_INSTALLED_REMOVE.code, M.say.notInstalled());

    // 3. The lock: the node, and nothing else, before any read (Decision 3).
    await S.lockNode(tx, key);

    // 4. The node.
    const facts = await N.whoseNode(read, key);
    if (!facts) throw refusal(UNKNOWN_NODE.code, say.unknownNode('node', key), { input: 'node' });
    if (facts.labels.includes('NostrEventTag')) throw refusal(M.TAG_NODE.code, say.tagNode(facts), { input: 'node' });
    const { hit, conceptKeys: before } = await M.lookedAfterElsewhere(read, facts);
    if (hit) throw refusal(M.MADE_ELSEWHERE_REMOVE.code, say.madeElsewhere(facts, hit), { input: 'node' });
    const kept = M.keptIn(facts);

    // 5. from, then to.
    const theSet = async (input, k) => {
      const node = await S.nodeOf(read, k);
      if (!node) throw refusal(UNKNOWN_NODE.code, say.unknownNode(input, k), { input });
      if (S.kindOf(node) === 'other') throw refusal(NOT_A_SET.code, say.notASet(input, node, await S.supersetOf(read, k)), { input });
      return node;
    };
    const fromNode = await theSet('from', from);
    const toNode = await theSet('to', to);

    // 6. The two sets' concepts (Decision 4): E2 of each, word's and graphContext's set aside.
    const fromConcepts = (await X.conceptsReaching(read, from)).map((c) => c.concept);
    const toConcepts = (await X.conceptsReaching(read, to)).map((c) => c.concept);
    const all = [...new Set([...before, ...fromConcepts, ...toConcepts])];
    const headerOf = new Map((all.length ? await K.headersByKey(read, all) : []).map((h) => [h.key, h]));
    const header = (c) => headerOf.get(c) || { key: c, uuid: null, name: null, oKey: null };
    const reserved = (c) => X.RESERVED_KEYS.includes(header(c).oKey);
    const counted = (list) => list.filter((c) => !reserved(c)).sort();
    const fromIn = counted(fromConcepts);
    const toIn = counted(toConcepts);
    const shared = fromIn.filter((c) => toIn.includes(c));

    const supersets = new Map();
    const supersetOf = async (c) => {
      if (!supersets.has(c)) supersets.set(c, await S.supersetOf(read, c));
      return supersets.get(c);
    };
    // The innermost of `keys`: one whose class thread reaches the superset of no other (M2); of several, the lowest key.
    const innermost = async (keys) => {
      const inner = [];
      for (const c of keys) {
        let outer = false;
        for (const d of keys) {
          if (d === c) continue;
          const sup = await supersetOf(d);
          if (sup && (await M.reaches(read, { concept: c, anchor: sup }))) { outer = true; break; }
        }
        if (!outer) inner.push(c);
      }
      return (inner.length ? inner : keys).slice().sort()[0] || null;
    };

    if (!shared.length) {
      const aside = (list) => [...new Set(list.filter(reserved).map((c) => header(c).oKey))].sort();
      const fromFirst = fromIn.length ? header(await innermost(fromIn)) : null;
      const toFirst = toIn.length ? header(await innermost(toIn)) : null;
      throw refusal(DIFFERENT_CONCEPTS.code, say.differentConcepts(facts, {
        fromNode, toNode, fromIn: fromIn.map(header), toIn: toIn.map(header), fromAside: aside(fromConcepts), toAside: aside(toConcepts), fromFirst, toFirst,
      }), { input: 'to' });
    }
    const concept = header(await innermost(shared));

    const keyed = (c) => ({ concept: c, key: header(c).oKey || null });
    const answer = { node: M.nodeOf(facts), from, to, concept: concept.key, kept };
    const nothing = (concepts) => ({ data: { outcome: 'already-moved', ...answer, concepts: concepts.map(keyed), letters: [], letterOutOfDate: false, cacheOutOfDate: false }, changes: [] });

    // 7–8. Where the node is (Decision 5): from's own direct links (M1, kept to those whose start is from), and to's.
    const ways = (await M.waysIn(read, { anchor: from, node: key })).filter((w) => w.from === from);
    const inTo = await M.isElementLink(read, to, key);
    if (!ways.length && inTo) return nothing(before);
    if (!ways.length) {
      const holders = new Map();
      for (const c of shared) {
        const sup = await supersetOf(c);
        if (!sup) continue;
        for (const w of await M.waysIn(read, { anchor: sup, node: key })) if (!holders.has(w.from)) holders.set(w.from, w);
      }
      const holderNodes = [];
      for (const k of [...holders.keys()].sort()) holderNodes.push((await S.nodeOf(read, k)) || { key: k });
      throw refusal(NOT_IN_FROM.code, say.notInFrom(facts, { fromNode, toNode, concept, holders: holderNodes }), { input: 'from' });
    }

    // The node's concepts after the move (Decision 7): those still reaching it without from's links, and to's.
    const after = [...new Set([...M.keysOf(await F.conceptsOfNodes(read, [key], { without: ways.map((w) => w.rel) })), ...toConcepts])].sort();
    const left = before.filter((c) => !after.includes(c) && !reserved(c)).map((c) => ({ concept: c, uuid: header(c).uuid || null }));
    const joined = after.filter((c) => !before.includes(c) && !reserved(c));

    // 9. Whose claim from's link is (Decision 6), before the concepts are judged (Decision 7, the order).
    const made = await M.firmwareMembership(read, { facts, ways, left });
    if (made) throw refusal(M.FIRMWARE_MEMBERSHIP.code, M.say.firmwareMembership(facts, made), { input: 'node' });
    const tags = await M.tagsOf(read, key);
    const claim = M.authorClaim({ facts, tags, ways, left });
    if (claim) throw refusal(M.AUTHOR_CLAIM.code, say.authorClaim(facts, claim, fromNode), { input: 'node' });

    // 10. The node's concepts stay the same (Decision 7).
    if (left.length) throw refusal(LEAVES_CONCEPT.code, say.leavesConcept(facts, { fromNode, toNode, concept, left: left.map((c) => header(c.concept)) }), { input: 'from' });
    if (joined.length) throw refusal(JOINS_CONCEPT.code, say.joinsConcept(facts, { fromNode, toNode, joined: joined.map(header) }), { input: 'to' });

    // What the note says about a superset's link (Decision 12), read before the writes: from's own concept, when from
    // is a superset; the sets of to's concept that still hold the node, when to is a superset.
    let zFrom = null;
    if (S.kindOf(fromNode) === 'superset') {
      for (const c of fromConcepts) {
        const h = header(c);
        if (h.uuid && (await supersetOf(c)) === from && tags.some((t) => t.type === 'z' && t.value === h.uuid)) { zFrom = h; break; }
      }
    }
    let stillHeld = [];
    if (S.kindOf(toNode) === 'superset') {
      const gone = new Set(ways.map((w) => w.rel));
      const others = [...new Set((await M.waysIn(read, { anchor: to, node: key })).filter((w) => w.from !== to && !gone.has(w.rel)).map((w) => w.from))].sort();
      for (const k of others) stillHeld.push((await S.nodeOf(read, k)) || { key: k });
    }

    // 11. The writes (Decision 8). First from's link, every copy.
    const { TERM } = S.aliases();
    const { counters } = await tx.run(pairDelete(TERM), { from, to: key });
    const count = Number(counters && counters.relationshipsDeleted) || 0;
    if (!count) {
      // A write that doesn't lock the node took it out meanwhile: nothing more is written.
      if (await M.isElementLink(read, to, key)) return nothing(M.keysOf(await F.conceptsOfNodes(read, [key])));
      throw refusal(NOT_IN_FROM.code, say.takenMeanwhile(facts, { fromNode, toNode }), { input: 'from' });
    }
    // Then to's, unless it was there.
    if (!inTo) await X.link(tx, to, key);

    // The tags of a node kept in its json tag (Decision 9): each n naming from goes, one at a time; one naming to comes
    // when to is a set and none names it yet, at a new index, so its uuid is new. A superset gets no n.
    const tagsGone = kept === 'json-tag' ? tags.filter((t) => t.type === 'n' && t.value === fromNode.uuid) : [];
    if (tagsGone.some((t) => typeof t.key !== 'string')) throw new Error("a tag of the node has no tapestryKey, so it can't be taken out; run lifecycle migrate first");
    for (const t of tagsGone) await tx.run(TAG_DELETE, { key: t.key });
    const tagAdded = kept === 'json-tag' && S.kindOf(toNode) === 'set' && !tags.some((t) => t.type === 'n' && t.value === toNode.uuid) ? toNode.uuid : null;
    if (tagAdded) await E.addTags(tx, key, E.tagRows(facts.uuid || key, [['n', tagAdded]], tags.length));

    // 12. Its letters and its cached copy (Decision 10).
    const letterOutOfDate = kept === 'json-tag' && facts.hasLetter === true && (tagsGone.length > 0 || Boolean(tagAdded));
    const letters = [];
    if (letterOutOfDate && facts.uuid) {
      const what = [...tagsGone.map((t) => `its n tag names ${t.value}, the set it left`), ...(tagAdded ? [`it has no n tag naming ${tagAdded}, the set it is in now`] : [])];
      letters.push({ address: facts.uuid, says: `it still states the node's old place: ${what.join('; ')}. export nostr (A10.34) is what sends a letter that matches` });
    }
    for (const l of await M.ownLetters(read, { facts, kept, removed: [{ from, uuid: fromNode.uuid }], tags: tagsGone, sections: [], authors: R.ownKeys() })) {
      if (l.address !== facts.uuid && !letters.some((x) => x.address === l.address)) letters.push(l);
    }
    const [whole] = await read(R1, { key });
    const props = whole && isObject(whole.n) ? whole.n : {};
    const cacheOutOfDate = props.tapestryJsonUpdatedAt !== undefined && props.tapestryJsonUpdatedAt !== null;

    // 13. The answer and the entry (Decisions 12 and 13).
    const notes = ["Changed in this instance's graph only: nothing was signed or sent anywhere."];
    if (kept === 'beside') notes.push(`The node's tags and its JSON${facts.hasLetter ? `, its author's letter ${facts.uuid},` : ''} are left as they are: only its links changed.`);
    if (letters.length) notes.push(`${letters.length === 1 ? "One of this instance's own letters still states" : `${letters.length} of this instance's own letters still state`} the node's old place, until export nostr (A10.34) sends ${letters.length === 1 ? 'one that matches' : 'ones that match'}: ${letters.map((l) => l.address).join(', ')}.`);
    if (cacheOutOfDate) notes.push(`The derive step made a cached copy of its JSON before this change (tapestryJsonUpdatedAt), whose graphContext still lists ${from} among the sets that hold it, so readers of the cache, such as the node's JSON page, may see its old place until cache rebuild (A10.36).`);
    if (zFrom) notes.push(`From its z tag naming ${zFrom.uuid}, a firmware reinstall (pass 1d) links the node to ${from}, the superset it left, again, as it does every element in a set; install takes that redundant link out again only on a firmware concept with a manifest, and the node stays in ${to} and in ${X.conceptLabel(zFrom)}.`);
    if (stillHeld.length) notes.push(`A firmware reinstall's prune may take out the link from ${to}, which is redundant while ${and(stillHeld.map((n) => n.key))} still ${stillHeld.length === 1 ? 'holds' : 'hold'} the node directly, leaving it there and in ${X.conceptLabel(concept)}.`);
    const changes = [
      { change: 'membership-removed', type: TERM, from, to: key, node: key, concept: concept.key, ...(count > 1 ? { count } : {}) },
      ...(inTo ? [] : [{ change: 'membership-added', type: TERM, from: to, to: key, node: key, concept: concept.key }]),
      ...tagsGone.map((t) => ({ change: 'tag-removed', node: key, field: 'n', was: t.value })),
      ...(tagAdded ? [{ change: 'tag-added', node: key, field: 'n', now: tagAdded }] : []),
    ];
    return {
      data: {
        outcome: 'moved',
        ...answer,
        concepts: after.map(keyed),
        letters,
        letterOutOfDate,
        cacheOutOfDate,
        note: notes.join(' '),
      },
      changes,
    };
  },
};
