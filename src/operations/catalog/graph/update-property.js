'use strict';
/**
 * graph update-property — change a property's type, required flag, description, or the rest of what JSON Schema says
 * about it, with no event; the concept's JSON Schema follows (catalog §2, Properties and schema; story
 * graph-operations-first-slice #18, AC2, AC3 and AC6–AC9; ADR graph-operations-first-slice/0018 Decisions 1, 2, 6,
 * 7.2 and 8–14, and Amendment 1).
 *
 * A write through the write path, with the rule element-fits-schema run in apply over what it writes (Decision 10). It
 * finds the property's concept, locks the concept's header, catches the concept's property nodes up to its schema when
 * they aren't in line (Decision 6), changes the property's piece, rewrites the JSON schema node from the tree, and
 * reports on the concept's elements (Decision 9). The same values again answer unchanged. It signs nothing.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');
const S = require('./_sets');
const P = require('./_properties');

const FIELDS = Object.freeze(['type', 'required', 'description', 'schema']);

const unknownProperty = (key) => refusal(P.UNKNOWN_PROPERTY.code, `No concept's property tree has a property with the tapestryKey ${key}: it names no node, a node that isn't a property, a concept's primary property (which isn't a field: graph set-schema changes a concept's schema whole), or a property its concept's schema doesn't list, which bringing the concept's properties in line with its schema takes out. Nothing changed.`, { input: 'property' });

module.exports = {
  group: 'graph',
  name: 'update-property',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Change a property's type, required flag, description, or the rest of what JSON Schema says about it; the concept's JSON Schema follows",
  description: [
    "Changes the property whose tapestryKey is `property`, one of a concept's properties. Give any of: `type`, one of JSON Schema's seven; `required`, true or false, which lists it as required by its parent or takes it out of that list; `description` (an empty one takes it out); and `schema`, the rest of what JSON Schema says about it, as an object or its JSON text, where each keyword given takes its value and a `null` takes one out, such as {\"enum\": [\"a\", \"b\"]} or a list's {\"items\": {\"type\": \"integer\"}}. Everything else the property says stays as it was.",
    "The concept's JSON schema node is rebuilt from its properties in the same write, so every reader reads the change, and nothing is signed. A type other than object is refused while properties hang under the property (`has-properties`); with none, its empty properties and required list go. A marked field's type, or its list's item type, can't change (`marked-field`): graph unmark-field takes the mark off first. Its description, required flag and the rest can.",
    "As every property write, it first brings the concept's property nodes in line with its schema when they aren't (`caughtUp`), and reports on the concept's elements, judged as the rule `element-fits-schema` judges one as it stands, before and after (`elements`); none of it stops the write. The same values again change nothing and answer `unchanged`. Only this instance's own concepts change, firmware's aside; for one with a letter, `letterOutOfDate` says it no longer matches it.",
  ].join('\n\n'),
  inputs: {
    property: N.keyInput("The tapestryKey of the property: one of a concept's properties, not its primary property"),
    type: { schema: { type: 'string', maxLength: 100 }, description: 'Its new type: string, number, integer, boolean, object, array or null' },
    required: { schema: { type: 'boolean' }, description: 'True to list it as required by its parent, false to take it out of that list (--required true on a command line)' },
    description: { schema: { type: 'string', maxLength: 10000 }, description: 'Its new description; an empty one takes it out' },
    schema: { ...P.PIECE_INPUT, description: "The keywords to change in what JSON Schema says about it, as an object or its JSON text: each one given takes its value, and a null takes one out, such as '{\"minLength\": 1}'. It can't hold properties or a required list, which are properties of their own" },
  },
  result: {
    description: 'The property as it now is; whether it changed; which inputs changed something; what catching up changed first; what the write filled in; the report on the concept\'s elements; whether its letter and its cache no longer match; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'property', 'changed', 'caughtUp', 'filledIn', 'elements', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['updated', 'unchanged'], description: 'updated, or unchanged when it already held every value given' },
        property: P.PROPERTY,
        changed: { type: 'array', items: { type: 'string', enum: FIELDS }, description: 'The inputs that changed something' },
        caughtUp: P.CAUGHT_UP,
        filledIn: P.FILLED_IN,
        elements: P.ELEMENTS,
        letterOutOfDate: P.LETTER,
        cacheOutOfDate: P.CACHE,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [P.NOTHING_TO_CHANGE, P.BAD_TYPE, P.BAD_DESCRIPTION, P.BAD_SCHEMA, P.NOT_INSTALLED, P.UNKNOWN_PROPERTY, P.NOT_OWN_CONCEPT, P.FIRMWARE_CONCEPT, P.NO_PRIMARY_PROPERTY, P.NOT_WRAPPED_NOW, P.UNREADABLE_SCHEMA, P.TANGLED_TREE, P.NOT_OWN_NODE, P.HAS_PROPERTIES, P.MARKED_FIELD, P.SCHEMA_TOO_LARGE, P.NO_FREE_ADDRESS],
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['property', 'type', 'required', 'description', 'schema'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.property;

    // 1. The inputs that need no graph.
    if (!FIELDS.some((f) => inputs[f] !== undefined)) throw refusal(P.NOTHING_TO_CHANGE.code, `Name something to change: ${FIELDS.join(', ')}. Nothing changed.`);
    if (inputs.type !== undefined && !P.TYPES.includes(inputs.type)) throw refusal(P.BAD_TYPE.code, `The type ${P.show(inputs.type)} isn't one of JSON Schema's seven types: ${P.TYPES.join(', ')}. Nothing changed.`, { input: 'type' });
    const description = inputs.description === undefined ? undefined : P.cleanDescription(inputs.description);
    const merge = inputs.schema === undefined ? null : P.pieceInput(inputs.schema, { type: inputs.type, description });

    // 2. Installed; 3. the property's concept, then the lock on its header (Decision 11).
    const inst = await P.requireInstalled(read);
    const concept = await P.conceptOfProperty(read, key);
    if (!concept) throw unknownProperty(key);
    await S.lockNode(tx, concept);

    // 4 to 6. The concept, its tree, and its tree caught up to its schema; the property must be in it then.
    const st = await P.load(read, concept, { inst, missing: () => unknownProperty(key) });
    const t1 = st.t1;
    const rec = P.findRec(t1, key);
    if (!rec || rec.ref === t1.root) throw unknownProperty(key);

    // 7. Its own change (Decision 7.2).
    const path = P.pathOf(t1, rec);
    const target = P.copy(st.section1);
    const def = P.defAt(target, path);
    const parentDef = P.defAt(target, path.slice(0, -1));
    const was = P.copy(def);
    const wasRequired = P.requiredIn(t1, rec);
    if (merge) for (const [k, v] of Object.entries(merge)) { if (v === null) delete def[k]; else def[k] = P.copy(v); }
    if (inputs.type !== undefined) def.type = inputs.type;
    if (description !== undefined) { if (description) def.description = description; else delete def.description; }
    const tp = P.typeProblem(def.type);
    if (tp) throw refusal(P.BAD_TYPE.code, `${P.labelOfRec(rec)} can't take that schema: ${tp}. Nothing changed.`, { input: 'schema' });
    if (!P.typesOf(def.type).includes('object')) {
      const kids = P.childrenOf(t1, rec.ref);
      if (kids.length) {
        throw refusal(P.HAS_PROPERTIES.code, `${P.labelOfRec(rec)} has properties under it (${kids.map((k) => k.field).join(', ')}), so its type can't become ${P.show(def.type)}: take them out first with graph remove-property, or set the concept's whole schema with graph set-schema. Nothing changed.`, { input: inputs.type !== undefined ? 'type' : 'schema' });
      }
      if (P.isObject(def.properties) && !Object.keys(def.properties).length) delete def.properties;
      if (Array.isArray(def.required) && !def.required.length) delete def.required;
    }
    if (inputs.required !== undefined) {
      const had = Array.isArray(parentDef.required) ? parentDef.required : null;
      const isIn = !!had && had.includes(rec.field);
      if (inputs.required && !isIn) parentDef.required = [...(had || []), rec.field];
      if (!inputs.required && isIn) parentDef.required = had.filter((x) => x !== rec.field);
    }
    const nowRequired = Array.isArray(parentDef.required) && parentDef.required.includes(rec.field);
    const unchanged = P.same(target, st.section1);
    const changed = [];
    if (!unchanged) {
      if (inputs.type !== undefined && !P.same(was.type, def.type)) changed.push('type');
      if (inputs.required !== undefined && wasRequired !== nowRequired) changed.push('required');
      if (description !== undefined && !P.same(was.description, def.description)) changed.push('description');
      if (merge && Object.entries(merge).some(([k, v]) => !P.same(was[k], v === null ? undefined : v))) changed.push('schema');
    }

    // 8 to 12.
    const done = await P.commit(tx, read, st, { target, frame: st.doc0 });
    return {
      data: {
        outcome: unchanged ? 'unchanged' : 'updated',
        property: done.now(rec.ref),
        changed,
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
