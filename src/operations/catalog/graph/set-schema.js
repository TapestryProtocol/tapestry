'use strict';
/**
 * graph set-schema — make a concept's properties match a given JSON Schema, with no event (catalog §2, Properties and
 * schema; story graph-operations-first-slice #18, AC2, AC5–AC9 and the narrowings "Corrected at Architecture"; ADR
 * graph-operations-first-slice/0018 Decisions 1–7.4 and 8–14, and Amendment 1).
 *
 * A write through the write path, with the rule element-fits-schema run in apply over what it writes (Decision 10). It
 * locks the concept's header, catches the concept's property nodes up to its current schema when they aren't in line
 * and that schema can be (Decision 6), then matches each field of the schema given to the node at the same place,
 * adding, changing and taking out property nodes so the tree matches it (Decision 7.4). The JSON schema node is
 * rebuilt from the tree with the schema's own frame, so the schema reads back as given, but for what filledIn names.
 * The same schema again answers unchanged. It signs nothing.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');
const S = require('./_sets');
const P = require('./_properties');

/** The refusal each of schemaProblem's codes is, for the schema given (Amendment 1, item 3). */
const GIVEN = Object.freeze({ 'not-wrapped': P.NOT_WRAPPED_GIVEN, 'bad-type': P.BAD_TYPE, 'bad-name': P.BAD_NAME, 'bad-description': P.BAD_DESCRIPTION, 'schema-too-large': P.SCHEMA_TOO_LARGE, 'bad-schema': P.BAD_SCHEMA });

module.exports = {
  group: 'graph',
  name: 'set-schema',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Make a concept's properties match a given JSON Schema; its schema then reads back as given",
  description: [
    "Makes the properties of the concept whose header's tapestryKey is `concept` match `schema`, a JSON Schema for its elements' JSON, as an object or its JSON text, with the concept's fields under its key, as save-schema takes one today. Each field is matched to the property at the same place: a field with no property gets one, a property whose definition or required flag differs is rewritten, and a property at a place the schema doesn't have is taken out with all under it, kept whole in the change entry. A property kept keeps its node and its tapestryKey, so a mark on it goes on working. `added`, `changed` and `removed` list them, against the schema as it was before the call.",
    "The concept's JSON schema node is rebuilt from its properties and the schema's own top level, so the schema reads back as given, every keyword at every level kept, but for what `filledIn` names: the `$schema`, `type`, `required` and `definitions` the json-schema concept requires, when the schema lacks them. Nothing is signed or sent anywhere.",
    "It keeps only a wrapped schema (`not-wrapped`): one whose top level is an object whose one property is the concept's key, holding an object. Every field has a type, one of JSON Schema's seven or a list of them, and only an object holds properties (`bad-type`); a key create-concept's name check leaves as it is (`bad-name`); and a description create-concept's description check takes (`bad-description`), since it becomes the property node's tag; at most 32 levels and 1,000 properties lie under the key (`schema-too-large`), and the schema must compile (`bad-schema`). A list's item fields stay in its own definition. A marked field can't be taken out or change type (`marked-field`).",
    "As every property write, it first brings the concept's property nodes in line with its current schema when they aren't and that schema can be (`caughtUp`): a current schema that can't be is replaced all the same, against the property nodes as they are. `elements` reports on the concept's elements, judged as the rule `element-fits-schema` judges one as it stands, before and after, those that still hold a removed field among them; none of it stops the write. The same schema again changes nothing and answers `unchanged`. Only this instance's own concepts change, firmware's aside; for one with a letter, `letterOutOfDate` says it no longer matches it.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
    schema: {
      schema: { oneOf: [{ type: 'object' }, { type: 'string', maxLength: P.MAX_JSON }] },
      required: true,
      description: "The concept's JSON Schema, as an object or its JSON text: the document its JSON schema node holds, with the concept's fields under its key, such as {\"type\": \"object\", \"properties\": {\"dog\": {\"type\": \"object\", \"properties\": {\"breed\": {\"type\": \"string\"}}}}}",
    },
  },
  result: {
    description: 'Whether the schema was set or already held; the properties added, changed and taken out against the schema before; what catching up changed first; what the write filled in; the report on the concept\'s elements; whether its letter and its cache no longer match; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'added', 'changed', 'removed', 'caughtUp', 'filledIn', 'elements', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['set', 'unchanged'], description: 'set, or unchanged when the concept already had this schema' },
        added: P.PROPERTIES('The properties given nodes, as they now are'),
        changed: P.PROPERTIES('The properties whose definition or required flag changed, as they now are'),
        removed: P.PROPERTIES('The properties taken out, each before those under it, as they were'),
        caughtUp: P.CAUGHT_UP,
        filledIn: P.FILLED_IN,
        elements: P.ELEMENTS,
        letterOutOfDate: P.LETTER,
        cacheOutOfDate: P.CACHE,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [P.BAD_SCHEMA, P.NOT_WRAPPED_GIVEN, P.BAD_TYPE, P.BAD_NAME, P.BAD_DESCRIPTION, P.SCHEMA_TOO_LARGE, P.NOT_INSTALLED, P.UNKNOWN_CONCEPT, P.NOT_OWN_CONCEPT, P.FIRMWARE_CONCEPT, P.NO_PRIMARY_PROPERTY, P.TANGLED_TREE, P.NOT_OWN_NODE, P.MARKED_FIELD, P.NO_FREE_ADDRESS],
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['concept', 'schema'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);

    // 1. The inputs that need no graph: the schema's shape, its fields, its size, and that it compiles.
    const doc = P.parseObject(inputs.schema, 'schema', "the concept's JSON Schema, with its fields under the concept's key");
    const problem = P.schemaProblem(doc, null);
    if (problem) throw refusal(GIVEN[problem.code].code, `That schema can't be a concept's: ${problem.message}. Nothing changed.`, { input: 'schema' });

    // 2. Installed; 3. the lock on the concept's header (Decision 11).
    const inst = await P.requireInstalled(read);
    await S.lockNode(tx, inputs.concept);

    // 4 to 6. Never refused for the current schema: one that can't be caught up to is replaced all the same.
    const st = await P.load(read, inputs.concept, { inst, setSchema: true });
    const key = Object.keys(doc.properties)[0];
    if (key !== st.oKey) {
      throw refusal(P.NOT_WRAPPED_GIVEN.code, `That schema's one top-level property is ${JSON.stringify(key)}, but ${P.conceptLabel(st.header)}'s key is ${st.oKey}: its elements keep their fields under ${st.oKey}, so a wrapped schema for it has ${st.oKey} as its one top-level property. Nothing changed.`, { input: 'schema' });
    }

    // 7 to 12. The tree made to match the schema given, by path (Decision 7.4).
    const done = await P.commit(tx, read, st, { target: doc.properties[key], frame: doc });
    const unchanged = !done.docChanged && !done.own.added.length && !done.own.changed.length && !done.own.removed.length;
    return {
      data: {
        outcome: unchanged ? 'unchanged' : 'set',
        added: done.own.added,
        changed: done.own.changed,
        removed: done.own.removed,
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
