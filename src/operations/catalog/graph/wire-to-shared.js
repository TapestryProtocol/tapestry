'use strict';
/**
 * graph wire-to-shared — affiliate one of the instance's own concepts with another author's shared concept (catalog
 * §2; story graph-operations-first-slice #48, AC2, AC3 and AC5; ADR graph-operations-first-slice/0048 Decisions 1–8,
 * and Amendment 1).
 *
 * A write through the write path: it is safe to repeat by the concept and the target, records a change entry, and
 * signs nothing. It gives the concept's header a pointer b naming the target's address, beside any b it holds, takes
 * out any deferral marker, and draws REFERENCES {source: 'b-tag'} to the node at that address, or to a placeholder made
 * there, as the importers do. Export nostr is what sends it, and stamps the concept's elements with a z for the target.
 *
 * The target's form is checked before any statement, since an input's own refusal comes first (Amendment 1, item 4).
 * It then takes update-concept's two locks before it reads, in update-concept's order (Decision 4).
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
  name: 'wire-to-shared',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Affiliate one of the instance's own concepts with another author's shared concept",
  description: [
    'Gives the header of the concept whose header\'s tapestryKey is `concept` a pointer `b` naming `target`, `["b", <target>, "pointer"]`, beside any `b` it holds. `target` is a concept header\'s address, `39998:<pubkey>:<d-tag>` with its pubkey 64 lowercase hex, or an naddr of one, which is turned into its address. A deferral marker the header held goes, since a real `b` replaces it; every other tag, and its JSON, stay as they were. A header whose `b` already names the target, of any type, answers `already-wired` and changes nothing.',
    "It draws `(header)-[:REFERENCES {source: 'b-tag'}]->(target)`, as importing its letter would: to the node at the target's address, or to a placeholder made there when the graph holds no node at it, which importing the target's letter fills in. `target` says where it runs (`node`) and whether the graph holds the target itself (`held`). Anyone's concept may be a target, so one the graph doesn't hold is written all the same. Nothing is signed: export nostr is what sends the letter, and stamps each of the concept's elements with a `z` for the target.",
    "Only this instance's own concepts are wired, as `graph declare-shared` takes them: another author's concept, one at the owner's own key and a firmware concept are refused. So is the concept's own address as the target: offering the concept as a shared concept is `graph declare-shared`'s job.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
    // No pattern: the form is targetOf's to check, so a bad one is refused bad-target (Amendment 1, item 5).
    target: { schema: { type: 'string', maxLength: 2048 }, required: true, description: "The shared concept to wire to: a concept header's address, 39998:<pubkey>:<d-tag>, or an naddr of one" },
  },
  result: {
    description: 'The concept, the target and the node its relationship runs to, its disposition after the call, whether its letter no longer matches it, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'concept', 'target', 'disposition', 'letterOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['wired', 'already-wired'], description: "wired, or already-wired when a b of the header's already named the target" },
        concept: K.CONCEPT,
        target: D.TARGET,
        disposition: D.DISPOSITION,
        letterOutOfDate: { type: 'boolean', description: 'Whether this call changed a header that has a letter, which now differs from it until export nostr sends a new one' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [D.BAD_TARGET, D.SELF_TARGET, K.UNKNOWN_CONCEPT, K.NOT_OWN_CONCEPT, K.FIRMWARE_CONCEPT, K.NOT_INSTALLED],
  repeatKey: ['concept', 'target'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const address = D.targetOf(inputs.target);
    await K.lock(tx);
    await S.lockNode(tx, inputs.concept);
    const found = await D.headerOf(read, inputs.concept);
    const { h } = found;
    if (address === h.uuid) {
      throw refusal(D.SELF_TARGET.code, `${address} is ${h.names.singular || 'the concept'}'s own address: a b naming it offers the concept as a shared concept, which graph declare-shared does. Nothing changed.`, { input: 'target' });
    }
    if (found.values.includes(address)) {
      return { data: { ...D.answerOf(found, 'already-wired', found.values, false), target: await D.nodeAt(read, address) }, changes: [] };
    }

    const changes = [await D.addB(tx, found, ['b', address, 'pointer']), ...await D.dropMarkers(tx, found)];
    const ref = await D.drawReference(tx, h.key, address);
    if (ref.made) changes.push({ change: 'relationship-added', type: 'REFERENCES', from: h.key, to: ref.key });
    const values = [...found.values.filter((v) => v !== B.SENTINEL), address];
    return { data: { ...D.answerOf(found, 'wired', values, true), target: { address, held: ref.held, node: ref.key } }, changes };
  },
};
