'use strict';
/**
 * graph create-element — an element of a concept, or of a set in its class thread, with no event, its fields checked
 * against the concept's JSON Schema (catalog §2; story graph-operations-first-slice #20, AC1–AC8; ADR
 * graph-operations-first-slice/0020 Decisions 1–18).
 *
 * A write through the write path (src/operations/write.js). Its guard is the rule element-fits-schema, BIBLE §10's rule
 * 4, run in apply once the write has taken the lock on the concept's header and built the element's JSON, since that
 * JSON comes from the graph (Option A). It is safe to repeat by name within the concept: this instance's own element
 * with the slug the name gives is answered untouched. It records a change entry when it makes an element, and signs
 * nothing: the element is the node the nostr import would make of the letter the write would sign (_eventless.js).
 */

const dtag = require('../../../lib/dtag');
const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_elements');
const E = require('./_eventless');
const N = require('./_nodes');

const NOTE = "This element is in this instance's graph only: no event backs it, so only a backup (lifecycle backup) keeps it (BIBLE §30). export nostr is how it is published.";

module.exports = {
  group: 'graph',
  name: 'create-element',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "An element of a concept, or of a set in its class thread, with no event, its fields checked against the concept's schema",
  description: [
    "Makes an element named `name` of `concept`, directly under the concept's superset, or directly in `set`: a set or superset in the concept's class thread. Nothing is signed or sent anywhere. The element is the node the nostr import would make of the letter today's create-element signs, at the address that letter would carry, with its tags (`d`, `name`, a `z` naming the concept's header, an `n` naming the set, and `json`), and no event: a letter published for it later lands on the same node. The name is trimmed, and each run of white space inside it becomes one space.",
    "Its JSON is word-wrapper JSON: a `word` block naming it, whose `wordTypes` list `word` and the key of each concept whose class thread reaches it, and the concept's section, under the concept's key, holding its name, its slug and `fields`. `fields` is an object, or its JSON text, as a command line gives it. Before anything is written, the JSON is checked against the concept's JSON Schema, read as the derive step reads it (BIBLE §10, rule 4: the rule `element-fits-schema`). JSON that doesn't fit is refused (`invalid-fields`), naming every problem; no value is made up for a field left out. For each other concept the element joins through its set, `concepts` says whether its JSON fits that concept's schema too; those never stop it. A concept whose key is `word` or `graphContext` is refused (`reserved-key`): an element's JSON keeps those keys for itself, for its word block and the derive step's `graphContext`. The concept's marked fields are carried on the node as `<concept key>_<field>`.",
    "Safe to repeat: when this instance's own element of the concept, anywhere in its class thread, has the name, or sits at the address the name gives, it changes nothing, records nothing and answers `already-exists` with that element, naming in `differs` each input given that differs from what it holds, so fields given aren't assumed saved. Another author's element with the name isn't a repeat. The element is in this instance's graph only: only a backup keeps it.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("A concept header's tapestryKey: the concept the element is made in, whose schema its fields are checked against"),
    name: { schema: { type: 'string', maxLength: 1000 }, required: true, description: "Its name, such as Rover (trimmed; up to 200 characters): its tapestryValue, and what makes a second call the same one within the concept" },
    set: { schema: { type: 'string', pattern: N.KEY_PATTERN }, description: "The tapestryKey of a set or superset in the concept's class thread to make the element directly in; left out, the concept's superset" },
    fields: X.FIELDS_INPUT,
  },
  result: {
    description: "The element made, or this instance's own element that already had the name; the concepts it belongs to, and whether its JSON fits each one's schema; what differs on a repeat; the node properties its concepts' marks carry; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'element', 'concepts', 'differs', 'copies', 'skipped', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['created', 'already-exists'], description: "created, or already-exists when this instance's own element of the concept already had the name" },
        element: X.ELEMENT,
        concepts: {
          type: 'array',
          description: 'On created, each concept the element belongs to, the named one first, then by tapestryKey, and whether its JSON fits that concept\'s schema; empty on already-exists',
          items: {
            type: 'object',
            required: ['concept', 'key', 'fits', 'problems', 'problem', 'waiting'],
            properties: {
              concept: { type: 'string', description: "The tapestryKey of the concept's header" },
              key: { type: 'string', nullable: true, description: "The concept's key, the section its fields go in" },
              fits: { type: 'boolean', nullable: true, description: "Whether the element's JSON fits the concept's schema; null when the concept has no schema to check against, or when the JSON misses only what the derive step builds (waiting)" },
              problems: { type: 'array', items: X.PROBLEM, description: 'Each problem with its JSON under that schema' },
              problem: { type: 'string', nullable: true, description: 'Why there is no schema to check against, or that the concept waits for the derive step' },
              waiting: { type: 'boolean', description: "Whether the JSON misses its graphContext, which only the derive step builds, so the problems about it were set aside (ADR graph-operations-first-slice/0042)" },
            },
          },
        },
        differs: {
          type: 'array',
          description: 'On already-exists, each input given that differs from what the element holds: name, set, or fields.<field>; empty otherwise',
          items: {
            type: 'object',
            required: ['input', 'given', 'holds'],
            properties: {
              input: { type: 'string', description: 'name, set, or fields.<field>' },
              given: { description: 'The input, as cleaned' },
              holds: { description: 'What the element holds: for set, the tapestryKeys of the sets it is directly in; null for a field it lacks' },
            },
          },
        },
        copies: { type: 'array', items: { type: 'string' }, description: 'On created, the node properties the element now carries for its concepts\' marked fields, such as dog_breed; empty otherwise' },
        skipped: F.SKIPPED,
        note: { type: 'string', description: 'On created: where the element is kept' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [X.BAD_NAME, X.BAD_FIELDS, X.NOT_INSTALLED, F.UNKNOWN_CONCEPT, X.MADE_ELSEWHERE_REFUSAL, X.RESERVED_KEY, X.NO_SUPERSET, X.UNKNOWN_SET, X.NOT_A_SET, X.NOT_IN_CLASS_THREAD, X.NO_FREE_ADDRESS],
  // The rule's refusals are listed through the guard, but its items are empty: the JSON it judges is built from the
  // graph, inside the write, so apply runs the rule on it after the lock (ADR 0020 Decision 12, Option A).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['concept', 'name'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);

    // 1. What needs no graph (Decision 2): the name, the fields and the would-be author.
    const name = X.cleanName(inputs.name);
    const slug = dtag.slug(name);
    const fields = X.parseFields(inputs.fields, { name, slug });
    const ta = K.assistant();
    if (!ta) throw refusal(X.NOT_INSTALLED.code, X.say.notInstalled());

    // 2. The lock on the concept's header (Decision 7): two writes in one concept go one at a time, and the second
    // finds what the first made. Every read comes after it.
    await S.lockNode(tx, inputs.concept);

    // 3. The concept.
    const concept = await F.conceptOf(read, inputs.concept);
    if (!concept) throw refusal(F.UNKNOWN_CONCEPT.code, F.say.unknownConcept(inputs.concept), { input: 'concept' });
    const elsewhere = X.madeElsewhere(concept.uuid);
    if (elsewhere) throw refusal(X.MADE_ELSEWHERE_REFUSAL.code, X.say.madeElsewhere(concept, elsewhere), { input: 'concept' });
    // The key the element's section is filed under (Decision 8). A key the element's JSON keeps for itself is refused
    // before anything is built (Amendment 1, item 2).
    const [header] = await K.headersByKey(read, [concept.key]);
    if (header && X.RESERVED_KEYS.includes(header.oKey)) throw refusal(X.RESERVED_KEY.code, X.say.reservedKey(concept, header.oKey), { input: 'concept' });
    const superset = await S.supersetOf(read, concept.key);
    if (!superset) throw refusal(X.NO_SUPERSET.code, X.say.noSuperset(concept), { input: 'concept' });
    if (typeof concept.uuid !== 'string' || !concept.uuid) throw new Error(`the concept header ${concept.key} has no address, so an element of it has none either`);
    if (!header || typeof header.oKey !== 'string' || !header.oKey) throw new Error(`the concept header ${concept.key} has no key, so an element's JSON has no section to file its fields under`);

    // 4. Where the element goes, and the concepts that reach it (Decision 3).
    const where = await X.whereTo(read, { concept, superset, set: inputs.set });
    const otherKeys = where.concepts.map((c) => c.concept).filter((k) => k !== concept.key);
    const headers = new Map([[concept.key, header], ...(await K.headersByKey(read, otherKeys)).map((h) => [h.key, h])]);

    // 5. The repeat (Decision 6).
    const plain = `39999:${ta}:${dtag.childDTag(name, concept.uuid)}`;
    const repeat = await X.findRepeat(read, { concept: concept.key, name, ta, address: plain });
    if (repeat) {
      const { json } = F.readJson(repeat.json);
      const section = json && json[header.oKey] && typeof json[header.oKey] === 'object' ? json[header.oKey] : {};
      const heldSlug = typeof section.slug === 'string' && section.slug ? section.slug : (repeat.name ? dtag.slug(repeat.name) : null);
      return {
        data: {
          outcome: 'already-exists',
          element: X.describeElement({ key: repeat.key, address: repeat.uuid, name: repeat.name, slug: heldSlug, concept: concept.key, parents: repeat.parents, hasLetter: repeat.hasLetter }),
          concepts: [],
          differs: X.differsOf(repeat, { name, set: inputs.set, fields, oKey: header.oKey }),
          copies: [],
          skipped: [],
        },
        changes: [],
      };
    }

    // 6. The address (Decision 5).
    const free = await X.freeAddress(read, { name, header: concept.uuid, ta });
    if (!free) throw refusal(X.NO_FREE_ADDRESS.code, X.say.noFreeAddress(name, plain));

    // 7. The element's JSON (Decision 8).
    const others = where.concepts.filter((c) => c.concept !== concept.key).map((c) => c.concept).sort();
    const json = X.elementJson({ header, name, slug, fields, others: others.map((k) => headers.get(k) && headers.get(k).oKey) });
    const text = JSON.stringify(json);
    if (text.length > X.MAX_JSON) throw refusal(X.BAD_FIELDS.code, X.say.tooLong(text.length), { input: 'fields' });

    // 8. Rule 4, on the JSON the write built: invalid-fields or no-schema, with the rule named (Decision 12).
    const Sch = require('./_schemas');
    await Sch.checkElements(read, [{ concept: concept.key, json }]);

    // 9. The node, its tags and its one link (Decisions 9 and 10).
    const set = where.setNode ? where.setNode.uuid : null;
    const key = await E.makeNode(tx, {
      uuid: free.address,
      kind: 39999,
      labels: ['ListItem'],
      name,
      tags: X.elementTags({ d: free.d, name, header: concept.uuid, set, json: text }),
      pubkey: ta,
      createdAt: Math.floor(Date.now() / 1000),
    });
    await X.link(tx, where.target, key);

    // 10. Its marked fields (Decision 13), the other concepts' verdicts (Decision 14) and the entry (Decision 15).
    const mapped = await F.mapNodes(tx, [key]);
    // The named concept's entry comes from the same check, so it says waiting when that is what it is (ADR 0042 Decision 4).
    const named = await Sch.fits(read, concept.key, json);
    const concepts = [{ concept: concept.key, key: header.oKey, fits: named.fits, problems: named.problems, problem: named.problem, waiting: named.waiting }];
    for (const c of others) {
      const r = await Sch.fits(read, c, json);
      concepts.push({ concept: c, key: (headers.get(c) && headers.get(c).oKey) || null, fits: r.fits, problems: r.problems, problem: r.problem, waiting: r.waiting });
    }
    return {
      data: {
        outcome: 'created',
        element: X.describeElement({ key, address: free.address, name, slug, concept: concept.key, parents: [where.target], hasLetter: false }),
        concepts,
        differs: [],
        copies: Object.keys(mapped.set).filter((p) => mapped.set[p].length).sort(),
        skipped: mapped.skipped,
        note: NOTE,
      },
      changes: [{ change: 'element-created', node: key, concept: concept.key, from: where.target, name, slug }, ...F.copyChanges(mapped)],
    };
  },
};
