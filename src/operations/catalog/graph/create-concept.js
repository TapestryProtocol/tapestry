'use strict';
/**
 * graph create-concept — a concept, with its eight core nodes and their wiring, and no event (catalog §2; story
 * graph-operations-first-slice #16, AC1–AC5, AC7, AC8; ADR graph-operations-first-slice/0016 Decisions 1–8, 10, 11).
 *
 * A write through the write path (src/operations/write.js): its guard is concept-slug-unique, it is safe to repeat by
 * name (an own concept with the slug the name gives is returned untouched, A9's contract), it records a change entry
 * when it makes a concept, and it signs nothing. Each node is the one the nostr import would make of the letter today's
 * create-concept signs, recorded without signing (_eventless.js, _concepts.js).
 */

const { CHANGE_ENTRY } = require('../../changes');
const K = require('./_concepts');
const E = require('./_eventless');

const NOTE = "This concept is in this instance's graph only: no event backs it, so only a backup (lifecycle backup) keeps it (BIBLE §30). export nostr is how it is published.";

module.exports = {
  group: 'graph',
  name: 'create-concept',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'A concept, with its eight core nodes and their wiring, and no event',
  description: [
    "Makes a concept named `name`: its header and its seven other core nodes (superset, JSON schema, primary property, properties set, property tree graph, concept graph and core nodes graph), wired as today's create-concept wires them, each an element of the concepts it belongs to, and none signed or sent anywhere. Each node is what the nostr import would make of the letter today's route signs, at the address that letter would carry, with no event: a later letter lands on the same node. The names are trimmed, and each run of white space inside them becomes one space. Left out, `plural` is the name with an s.",
    "Safe to repeat: when one of this instance's own concepts already has the slug the name gives, it changes nothing, records nothing and answers `already-exists` with that concept, naming in `differs` each input given that differs from what the concept holds, so the plural or description given isn't assumed saved. A name whose key another of this instance's concepts has under another slug is refused (`key-in-use`): a concept's key, what its elements' JSON is filed under, never changes.",
    "Every answer lists, in `similar`, the concepts close to the one asked for, up to ten: another author's concept with the same slug (`same-slug`, such as a shared concept), any concept with the same name and another slug (`same-name`), and any whose singular is the plural asked for, or whose plural is the singular (`plural-swap`). None of them stops the create. The concept is in this instance's graph only: only a backup keeps it.",
  ].join('\n\n'),
  inputs: {
    name: { schema: { type: 'string', maxLength: 1000 }, required: true, description: 'Its singular name, such as coffee house (trimmed; up to 200 characters)' },
    plural: { schema: { type: 'string', maxLength: 1000 }, description: 'Its plural name, such as coffee houses; left out, the name with an s' },
    description: { schema: { type: 'string', maxLength: 10000 }, description: 'What it is, in a sentence or two' },
  },
  result: {
    description: 'The concept made, or the one that already had the slug; what differs from it; the concepts close to it; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'concept', 'differs', 'similar', 'moreSimilar', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['created', 'already-exists'], description: 'created, or already-exists when one of this instance\'s concepts already had the slug' },
        concept: K.CONCEPT,
        differs: {
          type: 'array',
          description: 'On already-exists, each input given that differs from what the concept holds; empty otherwise',
          items: {
            type: 'object',
            required: ['input', 'given', 'holds'],
            properties: {
              input: { type: 'string', enum: ['name', 'plural', 'description'] },
              given: { type: 'string', description: 'The input, as cleaned' },
              holds: { type: 'string', nullable: true, description: 'What the concept holds' },
            },
          },
        },
        similar: K.SIMILAR,
        moreSimilar: { type: 'boolean', description: 'Whether there were more close concepts than the list holds' },
        note: { type: 'string', description: 'On created: where the concept is kept' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [K.BAD_NAME, K.BAD_DESCRIPTION, K.NOT_INSTALLED, K.NO_FREE_ADDRESS],
  guards: [{ rule: 'concept-slug-unique', items: (inputs) => K.createItems(inputs) }],
  repeatKey: ['name'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const given = K.cleanInputs(inputs, { create: true });
    const ta = K.assistant();
    await K.lock(tx);
    if (!ta) throw new Error('the lock was taken, but the instance has no assistant key');
    const { deriveAllNames } = require('../../../lib/conceptNames');
    const names = deriveAllNames(given.name, given.plural);
    const slug = names.oSlugs.singular;
    // Two calls at once: the second waits on the lock, then finds what the first made (Decision 6).
    await K.recheck(read, [{ slug, key: names.oKeys.singular, repeat: true }]);
    const asked = { singular: names.oNames.singular, plural: names.oNames.plural, slug };

    const existing = (await K.ownConcepts(read)).find((c) => c.slug === slug);
    if (existing) {
      const concept = await K.describeConcept(read, existing.key);
      if (!concept) throw new Error(`the concept with the slug ${slug} went missing while it was read`);
      const differs = [];
      if (names.oNames.singular !== String(concept.names.singular || '').toLowerCase()) differs.push({ input: 'name', given: given.name, holds: concept.names.singular });
      if (typeof inputs.plural === 'string' && names.oNames.plural !== String(concept.names.plural || '').toLowerCase()) differs.push({ input: 'plural', given: given.plural, holds: concept.names.plural || null });
      if (given.description && given.description !== concept.description) differs.push({ input: 'description', given: given.description, holds: concept.description });
      const near = await K.nearMatches(read, { ...asked, exclude: existing.key });
      return { data: { outcome: 'already-exists', concept, differs, similar: near.similar, moreSimilar: near.moreSimilar }, changes: [] };
    }

    const supersets = await K.supersetsOf(read, K.FIRMWARE_SLUGS);
    const d = await K.freeD(read, given.name, ta);
    if (!d) {
      const { refusal } = require('../../refusal');
      throw refusal(K.NO_FREE_ADDRESS.code, `Every address the name ${given.name} gives is held: 39998:${ta}:${require('../../../lib/dtag').slug(given.name)}, and each versioning nonce to ~${K.MAX_NONCE}. Nothing changed. Choose another name.`);
    }
    const built = K.conceptNodes({ names, d, ta, description: given.description || null });
    const createdAt = Math.floor(Date.now() / 1000);
    const keys = {};
    for (const role of K.ROLES) {
      const n = built.nodes[role];
      keys[role] = await E.makeNode(tx, { uuid: n.uuid, kind: n.kind, labels: n.labels, name: n.name, tags: n.tags, pubkey: ta, createdAt });
    }
    const edge = async (from, type, to) => {
      const { rows } = await tx.run(
        `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange
         MATCH (b:TapestryNode {tapestryKey: $to}) WHERE NOT b:GraphChange
         MERGE (a)-[r:\`${type}\`]->(b)
         RETURN count(r) AS n`,
        { from, to },
      );
      if (!rows.length || rows[0].n !== 1) throw new Error(`a ${type} relationship of the new concept found ${rows.length ? rows[0].n : 0} pairs of nodes to join, not 1`);
    };
    // The types are firmware's, through relAlias: plain names, never input.
    for (const w of built.wiring) await edge(keys[w.from], w.type, keys[w.to]);
    for (const role of K.ROLES) {
      for (const s of built.memberships[role]) await edge(supersets[s], built.membershipType, keys[role]);
    }

    const concept = {
      conceptHeader: keys.conceptHeader,
      nodes: { ...keys },
      address: built.nodes.conceptHeader.uuid,
      names: { singular: names.oNames.singular, plural: names.oNames.plural },
      slug,
      key: names.oKeys.singular,
      description: given.description || built.nodes.conceptHeader.json.conceptHeader.description,
      hasLetter: false,
    };
    const near = await K.nearMatches(read, { ...asked, exclude: keys.conceptHeader });
    return {
      data: { outcome: 'created', concept, differs: [], similar: near.similar, moreSimilar: near.moreSimilar, note: NOTE },
      changes: [{ change: 'concept-created', concept: keys.conceptHeader, nodes: K.ROLES.map((r) => keys[r]), count: K.ROLES.length, name: names.oNames.singular, slug }],
    };
  },
};
