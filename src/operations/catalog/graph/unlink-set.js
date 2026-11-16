'use strict';
/**
 * graph unlink-set — take a set out from under one of its parents (catalog §2, Sets; story
 * graph-operations-first-slice #28, AC4–AC6; ADR graph-operations-first-slice/0028 Decision 1).
 *
 * A write through the write path: its guard is set-has-a-parent, it is safe to repeat by set and parent, it records a
 * change entry when it takes the link out, and it signs nothing. It leaves alone the links firmware makes and the ones
 * a peer's event claims (Decisions 6 and 7). It locks the set before it reads anything (Amendments 2 and 3). It removes
 * every copy of the link, since older paths could have made two, then runs the rule again, for a parent another writer
 * took out meanwhile (Decision 9), which rolls it back, naming the parent the set stays under. When the set's own
 * letter still names the parent, its answer says so: export nostr (A10.34) is what sends a new one (D2).
 */

const { CHANGE_ENTRY } = require('../../changes');
const { refusal } = require('../../refusal');
const { findRule } = require('../../rules');
const N = require('./_nodes');
const S = require('./_sets');

const RULE = 'set-has-a-parent';
const FIRMWARE_LINK = Object.freeze({ code: 'firmware-link', status: 409, when: "The link is one the firmware's definition makes (a set file, existing-sets, a concept manifest or a community reference), which stays as firmware defines it until lifecycle seed-firmware" });
const PEER_LINK = Object.freeze({ code: 'peer-link', status: 409, when: "The link is one another author's event claims (their set's s tag names the parent), which the instance records as theirs; whether it counts is decided per point of view" });

const LETTERS = Object.freeze({
  type: 'array',
  description: "The instance's own letters that still name the parent: the set's event, signed by this instance's assistant or owner, whose s tag names it. export nostr (A10.34) is what sends one that matches",
  items: {
    type: 'object',
    required: ['address', 'says'],
    properties: {
      address: { type: 'string', description: "The letter's address: the set's uuid" },
      says: { type: 'string', description: 'What it still says, in words' },
    },
  },
});

module.exports = {
  group: 'graph',
  name: 'unlink-set',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Take a set out from under one of its parents',
  description: [
    "Takes out the class-thread link from the superset or set `parent` to the set or superset `set`, each named by its tapestryKey: every copy of it there is, with their count in the change entry when there is more than one. `set` stays under its other parents, and an element that `parent`'s concepts reached only through this link is no longer one of their elements. Called again, or when `set` isn't directly under `parent`, it changes nothing, records nothing and answers `already-unlinked`.",
    "It refuses the set's last parent (the rule `set-has-a-parent`): link the set under another parent first, or delete it once it is empty. A concept's superset has no last parent to keep, since it stays its concept's superset. It leaves alone a link firmware's definition makes, and a link another author's event claims, which the instance records as theirs. When the set's own letter, an event this instance signed, still names `parent` in its `s` tag, `letters` says so. Nothing is signed.",
  ].join('\n\n'),
  inputs: {
    set: N.keyInput("The tapestryKey of the set to take out: a set, or a concept's superset"),
    parent: N.keyInput('The tapestryKey of the parent to take it out from under: a superset or a set'),
  },
  result: {
    description: "The link, whether this call took it out or it wasn't there, the instance's own letters that still name the parent, and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['link', 'outcome', 'letters', 'change'],
      properties: {
        link: S.LINK,
        outcome: { type: 'string', enum: ['unlinked', 'already-unlinked'], description: "unlinked, or already-unlinked when the set wasn't directly under the parent" },
        letters: LETTERS,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [S.UNKNOWN_SET_OR_PARENT, S.NOT_A_SET, S.NOT_A_PARENT, FIRMWARE_LINK, PEER_LINK],
  guards: [{ rule: RULE, items: (inputs) => [{ set: inputs.set, without: inputs.parent }] }],
  repeatKey: ['set', 'parent'],

  async apply(inputs, ctx) {
    const { set, parent } = inputs;
    // A relationship's DELETE doesn't lock its ends (the live check, ADR 0028 Amendment 2), so the set is locked before
    // anything here reads (Amendment 3, item 1): two unlink-sets of one set then run one after the other, and the
    // re-check below sees the other's delete. A key that names no node locks nothing, and unknown-node follows.
    await S.lockNode(ctx.tx, set);
    const read = (cypher, params) => ctx.tx.read(cypher, params);
    const { setNode, parentNode } = await S.requireEnds(ctx.tx, { set, parent });
    const link = { set, parent };
    if (!(await S.isLinked(read, parent, set))) return { data: { link, outcome: 'already-unlinked', letters: [] }, changes: [] };
    const made = await S.isFirmwareLink(read, parentNode, setNode);
    if (made) {
      throw refusal(FIRMWARE_LINK.code, `The link from ${S.describe(parentNode)} to ${S.describe(setNode)} is firmware's own: it comes from ${made.what}. Firmware's class threads stay as its definition makes them, and a firmware reinstall can put the link back, so it isn't taken out. Nothing changed. Firmware changes through lifecycle seed-firmware (A10.37).`);
    }
    const claim = await S.peerClaim(read, parentNode, setNode);
    if (claim) {
      throw refusal(PEER_LINK.code, `The link from ${S.describe(parentNode)} to ${S.describe(setNode)} is a peer's claim: the set's own event, ${claim.address}, signed by ${claim.author}, names ${parentNode.uuid} as its parent in its s tag. The instance records a peer's claims as theirs, and the next pull of their class thread would record this one again; whether it counts is decided per point of view, when the graph is read. Nothing changed.`);
    }
    const { PROP } = S.aliases();
    const { counters } = await ctx.tx.run(
      `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${PROP}\`]->(b:TapestryNode {tapestryKey: $to})
       WHERE NOT a:GraphChange AND NOT b:GraphChange
       DELETE r
       RETURN count(r) AS removed`,
      { from: parent, to: set },
    );
    const removed = counters.relationshipsDeleted;
    // An unlink that raced this call took it out first.
    if (!removed) return { data: { link, outcome: 'already-unlinked', letters: [] }, changes: [] };
    // The re-check (Decision 9). The guard found another parent, so a finding now means another write took it away while
    // this call ran. The rule decides, and the refusal names the parent the set stays under (Amendment 3, item 2).
    const rule = findRule(RULE);
    const found = await rule.violations([{ set }], read);
    if (found.length) {
      throw refusal(found[0].code, `${S.describe(setNode)} stays under ${S.describe(parentNode)}: another write took it out from under its other parent while this call ran, so ${S.describe(parentNode)} is now its last parent, and taking it out would leave the set under no superset or set, where no class thread would reach it or its elements. Nothing changed. Link it under another parent first (graph link-set), or delete it once it is empty (graph delete-set, A10.17).`, { rule: rule.name });
    }
    const letters = await S.ownLetters(read, parentNode, setNode);
    const change = { change: 'set-unlinked', type: PROP, from: parent, to: set };
    if (removed > 1) change.count = removed;
    return { data: { link, outcome: 'unlinked', letters }, changes: [change] };
  },
};
