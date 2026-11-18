'use strict';
/**
 * graph remove-property — take a property, and every property under it, out of a concept, with no event; the concept's
 * JSON Schema follows (catalog §2, Properties and schema; story graph-operations-first-slice #18, AC2, AC4 and AC6–AC9;
 * ADR graph-operations-first-slice/0018 Decisions 6, 7.3 and 8–14, and Amendment 1).
 *
 * A write through the write path, with the rule element-fits-schema run in apply over what it writes (Decision 10). It
 * finds the property's concept, locks the concept's header, catches the concept's property nodes up to its schema when
 * they aren't in line (Decision 6), takes the property and those under it out, each kept whole in the change entry, so
 * a mistake can be undone from the entry alone, rewrites the JSON schema node from the tree, and reports on the
 * concept's elements, those that still hold the field among them (Decision 9). A key whose removal an entry records
 * answers already-gone. It signs nothing.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY, ENTRY } = require('../../changes');
const N = require('./_nodes');
const S = require('./_sets');
const P = require('./_properties');

const REMOVAL = Object.freeze({
  type: 'object',
  nullable: true,
  required: ['id', 'at', 'by', 'operation'],
  description: 'For already-gone, the change entry that records the removal; null for removed, whose entry is change',
  properties: { id: ENTRY.properties.id, at: ENTRY.properties.at, by: ENTRY.properties.by, operation: ENTRY.properties.operation },
});

const unknownProperty = (key, why) => refusal(P.UNKNOWN_PROPERTY.code, `No concept's property tree has a property with the tapestryKey ${key}: ${why}. Nothing changed.`, { input: 'property' });

/** No property node has the key: already-gone, from the entry that records its removal, or unknown-property (Decision 7.3). */
async function repeatOf(read, key) {
  if (await N.whoseNode(read, key)) throw unknownProperty(key, "it names a node that isn't one of a concept's properties (a concept's primary property is not one)");
  const found = await N.removalOf(read, key, 'property-removed');
  if (!found) throw unknownProperty(key, 'it names no node, and no change entry records its removal');
  const { entry } = found;
  return {
    data: {
      outcome: 'already-gone',
      removed: [],
      removal: { id: entry.id, at: entry.at, by: entry.by, operation: entry.operation },
      caughtUp: { added: [], changed: [], removed: [] },
      filledIn: [],
      elements: null,
      letterOutOfDate: false,
      cacheOutOfDate: false,
    },
    changes: [],
  };
}

module.exports = {
  group: 'graph',
  name: 'remove-property',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Take a property, and every property under it, out of a concept; the concept's JSON Schema follows",
  description: [
    "Takes the property whose tapestryKey is `property`, one of a concept's properties, out of the concept, with every property under it. The concept's schema no longer has them, nor lists them as required or unique, and its JSON schema node is rebuilt from its properties in the same write, so every reader reads the change. Nothing is signed or sent anywhere.",
    "The change entry keeps each property node taken out whole, its labels, properties, tags and relationships, so a mistake can be undone from the entry alone. A marked field, or a property one hangs under, can't be taken out (`marked-field`): graph unmark-field takes the mark off first. The elements' JSON is left as it is: `elements.stillHold` names those whose tapestryJson still holds a value at a removed field's place, for graph update-node to change.",
    "As every property write, it first brings the concept's property nodes in line with its schema when they aren't (`caughtUp`); when that takes the property out itself, as one the schema doesn't list, the answer is removed all the same. The same call again changes nothing and answers `already-gone`, naming the entry that records the removal. Only this instance's own concepts change, firmware's aside; for one with a letter, `letterOutOfDate` says it no longer matches it.",
  ].join('\n\n'),
  inputs: {
    property: N.keyInput("The tapestryKey of the property to take out: one of a concept's properties, not its primary property"),
  },
  result: {
    description: 'Whether it was removed or already gone; the properties taken out, as they were, the one named first; for a repeat, the entry that records the removal; what catching up changed first; what the write filled in; the report on the concept\'s elements; whether its letter and its cache no longer match; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'removed', 'removal', 'caughtUp', 'filledIn', 'elements', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['removed', 'already-gone'], description: 'removed, or already-gone when an entry records that it was taken out before' },
        removed: P.PROPERTIES('The property taken out, then each under it, as they were; empty for already-gone'),
        removal: REMOVAL,
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
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['property'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.property;

    // 2. Installed; 3. the property's concept, then the lock on its header (Decision 11). No property node: a repeat.
    const inst = await P.requireInstalled(read);
    const concept = await P.conceptOfProperty(read, key);
    if (!concept) return repeatOf(read, key);
    await S.lockNode(tx, concept);

    // 4 to 6. After the lock, a property another write took out is gone: already-gone (Decision 11).
    const st = await P.load(read, concept, { inst, missing: () => unknownProperty(key, 'its concept went while it was read') });
    const rec0 = P.findRec(st.t0, key);
    if (!rec0 || rec0.ref === st.t0.root) return repeatOf(read, key);
    const rec1 = P.findRec(st.t1, key);

    // 7. Its own change (Decision 7.3), unless catching up took it out already.
    let target = st.section1;
    if (rec1) {
      const path = P.pathOf(st.t1, rec1);
      target = P.copy(st.section1);
      const parentDef = P.defAt(target, path.slice(0, -1));
      parentDef.properties = Object.fromEntries(Object.entries(parentDef.properties).filter(([k]) => k !== rec1.field));
      if (Array.isArray(parentDef.required)) parentDef.required = parentDef.required.filter((x) => x !== rec1.field);
      const xt = parentDef['x-tapestry'];
      if (P.isObject(xt) && Array.isArray(xt.unique)) xt.unique = xt.unique.filter((x) => x !== rec1.field);
    }

    // 8 to 12.
    const done = await P.commit(tx, read, st, { target, frame: st.doc0 });
    const at = P.pathOf(st.t0, rec0);
    const under = (x) => x.path.length >= at.length && at.every((k, i) => x.path[i] === k);
    const removed = rec1 ? done.own.removed : done.caughtUp.removed.filter(under);
    return {
      data: {
        outcome: 'removed',
        removed,
        removal: null,
        caughtUp: done.caughtUp,
        filledIn: done.filledIn,
        elements: done.elements,
        letterOutOfDate: done.letterOutOfDate,
        cacheOutOfDate: done.cacheOutOfDate,
      },
      changes: done.changes,
    };
  },
};
