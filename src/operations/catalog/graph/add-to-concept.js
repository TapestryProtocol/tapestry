'use strict';
/**
 * graph add-to-concept — make a node an element of another concept, or put it in one of a concept's sets, with the
 * section that concept asks for checked against its schema (catalog §2, Nodes; story graph-operations-first-slice #22,
 * AC1–AC5, AC8 and AC9; ADR graph-operations-first-slice/0022 Decisions 1–9, 13, 14 and 17, and Amendment 1).
 *
 * A write through the write path (src/operations/write.js). Its guard is the rule element-fits-schema, BIBLE §10's rule
 * 4, which apply runs on the JSON it builds once it holds its locks on the node and the concept's header (as
 * create-element and update-node run it). Any node is taken, whatever its source. One of the instance's own keeps the
 * concept's section in its json tag, with the tags a letter for it would carry; another author's letter, a person node,
 * a placeholder or one of firmware's own elements keeps it beside, in tapestryOwnSections, so the author's letter, or
 * firmware's definition, is never written (design D4; _memberships.js). It is safe to repeat by node, concept and set,
 * records a change entry when it adds a membership, and signs nothing.
 */

const dtag = require('../../../lib/dtag');
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
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
/** JSON with every object's keys sorted, so two values compare as JSON, not by their keys' order (as _elements.js's canon). */
const canon = (x) => JSON.stringify(x === undefined ? null : x, (k, v) => (isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v));

const PROPERTY = 'tapestryOwnSections';

module.exports = {
  group: 'graph',
  name: 'add-to-concept',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Make a node an element of another concept, or put it in a set, with the concept's section checked against its schema",
  description: [
    "Makes the node whose tapestryKey is `node` an element of `concept`, directly under the concept's superset, or directly in `set`: a set or superset in the concept's class thread. The node then belongs to every concept whose class thread reaches where it went. Any node is taken: one of this instance's own, one that came from another author's event, a person node, a placeholder the import made, or one of firmware's own elements. The membership is the owner's claim, beside any the node's author makes. Nothing is signed or sent anywhere.",
    "The node gains the concept's section, under the concept's key, holding its name, the slug its name gives and `fields`, an object or its JSON text, as a command line gives it; a section it already holds for the concept has `fields` merged into it. A node with no name, such as a person node or a placeholder, takes its section's name from `fields`. One of this instance's own nodes keeps the section in its JSON, its json tag, whose word block's `wordTypes` gains the concept's key, and gains the tags a letter for it would carry: a `z` naming the concept's header and an `n` naming the set. Any other node's letter, or firmware's definition, is never written: the section is kept beside it, in the node property `tapestryOwnSections`, which the field mapping and the derive step read with its JSON.",
    "Before anything is written, the node's JSON as the call would leave it is checked against the concept's JSON Schema (BIBLE §10, rule 4: the rule `element-fits-schema`): JSON that doesn't fit is refused (`invalid-fields`), naming every problem, and no value is made up for a field left out. `concepts` says how every concept the node now belongs to judges it; the others never stop the call. The concepts' marked fields follow onto the node. It refuses a tag (`tag-node`), a node another operation looks after (`made-elsewhere`), a concept whose elements another operation makes or that is keyed `word` or `graphContext`, a `set` that isn't one of the concept's, fields that aren't an object or give another name or slug, and JSON that can't be read. For a node whose author is one of this instance's own keys, it refuses a concept where another of the instance's own elements has the node's name (`name-in-use`).",
    "Safe to repeat: when the node is already an element of the concept, and directly in `set` when one is given, it changes nothing, records nothing and answers `already-element`, naming in `differs` each field given that differs from what its section holds; `graph update-node` changes those. A node already in the concept that is put in a set gets the set's link and its tags, and its section stays as it is. The change entry records the membership, the section, the tags and `wordTypes`. The node's letter and the derive step's cached copy of its JSON are left as they are: `letterOutOfDate` and `cacheOutOfDate` say when they now differ from it.",
  ].join('\n\n'),
  inputs: {
    node: N.keyInput("The tapestryKey of the node to add: any node, one of this instance's own or another author's, a person node, a placeholder or one of firmware's own elements"),
    concept: N.keyInput("A concept header's tapestryKey: the concept the node joins, whose section it gains and whose schema that section is checked against"),
    set: { schema: { type: 'string', pattern: N.KEY_PATTERN }, description: "The tapestryKey of a set or superset in the concept's class thread to put the node directly in; left out, the concept's superset" },
    fields: { schema: X.FIELDS_INPUT.schema, description: "The fields of the node's section for the concept: an object, or its JSON text, as a command line gives it, such as '{\"description\": \"a dog\"}'. Left out, none. A name or slug given must be the node's name and the slug it gives; a node with no name takes its section's name from here" },
  },
  result: {
    description: "The node, whether this call added the membership or it was there; where its sections are kept; each concept it now belongs to, and whether its JSON fits that concept's schema; what differs on a repeat; the node properties its concepts' marks carry; whether its letter and its cached copy now differ from it; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'node', 'concept', 'set', 'kept', 'concepts', 'differs', 'copies', 'skipped', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['added', 'already-element'], description: 'added, or already-element when the node was an element of the concept, and directly in the set when one was given' },
        node: M.NODE,
        concept: { type: 'string', description: "The tapestryKey of the concept's header" },
        set: { type: 'string', nullable: true, description: 'The set given, or null' },
        kept: { type: 'string', enum: ['json-tag', 'beside'], description: "Where the node's sections are kept: json-tag, in its own JSON, for one of this instance's own nodes; beside, in tapestryOwnSections, for any other, so its author's letter stays as they wrote it" },
        concepts: X.CONCEPTS,
        differs: {
          type: 'array',
          description: 'Each field given that differs from what the section holds, when the node was already in the concept; empty otherwise',
          items: {
            type: 'object',
            required: ['input', 'given', 'holds'],
            properties: {
              input: { type: 'string', description: 'fields.<field>' },
              given: { description: 'The value given' },
              holds: { description: 'What the section holds; null for a field it lacks' },
            },
          },
        },
        copies: { type: 'array', items: { type: 'string' }, description: "The node properties this call set for its concepts' marked fields, such as dog_breed" },
        skipped: F.SKIPPED,
        letterOutOfDate: { type: 'boolean', description: "Whether this call changed one of this instance's own nodes that has a letter, which now differs from it until export nostr (A10.34) sends a new one" },
        cacheOutOfDate: { type: 'boolean', description: 'Whether this call changed a node the derive step had cached (tapestryJsonUpdatedAt): readers of the cache may see its old JSON until cache rebuild (A10.36)' },
        note: { type: 'string', description: 'When it changed: where the change is kept, and what its letter and cached copy now say' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [X.BAD_NAME, X.BAD_FIELDS, X.NOT_INSTALLED, M.UNKNOWN_NODE, M.TAG_NODE, M.MADE_ELSEWHERE_ADD, F.UNKNOWN_CONCEPT, X.RESERVED_KEY, X.NO_SUPERSET, X.NOT_A_SET, X.NOT_IN_CLASS_THREAD, M.UNREADABLE_JSON, M.NAME_IN_USE],
  // The rule's refusals are listed through the guard, but its items are empty: the JSON it judges is built from the
  // graph, inside the write, so apply runs the rule on it after the locks (ADR 0022 Decision 1, as ADR 0020 Option A).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['node', 'concept', 'set'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.node;
    const set = typeof inputs.set === 'string' ? inputs.set : null;

    // 1. What needs no graph (Decision 8, step 1).
    const ta = K.assistant();
    if (!ta) throw refusal(X.NOT_INSTALLED.code, M.say.notInstalled());

    // 2. The locks (Decision 4): the node, then the concept's header, as update-node and delete-node take theirs. Two
    // calls on one node go one at a time, and an add beside a create-element in the concept waits on the header.
    await S.lockNode(tx, key);
    await S.lockNode(tx, inputs.concept);

    // 3. The node, the concept and where it goes (Decisions 2 and 3).
    const { facts, conceptKeys } = await M.theNode(read, key);
    const kept = M.keptIn(facts);
    const { concept, oKey, superset } = await M.theConcept(read, inputs.concept, { add: true });
    const where = await X.whereTo(read, { concept, superset, set: inputs.set });
    const anchor = where.target;

    // 4. The fields (Decision 7).
    const { name, slug, fields } = M.sectionFields(inputs.fields, facts);

    const Sch = require('./_schemas');
    const report = async (keys, json) => {
      const order = [concept.key, ...keys.filter((c) => c !== concept.key).sort()];
      const byKey = new Map((await K.headersByKey(read, order)).map((h) => [h.key, h]));
      const out = [];
      for (const c of order) {
        const r = await Sch.fits(read, c, json);
        out.push({ concept: c, key: (byKey.get(c) && byKey.get(c).oKey) || null, fits: r.fits, problems: r.problems, problem: r.problem, waiting: r.waiting });
      }
      return out;
    };
    const differsOf = (section) => fields.map(([field, given]) => ({ input: `fields.${field}`, given, holds: own(section, field) ? section[field] : null })).filter((d) => canon(d.given) !== canon(d.holds));
    const answer = { node: M.nodeOf(facts), concept: concept.key, set, kept };

    // 5. The repeat (Decision 7): already an element of the concept, and directly in the set when one is given.
    const inConcept = conceptKeys.includes(concept.key);
    const inSet = !where.setNode || (await M.isElementLink(read, anchor, key));
    if (inConcept && inSet) {
      const { view } = await M.jsonOf(read, facts, kept);
      const section = own(view, oKey) && isObject(view[oKey]) ? view[oKey] : {};
      return {
        data: { outcome: 'already-element', ...answer, concepts: await report(conceptKeys, view), differs: differsOf(section), copies: [], skipped: [], letterOutOfDate: false, cacheOutOfDate: false },
        changes: [],
      };
    }

    // 6. name-in-use (Decision 8, step 6; Amendment 1, item 5): for a node whose author is one of the instance's own
    // keys, firmware's own elements included, which sit at the assistant's addresses.
    if (!inConcept && facts.own && name) {
      const address = typeof concept.uuid === 'string' && concept.uuid ? `39999:${ta}:${dtag.childDTag(name, concept.uuid)}` : null;
      const other = (await X.repeatsOf(read, { concept: concept.key, name, authors: R.ownKeys(), address })).find((r) => r.key !== key);
      if (other) throw refusal(M.NAME_IN_USE.code, M.say.nameInUse(facts, concept, other, name), { input: 'node' });
    }

    // 7. The JSON (Decision 5), and what the call writes into it (Decisions 7 and 9; Amendment 1, item 7: a node already
    // in the concept, put in a set, keeps its section as it is).
    const json = await M.jsonOf(read, facts, kept);
    const held = own(json.view, oKey) && isObject(json.view[oKey]) ? json.view[oKey] : null;
    const section = inConcept ? held : held ? X.mergeSection(held, fields) : Object.fromEntries([...(name ? [['name', name], ['slug', slug]] : []), ...fields]);
    const withSection = (j) => (own(j, oKey) ? Object.fromEntries(Object.entries(j).map(([k, v]) => (k === oKey ? [k, section] : [k, v]))) : Object.fromEntries([...Object.entries(j), [oKey, section]]));
    let newJson = json.base;
    let newOwn = json.own;
    let wordTypes = null;
    if (!inConcept && kept === 'json-tag') {
      newJson = withSection(json.base);
      const word = own(newJson, 'word') && isObject(newJson.word) ? newJson.word : null;
      if (word && Array.isArray(word.wordTypes)) {
        // The concept's key, then each other key the anchor joins, sorted, word's aside, as create-element orders them.
        const others = where.concepts.map((c) => c.concept).filter((c) => c !== concept.key);
        const keysOfOthers = (others.length ? await K.headersByKey(read, others) : []).map((h) => h.oKey);
        const added = [oKey, ...[...new Set(keysOfOthers.filter((k) => typeof k === 'string' && k && k !== 'word' && k !== oKey))].sort()].filter((k) => !word.wordTypes.includes(k));
        if (added.length) {
          wordTypes = { was: [...word.wordTypes], now: [...word.wordTypes, ...added] };
          newJson = Object.fromEntries(Object.entries(newJson).map(([k, v]) => (k === 'word' ? [k, { ...v, wordTypes: wordTypes.now }] : [k, v])));
        }
      }
    } else if (!inConcept) {
      newOwn = withSection(json.own);
    }
    const view = kept === 'beside' ? F.overlaySections(json.base, newOwn) : newJson;
    const text = kept === 'beside' ? JSON.stringify(newOwn) : JSON.stringify(newJson);
    if (!inConcept && text.length > X.MAX_JSON) throw refusal(X.BAD_FIELDS.code, X.say.tooLong(text.length), { input: 'fields' });

    // 8. Rule 4 (Decision 8, step 8), on the JSON as the call would leave it; a node already in the concept has nothing
    // new to judge.
    if (!inConcept) await Sch.checkElements(read, [{ concept: concept.key, json: view }]);

    // 9. The writes (Decision 9): the link, the section, the would-be tags, the marks.
    await X.link(tx, anchor, key);
    let tagCount = json.tags.length;
    if (!inConcept && kept === 'json-tag') {
      if (json.jsonTags.some((t) => typeof t.key !== 'string')) throw new Error("a json tag of the node has no tapestryKey, so it can't be rewritten; run lifecycle migrate first");
      if (json.jsonTags.length) {
        // Inline, even over an LMDB reference, so the graph holds the change (BIBLE §30), as update-node writes it.
        const writes = json.jsonTags.map((t) => ({ key: t.key, props: { value: text } }));
        const written = await F.writeCopies(tx, writes);
        if (written !== writes.length) throw new Error(`the add wrote ${written} of the node's ${writes.length} json tags: one went missing while it was written`);
      } else {
        await E.addTags(tx, key, E.tagRows(facts.uuid || key, [['json', text]], tagCount));
        tagCount += 1;
      }
    } else if (!inConcept) {
      const written = await F.writeCopies(tx, [{ key, props: { [PROPERTY]: text } }]);
      if (written !== 1) throw new Error('the node went missing while its sections were written');
    }
    const wouldBe = [];
    if (kept === 'json-tag') {
      const has = (type, value) => json.tags.some((t) => t.type === type && t.value === value);
      if (typeof concept.uuid === 'string' && concept.uuid && !has('z', concept.uuid)) wouldBe.push(['z', concept.uuid]);
      if (where.setNode && where.setNode.uuid && !has('n', where.setNode.uuid)) wouldBe.push(['n', where.setNode.uuid]);
      if (wouldBe.length) await E.addTags(tx, key, E.tagRows(facts.uuid || key, wouldBe, tagCount));
    }
    const mapped = await F.mapNodes(tx, [key]);

    // 10. The answer and the entry (Decisions 13 and 14).
    const after = M.keysOf(await F.conceptsOfNodes(read, [key]));
    const letterOutOfDate = kept === 'json-tag' && facts.hasLetter === true;
    const cacheOutOfDate = json.cached;
    const notes = ["Changed in this instance's graph only: nothing was signed or sent anywhere."];
    if (kept === 'beside') notes.push(`The node's own JSON${facts.hasLetter ? `, its letter ${facts.uuid},` : ''} is left as it is: this instance's section is kept beside it, in its ${PROPERTY} property.`);
    if (letterOutOfDate) notes.push(`Its letter, ${facts.uuid}, now differs from it, until export nostr (A10.34) sends a new one.`);
    if (cacheOutOfDate) notes.push("The derive step made a cached copy of its JSON before this change (tapestryJsonUpdatedAt), so readers of the cache, such as the node's JSON page, may see the old one until cache rebuild (A10.36).");
    const { TERM } = S.aliases();
    const changes = [
      { change: 'membership-added', type: TERM, from: anchor, to: key, node: key, concept: concept.key },
      // `was` is what the place the section is kept held for the concept: null for a new section.
      ...(inConcept ? [] : [{ change: 'section-added', node: key, concept: concept.key, field: oKey, was: kept === 'beside' ? (own(json.own, oKey) ? json.own[oKey] : null) : held, now: section, ...(kept === 'beside' ? { property: PROPERTY } : {}) }]),
      ...wouldBe.map(([type, value]) => ({ change: 'tag-added', node: key, field: type, now: value })),
      ...(wordTypes ? [{ change: 'field-changed', node: key, field: 'word.wordTypes', was: wordTypes.was, now: wordTypes.now }] : []),
      ...F.copyChanges(mapped),
    ];
    return {
      data: {
        outcome: 'added',
        ...answer,
        concepts: await report(after, view),
        differs: inConcept ? differsOf(held || {}) : [],
        copies: Object.keys(mapped.set).filter((p) => mapped.set[p].length).sort(),
        skipped: mapped.skipped,
        letterOutOfDate,
        cacheOutOfDate,
        note: notes.join(' '),
      },
      changes,
    };
  },
};
