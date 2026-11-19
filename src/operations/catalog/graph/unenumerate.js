'use strict';
/**
 * graph unenumerate — take a property's link to another concept back: every ENUMERATES into the property node,
 * whichever operation or route made it, with no event (catalog §2, Properties and schema; story
 * graph-operations-first-slice #19, AC5–AC7; ADR graph-operations-first-slice/0019 Decisions 5 and 10–12, and
 * Amendment 1).
 *
 * A property write through the write path (src/operations/write.js), declared as graph enumerate is. Its first steps
 * are enumerate's: it finds the property's concept, locks the concept's header, catches the concept's property nodes
 * up to its schema when they aren't in line (ADR 0018 Decision 6), and refuses what the property writes refuse. Then it
 * takes out every ENUMERATES into the property, from a superset or from anywhere else, and counts them. Nothing else
 * changes: no element changes, and the property's values are judged by its schema alone again. It names the
 * instance's own letters that still claim a link it took out, the relationship events today's route signs, which
 * nothing makes an edge from again (ADR 0022 Amendment 2, item 4); taking a letter back is export nostr's (A10.34). A
 * property with no link answers not-enumerated. It signs nothing.
 */

const { CHANGE_ENTRY } = require('../../changes');
const R = require('../../reads');
const K = require('./_concepts');
const N = require('./_nodes');
const S = require('./_sets');
const M = require('./_memberships');
const P = require('./_properties');
const E = require('./_enumerations');

/** One start's links into the property taken out, every copy, and counted (Decision 5). */
const UNLINK = (ENUM) => `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${ENUM}\`]->(b:TapestryNode {tapestryKey: $to})
  DELETE r
  RETURN count(r) AS n`;

module.exports = {
  group: 'graph',
  name: 'unenumerate',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Take a property's link to another concept back: every ENUMERATES into the property, with no event",
  description: [
    "Takes out every ENUMERATES into the property whose tapestryKey is `property`, one of the fields of one of this instance's own concepts, whichever operation or route made it: `graph enumerate`, today's `POST /api/normalize/enumerate`, or a link from a set. Nothing else changes: the property stays where it is, no element changes, and its values are judged by its schema alone again. Nothing is signed or sent anywhere.",
    "`source` is the concept the property was linked to, when its link ran from one concept's superset; `removed` counts the links taken out, and the change entry names each one's start. `letters` names the instance's own letters that still claim a link it took out: the relationship events today's route signs, which nothing makes a link from again. Taking one back is `export nostr`'s (A10.34).",
    "As every property write, it first brings the concept's property nodes in line with its schema when they aren't (`caughtUp`), and reports on the concept's elements as the rule `element-fits-schema` judges them (`elements`). Safe to repeat: a property with no link changes nothing, records nothing and answers `not-enumerated`. Only this instance's own concepts change, firmware's aside, and a concept whose property tree isn't a tree is refused (`tangled-tree`), its link left as it is.",
  ].join('\n\n'),
  inputs: {
    property: N.keyInput("The tapestryKey of the property: one of a concept's fields, not its primary property"),
  },
  result: {
    description: "Whether a link was taken out; the property; the source it had; how many links went; the letters that still claim one; what catching up changed first; what the write filled in; the property writes' report; whether a letter or the cache no longer match; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'property', 'source', 'removed', 'letters', 'caughtUp', 'filledIn', 'elements', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['unenumerated', 'not-enumerated'], description: 'unenumerated, or not-enumerated when no ENUMERATES ran into the property' },
        property: P.PROPERTY,
        source: { ...E.SOURCE, nullable: true, description: "The source the property had, when every link taken out ran from one concept's superset; null when none was taken out, or they ran from more than one start, or from a set, which the change entry names" },
        removed: { type: 'integer', minimum: 0, description: 'How many ENUMERATES were taken out' },
        letters: E.LETTERS_ENUM,
        caughtUp: P.CAUGHT_UP,
        filledIn: P.FILLED_IN,
        elements: P.ELEMENTS,
        letterOutOfDate: P.LETTER,
        cacheOutOfDate: P.CACHE,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [P.NOT_INSTALLED, P.UNKNOWN_PROPERTY, P.NOT_OWN_CONCEPT, P.FIRMWARE_CONCEPT, P.NO_PRIMARY_PROPERTY, P.NOT_WRAPPED_NOW, P.UNREADABLE_SCHEMA, P.TANGLED_TREE, P.NOT_OWN_NODE, P.MARKED_FIELD, P.SCHEMA_TOO_LARGE, P.BAD_SCHEMA, P.NO_FREE_ADDRESS],
  // As the property writes declare it, so that no-schema and invalid-fields stay listed (ADR 0019 Implementation notes).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['property'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.property;

    // Enumerate's steps 1 to 4: installed, the property's concept, the lock on its header, then the concept.
    const inst = await P.requireInstalled(read);
    const concept = await P.conceptOfProperty(read, key);
    if (!concept) throw E.say.unknownProperty(key);
    await S.lockNode(tx, concept);
    const st = await P.load(read, concept, { inst, missing: () => E.say.unknownProperty(key) });
    const rec = P.findRec(st.t1, key);
    if (!rec || rec.ref === st.t1.root) throw E.say.unknownProperty(key);

    // The links into it, read after the lock; then enumerate's step 10, the commit with the schema as it is.
    const links = await E.linksInto(read, key);
    const done = await P.commit(tx, read, st, { target: st.section1, frame: st.doc0 });

    // Every link taken out, each start's counted (Decision 5).
    const { ENUM } = K.rel();
    const changes = [...done.changes];
    const gone = [];
    let removed = 0;
    for (const l of links) {
      const { rows } = await tx.run(UNLINK(ENUM), { from: l.start, to: key });
      const n = rows.length ? Number(rows[0].n) : 0;
      if (!n) continue;
      removed += n;
      gone.push(l);
      changes.push({ change: 'enumeration-removed', type: ENUM, from: l.start, to: key, ...(l.superset && l.concept ? { concept: l.concept } : {}), nodes: [concept], count: n });
    }

    // The source it had: one concept's superset, every link's start.
    const only = gone.length === 1 && gone[0].superset && gone[0].concept ? gone[0] : null;
    const [h] = only ? await K.headersByKey(read, [only.concept]) : [];
    const source = only ? { concept: only.concept, name: (h && h.names.singular) || null, superset: only.start } : null;

    // The letters that still claim a link it took out (Decision 5): the instance's own relationship events, found
    // through the relationship concept's class thread.
    const from = [...new Set(gone.map((l) => l.uuid).filter(Boolean))];
    const letters = removed
      ? { addresses: from.length && rec.uuid ? [...new Set((await M.relationshipEvents(read, { from, to: rec.uuid, authors: R.ownKeys(), type: ENUM })).map((r) => r.address))].sort() : [], searched: E.SEARCHED }
      : { addresses: [], searched: E.NOT_SEARCHED };

    return {
      data: {
        outcome: removed ? 'unenumerated' : 'not-enumerated',
        property: done.now(rec.ref),
        source,
        removed,
        letters,
        caughtUp: done.caughtUp,
        filledIn: done.filledIn,
        elements: done.elements,
        letterOutOfDate: done.letterOutOfDate,
        cacheOutOfDate: done.cacheOutOfDate,
      },
      changes,
    };
  },
};
