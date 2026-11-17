'use strict';
/**
 * graph create-set — a set under a concept's superset or another set, with no event (catalog §2, Sets; story
 * graph-operations-first-slice #27, AC1–AC7; ADR graph-operations-first-slice/0027 Decisions 1–17).
 *
 * A write through the write path (src/operations/write.js). It takes the lock on its parent first, so every call that
 * could make the same set goes one at a time (Decision 5). It reads its parent as link-set does (_sets.js's
 * requireParent, Decision 4), and its guard is the rule element-fits-schema, BIBLE §10's rule 4, run in apply on the
 * set's JSON once the write has built it, since that JSON comes from the graph (Decision 1). It is safe to repeat by name
 * under the parent: this instance's own set there with the name, or at the address the name gives, is answered
 * untouched. It records a change entry when it makes a set, and signs nothing: the set is the node the nostr import
 * would make of the letter today's create-set signs, plus its JSON (_eventless.js).
 */

const dtag = require('../../../lib/dtag');
const CN = require('../../../lib/conceptNames');
const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_elements');
const E = require('./_eventless');
const N = require('./_nodes');

const NOTE = "This set is in this instance's graph only: no event backs it, so only a backup (lifecycle backup) keeps it (BIBLE §30). export nostr is how it is published.";
const MAX_DESCRIPTION = 10000;

// ── the refusals that are the operation's own (Decision 15) ──
const BAD_NAME = X.BAD_NAME;
const BAD_DESCRIPTION = K.BAD_DESCRIPTION;
const NOT_INSTALLED = Object.freeze({ code: 'not-installed', status: 409, when: "The instance has no assistant key, the would-be author, or no set concept with a superset: the firmware isn't installed" });
const UNKNOWN_PARENT = Object.freeze({ code: 'unknown-node', status: 404, when: 'A parent that names no node of the graph (a change entry is not one)' });
const NO_FREE_ADDRESS = X.NO_FREE_ADDRESS;

const shorten = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

/** The name, cleaned as create-concept cleans one; or the refusal bad-name (Decision 3). */
function cleanName(raw) {
  const name = CN.cleanName(raw);
  const why = CN.nameProblem(name);
  if (why) throw refusal(BAD_NAME.code, `The name ${JSON.stringify(shorten(raw))} can't be a set's name: ${why}.`, { input: 'name' });
  return name;
}

/** The description, trimmed, or null when left out or blank; or the refusal bad-description (Decision 3). */
function cleanDescription(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  const why = CN.descriptionProblem(value);
  if (why) throw refusal(BAD_DESCRIPTION.code, `That description can't be a set's: ${why}.`, { input: 'description' });
  return value || null;
}

/**
 * R6 (Decision 6): the set concept, found by its firmware address on this instance, so another author's concept with
 * the slug set isn't it → { uuid, concept, superset }, where concept and superset are null when the graph has no such
 * header pointing to a superset.
 */
async function setConceptOf(read) {
  const { conceptUuid } = require('../../../api/normalize/firmware');
  const uuid = conceptUuid('set');
  if (!uuid) return { uuid: null, concept: null, superset: null };
  const { INIT } = S.aliases();
  const rows = await read(
    `MATCH (h:TapestryNode {uuid: $uuid})-[:${INIT}]->(s:Superset)
     WHERE NOT h:GraphChange
     RETURN h.tapestryKey AS concept, s.tapestryKey AS superset LIMIT 1`,
    { uuid },
  );
  const r = rows[0] || {};
  return { uuid, concept: typeof r.concept === 'string' ? r.concept : null, superset: typeof r.superset === 'string' ? r.superset : null };
}

/** What the refusal not-installed says, naming what is missing. */
function notInstalled(missing) {
  return `This instance has ${missing}, so no set can be made: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again.`;
}

/** Every concept whose class thread reaches the node keyed `key`, as { concept, address }, by tapestryKey (E2). */
async function threadsOf(read, key) {
  const rows = await X.conceptsReaching(read, key);
  return rows.map((r) => ({ concept: r.concept, address: r.uuid })).sort((a, b) => (a.concept < b.concept ? -1 : a.concept > b.concept ? 1 : 0));
}

/** The answer's schemas. */
const SET = Object.freeze({
  type: 'object',
  required: ['tapestryKey', 'address', 'name', 'slug', 'description', 'parents', 'hasLetter'],
  properties: {
    tapestryKey: { type: 'string', description: "The set's tapestryKey" },
    address: { type: 'string', nullable: true, description: 'Its nostr address, 39999:<assistant>:<d>: the address a letter for it would carry' },
    name: { type: 'string', nullable: true, description: 'Its name, its tapestryValue' },
    slug: { type: 'string', nullable: true, description: "Its slug: its JSON's set.slug, else the one its name gives" },
    description: { type: 'string', nullable: true, description: 'Its description, or null when it has none' },
    parents: { type: 'array', items: { type: 'string' }, description: 'The tapestryKeys of the supersets and sets it is directly under' },
    hasLetter: { type: 'boolean', description: 'Whether it came from a nostr event' },
  },
});
const THREAD = Object.freeze({
  type: 'object',
  required: ['concept', 'address'],
  properties: {
    concept: { type: 'string', description: "The tapestryKey of the concept's header" },
    address: { type: 'string', nullable: true, description: "The header's nostr address" },
  },
});

module.exports = {
  group: 'graph',
  name: 'create-set',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "A set under a concept's superset or another set, with no event",
  description: [
    "Makes a set named `name` directly under `parent`, the tapestryKey of a concept's superset or of a set: one class-thread link from `parent` to it. Every concept whose class thread reaches `parent` then reaches the set, so an element put in it later belongs to each of them; `threads` names them. The set is an element of the set concept. Nothing is signed or sent anywhere. The set is the node the nostr import would make of the letter today's create-set signs, at the address that letter would carry, with its tags (`d`, `name`, a `z` naming the set concept, an `s` naming the parent, `description` when one is given, and `json`), and no event: a letter published for it later lands on the same node. The name is trimmed, and each run of white space inside it becomes one space.",
    "Its JSON is word-wrapper JSON, as firmware's set files hold it: a `word` block naming it, and a `set` section holding its slug, name, title and description. Before anything is written, the JSON is checked against the set concept's JSON Schema (BIBLE §10, rule 4: the rule `element-fits-schema`); JSON that doesn't fit is refused (`invalid-fields`). For each other concept the set is an element of, such as word, `concepts` says whether its JSON fits that concept's schema too; those never stop it. A concept header is not a parent: pass its superset's tapestryKey.",
    "Safe to repeat: when this instance's own set directly under `parent` has the name, or sits at the address the name gives, it changes nothing, records nothing and answers `already-exists` with that set, naming in `differs` the name when it differs at all and the description when one is given that differs. Another author's set under the parent isn't a repeat. The set is in this instance's graph only: only a backup keeps it.",
  ].join('\n\n'),
  inputs: {
    parent: N.keyInput("The tapestryKey of the superset or set to make the set directly under: a concept's superset, or a set"),
    name: { schema: { type: 'string', maxLength: 1000 }, required: true, description: 'Its name, such as show dogs (trimmed; up to 200 characters): its tapestryValue, and what makes a second call the same one under the parent' },
    description: { schema: { type: 'string', maxLength: MAX_DESCRIPTION }, description: 'What the set holds, in a sentence or two' },
  },
  result: {
    description: "The set made, or this instance's own set under the parent that already had the name; the concepts whose class thread reaches it; the concepts it is an element of, and whether its JSON fits each one's schema; what differs on a repeat; the node properties the set concept's marks carry; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'set', 'threads', 'concepts', 'differs', 'copies', 'skipped', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['created', 'already-exists'], description: "created, or already-exists when this instance's own set under the parent already had the name" },
        set: SET,
        threads: { type: 'array', items: THREAD, description: 'Each concept whose class thread reaches the set, through its parent, by tapestryKey: an element put in the set belongs to each' },
        concepts: {
          type: 'array',
          description: "On created, each concept the set is an element of, the set concept first, then by tapestryKey, and whether its JSON fits that concept's schema; empty on already-exists",
          items: {
            type: 'object',
            required: ['concept', 'key', 'fits', 'problems', 'problem'],
            properties: {
              concept: { type: 'string', description: "The tapestryKey of the concept's header" },
              key: { type: 'string', nullable: true, description: "The concept's key" },
              fits: { type: 'boolean', nullable: true, description: "Whether the set's JSON fits the concept's schema; null when the concept has no schema to check against" },
              problems: { type: 'array', items: X.PROBLEM, description: 'Each problem with its JSON under that schema' },
              problem: { type: 'string', nullable: true, description: 'Why there is no schema to check against' },
            },
          },
        },
        differs: {
          type: 'array',
          description: 'On already-exists, each input given that differs from what the set holds: name, or description; empty otherwise',
          items: {
            type: 'object',
            required: ['input', 'given', 'holds'],
            properties: {
              input: { type: 'string', enum: ['name', 'description'], description: 'name or description' },
              given: { type: 'string', description: 'The input, as cleaned' },
              holds: { type: 'string', nullable: true, description: 'What the set holds: null for a description it lacks' },
            },
          },
        },
        copies: { type: 'array', items: { type: 'string' }, description: "On created, the node properties the set now carries for the set concept's marked fields, such as set_slug; empty otherwise" },
        skipped: F.SKIPPED,
        note: { type: 'string', description: 'On created: where the set is kept' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [BAD_NAME, BAD_DESCRIPTION, NOT_INSTALLED, UNKNOWN_PARENT, S.NOT_A_PARENT, NO_FREE_ADDRESS],
  // The rule's refusals are listed through the guard, but its items are empty: the JSON it judges is built from the
  // graph, inside the write, so apply runs the rule on it (ADR 0027 Decision 1, as ADR 0020 Decision 12 does).
  guards: [{ rule: 'element-fits-schema', items: () => [] }],
  repeatKey: ['parent', 'name'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);

    // 1. What needs no graph (Decision 3): the name, the description and the would-be author.
    const name = cleanName(inputs.name);
    const slug = dtag.slug(name);
    const description = cleanDescription(inputs.description);
    const ta = K.assistant();
    if (!ta) throw refusal(NOT_INSTALLED.code, notInstalled('no assistant key, the would-be author of every node a write makes'));

    // 2. The lock on the parent (Decision 5): every call that could make the same set names it, so they go one at a
    // time, and the second finds what the first made. Every read comes after it.
    await S.lockNode(tx, inputs.parent);

    // 3. The parent, read as link-set reads one (Decision 4).
    const parentNode = await S.requireParent(tx, inputs.parent);

    // 4. The set concept (Decision 6).
    const setConcept = await setConceptOf(read);
    if (!setConcept.concept || !setConcept.superset) throw refusal(NOT_INSTALLED.code, notInstalled(`no set concept with a superset (${setConcept.uuid || '39998:<assistant>:set'})`));
    const threads = await threadsOf(read, inputs.parent);

    // 5. The repeat (Decision 7).
    const plain = `39999:${ta}:${dtag.childDTag(name, parentNode.uuid)}`;
    const repeat = await S.findSetRepeat(read, { parent: inputs.parent, name, ta, address: plain });
    if (repeat) {
      const { json } = F.readJson(repeat.json);
      const heldSlug = json && json.set && typeof json.set.slug === 'string' && json.set.slug ? json.set.slug : (repeat.name ? dtag.slug(repeat.name) : null);
      return {
        data: {
          outcome: 'already-exists',
          set: S.describeSet({ key: repeat.key, address: repeat.uuid, name: repeat.name, slug: heldSlug, description: repeat.description, parents: repeat.parents, hasLetter: repeat.hasLetter }),
          threads,
          concepts: [],
          differs: S.setDiffers(repeat, { name, description: typeof inputs.description === 'string' ? description : undefined }),
          copies: [],
          skipped: [],
        },
        changes: [],
      };
    }

    // 6. The address (Decision 8): the one today's create-set and add-subset give the name and parent, else the first
    // free versioning nonce.
    const free = await X.freeAddress(read, { name, header: parentNode.uuid, ta });
    if (!free) throw refusal(NO_FREE_ADDRESS.code, `Every address the name ${name} gives under this parent is held: ${plain}, and each versioning nonce to ~${X.MAX_NONCE}. Nothing changed. Choose another name.`);

    // 7. The JSON (Decision 9), and rule 4 on it: invalid-fields or no-schema, with the rule named.
    const memberOf = (await X.conceptsReaching(read, setConcept.superset)).map((c) => c.concept).filter((k) => k !== setConcept.concept).sort();
    const headers = new Map((await K.headersByKey(read, memberOf)).map((h) => [h.key, h]));
    const json = S.setJson({ name, slug, description, others: memberOf.map((k) => headers.get(k) && headers.get(k).oKey) });
    const Sch = require('./_schemas');
    await Sch.checkElements(read, [{ concept: setConcept.concept, json }]);

    // 8. The node, its tags and its two links (Decisions 10 and 11).
    const key = await E.makeNode(tx, {
      uuid: free.address,
      kind: 39999,
      labels: ['ListItem', 'Set'],
      name,
      tags: S.setTags({ d: free.d, name, setConcept: setConcept.uuid, parent: parentNode.uuid, description, json: JSON.stringify(json) }),
      pubkey: ta,
      createdAt: Math.floor(Date.now() / 1000),
    });
    await S.linkUnder(tx, inputs.parent, key);
    await X.link(tx, setConcept.superset, key);

    // 9. Its marks (Decision 12), the other concepts' verdicts (Decision 13) and the entry (Decision 14).
    const mapped = await F.mapNodes(tx, [key]);
    const concepts = [{ concept: setConcept.concept, key: 'set', fits: true, problems: [], problem: null }];
    for (const c of memberOf) {
      const r = await Sch.fits(read, c, json);
      concepts.push({ concept: c, key: (headers.get(c) && headers.get(c).oKey) || null, fits: r.fits, problems: r.problems, problem: r.problem });
    }
    return {
      data: {
        outcome: 'created',
        set: S.describeSet({ key, address: free.address, name, slug, description, parents: [inputs.parent], hasLetter: false }),
        threads,
        concepts,
        differs: [],
        copies: Object.keys(mapped.set).filter((p) => mapped.set[p].length).sort(),
        skipped: mapped.skipped,
        note: NOTE,
      },
      changes: [{ change: 'set-created', node: key, from: inputs.parent, name, slug }, ...F.copyChanges(mapped)],
    };
  },
};
