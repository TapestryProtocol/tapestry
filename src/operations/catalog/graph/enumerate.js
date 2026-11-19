'use strict';
/**
 * graph enumerate — make a property's allowed values the elements of another concept, with no event: one ENUMERATES
 * from the source concept's superset to the property node (catalog §2, Properties and schema; story
 * graph-operations-first-slice #19, AC1–AC4, AC6 and AC7; ADR graph-operations-first-slice/0019 Decisions 1–4, 6 and
 * 9–12, and Amendment 1).
 *
 * A property write through the write path (src/operations/write.js), with the rule element-fits-schema declared as the
 * property writes declare it, so that its refusals are listed. It finds the property's concept, locks the concept's
 * header, and catches the concept's property nodes up to its schema when they aren't in line (ADR 0018 Decision 6), as
 * every property write does. It refuses a property that can't hold a reference, or whose schema refuses every one
 * (Decision 4), a source that isn't one (Decision 3), and a property already linked to another source. Then it writes
 * the link, carrying only its type (Decision 1): the property stays where it is in its tree, and the schema doesn't
 * change. The rule enumerated-value-allowed checks each value against the source when an element write stores it
 * (Decisions 7 and 8), so nothing about the values is kept. The answer lists the elements a value may name, from the
 * owner's point of view, and reports on the concept's elements whose values the link doesn't allow, refusing none
 * (Decision 9). The same link again answers already-enumerated (Decision 12). It signs nothing.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const R = require('../../reads');
const K = require('./_concepts');
const N = require('./_nodes');
const S = require('./_sets');
const P = require('./_properties');
const E = require('./_enumerations');

/** The link, made once (Decision 1): between two keyed nodes, a superset and a property, as add-relationship's MERGE. */
const LINK = (ENUM) => `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE a:Superset
  MATCH (b:TapestryNode {tapestryKey: $to}) WHERE b:Property
  MERGE (a)-[r:\`${ENUM}\`]->(b)
  RETURN count(r) AS n`;

module.exports = {
  group: 'graph',
  name: 'enumerate',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Make a property's allowed values the elements of another concept: one ENUMERATES from its superset to the property, with no event",
  description: [
    "Links the property whose tapestryKey is `property`, one of the fields of one of this instance's own concepts, to the concept whose header's tapestryKey is `source`: one ENUMERATES from the source's superset to the property node, which carries its type and nothing else. Nothing else changes: the property stays where it is in its concept's property tree, the concept's JSON schema stays as it is, and nothing is signed or sent anywhere. The property's own concept may be its source, as a person's mentor is a person; a firmware concept, or another author's, may be the source too.",
    "From then on, each value of the field is `tapestry:<tapestryKey>`, naming one element of the source, which survives renames: a field of type string holds one, and a list of strings any number. `graph create-element`, `update-node` and `add-to-concept` refuse a value that names a node any other way, or names a node that isn't an element of the source from the owner's point of view (the rule `enumerated-value-allowed`, `value-not-allowed`). The allowed values are the source's elements as they are when a write is checked, so an element added to the source is allowed from then on, and one taken out of it no longer is, with no further call. `allowed` lists them as they are now, the first 50 by tapestryKey, as `graph list-elements` lists the source.",
    "`values` judges the concept's elements as the element writes would, everyone's, from their JSON: those whose values the link doesn't allow are counted and named, and refused nothing. A later write to one of them is judged as any write is. It refuses a property that can't hold a reference (`not-enumerable`: a type other than string, or a list whose items aren't strings), one whose own schema would refuse every reference (`refuses-references`: its own enum or const, a pattern or a length a reference can't meet, or any other keyword that leaves no reference or list of references, each named; and a list whose minItems is beyond 10,000, the most it tries), and one already linked to another source (`enumerated-elsewhere`), which `graph unenumerate` takes out first. A source keyed `word` or `graphContext` is refused (`reserved-source`), and one with no superset, or more than one (`no-superset`).",
    "As every property write, it first brings the concept's property nodes in line with its schema when they aren't (`caughtUp`), and reports on the concept's elements as the rule `element-fits-schema` judges them (`elements`). Safe to repeat: a property already linked from the source's superset, by this operation or by today's `POST /api/normalize/enumerate`, changes nothing, records nothing and answers `already-enumerated`. Only this instance's own concepts change, firmware's aside, and a concept whose property tree isn't a tree is refused (`tangled-tree`).",
  ].join('\n\n'),
  inputs: {
    property: N.keyInput("The tapestryKey of the property: one of a concept's fields, not its primary property, of type string or a list of strings"),
    source: N.keyInput("The tapestryKey of the source concept's header: the concept whose elements the property's values name"),
  },
  result: {
    description: "Whether the link was made or was there; the property; the source; the elements a value may name; the report on the property's concept's elements; what catching up changed first; what the write filled in; the property writes' report; whether a letter or the cache no longer match; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'property', 'source', 'allowed', 'values', 'caughtUp', 'filledIn', 'elements', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['enumerated', 'already-enumerated'], description: "enumerated, or already-enumerated when an ENUMERATES already ran from the source's superset to the property" },
        property: P.PROPERTY,
        source: E.SOURCE,
        allowed: E.ALLOWED,
        values: E.VALUES,
        caughtUp: P.CAUGHT_UP,
        filledIn: P.FILLED_IN,
        elements: P.ELEMENTS,
        letterOutOfDate: P.LETTER,
        cacheOutOfDate: P.CACHE,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [P.NOT_INSTALLED, P.UNKNOWN_PROPERTY, P.NOT_OWN_CONCEPT, P.FIRMWARE_CONCEPT, P.NO_PRIMARY_PROPERTY, P.NOT_WRAPPED_NOW, P.UNREADABLE_SCHEMA, P.TANGLED_TREE, P.NOT_OWN_NODE, P.MARKED_FIELD, P.SCHEMA_TOO_LARGE, P.BAD_SCHEMA, P.NO_FREE_ADDRESS, P.UNKNOWN_CONCEPT, E.NOT_ENUMERABLE, E.REFUSES_REFERENCES, E.ENUMERATED_ELSEWHERE, E.RESERVED_SOURCE, E.NO_SUPERSET],
  // As the property writes declare it, so that no-schema and invalid-fields stay listed: commit runs the rule over
  // what it writes (ADR 0018 Decision 10; ADR 0019 Implementation notes).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['property', 'source'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.property;

    // 1. Installed; 2. the property's concept; 3. the lock on its header, this write's first write (Decision 12).
    const inst = await P.requireInstalled(read);
    const concept = await P.conceptOfProperty(read, key);
    if (!concept) throw E.say.unknownProperty(key);
    await S.lockNode(tx, concept);

    // 4. The concept, its tree, and its tree caught up to its schema, with every check the property writes make.
    const st = await P.load(read, concept, { inst, missing: () => E.say.unknownProperty(key) });

    // 5 and 6. The property as the caught-up tree holds it: it can hold a reference, and its piece accepts one (Decision 4).
    const rec = P.findRec(st.t1, key);
    if (!rec || rec.ref === st.t1.root) throw E.say.unknownProperty(key);
    const place = P.placeOf(st.oKey, P.pathOf(st.t1, rec));
    if (!E.holdsReference(rec.piece)) throw refusal(E.NOT_ENUMERABLE.code, E.say.notEnumerable(key, place, st.header, rec.piece), { input: 'property' });
    if (!E.acceptsReference(rec.piece)) throw refusal(E.REFUSES_REFERENCES.code, E.say.refusesReferences(key, place, st.header, rec.piece), { input: 'property' });

    // 7. The source (Decision 3).
    const source = await E.sourceOf(read, inputs.source);

    // 8 and 9. The links already into the property: one from the source's superset makes this call a repeat; one from
    // anywhere else is refused, whether or not the source's is there too, since a property has one source.
    const links = await E.linksInto(read, key);
    const repeat = links.some((l) => l.start === source.superset);
    const elsewhere = links.filter((l) => l.start !== source.superset);
    if (elsewhere.length) {
      const headers = new Map((await K.headersByKey(read, elsewhere.map((l) => l.concept).filter(Boolean))).map((h) => [h.key, h]));
      throw refusal(E.ENUMERATED_ELSEWHERE.code, E.say.enumeratedElsewhere(key, place, elsewhere, headers), { input: 'property' });
    }

    // 10. The property writes' steps 7 to 12 with the schema as it is, as add-property's already-exists takes them: any
    // catch-up is written and recorded, and commit gives the property's answer.
    const done = await P.commit(tx, read, st, { target: st.section1, frame: st.doc0 });

    // 11. The link, unless it was there (Decision 1).
    const { ENUM } = K.rel();
    const changes = [...done.changes];
    if (!repeat) {
      const { rows } = await tx.run(LINK(ENUM), { from: source.superset, to: key });
      if (!rows.length || Number(rows[0].n) !== 1) throw new Error(`the link from ${source.superset} to ${key} found ${rows.length ? rows[0].n : 0} pairs of nodes to join, not 1: one of them went missing while it was linked; try again`);
      changes.push({ change: 'enumeration-added', type: ENUM, from: source.superset, to: key, concept: source.concept, nodes: [concept] });
    }

    // 12. The elements a value may name, and the report on the concept's elements, from the owner's point of view,
    // judged with the link as it now stands (Decision 9).
    const pov = await R.resolvePov(read, 'owner');
    const allowed = await E.allowedOf(read, source.superset, pov);
    const values = await E.valuesReport(read, concept, await E.enumeratedFieldsOf(read, concept), pov);
    return {
      data: {
        outcome: repeat ? 'already-enumerated' : 'enumerated',
        property: done.now(rec.ref),
        source: { concept: source.concept, name: source.name, superset: source.superset },
        allowed,
        values,
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
