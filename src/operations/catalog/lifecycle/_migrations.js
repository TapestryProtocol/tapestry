'use strict';
/**
 * The migrations lifecycle migrate can run — ADR graph-operations-foundation/0003 Decisions 3, 4 and 5. A helper of the
 * lifecycle operations.
 *
 * Each entry is { name, summary, requires, plan(system), apply(plan, system, progress) }:
 *   plan     only reads; resolves { applied, changes, needsBackup, details }
 *   apply    makes the changes and resolves the migration's report
 *   progress(fields) writes { stage, … } into the run's file, so status can show a running migration
 *
 * Whether a migration is applied is read from the graph each time, never recorded (Sub-decision 2), so a restore of a
 * graph from before a migration reads as not migrated. A later migration is a new entry here, with no change to the
 * operation. Nothing is required at load.
 */

const { LABEL, KEY_RULE, UUID_INDEX } = require('../../../lib/tapestry-key-cypher');

const MAX_PASSES = 3;
const KEYS_BATCH = 10000;
const RELABEL_BATCH = 1000;
const INDEX_POLL_MS = 2000;
const INDEX_WAIT_MS = 30 * 60 * 1000;
const SHARED_LIMIT = 100;
const ADDRESSES_SHOWN = 20;

const num = (rows, key) => {
  const row = (rows && rows[0]) || {};
  const v = key in row ? row[key] : Object.values(row)[0];
  return Number(v) || 0;
};
const read = (system, q, params) => system.cypher(q, params || {});
const write = (system, q, params) => system.cypher(q, params || {}, { write: true });

// ── The schema (Decision 1) ──────────────────────────────────────────────────────────────────────────────────────

/** Whether the rule and the index are in place, by their definitions, and whether each is online. */
async function readSchema(system) {
  const constraints = await read(system, `SHOW CONSTRAINTS WHERE name = '${KEY_RULE}'`);
  const indexes = await read(system, `SHOW INDEXES WHERE name IN ['${KEY_RULE}', '${UUID_INDEX}']`);
  const on = (row, label, prop) => row && [].concat(row.labelsOrTypes || []).join() === label && [].concat(row.properties || []).join() === prop;
  const rule = constraints.find((c) => c.name === KEY_RULE);
  const ruleIndex = indexes.find((i) => i.name === KEY_RULE);
  const uuidIndex = indexes.find((i) => i.name === UUID_INDEX);
  const rulePresent = !!rule && /UNIQUENESS/i.test(String(rule.type)) && on(rule, LABEL, 'tapestryKey');
  const indexPresent = !!uuidIndex && on(uuidIndex, LABEL, 'uuid');
  return {
    rulePresent,
    indexPresent,
    // A rule or index of the same name with another definition: CREATE … IF NOT EXISTS would change nothing.
    taken: { rule: (!!rule && !rulePresent) || (!rule && !!ruleIndex), index: !!uuidIndex && !indexPresent },
    rule: rulePresent && !!ruleIndex && ruleIndex.state === 'ONLINE',
    index: indexPresent && uuidIndex.state === 'ONLINE',
    states: { rule: ruleIndex ? ruleIndex.state : null, index: uuidIndex ? uuidIndex.state : null },
  };
}

// ── Counting keys (Decisions 4 and 7) ────────────────────────────────────────────────────────────────────────────

/** The whole graph's counts: nodes, nodes with the label, nodes with no key ('{}' is none), and nulls alone. */
async function countKeys(system) {
  const nodes = num(await read(system, 'MATCH (n) RETURN count(n) AS nodes'), 'nodes');
  const withLabel = num(await read(system, `MATCH (n:${LABEL}) RETURN count(n) AS withLabel`), 'withLabel');
  const withoutKey = num(await read(system, "MATCH (n) WHERE n.tapestryKey IS NULL OR n.tapestryKey = '{}' RETURN count(n) AS withoutKey"), 'withoutKey');
  return { nodes, withLabel, withoutKey };
}

/** What a pass leaves: nodes with no key, and nodes with no label other than those whose key is skipped. */
async function leftToDo(system, skip) {
  const withoutKey = num(await read(system, "MATCH (n) WHERE n.tapestryKey IS NULL OR n.tapestryKey = '{}' RETURN count(n) AS withoutKey"), 'withoutKey');
  const withoutLabel = num(await read(system, `MATCH (n) WHERE NOT n:${LABEL} AND NOT coalesce(n.tapestryKey, '') IN $skip RETURN count(n) AS withoutLabel`, { skip }), 'withoutLabel');
  return { withoutKey, withoutLabel };
}

/**
 * Keys held by more than one node, at most 100 of them, each with up to ten element ids. With the rule in place, the
 * labelled keys are unique already, so only unlabelled nodes are read, each against the rule's index.
 */
async function sharedKeys(system, ruleInPlace) {
  const rows = ruleInPlace
    ? await read(system, `MATCH (n) WHERE NOT n:${LABEL} AND n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}'
        OPTIONAL MATCH (m:${LABEL} {tapestryKey: n.tapestryKey})
        WITH n.tapestryKey AS k, collect(DISTINCT elementId(n)) + collect(DISTINCT elementId(m)) AS holders
        WITH k, holders, size(holders) AS c WHERE c > 1
        RETURN k, c, holders[..10] AS ids LIMIT ${SHARED_LIMIT}`)
    : await read(system, `MATCH (n) WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}'
        WITH n.tapestryKey AS k, collect(elementId(n))[..10] AS ids, count(*) AS c WHERE c > 1
        RETURN k, c, ids LIMIT ${SHARED_LIMIT}`);
  return rows.map((r) => ({ key: String(r.k), count: Number(r.c), nodes: [].concat(r.ids || []).map(String) }));
}

/** The counts status shows (Decision 7), from a tapestry-keys plan: the whole graph's keys, and the rule and index. */
function keyCountsOf(plan) {
  const { before, schema } = plan.details;
  return { nodes: before.nodes, withLabel: before.withLabel, withoutKey: before.withoutKey, rule: schema.rule, index: schema.index };
}

// ── tapestry-keys (Decision 4) ───────────────────────────────────────────────────────────────────────────────────

/**
 * Reads the counts and the schema. Applied needs the rule, so with no rule the whole-graph search for shared keys
 * can't change the answer: it runs only for `apply` ({ full: true }), once, or when the rule is in place, when it
 * reads only the unlabelled nodes. The '{}' count is apply's too.
 */
async function planKeys(system, { full = false } = {}) {
  const counts = await countKeys(system);
  const schema = await readSchema(system);
  const shared = full || schema.rule ? await sharedKeys(system, schema.rule) : null;
  const nullKeys = full ? num(await read(system, 'MATCH (n) WHERE n.tapestryKey IS NULL RETURN count(n) AS nullKeys'), 'nullKeys') : null;
  const withoutLabel = counts.nodes - counts.withLabel;
  const applied = counts.withoutKey === 0 && withoutLabel === 0 && schema.rule && schema.index && !!shared && shared.length === 0;
  return {
    applied,
    needsBackup: counts.withoutKey > 0 || withoutLabel > 0,
    changes: {
      keys: counts.withoutKey,
      labels: withoutLabel,
      placeholders: nullKeys === null ? null : Math.max(0, counts.withoutKey - nullKeys),
      rule: !schema.rule,
      index: !schema.index,
    },
    details: { before: counts, schema, sharedKeys: shared },
  };
}

/**
 * One pass: the label and a key where either is missing, never replacing a real key; '{}' gives way to a key, and its
 * cache stamp goes with it. A key in `skip` (shared, with the rule in place) is left alone, so no batch fails on it.
 * The two FOREACHes set the key in a clause of its own, after the stamp is read against the old key.
 */
async function runKeysPass(system, skip) {
  const rows = await write(system, `CALL apoc.periodic.iterate(
    "MATCH (n) WHERE (NOT n:${LABEL} OR n.tapestryKey IS NULL OR n.tapestryKey = '{}') AND NOT coalesce(n.tapestryKey, '') IN $skip RETURN n",
    "SET n:${LABEL}
     FOREACH (_ IN CASE WHEN n.tapestryKey = '{}' THEN [1] ELSE [] END | REMOVE n.tapestryJsonUpdatedAt)
     FOREACH (_ IN CASE WHEN n.tapestryKey IS NULL OR n.tapestryKey = '{}' THEN [1] ELSE [] END | SET n.tapestryKey = randomUUID())",
    {batchSize: ${KEYS_BATCH}, parallel: false, retries: 3, params: {skip: $skip}})
    YIELD batches, total, committedOperations, failedOperations, failedBatches, errorMessages
    RETURN batches, total, committedOperations, failedOperations, failedBatches, errorMessages`, { skip });
  const r = (rows && rows[0]) || {};
  return {
    failedBatches: Number(r.failedBatches) || 0,
    failedOperations: Number(r.failedOperations) || 0,
    errors: Object.keys(r.errorMessages || {}).slice(0, 3),
  };
}

/** Make the rule and the index, then wait until both are online (Decision 4 step 2). */
async function addSchema(system, schema, progress) {
  const taken = [schema.taken.rule && KEY_RULE, schema.taken.index && UUID_INDEX].filter(Boolean);
  if (taken.length) {
    throw new Error(`${taken.join(' and ')} already name${taken.length === 1 ? 's' : ''} a rule or index with another definition, so it can't be added; every key was given. Drop it (DROP CONSTRAINT or DROP INDEX) and run tapestry-keys again`);
  }
  if (!schema.rulePresent) await write(system, `CREATE CONSTRAINT ${KEY_RULE} IF NOT EXISTS FOR (n:${LABEL}) REQUIRE n.tapestryKey IS UNIQUE`);
  if (!schema.indexPresent) await write(system, `CREATE INDEX ${UUID_INDEX} IF NOT EXISTS FOR (n:${LABEL}) ON (n.uuid)`);
  const start = Date.now();
  for (;;) {
    const now = await readSchema(system);
    if (now.rule && now.index) return now;
    if (Date.now() - start > INDEX_WAIT_MS) {
      throw new Error(`the rule ${KEY_RULE} and the index ${UUID_INDEX} weren't online within ${INDEX_WAIT_MS / 60000} minutes (now ${now.states.rule || 'missing'} and ${now.states.index || 'missing'}); every key was given, and running tapestry-keys again waits for them`);
    }
    progress({ stage: 'indexing', rule: now.states.rule, index: now.states.index });
    await system.sleep(INDEX_POLL_MS);
  }
}

async function applyKeys(plan, system, progress) {
  const { before, schema, sharedKeys: shared } = plan.details;
  const skip = schema.rule ? shared.map((s) => s.key) : [];
  let left = await leftToDo(system, skip);
  const start = left;
  let passes = 0;
  let failedBatches = 0;
  const errors = [];
  while ((left.withoutKey > 0 || left.withoutLabel > 0) && passes < MAX_PASSES) {
    passes++;
    progress({ stage: 'keys', pass: passes, withoutKey: left.withoutKey, withoutLabel: left.withoutLabel });
    const r = await runKeysPass(system, skip);
    failedBatches += r.failedBatches;
    for (const e of r.errors) if (errors.length < 3 && !errors.includes(e)) errors.push(e);
    left = await leftToDo(system, skip);
  }

  let rule = schema.rule ? 'already-there' : 'left-out';
  let index = schema.index ? 'already-there' : 'left-out';
  if (!shared.length && !(schema.rule && schema.index)) {
    progress({ stage: 'indexing' });
    await addSchema(system, schema, progress);
    if (!schema.rule) rule = 'added';
    if (!schema.index) index = 'added';
  }
  const after = await countKeys(system);
  // keysGiven and labelsGiven: what was left when the passes began, less what is left at the end. A node made without
  // a key while it ran (a writer still on the old code) and keyed by a later pass doesn't add to them.
  const report = {
    before,
    after,
    keysGiven: Math.max(0, start.withoutKey - left.withoutKey),
    labelsGiven: Math.max(0, start.withoutLabel - left.withoutLabel),
    placeholdersReplaced: plan.changes.placeholders,
    passes,
    failedBatches,
    rule,
    index,
    sharedKeys: shared,
  };
  if (errors.length) report.errors = errors;
  return report;
}

/** The answer's words for a tapestry-keys report. */
function describeKeys(report) {
  const words = [`Gave ${report.keysGiven} node${report.keysGiven === 1 ? '' : 's'} a tapestryKey and ${report.labelsGiven} the label ${LABEL}, in ${report.passes} pass${report.passes === 1 ? '' : 'es'}.`];
  if (report.placeholdersReplaced) words.push(`${report.placeholdersReplaced} of those keys replaced the '{}' placeholder.`);
  if (report.after.withoutKey) words.push(`${report.after.withoutKey} node${report.after.withoutKey === 1 ? ' still has' : 's still have'} no key (made while it ran); running it again keys them.`);
  if (report.failedBatches) words.push(`${report.failedBatches} batch${report.failedBatches === 1 ? '' : 'es'} failed and ${report.failedBatches === 1 ? 'was' : 'were'} picked up by a later pass.`);
  if (report.sharedKeys.length) {
    const list = report.sharedKeys.slice(0, 5).map((s) => `${s.key} (${s.count} nodes: ${s.nodes.join(', ')})`).join('; ');
    words.push(`Some keys are held by more than one node, so none of them was changed and the uniqueness rule ${KEY_RULE} and the index ${UUID_INDEX} were left out, for the owner to decide: ${list}${report.sharedKeys.length > 5 ? `; and ${report.sharedKeys.length - 5} more` : ''}.`);
  } else {
    const said = { added: 'added', 'already-there': 'already there' };
    words.push(`The uniqueness rule ${KEY_RULE} is ${said[report.rule] || report.rule} and the index ${UUID_INDEX} ${said[report.index] || report.index}, both online.`);
  }
  return words.join(' ');
}

// ── event-less-nodes (Decision 5) ────────────────────────────────────────────────────────────────────────────────

const EVENT_LESS = `MATCH (n:NostrEvent) WHERE n.id IS NULL AND n:${LABEL} AND (n)-[:HAS_TAG]->()`;

async function planEventLess(system) {
  const count = num(await read(system, `${EVENT_LESS} RETURN count(n) AS eventLess`), 'eventLess');
  return { applied: count === 0, needsBackup: count > 0, changes: { relabel: count }, details: { count } };
}

async function applyEventLess(plan, system, progress) {
  const addresses = (await read(system, `${EVENT_LESS} RETURN n.uuid AS uuid ORDER BY uuid LIMIT ${ADDRESSES_SHOWN}`)).map((r) => r.uuid);
  progress({ stage: 'relabel', nodes: plan.details.count });
  const rows = await write(system, `CALL apoc.periodic.iterate(
    "${EVENT_LESS} RETURN n",
    "REMOVE n:NostrEvent",
    {batchSize: ${RELABEL_BATCH}, parallel: false, retries: 3})
    YIELD batches, total, committedOperations, failedOperations, failedBatches, errorMessages
    RETURN batches, total, committedOperations, failedOperations, failedBatches, errorMessages`);
  const r = (rows && rows[0]) || {};
  const report = { relabelled: Number(r.committedOperations) || 0, addresses };
  if (Number(r.failedOperations)) report.failed = Number(r.failedOperations);
  return report;
}

function describeEventLess(report) {
  const n = report.relabelled;
  const words = [`Took the label NostrEvent off ${n} event-less node${n === 1 ? '' : 's'} (sets made with no event); each keeps its key, its other labels and its fields, and an event published for it later gives the label back.`];
  if (report.failed) words.push(`${report.failed} could not be changed; running it again picks them up.`);
  return words.join(' ');
}

// ── The list ─────────────────────────────────────────────────────────────────────────────────────────────────────

const MIGRATIONS = [
  {
    name: 'tapestry-keys',
    summary: `Give every node a tapestryKey and the label ${LABEL}, then add the uniqueness rule ${KEY_RULE} and the index ${UUID_INDEX}`,
    requires: [],
    plan: planKeys,
    apply: applyKeys,
    describe: describeKeys,
  },
  {
    name: 'event-less-nodes',
    summary: 'Take the label NostrEvent off nodes that came from no event (sets made by add-subset), keeping their key and their other labels',
    requires: ['tapestry-keys'],
    plan: planEventLess,
    apply: applyEventLess,
    describe: describeEventLess,
  },
];

const names = () => MIGRATIONS.map((m) => m.name);
const byName = (name) => MIGRATIONS.find((m) => m.name === name) || null;

module.exports = { MIGRATIONS, names, byName, keyCountsOf, readSchema };
