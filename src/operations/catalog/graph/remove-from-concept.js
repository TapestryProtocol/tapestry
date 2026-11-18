'use strict';
/**
 * graph remove-from-concept — take a node out of a concept, or out of one of its sets: the owner's claim, never the
 * node's last concept (catalog §2, Nodes; story graph-operations-first-slice #22, AC5–AC8 and AC9; ADR
 * graph-operations-first-slice/0022 Decisions 1–6, 10–15 and 17, and Amendment 1).
 *
 * A write through the write path (src/operations/write.js). Its guard is the rule node-has-a-concept (design D9), which
 * runs before apply, and again after apply's delete, for another write that took the node's other concept away meanwhile
 * (as unlink-set runs set-has-a-parent). It takes out every way the concept's class thread, or the set's, reaches the
 * node (M1, _memberships.js), and refuses one that would also take the node out of a concept the call didn't name. It
 * takes out only the owner's claims: a membership another author's letter claims, or firmware's definition makes, stays.
 * It is safe to repeat by node, concept and set, records a change entry that keeps each section it takes out whole, and
 * signs nothing.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const { findRule } = require('../../rules');
const R = require('../../reads');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_elements');
const N = require('./_nodes');
const M = require('./_memberships');

const RULE = 'node-has-a-concept';
const PROPERTY = 'tapestryOwnSections';
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);

/** Decision 15, step 1 (Amendment 1, item 1): one pair's links, every copy, by unlink-set's statement. */
const pairDelete = (TERM) => `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${TERM}\`]->(b:TapestryNode {tapestryKey: $to})
   WHERE NOT a:GraphChange AND NOT b:GraphChange
   DELETE r
   RETURN count(r) AS removed`;
/** Decision 15, step 3 (Amendment 1, item 2): one tag, by C11's statement. */
const TAG_DELETE = 'MATCH (t:NostrEventTag {tapestryKey: $key}) DETACH DELETE t';
/** The node read whole, for the copies it carries. */
const R1 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n';

module.exports = {
  group: 'graph',
  name: 'remove-from-concept',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Take a node out of a concept, or out of one of its sets: the owner's claim, never the node's last concept",
  description: [
    "Takes the node whose tapestryKey is `node` out of `concept`: every `HAS_ELEMENT` into it from the concept's superset, or from a set in the concept's class thread, goes. Given `set`, a set or superset in the concept's class thread, the links into the node from that set and from the sets below it go instead, and the node stays in the concept when the concept still reaches it another way. The node leaves each concept that reached it only through what was taken out, and stays in every other. Nothing is signed or sent anywhere.",
    "For each concept it leaves, that concept's section leaves its JSON and its key leaves `wordTypes`; its word block stays. One of this instance's own nodes also loses its `z` tags naming those concepts and its `n` tags naming the sets taken out, so a firmware reinstall doesn't link it again. For any other node only the owner's section goes, kept beside the author's letter in `tapestryOwnSections`: the letter stays as its author wrote it. The marked fields of each concept it leaves come off the node. The change entry keeps each section whole, so a mistaken removal is undone with `graph add-to-concept` and the section's fields.",
    "It refuses a call that would leave the node an element of no concept but word (the rule `node-has-a-concept`, design D9): add it to another concept first (`graph add-to-concept`), or delete it (`graph delete-node`). It takes out only the owner's claims: a membership another author's letter claims, by a `z` naming the concept or an `n` naming the set (`author-claim`), or one firmware's definition makes (`firmware-membership`), stays, since the next import or a firmware reinstall would make it again. It refuses a call that would also take the node out of a concept it didn't name (`other-concept`), naming that concept; and a tag (`tag-node`), a node another operation looks after (`made-elsewhere`), a concept keyed `word` or `graphContext`, a `set` that isn't one of the concept's, and JSON that can't be read.",
    "When the concept, or the set, doesn't reach the node, it changes nothing, records nothing and answers `already-removed`. `letters` names the instance's own letters that still state a removed membership: the node's own letter, and a relationship event that names a removed pair. The node's letter and the derive step's cached copy of its JSON are left as they are: `letterOutOfDate` and `cacheOutOfDate` say when they now differ from it.",
  ].join('\n\n'),
  inputs: {
    node: N.keyInput("The tapestryKey of the node to take out: any node, one of this instance's own or another author's, a person node, a placeholder or one of firmware's own elements"),
    concept: N.keyInput("A concept header's tapestryKey: the concept the node is taken out of"),
    set: { schema: { type: 'string', pattern: N.KEY_PATTERN }, description: "The tapestryKey of a set or superset in the concept's class thread to take the node out of, with the sets below it; left out, the concept's superset, so the whole concept" },
  },
  result: {
    description: "The node, whether this call took the membership out or the concept didn't reach it; where its sections are kept; the links taken out; the concepts it left and those it is still an element of; the instance's own letters that still state the membership; the node properties taken off; whether its letter and its cached copy now differ from it; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'node', 'concept', 'set', 'kept', 'links', 'left', 'concepts', 'letters', 'letterOutOfDate', 'cacheOutOfDate', 'copies', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['removed', 'already-removed'], description: "removed, or already-removed when the concept, or the set, didn't reach the node" },
        node: M.NODE,
        concept: { type: 'string', description: "The tapestryKey of the concept's header" },
        set: { type: 'string', nullable: true, description: 'The set given, or null' },
        kept: { type: 'string', enum: ['json-tag', 'beside'], description: "Where the node's sections are kept: json-tag, in its own JSON, for one of this instance's own nodes; beside, in tapestryOwnSections, for any other" },
        links: { type: 'array', items: N.RELATIONSHIP, description: 'Each relationship taken out' },
        left: { ...M.CONCEPT_KEYS, description: 'Each concept the node left, by tapestryKey' },
        concepts: { ...M.CONCEPT_KEYS, description: 'Each concept it is still an element of, by tapestryKey' },
        letters: M.LETTERS,
        letterOutOfDate: { type: 'boolean', description: "Whether this call changed one of this instance's own nodes that has a letter, which now differs from it until export nostr (A10.34) sends a new one" },
        cacheOutOfDate: { type: 'boolean', description: 'Whether this call changed a node the derive step had cached (tapestryJsonUpdatedAt): readers of the cache may see its old JSON until cache rebuild (A10.36)' },
        copies: { type: 'array', items: { type: 'string' }, description: "The node properties taken off: the marked fields of the concepts it left, such as dog_breed" },
        note: { type: 'string', description: 'When it changed: where the change is kept, and what its letters and cached copy now say' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [X.NOT_INSTALLED, M.UNKNOWN_NODE, M.TAG_NODE, M.MADE_ELSEWHERE_REMOVE, F.UNKNOWN_CONCEPT, X.RESERVED_KEY, X.NO_SUPERSET, X.NOT_A_SET, X.NOT_IN_CLASS_THREAD, M.UNREADABLE_JSON, M.FIRMWARE_MEMBERSHIP, M.AUTHOR_CLAIM, M.OTHER_CONCEPT],
  guards: [{ rule: RULE, items: (inputs) => [{ node: inputs.node, concept: inputs.concept, set: inputs.set }] }],
  repeatKey: ['node', 'concept', 'set'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.node;
    const set = typeof inputs.set === 'string' ? inputs.set : null;

    // 1. What needs no graph (Decision 2).
    if (!K.assistant()) throw refusal(X.NOT_INSTALLED.code, M.say.notInstalled());

    // 2. The locks (Decision 4): the node, then the concept's header. Two calls on one node go one at a time; the guard
    // ran before them, so the re-check below judges the node again once the links are gone.
    await S.lockNode(tx, key);
    await S.lockNode(tx, inputs.concept);

    // 3. The node, the concept and the anchor (Decisions 2 and 3).
    const { facts, conceptKeys: before, headers } = await M.theNode(read, key);
    const kept = M.keptIn(facts);
    const { concept, superset } = await M.theConcept(read, inputs.concept);
    const where = await X.whereTo(read, { concept, superset, set: inputs.set });
    const anchor = where.target;

    const headerOf = new Map(headers.map((h) => [h.key, h]));
    const keyed = (c) => ({ concept: c, key: (headerOf.get(c) && headerOf.get(c).oKey) || null });
    const answer = { node: M.nodeOf(facts), concept: concept.key, set, kept };
    const nothing = (concepts) => ({ data: { outcome: 'already-removed', ...answer, links: [], left: [], concepts: concepts.map(keyed), letters: [], letterOutOfDate: false, cacheOutOfDate: false, copies: [] }, changes: [] });

    // 4. M1 (Decision 10): every way the concept, or the set, reaches the node. None is a repeat.
    const ways = await M.waysIn(read, { anchor, node: key });
    if (!ways.length) return nothing(before);

    // 5. The concepts it would leave: those that reach it now and wouldn't once M1's links were gone. Only those whose
    // key isn't reserved are judged (Amendment 1, item 4: word is listed, never a reason to refuse).
    const after = M.keysOf(await F.conceptsOfNodes(read, [key], { without: ways.map((w) => w.rel) }));
    const left = before.filter((c) => !after.includes(c)).map((c) => ({ ...keyed(c), uuid: (headerOf.get(c) && headerOf.get(c).uuid) || null }));
    const judged = left.filter((c) => !X.RESERVED_KEYS.includes(c.key));

    // 6. Whose claim it is, and the concepts the call didn't name (Decision 10's checks, in order).
    const made = await M.firmwareMembership(read, { facts, ways, left: judged });
    if (made) throw refusal(M.FIRMWARE_MEMBERSHIP.code, M.say.firmwareMembership(facts, made), { input: 'node' });
    const tags = await M.tagsOf(read, key);
    const claim = M.authorClaim({ facts, tags, ways, left: judged });
    if (claim) throw refusal(M.AUTHOR_CLAIM.code, M.say.authorClaim(facts, claim), { input: 'node' });
    for (const c of judged) {
      if (await M.reaches(read, { concept: c.concept, anchor })) continue;
      let via = ways[0];
      for (const w of ways) if (await M.reaches(read, { concept: c.concept, anchor: w.from })) { via = w; break; }
      const other = (await F.conceptOf(read, c.concept)) || { key: c.concept, uuid: c.uuid };
      const start = (await S.nodeOf(read, via.from)) || { key: via.from };
      throw refusal(M.OTHER_CONCEPT.code, M.say.otherConcept(facts, concept, other, start), { input: 'concept' });
    }

    // 7. The node's JSON (Decision 5).
    const json = await M.jsonOf(read, facts, kept);

    // 8. The writes (Decision 15). First the links, pair by pair, every copy.
    const { TERM } = S.aliases();
    const removed = [];
    for (const w of new Map(ways.map((x) => [x.from, x])).values()) {
      const { counters } = await tx.run(pairDelete(TERM), { from: w.from, to: key });
      if (counters.relationshipsDeleted) removed.push({ ...w, count: counters.relationshipsDeleted });
    }
    // A removal that raced this call took them out first.
    if (!removed.length) return nothing(M.keysOf(await F.conceptsOfNodes(read, [key])));

    // The sections of each concept it leaves, and their keys in wordTypes; a reserved key's block stays.
    const leaving = new Set(judged.map((c) => c.key).filter((k) => typeof k === 'string' && k));
    const sections = [];
    let wordTypes = null;
    if (kept === 'json-tag') {
      for (const c of judged) if (c.key && own(json.base, c.key) && !sections.some((s) => s.field === c.key)) sections.push({ concept: c.concept, field: c.key, was: json.base[c.key] });
      let newJson = Object.fromEntries(Object.entries(json.base).filter(([k]) => !sections.some((s) => s.field === k)));
      const word = own(newJson, 'word') && isObject(newJson.word) ? newJson.word : null;
      if (word && Array.isArray(word.wordTypes)) {
        const now = word.wordTypes.filter((k) => !leaving.has(k));
        if (now.length !== word.wordTypes.length) {
          wordTypes = { was: [...word.wordTypes], now };
          newJson = Object.fromEntries(Object.entries(newJson).map(([k, v]) => (k === 'word' ? [k, { ...v, wordTypes: now }] : [k, v])));
        }
      }
      if (sections.length || wordTypes) {
        if (json.jsonTags.some((t) => typeof t.key !== 'string')) throw new Error("a json tag of the node has no tapestryKey, so it can't be rewritten; run lifecycle migrate first");
        // Inline, even over an LMDB reference, so the graph holds the change (BIBLE §30), as update-node writes it.
        const text = JSON.stringify(newJson);
        const writes = json.jsonTags.map((t) => ({ key: t.key, props: { value: text } }));
        const written = await F.writeCopies(tx, writes);
        if (written !== writes.length) throw new Error(`the removal wrote ${written} of the node's ${writes.length} json tags: one went missing while it was written`);
      }
    } else {
      for (const c of judged) if (c.key && own(json.own, c.key) && !sections.some((s) => s.field === c.key)) sections.push({ concept: c.concept, field: c.key, was: json.own[c.key] });
      if (sections.length) {
        const rest = Object.fromEntries(Object.entries(json.own).filter(([k]) => !sections.some((s) => s.field === k)));
        // The property goes when its last section does (Decision 6).
        const written = await F.writeCopies(tx, [{ key, props: { [PROPERTY]: Object.keys(rest).length ? JSON.stringify(rest) : null } }]);
        if (written !== 1) throw new Error('the node went missing while its sections were written');
      }
    }

    // The tags of a node kept in its json tag: each z naming a concept it leaves, each n naming a set a removed link ran
    // from, one at a time, so a reinstall's pass 1d and wire-implicit-elements don't link it again (AC9).
    const tagsGone = [];
    if (kept === 'json-tag') {
      const zOf = new Set(left.map((c) => c.uuid).filter(Boolean));
      const nOf = new Set(removed.map((w) => w.uuid).filter(Boolean));
      for (const t of tags) if ((t.type === 'z' && zOf.has(t.value)) || (t.type === 'n' && nOf.has(t.value))) tagsGone.push(t);
      if (tagsGone.some((t) => typeof t.key !== 'string')) throw new Error("a tag of the node has no tapestryKey, so it can't be taken out; run lifecycle migrate first");
      for (const t of tagsGone) await tx.run(TAG_DELETE, { key: t.key });
    }

    // The copies: each concept it leaves takes its marked fields off the node; the mapping brings the rest in line.
    const marked = new Set();
    for (const c of left) for (const m of await F.marksOf(read, { concept: c.concept })) if (typeof m.property === 'string') marked.add(m.property);
    const [whole] = await read(R1, { key });
    const props = whole && isObject(whole.n) ? whole.n : {};
    const off = [...marked].filter((p) => own(props, p)).sort();
    if (off.length) await F.writeCopies(tx, [{ key, props: Object.fromEntries(off.map((p) => [p, null])) }]);
    const mapped = await F.mapNodes(tx, [key]);

    // 9. The re-check (Decision 15, step 5): the guard found another concept, so a finding now means another write took
    // it away while this call ran. The rule decides, and the write rolls back.
    const rule = findRule(RULE);
    const found = await rule.violations([{ node: key }], read);
    if (found.length) {
      throw refusal(found[0].code, `${N.labelOf(facts)} stays in ${X.conceptLabel(concept)}: another write took it out of its other concepts while this call ran, so ${X.conceptLabel(concept)} is now its last concept but word, and taking it out would leave it an element of none (design D9). Nothing changed. Add it to another concept first (graph add-to-concept), or delete it (graph delete-node).`, { rule: rule.name });
    }

    // 10. The answer and the entry (Decisions 13 and 14).
    const letters = await M.ownLetters(read, { facts, kept, removed, tags: tagsGone, sections: sections.map((s) => s.field), authors: R.ownKeys() });
    const letterOutOfDate = kept === 'json-tag' && facts.hasLetter === true;
    const cacheOutOfDate = json.cached;
    const copies = { set: mapped.set, removed: { ...mapped.removed } };
    for (const p of off) copies.removed[p] = [...new Set([...(copies.removed[p] || []), key])];
    const notes = ["Changed in this instance's graph only: nothing was signed or sent anywhere."];
    if (kept === 'beside') notes.push(`The node's own JSON${facts.hasLetter ? `, its letter ${facts.uuid},` : ''} is left as it is: only this instance's sections, kept beside it in its ${PROPERTY} property, were taken out.`);
    if (letters.length) notes.push(`${letters.length === 1 ? 'One of this instance\'s own letters still states' : `${letters.length} of this instance's own letters still state`} the membership, until export nostr (A10.34) sends ${letters.length === 1 ? 'one that matches' : 'ones that match'}: ${letters.map((l) => l.address).join(', ')}.`);
    if (cacheOutOfDate) notes.push("The derive step made a cached copy of its JSON before this change (tapestryJsonUpdatedAt), so readers of the cache, such as the node's JSON page, may see the old one until cache rebuild (A10.36).");
    notes.push(`Its change entry keeps each section it took out whole, so graph add-to-concept with a section's fields puts the node back.`);
    const changes = [
      ...removed.map((w) => ({ change: 'membership-removed', type: TERM, from: w.from, to: key, node: key, concept: concept.key, ...(w.count > 1 ? { count: w.count } : {}) })),
      ...sections.map((s) => ({ change: 'section-removed', node: key, concept: s.concept, field: s.field, was: s.was, now: null })),
      ...tagsGone.map((t) => ({ change: 'tag-removed', node: key, field: t.type, was: t.value })),
      ...(wordTypes ? [{ change: 'field-changed', node: key, field: 'word.wordTypes', was: wordTypes.was, now: wordTypes.now }] : []),
      ...F.copyChanges(copies),
    ];
    return {
      data: {
        outcome: 'removed',
        ...answer,
        links: removed.map((w) => ({ type: TERM, from: w.from, to: key })),
        left: left.map(({ concept: c, key: k }) => ({ concept: c, key: k })),
        concepts: after.map(keyed),
        letters,
        letterOutOfDate,
        cacheOutOfDate,
        copies: Object.keys(copies.removed).filter((p) => copies.removed[p].length).sort(),
        note: notes.join(' '),
      },
      changes,
    };
  },
};
