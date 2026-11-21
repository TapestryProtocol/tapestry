'use strict';
/**
 * graph declare-shared — offer one of the instance's own concepts as a shared concept (catalog §2; story
 * graph-operations-first-slice #48, AC1, AC3 and AC5; ADR graph-operations-first-slice/0048 Decisions 1, 3–8, and
 * Amendment 1).
 *
 * A write through the write path: it is safe to repeat by the concept, records a change entry, and signs nothing. It
 * gives the concept's header the self-pointing pointer b its letter would carry, ["b", "39998:<TA>:<d-tag>",
 * "pointer"] (protocols/drafts/inherit-from.md § "The `b` tag"), takes out any deferral marker, and draws the self-loop
 * the spec derives from that b, as the importers do. Export nostr is what sends it.
 *
 * It takes update-concept's two locks before it reads, in update-concept's order: C1, then the concept's own header
 * (Decision 4). So it goes one at a time with every write that takes the concept's header, and with the other two.
 */

const B = require('../../../lib/bValueForms');
const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');
const K = require('./_concepts');
const S = require('./_sets');
const D = require('./_dispositions');

module.exports = {
  group: 'graph',
  name: 'declare-shared',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Offer one of the instance's own concepts as a shared concept, one other authors may affiliate with",
  description: [
    'Gives the header of the concept whose header\'s tapestryKey is `concept` the self-pointing pointer `b` its letter would carry, `["b", "39998:<assistant>:<d-tag>", "pointer"]`: its author offers it as a shared concept, one other authors may affiliate with (protocols/drafts/inherit-from.md, "The `b` tag"). That is a claim, not an outcome: whether other authors converge on it is read from each point of view. A deferral marker the header held goes, since a real `b` replaces it; every other tag, and its JSON, stay as they were. A header whose `b` already names its own address, of any type, answers `already-declared` and changes nothing.',
    "It draws the self-loop the spec derives from that `b`, `(header)-[:REFERENCES {source: 'b-tag'}]->(header)`, as importing its letter would, unless an import drew it already. Nothing is signed: export nostr is what sends the letter. For a concept with a letter, the graph then differs from it, and `letterOutOfDate` says so.",
    "Only this instance's own concepts are declared: its header's author is the instance's assistant, with or without a letter. Another author's concept, one at the owner's own key, which the assistant can't sign a new version of, and a firmware concept, whose `b` a reinstall would drop, are refused. `graph wire-to-shared` affiliates a concept with another author's shared concept, and `graph defer-sharing` marks it deliberately unaffiliated.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
  },
  result: {
    description: 'The concept, its disposition after the call, whether its letter no longer matches it, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'concept', 'disposition', 'letterOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['declared', 'already-declared'], description: "declared, or already-declared when a b of the header's already named its own address" },
        concept: K.CONCEPT,
        disposition: D.DISPOSITION,
        letterOutOfDate: { type: 'boolean', description: 'Whether this call changed a header that has a letter, which now differs from it until export nostr sends a new one' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [K.UNKNOWN_CONCEPT, K.NOT_OWN_CONCEPT, K.FIRMWARE_CONCEPT, K.NOT_INSTALLED],
  repeatKey: ['concept'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    await K.lock(tx);
    await S.lockNode(tx, inputs.concept);
    const found = await D.headerOf(read, inputs.concept);
    const { h } = found;
    if (found.values.includes(h.uuid)) return { data: D.answerOf(found, 'already-declared', found.values, false), changes: [] };

    const changes = [await D.addB(tx, found, ['b', h.uuid, 'pointer']), ...await D.dropMarkers(tx, found)];
    if (await D.link(tx, h.key, h.key)) changes.push({ change: 'relationship-added', type: 'REFERENCES', from: h.key, to: h.key });
    const values = [...found.values.filter((v) => v !== B.SENTINEL), h.uuid];
    return { data: D.answerOf(found, 'declared', values, true), changes };
  },
};
