'use strict';
/**
 * graph add-property — add a property to a concept, under a parent property for a nested object, with no event; the
 * concept's JSON Schema follows (catalog §2, Properties and schema; story graph-operations-first-slice #18, AC1, AC2 and
 * AC6–AC9; ADR graph-operations-first-slice/0018 Decisions 1–7.1 and 9–14, and Amendment 1).
 *
 * A write through the write path (src/operations/write.js). Its guard is the rule element-fits-schema, run in apply over
 * the nodes it writes, since their JSON comes from the graph (Decision 10). In one transaction it locks the concept's
 * header, brings the concept's property nodes in line with its schema when they aren't (Decision 6), makes the new
 * property's node with no event (Decision 5), rewrites the JSON schema node from the tree, and reports on the concept's
 * elements (Decision 9). It is safe to repeat: the same property again answers already-exists. It signs nothing.
 * _properties.js holds what the four property operations share.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');
const S = require('./_sets');
const P = require('./_properties');

/** The definition a call asks for: the piece, with the type and description given (Decision 7.1). */
function definitionFor(piece, type, description) {
  const rest = Object.entries(piece).filter(([k]) => k !== 'type' && !(k === 'description' && description !== undefined));
  return Object.fromEntries([['type', type], ...(description ? [['description', description]] : []), ...rest]);
}

module.exports = {
  group: 'graph',
  name: 'add-property',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Add a property to a concept, under a parent property for a nested object; the concept's JSON Schema follows",
  description: [
    "Adds the property `name` to the concept whose header's tapestryKey is `concept`: a field of its elements' JSON, under the concept's key, or under `parent`, one of the concept's object properties, for a nested one. `type` is one of JSON Schema's seven (string, number, integer, boolean, object, array, null). `required` true lists it as required where it goes; `description` describes it; `schema` gives the rest of what JSON Schema says about it, such as allowed values (`enum`), a `format`, or a list's `items`, as an object or its JSON text. A list's item fields stay in its own definition, so `parent` can't name a list.",
    "The concept's properties are the authority for its JSON Schema: each property node holds its piece of the schema, and the concept's JSON schema node is rebuilt from them in the same write, so every reader of it, the rule `element-fits-schema` among them, reads the change. Nothing is signed or sent anywhere: the new node is the one the nostr import would make of the letter today's create-property would sign, corrected, at BIBLE §9's address under its parent.",
    "The first write on a concept whose property nodes aren't in line with its schema, as every concept made before these writes is, first gives each field the schema lists a node of its own, rewrites a node made by today's routes from the schema, and takes out one the schema doesn't list, kept whole in the change entry; `caughtUp` lists what that changed. The schema's top level gets what the json-schema concept requires and it lacks (`filledIn`). These writes keep only a wrapped schema, whose one top-level property is the concept's key, with typed fields, at most 32 levels and 1,000 properties under it.",
    "`elements` judges the concept's elements, each by its tapestryJson as the rule `element-fits-schema` judges an element as it stands, against the schema before and after: which stop fitting, how many already didn't, how many couldn't be judged. None of it stops the write. A marked field can't be taken out or change type (`marked-field`). Safe to repeat: the same property again changes nothing and answers `already-exists`; a property of that name holding something else is refused (`name-in-use`), naming what differs. Only this instance's own concepts change, firmware's aside; for one with a letter, `letterOutOfDate` says it no longer matches it.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
    name: { schema: { type: 'string', maxLength: 1000 }, required: true, description: "The property's key in its elements' JSON, such as price (trimmed; up to 200 characters)" },
    type: { schema: { type: 'string', maxLength: 100 }, required: true, description: "Its type: string, number, integer, boolean, object, array or null" },
    required: { schema: { type: 'boolean' }, description: 'True to list it as required where it goes, as --required true on a command line; left out, it is optional' },
    description: { schema: { type: 'string', maxLength: 10000 }, description: 'What it holds, in words' },
    parent: { schema: { type: 'string', pattern: N.KEY_PATTERN }, description: "The tapestryKey of one of the concept's object properties, to nest it there; left out, it goes at the top level" },
    schema: P.PIECE_INPUT,
  },
  result: {
    description: 'The property as it now is; whether it was added or already there; what catching up changed first; what the write filled in; the report on the concept\'s elements; whether its letter and its cache no longer match; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'property', 'caughtUp', 'filledIn', 'elements', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['added', 'already-exists'], description: 'added, or already-exists when a property of that name at that place already held what was asked' },
        property: P.PROPERTY,
        caughtUp: P.CAUGHT_UP,
        filledIn: P.FILLED_IN,
        elements: P.ELEMENTS,
        letterOutOfDate: P.LETTER,
        cacheOutOfDate: P.CACHE,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [P.BAD_NAME, P.BAD_TYPE, P.BAD_DESCRIPTION, P.BAD_SCHEMA, P.NOT_INSTALLED, P.UNKNOWN_CONCEPT, P.NOT_OWN_CONCEPT, P.FIRMWARE_CONCEPT, P.NO_PRIMARY_PROPERTY, P.NOT_WRAPPED_NOW, P.UNREADABLE_SCHEMA, P.TANGLED_TREE, P.NOT_OWN_NODE, P.BAD_PARENT, P.NAME_IN_USE, P.MARKED_FIELD, P.SCHEMA_TOO_LARGE, P.NO_FREE_ADDRESS],
  // The JSON comes from the graph, so apply runs the rule over what it writes (Decision 10).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['concept', 'name', 'type', 'required', 'description', 'parent', 'schema'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);

    // 1. The inputs that need no graph.
    const field = P.cleanKey(inputs.name, 'name');
    if (!P.TYPES.includes(inputs.type)) throw refusal(P.BAD_TYPE.code, `The type ${P.show(inputs.type)} isn't one of JSON Schema's seven types: ${P.TYPES.join(', ')}. Nothing changed.`, { input: 'type' });
    const description = inputs.description === undefined ? undefined : P.cleanDescription(inputs.description);
    const piece = inputs.schema === undefined ? {} : P.pieceInput(inputs.schema, { type: inputs.type, description });
    const def = definitionFor(piece, inputs.type, description);
    const required = inputs.required === true;

    // 2. Installed; 3. the lock on the concept's header, this write's first write (Decision 11; Amendment 1, item 6).
    const inst = await P.requireInstalled(read);
    await S.lockNode(tx, inputs.concept);

    // 4 to 6. The concept, its tree, and its tree caught up to its schema.
    const st = await P.load(read, inputs.concept, { inst });
    const t1 = st.t1;

    // 7. Its own change (Decision 7.1): at the top level, or under an object property of the concept's own.
    let parent = t1.recs.get(t1.root);
    if (inputs.parent !== undefined) {
      const rec = P.findRec(t1, inputs.parent);
      const why = !rec ? `isn't one of ${P.conceptLabel(st.header)}'s properties`
        : rec.ref === t1.root ? "is the concept's primary property, which isn't a field: leave parent out for a top-level property"
          : !P.typesOf(rec.piece && rec.piece.type).includes('object') ? `is ${P.labelOfRec(rec)}, which holds ${P.show(rec.piece && rec.piece.type)}, not an object${P.typesOf(rec.piece && rec.piece.type).includes('array') ? ": a list's item fields stay in its own definition, which graph update-property's schema.items, or graph set-schema, changes" : ''}` : null;
      if (why) throw refusal(P.BAD_PARENT.code, `The parent ${inputs.parent} ${why}. Nothing changed.`, { input: 'parent' });
      parent = rec;
    }
    const path = P.pathOf(t1, parent);
    const existing = P.childrenOf(t1, parent.ref).find((c) => c.field === field);
    let outcome = 'added';
    let target = st.section1;
    if (existing) {
      const differs = P.differences(P.definitionOf(t1, existing.ref), def, P.requiredIn(t1, existing), required);
      if (differs.length) {
        throw refusal(P.NAME_IN_USE.code, `${P.conceptLabel(st.header)} already has the property ${P.placeOf(st.oKey, [...path, field])} (${existing.key || 'made by this write'}), holding something other than this call asks for. ${differs.join('; ')}. Change it with graph update-property, or choose another name. Nothing changed.`, { input: 'name' });
      }
      outcome = 'already-exists';
    } else {
      target = P.copy(st.section1);
      const at = P.defAt(target, path);
      at.properties = Object.fromEntries([...Object.entries(P.isObject(at.properties) ? at.properties : {}), [field, def]]);
      if (required) at.required = [...(Array.isArray(at.required) ? at.required.filter((x) => x !== field) : []), field];
    }

    // 8 to 12. The checks, the writes, the check of what was written, and the report.
    const done = await P.commit(tx, read, st, { target, frame: st.doc0 });
    const rec = P.childrenOf(done.t2, parent.ref).find((c) => c.field === field);
    return {
      data: {
        outcome,
        property: done.now(rec.ref),
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
