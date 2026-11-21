'use strict';
/**
 * graph defer-sharing — mark one of the instance's own concepts deliberately unaffiliated (catalog §2; story
 * graph-operations-first-slice #48, AC2, AC3 and AC5; ADR graph-operations-first-slice/0048 Decisions 1, 3–5, 7 and 8,
 * and Amendment 1).
 *
 * A write through the write path: it is safe to repeat by the concept, records a change entry, and signs nothing. It
 * gives the concept's header the reserved marker (bValueForms.js's SENTINEL; protocols/drafts/shared-concepts.md
 * § "Deliberate non-affiliation"), which draws no relationship. A real b beats it: a header that holds one is refused,
 * and declare-shared or wire-to-shared takes the marker out.
 *
 * It takes update-concept's two locks before it reads, in update-concept's order (Decision 4).
 */

const B = require('../../../lib/bValueForms');
const { CHANGE_ENTRY } = require('../../changes');
const { refusal } = require('../../refusal');
const N = require('./_nodes');
const K = require('./_concepts');
const S = require('./_sets');
const D = require('./_dispositions');

module.exports = {
  group: 'graph',
  name: 'defer-sharing',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Mark one of the instance's own concepts deliberately unaffiliated with any shared concept",
  description: [
    `Gives the header of the concept whose header's tapestryKey is \`concept\` the reserved marker \`["b", "${B.SENTINEL}"]\`: a disposition marker, not a correspondence claim, which draws no relationship (protocols/drafts/shared-concepts.md, "Deliberate non-affiliation"). A header that holds a real \`b\`, naming an address or an event, is refused, since a declaration or a wiring beats a deferral; a malformed \`b\` is no real one. A header that holds the marker answers \`already-deferred\` and changes nothing. Every other tag, and the header's JSON, stay as they were.`,
    'Nothing is signed. Like any tag, the marker travels with its header if export nostr sends it; a header that is never sent keeps its deferral to this instance. `graph declare-shared` or `graph wire-to-shared` later takes it out. For a concept with a letter, the graph then differs from it, and `letterOutOfDate` says so.',
    "Only this instance's own concepts are deferred, as `graph declare-shared` takes them: another author's concept, one at the owner's own key and a firmware concept are refused.",
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
        outcome: { type: 'string', enum: ['deferred', 'already-deferred'], description: 'deferred, or already-deferred when the header already held the marker' },
        concept: K.CONCEPT,
        disposition: D.DISPOSITION,
        letterOutOfDate: { type: 'boolean', description: 'Whether this call changed a header that has a letter, which now differs from it until export nostr sends a new one' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [D.AFFILIATED, K.UNKNOWN_CONCEPT, K.NOT_OWN_CONCEPT, K.FIRMWARE_CONCEPT, K.NOT_INSTALLED],
  repeatKey: ['concept'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    await K.lock(tx);
    await S.lockNode(tx, inputs.concept);
    const found = await D.headerOf(read, inputs.concept);
    const { h } = found;
    const now = B.dispositionOf(found.values, h.uuid);
    if (now.selfDeclared || now.wired) {
      throw refusal(D.AFFILIATED.code, `${h.names.singular || 'That concept'} (${h.uuid}) is ${now.selfDeclared ? 'declared a shared concept' : 'wired to another concept'}: its header holds a real b, and a declaration or a wiring beats a deferral, so it can't be marked deliberately unaffiliated. Nothing changed.`, { input: 'concept' });
    }
    if (found.values.includes(B.SENTINEL)) return { data: D.answerOf(found, 'already-deferred', found.values, false), changes: [] };

    const changes = [await D.addB(tx, found, ['b', B.SENTINEL])];
    return { data: D.answerOf(found, 'deferred', [...found.values, B.SENTINEL], true), changes };
  },
};
