'use strict';
/**
 * graph update-node — change one of this instance's own elements' name, description or fields (catalog §2, Nodes;
 * story graph-operations-first-slice #21, AC1–AC8; ADR graph-operations-first-slice/0021 Decisions 1–20 and
 * Amendment 1).
 *
 * A write through the write path (src/operations/write.js). It edits the node's stored JSON, its json tag, in place:
 * the fields merged into one concept's section, and a rename's values where they held what the old name gave. Its
 * guard is the rule element-fits-schema, BIBLE §10's rule 4, which apply runs on the JSON it built, for each concept
 * whose section the call changes, once the write holds its locks (as create-element runs it; Option A). It refuses a
 * node that came from someone else's event (design D4) with _nodes.js's requireOwn, the one test merge-nodes,
 * delete-node and copy-node will use too. It is safe to repeat: a call that gives only what the node holds changes
 * nothing and records nothing. It signs nothing, and leaves the derived cache as it is (the owner's answer, open
 * question 4), saying when the node's cached copy is out of date.
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

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
/** JSON with every object's keys sorted, so two values compare as JSON, not by their keys' order (as _elements.js's canon). */
const canon = (x) => JSON.stringify(x === undefined ? null : x, (k, v) => (isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v));
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'string' ? 'text' : `a ${typeof v}`);
const shorten = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

// ── the refusals (Decision 20; Amendment 1) ──
const NOTHING_TO_CHANGE = Object.freeze({ code: 'nothing-to-change', status: 400, when: 'A call that gives none of name, description and fields' });
const BAD_FIELDS = Object.freeze({ code: 'bad-fields', status: 400, when: `Fields that aren't a JSON object or its text; a name or slug in fields that is neither the node's name (or the slug it gives) nor what its section holds, or that takes either out; a description given on its own and in fields with different values; or JSON that would be longer than ${X.MAX_JSON.toLocaleString('en-US')} characters` });
const NOT_INSTALLED = Object.freeze({ code: 'not-installed', status: 409, when: "The instance has no assistant key, so it can't tell its own nodes from another author's (design D4), or firmware's own" });
const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A node that names no node of the graph (a change entry is not one)' });
const MADE_ELSEWHERE = Object.freeze({ code: 'made-elsewhere', status: 409, when: 'A node another operation changes, by its concepts or its role labels: a concept header or a core node (graph update-concept), a JSON schema (graph set-schema, A10.18), a property (graph update-property, A10.18), a set (A10.21.a) or a graph rule (the rulebook); the refusal names the operation to use' });
const FIRMWARE_NODE = Object.freeze({ code: 'firmware-node', status: 409, when: "One of firmware's own elements, which its file in the firmware defines and a firmware reinstall can make again: it changes through lifecycle seed-firmware (A10.37); the refusal names the file" });
const NOT_AN_ELEMENT = Object.freeze({ code: 'not-an-element', status: 409, when: "A node no concept's class thread reaches but word's, so it has no section to change and no schema to check against (design D9); graph add-to-concept (A10.22) makes a node an element" });
const NOT_ITS_CONCEPT = Object.freeze({ code: 'not-its-concept', status: 409, when: "A concept the node isn't an element of; the refusal lists the concepts it is an element of" });
const CONCEPT_NEEDED = Object.freeze({ code: 'concept-needed', status: 409, when: 'fields or description with no concept, for a node of more than one concept: which section they go in is never guessed; the refusal lists each concept and its key' });
const UNREADABLE_JSON = Object.freeze({ code: 'unreadable-json', status: 409, when: "A node whose JSON can't be read: no json tag, json tags that differ, JSON that doesn't parse, an LMDB entry that is missing, or JSON that isn't an object; nothing could be checked" });
const NO_SECTION = Object.freeze({ code: 'no-section', status: 409, when: "A concept whose section the node's JSON doesn't have: update-node changes a section the node has, and graph add-to-concept (A10.22) gives a node another concept's section" });
const NAME_IN_USE = Object.freeze({ code: 'name-in-use', status: 409, when: "A new name that another of the instance's own elements, its assistant's or its owner's, has in one of the node's concepts, without regard to case, or whose address that element sits at: the element create-element would answer for the name; the refusal names it" });

/** U1: the node and every tag it has, each with its tapestryKey (Decision 7). */
const U1 = `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange
  OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
  RETURN n.uuid AS uuid, n.name AS name, n.tapestryValue AS value, n.tapestryJsonUpdatedAt AS cached, t.tapestryKey AS tag, t.type AS type, t.value AS tagValue`;
/** The node read whole after the write, for the copies it carries (as _sets.js's R1 reads a node). */
const R1 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n';

/** The node as the answer gives it: the read conventions' five facts, its slug and whether it has a letter (Decision 17). */
const NODE = Object.freeze({
  type: 'object',
  required: [...R.NODE.required, 'slug', 'hasLetter'],
  properties: {
    ...R.NODE.properties,
    slug: { type: 'string', nullable: true, description: "Its slug: its section's for the concept the call names, else the one its name gives" },
    hasLetter: { type: 'boolean', description: 'Whether it came from a nostr event, its letter' },
  },
});

/** "<name>" (<address>), or the key alone, for messages. */
const labelOf = (facts) => (facts.name ? `"${facts.name}" (${facts.uuid || facts.key})` : (facts.uuid || facts.key));
/** A concept, for messages: its name and address, and its tapestryKey, the key to pass. */
const conceptOf = (h) => `${X.conceptLabel(h)}, whose tapestryKey is ${h.key}`;

/** The fields input, read: an object, or JSON text that parses to one (Decision 1). → [[field, value]], in the order given. */
function fieldsOf(value) {
  let fields = value;
  if (typeof value === 'string') {
    try {
      fields = JSON.parse(value);
    } catch {
      throw refusal(BAD_FIELDS.code, `fields isn't JSON that parses: give the fields to change as a JSON object, such as '{"description": "a dog"}'. Nothing changed.`, { input: 'fields' });
    }
  }
  if (!isObject(fields)) throw refusal(BAD_FIELDS.code, `fields must be a JSON object of the fields to change, such as {"description": "a dog"}; it is ${kindOf(fields)}. Nothing changed.`, { input: 'fields' });
  return Object.entries(fields);
}

/** The refusal for JSON that can't be read (Decision 7). */
const unreadable = (facts, why) => refusal(UNREADABLE_JSON.code, `${labelOf(facts)}'s JSON can't be read: ${why}. Nothing could be checked against its concepts' schemas, so nothing changed.`, { input: 'node' });

module.exports = {
  group: 'graph',
  name: 'update-node',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Change one of this instance's own elements' name, description or fields, each section it changes checked against its concept's schema",
  description: [
    "Changes the element whose tapestryKey is `node`, one of this instance's own: its author is the instance's assistant or its owner, with a letter or without, or it records none. A node that came from another author's event, an admin's included, is refused (`not-own-node`): it is that author's claim, and `graph copy-node` (A10.24) makes a copy of one's own. Nothing is signed or sent anywhere.",
    "`fields` are merged into the node's section for one concept: each field given takes the value given, in its place or at the end, a field given as null is taken out, and an object or a list is replaced whole. `fields` is an object, or its JSON text, as a command line gives it. `description` is the section's description field, trimmed. `concept` names the concept whose section changes; it may be left out when the node is an element of one concept only, word aside. A section the node lacks is `graph add-to-concept`'s (A10.22).",
    "`name` renames it: its name and tapestryValue, its name tag, each section's name and slug, and its word block's name, title and slug, wherever they held what the old name gave. Its address and tapestryKey never change, so create-element with the old name still answers it. A name another of the instance's own elements of one of its concepts has, or whose address it sits at, is refused (`name-in-use`).",
    "Before anything is written, the JSON as the call would leave it is checked against the JSON Schema of each concept whose section it changes (BIBLE §10, rule 4: the rule `element-fits-schema`); `concepts` says how every concept the node belongs to judges it. The concepts' marked fields follow onto the node. The same call again changes nothing and records nothing (`unchanged`). The node's letter, if it has one, and the derive step's cached copy of its JSON, if there is one, are left as they are: `letterOutOfDate` and `cacheOutOfDate` say when they now differ from it.",
  ].join('\n\n'),
  inputs: {
    node: N.keyInput("The tapestryKey of the element to change: one of this instance's own"),
    name: { schema: { type: 'string', maxLength: 1000 }, description: "Its new name, such as Rover (trimmed; up to 200 characters): its tapestryValue, and its sections' and word block's name and slug where they held the old one's" },
    description: { schema: { type: 'string', maxLength: 10000 }, description: 'Its section\'s new description field, trimmed: "" is a value, and fields {"description": null} takes the field out' },
    fields: { schema: X.FIELDS_INPUT.schema, description: "The fields to merge into its section: an object, or its JSON text, as a command line gives it, such as '{\"breed\": \"irishSetter\"}'. Each takes the value given; null takes one out. A name or slug given must be the node's name and the slug it gives, or what the section holds" },
    concept: { schema: { type: 'string', pattern: N.KEY_PATTERN }, description: "The tapestryKey of the concept whose section fields and description change; left out, the node's one concept (word aside)" },
  },
  result: {
    description: 'The node as it now is; what this call changed; each concept the node belongs to, and whether its JSON fits that concept\'s schema; the node properties its concepts\' marks carry; whether its letter and its cached copy now differ from it; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'node', 'changed', 'concepts', 'copies', 'skipped', 'letterOutOfDate', 'cacheOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['updated', 'unchanged'], description: 'updated, or unchanged when the node already held everything given' },
        node: NODE,
        changed: { type: 'array', items: { type: 'string' }, description: 'name when it was renamed, then fields.<field> for each field whose value changed, sorted; empty when nothing changed' },
        concepts: X.CONCEPTS,
        copies: { type: 'array', items: { type: 'string' }, description: "The node properties it now carries for its concepts' marked fields, such as dog_breed; empty when nothing changed" },
        skipped: F.SKIPPED,
        letterOutOfDate: { type: 'boolean', description: "Whether this call changed a node that has a letter, which now differs from it until export nostr (A10.34) sends a new one" },
        cacheOutOfDate: { type: 'boolean', description: "Whether this call changed a node the derive step had cached (tapestryJsonUpdatedAt): readers of the cache may see its old JSON until cache rebuild (A10.36)" },
        note: { type: 'string', description: 'When it changed: where the change is kept, and what its letter and cached copy now say' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [NOTHING_TO_CHANGE, X.BAD_NAME, BAD_FIELDS, NOT_INSTALLED, UNKNOWN_NODE, N.NOT_OWN_NODE, MADE_ELSEWHERE, FIRMWARE_NODE, NOT_AN_ELEMENT, F.UNKNOWN_CONCEPT, X.RESERVED_KEY, NOT_ITS_CONCEPT, CONCEPT_NEEDED, UNREADABLE_JSON, NO_SECTION, NAME_IN_USE],
  // The rule's refusals are listed through the guard, but its items are empty: the JSON it judges is built from the
  // graph, inside the write, so apply runs the rule on it after the locks (ADR 0021 Decision 11, as ADR 0020 Option A).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['node', 'concept', 'name', 'description', 'fields'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.node;

    // 1. What needs no graph (Decision 2).
    if (inputs.name === undefined && inputs.description === undefined && inputs.fields === undefined) {
      throw refusal(NOTHING_TO_CHANGE.code, 'Give name, description or fields to change. Nothing changed.');
    }
    const newName = typeof inputs.name === 'string' ? X.cleanName(inputs.name) : null;
    const fields = inputs.fields === undefined ? [] : fieldsOf(inputs.fields);
    const description = typeof inputs.description === 'string' ? inputs.description.trim() : undefined;
    if (description !== undefined) {
      const inFields = fields.find(([f]) => f === 'description');
      if (inFields && canon(inFields[1]) !== canon(description)) {
        throw refusal(BAD_FIELDS.code, `description is ${JSON.stringify(shorten(description))}, but fields gives the description ${JSON.stringify(shorten(JSON.stringify(inFields[1])))}: give it one way, or the same both ways. Nothing changed.`, { input: 'description' });
      }
    }
    const ta = K.assistant();
    if (!ta) throw refusal(NOT_INSTALLED.code, "This instance has no assistant key, so it can't tell its own nodes from another author's, or firmware's own: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again. Nothing changed.");

    // 2. The lock on the node (Decision 5): two updates of one node go one at a time, and the second reads what the
    // first wrote. A key that names no node locks nothing, and unknown-node follows.
    await S.lockNode(tx, key);

    // 3. Whose node it is (Decision 3): unknown-node, then not-own-node.
    const facts = await N.requireOwn(read, key, { input: 'node' });

    // 4. Its concepts, and what kind of node it is (Decision 4; Amendment 1).
    const conceptKeys = [...new Set((await F.conceptsOfNodes(read, [key])).map((r) => r.concept))].sort();
    const headers = conceptKeys.length ? await K.headersByKey(read, conceptKeys) : [];
    const byKey = new Map(headers.map((h) => [h.key, h]));
    const elsewhere = X.changedElsewhere({ conceptUuids: headers.map((h) => h.uuid), labels: facts.labels, uuid: facts.uuid });
    if (elsewhere) throw refusal(MADE_ELSEWHERE.code, X.say.changedElsewhere(labelOf(facts), elsewhere), { input: 'node' });
    const file = X.firmwareElementOf(facts.uuid);
    if (file) {
      throw refusal(FIRMWARE_NODE.code, `${labelOf(facts)} is one of firmware's own elements, which its file ${file} defines: a firmware reinstall can make it again as that file says, so it changes in firmware's definition, through lifecycle seed-firmware (A10.37), never here. Nothing changed.`, { input: 'node' });
    }
    const judged = conceptKeys.filter((c) => byKey.has(c) && !X.RESERVED_KEYS.includes(byKey.get(c).oKey));
    if (!judged.length) {
      throw refusal(NOT_AN_ELEMENT.code, `${labelOf(facts)} is an element of no concept${conceptKeys.length ? ' but word' : ''}: no other concept's class thread reaches it, so it has no section to change and no schema to check one against (design D9). graph add-to-concept (A10.22, to come) makes a node an element of a concept. Nothing changed.`, { input: 'node' });
    }

    // 5. The locks on the headers of the concepts it judges, in tapestryKey order (Decision 5): a rename's name check,
    // and a create-element of the name in any of them, then go one at a time.
    for (const c of judged) await S.lockNode(tx, c);

    // 6. The concept whose section changes (Decision 6).
    const sectionChange = fields.length > 0 || description !== undefined;
    let target = null;
    if (typeof inputs.concept === 'string') {
      const c = await F.conceptOf(read, inputs.concept);
      if (!c) throw refusal(F.UNKNOWN_CONCEPT.code, F.say.unknownConcept(inputs.concept), { input: 'concept' });
      const h = byKey.get(inputs.concept) || (await K.headersByKey(read, [inputs.concept]))[0] || null;
      const oKey = h && h.oKey ? h.oKey : c.oKey;
      if (X.RESERVED_KEYS.includes(oKey)) throw refusal(X.RESERVED_KEY.code, X.say.reservedKey(c, oKey), { input: 'concept' });
      if (!judged.includes(inputs.concept)) {
        throw refusal(NOT_ITS_CONCEPT.code, `${labelOf(facts)} isn't an element of ${X.conceptLabel(c)}, so it has no section of that concept's to change. It is an element of ${judged.map((j) => conceptOf(byKey.get(j))).join('; ')}. graph add-to-concept (A10.22, to come) makes a node an element of another concept. Nothing changed.`, { input: 'concept' });
      }
      target = inputs.concept;
    } else if (sectionChange) {
      if (judged.length > 1) {
        throw refusal(CONCEPT_NEEDED.code, `${labelOf(facts)} is an element of ${judged.length} concepts, ${judged.map((j) => `${conceptOf(byKey.get(j))}, its section ${byKey.get(j).oKey}`).join('; ')}: name the one whose section changes with concept. Which section fields go in is never guessed. Nothing changed.`, { input: 'concept' });
      }
      target = judged[0];
    }

    // 7. The node and its tags; its JSON (Decision 7).
    const rows = await read(U1, { key });
    const node = rows[0] || {};
    const tags = rows.filter((r) => r.type !== null && r.type !== undefined).map((r) => ({ key: r.tag, type: r.type, value: r.tagValue }));
    const jsonTags = tags.filter((t) => t.type === 'json');
    if (!jsonTags.length) throw unreadable(facts, 'it has no json tag');
    const values = [...new Set(jsonTags.map((t) => t.value))];
    if (values.length > 1) throw unreadable(facts, `it has ${jsonTags.length} json tags that differ, and which one counts isn't guessed`);
    const got = F.readJson(values[0]);
    if (got.problem) throw unreadable(facts, got.problem);
    if (!isObject(got.json)) throw unreadable(facts, "its JSON isn't an object, so it has no sections");
    const oldJson = got.json;
    const oldName = (typeof node.value === 'string' && node.value) || (typeof node.name === 'string' && node.name) || facts.name || '';
    const targetKey = target ? byKey.get(target).oKey : null;
    if (sectionChange && !isObject(oldJson[targetKey])) {
      throw refusal(NO_SECTION.code, `${labelOf(facts)}'s JSON has no ${targetKey} section, the section of ${conceptOf(byKey.get(target))}. update-node changes a section the node already has; graph add-to-concept (A10.22, to come) gives a node another concept's section. Nothing changed.`, { input: typeof inputs.concept === 'string' ? 'concept' : 'fields' });
    }

    // 8. The new JSON (Decisions 8 and 9): the rename first, then the fields merged into the target section.
    const renaming = newName !== null && newName !== oldName;
    const name = renaming ? newName : oldName;
    let json = oldJson;
    let renamedSections = [];
    if (renaming) ({ json, sections: renamedSections } = X.renamedJson(oldJson, { was: oldName, now: newName }));
    const fieldChanges = [];
    if (sectionChange) {
      const before = json[targetKey];
      const entries = [...fields];
      if (description !== undefined && !entries.some(([f]) => f === 'description')) entries.push(['description', description]);
      for (const [f, v] of entries) {
        if (f !== 'name' && f !== 'slug') continue;
        const want = f === 'name' ? name : dtag.slug(name);
        if (v === null) throw refusal(BAD_FIELDS.code, `fields takes out the section's ${f}, which the section always keeps: give its ${f}, or leave ${f} out of fields. Nothing changed.`, { input: 'fields' });
        if (v !== want && !(own(before, f) && v === before[f])) {
          throw refusal(BAD_FIELDS.code, `fields gives the ${f} ${JSON.stringify(shorten(JSON.stringify(v)))}, but the node's ${f} is ${JSON.stringify(want)}${own(before, f) ? `, and its section holds ${JSON.stringify(before[f])}` : ''}: a section's ${f} is the node's own${f === 'slug' ? ' slug, the one its name gives,' : ' name'} or what it already holds. Rename the node with name, or leave ${f} out of fields. Nothing changed.`, { input: 'fields' });
        }
      }
      const after = X.mergeSection(before, entries);
      for (const field of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
        const was = own(before, field) ? before[field] : null;
        const now = own(after, field) ? after[field] : null;
        if (canon(was) !== canon(now) || own(before, field) !== own(after, field)) fieldChanges.push({ field, was, now });
      }
      json = Object.fromEntries(Object.entries(json).map(([k, v]) => (k === targetKey ? [k, after] : [k, v])));
    }
    const text = JSON.stringify(json);
    if (text.length > X.MAX_JSON) throw refusal(BAD_FIELDS.code, X.say.tooLong(text.length), { input: 'fields' });

    const Sch = require('./_schemas');
    const report = async (j) => {
      const order = [...(target ? [target] : []), ...conceptKeys.filter((c) => c !== target)];
      const out = [];
      for (const c of order) {
        const r = await Sch.fits(read, c, j);
        out.push({ concept: c, key: (byKey.get(c) && byKey.get(c).oKey) || null, fits: r.fits, problems: r.problems, problem: r.problem });
      }
      return out;
    };
    const slugOf = (j) => (targetKey && isObject(j[targetKey]) && typeof j[targetKey].slug === 'string' && j[targetKey].slug ? j[targetKey].slug : dtag.slug(name));
    const answerNode = (j) => ({ tapestryKey: key, name, address: facts.uuid, author: facts.author, own: true, slug: slugOf(j), hasLetter: facts.hasLetter });

    // 9. Unchanged (Decision 12): nothing to write, so nothing is checked, as create-element's repeat checks nothing.
    if (!renaming && !fieldChanges.length) {
      return {
        data: { outcome: 'unchanged', node: answerNode(oldJson), changed: [], concepts: await report(oldJson), copies: [], skipped: [], letterOutOfDate: false, cacheOutOfDate: false },
        changes: [],
      };
    }

    // 10. The name check (Decision 10): the element create-element would answer for the new name, in each judged concept.
    if (renaming) {
      const authors = R.ownKeys();
      for (const c of judged) {
        const h = byKey.get(c);
        const address = typeof h.uuid === 'string' && h.uuid ? `39999:${ta}:${dtag.childDTag(newName, h.uuid)}` : null;
        const other = (await X.repeatsOf(read, { concept: c, name: newName, authors, address })).find((r) => r.key !== key);
        if (other) {
          const how = typeof other.name === 'string' && other.name.toLowerCase() === newName.toLowerCase() ? `has the name ${JSON.stringify(other.name)}` : `sits at the address the name ${newName} gives, ${other.uuid}`;
          throw refusal(NAME_IN_USE.code, `In ${conceptOf(h)}, another of this instance's own elements, ${other.name ? `"${other.name}"` : 'one'} (${other.key}), ${how}: renaming ${labelOf(facts)} to ${newName} would leave two of the instance's own elements of one name in one concept, and graph create-element would find that one for the name. Nothing changed. Choose another name, or merge the two (graph merge-nodes, A10.25, to come).`, { input: 'name' });
        }
      }
    }

    // 11. Rule 4 (Decision 11): each judged concept whose section changed, every finding named.
    const changedKeys = new Set([...renamedSections, ...(fieldChanges.length ? [targetKey] : [])]);
    const items = judged.filter((c) => changedKeys.has(byKey.get(c).oKey)).map((c) => ({ concept: c, json }));
    if (items.length) await Sch.checkElements(read, items, { every: true });

    // 12. The write (Decision 13): the node's name, its name tags, and its json tags, inline.
    const writes = [];
    const nameTags = tags.filter((t) => t.type === 'name');
    if (renaming) {
      writes.push({ key, props: { name: newName, tapestryValue: newName } });
      for (const t of nameTags) writes.push({ key: t.key, props: { value: newName } });
    }
    // The JSON goes inline, even over an LMDB reference, so the graph holds the change (BIBLE §30); only when it changed.
    if (text !== JSON.stringify(oldJson)) for (const t of jsonTags) writes.push({ key: t.key, props: { value: text } });
    if (writes.some((w) => typeof w.key !== 'string')) throw new Error("a tag this update writes has no tapestryKey, so it can't be changed; run lifecycle migrate first");
    const written = await F.writeCopies(tx, writes);
    if (written !== writes.length) throw new Error(`the update wrote ${written} of its ${writes.length} nodes and tags: one went missing while it was written`);
    if (renaming && !nameTags.length) await E.addTags(tx, key, E.tagRows(facts.uuid || node.uuid, [['name', newName]], tags.length));

    // 13. Marked fields (Decision 14), and the copies the node now carries for its concepts' marks.
    const mapped = await F.mapNodes(tx, [key]);
    const marked = new Set();
    for (const c of judged) for (const m of await F.marksOf(read, { concept: c })) if (typeof m.property === 'string') marked.add(m.property);
    const [after] = await read(R1, { key });
    const props = after && isObject(after.n) ? after.n : {};
    const copies = Object.keys(props).filter((p) => marked.has(p)).sort();

    // 14. The answer and the entry (Decisions 15–18).
    const letterOutOfDate = facts.hasLetter === true;
    const cacheOutOfDate = node.cached !== null && node.cached !== undefined;
    const notes = ["Changed in this instance's graph only: nothing was signed or sent anywhere."];
    if (letterOutOfDate) notes.push(`Its letter, ${facts.uuid}, now differs from it, until export nostr (A10.34) sends a new one.`);
    if (cacheOutOfDate) notes.push("The derive step made a cached copy of its JSON before this change (tapestryJsonUpdatedAt), so readers of the cache, such as the node's JSON page, may see the old one until cache rebuild (A10.36).");
    const changed = [...(renaming ? ['name'] : []), ...fieldChanges.map((c) => `fields.${c.field}`)];
    const changes = [
      ...(renaming ? [{ change: 'node-renamed', node: key, was: oldName, now: newName }] : []),
      ...fieldChanges.map((c) => ({ change: 'field-changed', node: key, concept: target, field: c.field, was: c.was, now: c.now })),
      ...F.copyChanges(mapped),
    ];
    return {
      data: { outcome: 'updated', node: answerNode(json), changed, concepts: await report(json), copies, skipped: mapped.skipped, letterOutOfDate, cacheOutOfDate, note: notes.join(' ') },
      changes,
    };
  },
};
