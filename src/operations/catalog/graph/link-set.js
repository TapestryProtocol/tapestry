'use strict';
/**
 * graph link-set — put an existing set, or a concept's superset, under another parent (catalog §2, Sets; story
 * graph-operations-first-slice #28, AC1–AC3 and AC6; ADR graph-operations-first-slice/0028 Decision 1).
 *
 * A write through the write path: its guard is class-thread-acyclic, it is safe to repeat by set and parent, it records
 * a change entry when it makes the link, and it signs nothing. After its MERGE, while Neo4j holds both ends' locks, it
 * runs the rule again, for a link another writer committed meanwhile (Decision 9), and refuses a link that would leave
 * one a firmware reinstall's prune takes out (Decision 6). Either refusal rolls the link back.
 */

const { CHANGE_ENTRY } = require('../../changes');
const { refusal } = require('../../refusal');
const { findRule } = require('../../rules');
const N = require('./_nodes');
const S = require('./_sets');

const RULE = 'class-thread-acyclic';
const FIRMWARE_PRUNES = Object.freeze({ code: 'firmware-prunes', status: 409, when: "The link would leave a direct link from a firmware concept's superset to a set also below it through another set (the link itself, or one made before), which a firmware reinstall takes out as redundant" });

/** What firmware-prunes says: each link the prune would take out now, and lifecycle seed-firmware. */
async function prunesMessage(read, setNode, parentNode, links) {
  const named = async (key) => S.describe((await S.nodeOf(read, key)) || { key });
  const what = [];
  for (const l of links) {
    what.push(l.isNew
      ? `make a link straight from ${await named(l.parent)} to a set already below it through another set`
      : `leave the earlier link from ${await named(l.parent)} to ${await named(l.set)} redundant, since that set would then be below it through another set too`);
  }
  return `${S.describe(setNode)} under ${S.describe(parentNode)} would ${what.join(', and ')}. A firmware reinstall takes out a direct link from a firmware concept's superset to a set that is also below it through another set, so the link wouldn't last; the set's elements belong to that concept either way. Nothing changed. Firmware's own class threads change through lifecycle seed-firmware (A10.37).`;
}

module.exports = {
  group: 'graph',
  name: 'link-set',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Put an existing set, or a concept's superset, under another parent",
  description: [
    "Links the set or superset `set` directly under the superset or set `parent`, each named by its tapestryKey: one class-thread link from `parent` to `set`. Every concept whose class thread reaches `parent` then reaches `set`, the sets below it and their elements, which become elements of those concepts too; `set` keeps its other parents. A concept's superset linked under another concept's superset or set makes the one concept a kind of the other. Called again with the same two, it changes nothing, records nothing and answers `already-linked`.",
    "It refuses a cycle (the rule `class-thread-acyclic`): a `parent` that is `set` itself, or already below it in the class thread, naming the chain of sets from `set` down to `parent`. It also refuses a link that a firmware reinstall would undo: one straight from a firmware concept's superset to a set already below it through another set, or one that would leave such an earlier link. A concept header is not a set: pass its superset's tapestryKey. Nothing is signed; `export nostr` is what sends a link out.",
  ].join('\n\n'),
  inputs: {
    set: N.keyInput("The tapestryKey of the set to link: a set, or a concept's superset"),
    parent: N.keyInput('The tapestryKey of the parent to put it directly under: a superset or a set'),
  },
  result: {
    description: 'The link, whether this call made it or it was there already, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['link', 'outcome', 'change'],
      properties: {
        link: S.LINK,
        outcome: { type: 'string', enum: ['linked', 'already-linked'], description: 'linked, or already-linked when the set was directly under the parent before this call' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [S.UNKNOWN_SET_OR_PARENT, S.NOT_A_SET, S.NOT_A_PARENT, FIRMWARE_PRUNES],
  guards: [{ rule: RULE, items: (inputs) => [{ set: inputs.set, parent: inputs.parent }] }],
  repeatKey: ['set', 'parent'],

  async apply(inputs, ctx) {
    const { set, parent } = inputs;
    const read = (cypher, params) => ctx.tx.read(cypher, params);
    const { setNode, parentNode } = await S.requireEnds(ctx.tx, { set, parent });
    const link = { set, parent };
    // Before any refusal only a new link could earn, so a repeat never refuses (Decision 1, step 3).
    if (await S.isLinked(read, parent, set)) return { data: { link, outcome: 'already-linked' }, changes: [] };
    const before = await S.firmwarePrunes(read, { parent, set });
    const { PROP } = S.aliases();
    const { counters } = await ctx.tx.run(
      `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange
       MATCH (b:TapestryNode {tapestryKey: $to}) WHERE NOT b:GraphChange
       MERGE (a)-[r:\`${PROP}\`]->(b)
       RETURN count(r) AS n`,
      { from: parent, to: set },
    );
    // A repeat that raced this call made it first.
    if (!counters.relationshipsCreated) return { data: { link, outcome: 'already-linked' }, changes: [] };
    const rule = findRule(RULE);
    const found = await rule.violations([{ set, parent }], read);
    if (found.length) throw refusal(found[0].code, found[0].message, { rule: rule.name });
    const prunes = await S.firmwarePrunes(read, { parent, set, before });
    if (prunes.length) throw refusal(FIRMWARE_PRUNES.code, await prunesMessage(read, setNode, parentNode, prunes));
    return {
      data: { link, outcome: 'linked' },
      changes: [{ change: 'set-linked', type: PROP, from: parent, to: set }],
    };
  },
};
