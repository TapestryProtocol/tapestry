'use strict';
/**
 * lifecycle seed-firmware — install or update the built-in concepts as the instance's own nodes, unsigned, by the
 * bootstrap path, keeping what was edited (catalog §8; story graph-operations-first-slice #37, ADR
 * graph-operations-first-slice/0037 Decisions 1 and 11).
 *
 * Its source is the firmware the instance carries, its files read once and checked before anything is written
 * (src/firmware/target.js). Holding the lifecycle lock, it reads what the graph holds at the firmware's addresses,
 * plans each node's and relationship's outcome, and writes the plan in one transaction, with one change entry
 * (_seed.js). Then the cache, and rules check over the firmware's concepts. It runs inline, not as a job, so the
 * caller's role reaches the entry. Nothing is signed or sent to any relay, and no guard runs: today's install, POST
 * /api/firmware/install, stays the install until export nostr can sign what this writes (ADR 0043, Decision 1).
 */

const path = require('path');
const C = require('./_common');
const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');

const MAX_TAKE = 500;
const D = (code, status, when) => Object.freeze({ code, status, when });
const UNKNOWN_VERSION = D('unknown-version', 409, 'A version the instance doesn\'t carry; the refusal names the one it carries');
const FIRMWARE_UNREADABLE = D('firmware-unreadable', 409, 'Firmware files that can\'t be read or don\'t hold together: a file missing, a file that isn\'t JSON, a concept an enumeration names that the firmware doesn\'t define, or a relationship type a concept manifest uses that the firmware lacks; the refusal names each file and its problem. Nothing is written');
const NO_ASSISTANT = D('no-assistant', 409, 'The instance has no assistant key, whose pubkey every firmware node\'s address carries');

const OUTCOMES = ['added', 'changed', 'unchanged', 'kept', 'put-back', 'not-in-source', 'blocked'];
const count = (description) => ({ type: 'integer', minimum: 0, description });
const REL = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    from: { type: 'string', description: 'The address of the node it runs from' },
    to: { type: 'string', description: 'The address of the node it runs to' },
    properties: { type: 'object', description: "Its properties, such as ENUMERATES' sourcePath and destinationPath" },
    noRecord: { type: 'boolean', description: 'For a kept one, true when no installed-firmware graph records it as installed' },
    missing: { type: 'boolean', description: 'For a kept one, true when it isn\'t there: taken out since it was installed' },
    was: { type: 'object', description: 'For a kept one that is there, its properties as they are' },
  },
};
const RELS = (description) => ({ type: 'array', items: REL, description });

/** The firmware's version as the instance carries it, and what a version input may say for it. */
function versionsCarried(dir, version) {
  const fs = require('fs');
  const names = new Set([version, `v${version}`]);
  try { names.add(path.basename(fs.realpathSync(dir))); } catch { /* the folder's name is only another spelling */ }
  return names;
}

/** The answer's note, in words. */
function noteOf({ version, counts, rels, wrote, letterOutOfDate, cacheOutOfDate }) {
  if (!wrote) {
    if (!counts.kept && !rels.kept.length) return `Nothing changed: the graph already holds firmware ${version} as its files say.`;
    return `Nothing changed: the graph already holds firmware ${version} as its files say, but for what was kept: ${counts.kept} node${counts.kept === 1 ? '' : 's'} and ${rels.kept.length} relationship${rels.kept.length === 1 ? '' : 's'}. Name a kept node in take, or pass takeAll, to bring them in line.`;
  }
  const said = OUTCOMES.filter((o) => counts[o]).map((o) => `${counts[o]} ${o}`).join(', ');
  const words = [`Firmware ${version} installed from its files, unsigned: ${said}. Relationships: ${rels.added.length} added, ${rels.removed.length} removed, ${rels.changed.length} changed, ${rels.kept.length} kept.`];
  if (counts.kept) words.push('A kept node was edited since it was installed, or today\'s install made it differently: name it in take, or pass takeAll, to bring it in line.');
  if (letterOutOfDate.length) words.push(`${letterOutOfDate.length} written node${letterOutOfDate.length === 1 ? ' keeps' : 's keep'} an older letter until export nostr signs a new one.`);
  if (cacheOutOfDate) words.push(`The cache of ${cacheOutOfDate} node${cacheOutOfDate === 1 ? '' : 's'} could not be rebuilt; cache rebuild can.`);
  words.push('Nothing was signed or sent to any relay.');
  return words.join(' ');
}

module.exports = {
  group: 'lifecycle',
  name: 'seed-firmware',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Install or update the built-in concepts as the instance\'s own nodes, unsigned, keeping local edits',
  description: [
    'Installs the firmware the instance carries as nodes of its own, at the addresses today\'s install gives them, under the instance\'s assistant, with no letter: nothing is signed or sent to any relay, and no guard runs. Today\'s install, POST /api/firmware/install, stays the install, and signs as it writes.',
    'Run again, it brings each node in line with the firmware unless it was edited since it was installed: an edited node is **kept** as it is, and the answer names what differs (its JSON, its name, or a tag type such as a re-pointed b). A node today\'s install made has no record of what was installed: it is adopted when it matches, and kept when it differs. Name kept nodes in `take`, by tapestryKey or address, or pass `takeAll`, to bring them in line anyway. Graph-rule\'s items always follow the rulebook, an edit put back. A node the firmware no longer has is left as it is (`not-in-source`); a relationship the last install made that the firmware no longer makes is taken out, and nothing else is.',
    'Each node it writes records where it came from (`cameFrom`, its file) and what was installed (`installed`), which `cache get` answers. It keeps an installed-firmware graph, an element of the graph concept at `39999:<assistant>:installed-firmware`, that `lifecycle status` reads; it lists the relationships it kept apart, which no later install takes out. A node at that address without seed-firmware\'s mark is refused (`address-held`), and nothing is written. A run that changes nothing writes nothing. Then rules check runs over the firmware\'s concepts, and reports what it finds.',
  ].join('\n\n'),
  inputs: {
    version: { schema: { type: 'string', minLength: 1, maxLength: 64 }, required: false, description: 'The firmware to install: the version the instance carries (1.0.0, or its folder\'s name, v1.0.0); left out, that one' },
    take: { schema: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 200 }, maxItems: MAX_TAKE }, required: false, description: `Up to ${MAX_TAKE} kept nodes to bring in line anyway, each by its tapestryKey or address (--take <ref> --take <ref>)` },
    takeAll: { schema: { type: 'boolean' }, required: false, description: 'Bring every kept node and relationship in line' },
  },
  result: {
    description: 'What was installed from, each node\'s outcome but the unchanged, the counts, the relationships, the nodes whose letter is out of date, how many caches failed, rules check, the change entry and a note',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', description: 'The firmware installed' },
        source: { type: 'object', description: "What it was installed from: { kind: 'files', digest, files }, each file by its path in the firmware with its sha256" },
        nodes: {
          type: 'array',
          description: 'Each node whose outcome isn\'t unchanged',
          items: {
            type: 'object',
            properties: {
              outcome: { type: 'string', enum: OUTCOMES },
              tapestryKey: { type: 'string', nullable: true },
              address: { type: 'string' },
              role: { type: 'string', nullable: true, description: "Its role: conceptHeader, a core node's (superset, jsonSchema, …), element, set or relationshipLetter" },
              file: { type: 'string', nullable: true, description: 'The firmware file it comes from' },
              parts: { type: 'array', items: { type: 'string' }, description: "For a kept node, what differs from what was installed (or from the firmware, with noRecord): name, json, or tags:<type>" },
              fromSource: { type: 'array', items: { type: 'string' }, description: 'For a kept node with a record, what differs from the firmware' },
              noRecord: { type: 'boolean', description: 'For a kept node, true when it has no record of what was installed' },
            },
          },
        },
        counts: { type: 'object', description: 'How many nodes had each outcome', properties: Object.fromEntries(OUTCOMES.map((o) => [o, count(`Nodes ${o}`)])) },
        relationships: {
          type: 'object',
          properties: {
            added: RELS('Made'), removed: RELS('Taken out: the last install made it and the firmware no longer does'), changed: RELS('Brought in line'),
            kept: RELS('Left as they are: removed or changed since they were installed, or with no record'),
            unchanged: count('Already as the firmware makes them'), others: count("Between two firmware nodes and made by neither list: the instance's own"),
          },
        },
        letterOutOfDate: { type: 'array', items: { type: 'object' }, description: 'The written nodes a letter backs, { address, tapestryKey }: each keeps its old letter until export nostr sends a new one' },
        cacheOutOfDate: count('How many written nodes\' caches could not be rebuilt after the commit'),
        rulesCheck: { type: 'object', description: 'rules check over the firmware\'s concepts: { findings, rules, judged, first, more }' },
        change: CHANGE_ENTRY,
        note: { type: 'string', description: 'What was done, in words' },
      },
    },
  },
  refusals: [UNKNOWN_VERSION, FIRMWARE_UNREADABLE, require('./_seed').NOT_FIRMWARE, NO_ASSISTANT, require('./_seed').ADDRESS_HELD, C.BUSY, C.GRAPH_UNAVAILABLE],

  async run(inputs, context) {
    const K = require('../graph/_concepts');
    const ta = K.assistant();
    if (!ta) throw refusal(NO_ASSISTANT.code, "This instance has no assistant key, whose pubkey every firmware node's address carries, so the firmware can't be installed. Nothing changed.");
    const firmware = require('../../../api/normalize/firmware');
    const { buildTarget } = require('../../../firmware/target');
    const dir = firmware.firmwareDir();
    const target = buildTarget({ dir, ta });
    if (target.problems.length) {
      throw refusal(FIRMWARE_UNREADABLE.code, `The firmware the instance carries (${dir}) can't be installed: ${target.problems.join('; ')}. Nothing changed.`);
    }
    if (inputs.version !== undefined && !versionsCarried(dir, target.version).has(inputs.version)) {
      throw refusal(UNKNOWN_VERSION.code, `This instance carries firmware ${target.version}, not ${inputs.version}. Leave version out, or name ${target.version}. Nothing changed.`, { input: 'version' });
    }

    const S = require('./_seed');
    const store = require('./_store');
    const graph = require('../../graph');
    const lock = await C.begin('seed-firmware');
    try {
      const at = new Date().toISOString();
      const caller = context && context.caller;
      const { p, wrote } = await graph.writeTransaction(async (tx) => {
        // The lock every concept write takes first, when the firmware's concept-header is there (Decision 10).
        await tx.run('MATCH (n:NostrEvent|TapestryNode {uuid: $uuid}) SET n.tapestryLock = true REMOVE n.tapestryLock', { uuid: `39998:${ta}:concept-header` });
        const state = await S.readState((cypher, params) => tx.read(cypher, params), target);
        const planned = S.plan(target, state, { take: inputs.take, takeAll: inputs.takeAll === true });
        return { p: planned, wrote: planned.writes ? await S.apply(tx, target, state, planned, { caller, at }) : null };
      });
      const cacheOutOfDate = wrote ? await S.refreshCache(wrote.written) : 0;
      const rulesCheck = await S.rulesCheck(target);
      const entries = [...p.nodes, ...p.notInSource];
      const counts = Object.fromEntries(OUTCOMES.map((o) => [o, entries.filter((e) => e.outcome === o).length]));
      const rels = S.relationshipsAnswer(p.relationships);
      const letterOutOfDate = wrote ? wrote.letterOutOfDate : [];
      return {
        version: target.version,
        source: target.source,
        nodes: entries.filter((e) => e.outcome !== 'unchanged').map((e) => ({
          outcome: e.outcome, tapestryKey: e.tapestryKey || null, address: e.address, role: e.role || null, file: e.file || null,
          ...(e.parts ? { parts: e.parts } : {}), ...(e.fromSource ? { fromSource: e.fromSource } : {}), ...(e.noRecord ? { noRecord: true } : {}),
          ...(e.heldBy ? { heldBy: e.heldBy } : {}),
        })),
        counts,
        relationships: rels,
        letterOutOfDate,
        cacheOutOfDate,
        rulesCheck,
        change: wrote ? wrote.change : null,
        note: noteOf({ version: target.version, counts, rels, wrote: !!wrote, letterOutOfDate, cacheOutOfDate }),
      };
    } finally {
      store.releaseLock(lock.runId);
    }
  },
};
