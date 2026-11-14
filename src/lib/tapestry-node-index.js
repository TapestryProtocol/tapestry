'use strict';
/**
 * The index `tapestry_node_uuid` at control-panel start (ADR graph-operations-foundation/0003 Amendment 1).
 *
 * Lookups by address match `(:NostrEvent|TapestryNode {uuid: …})` (Decision 9). Between a deploy and the first run of
 * `lifecycle migrate`, keyNode labels every node the pipeline touches, so without this index each such lookup would
 * scan them all. The control panel calls ensureUuidIndexOnBoot when it starts, without waiting on it. It makes the
 * index only, never the uniqueness rule `tapestry_key` (migrate's, AC2), and changes no data.
 *
 * It needs no driver of its own: the caller passes runRead and runWrite, so it loads and is tested stack-free.
 */

const { LABEL, UUID_INDEX } = require('./tapestry-key-cypher');

const CREATE_INDEX = `CREATE INDEX ${UUID_INDEX} IF NOT EXISTS FOR (n:${LABEL}) ON (n.uuid)`;
const SHOW_INDEX = `SHOW INDEXES WHERE name = '${UUID_INDEX}'`;
// The errors of a graph that is starting, or whose password the entrypoint is still setting (as tagging-edges' hook).
const RETRY_CODES = Object.freeze(['ServiceUnavailable', 'SessionExpired', 'Neo.ClientError.Security.Unauthorized', 'Neo.ClientError.Security.AuthenticationRateLimit']);
const retriable = (err) => {
  const code = err && typeof err.code === 'string' ? err.code : '';
  return code.startsWith('Neo.TransientError.') || RETRY_CODES.includes(code);
};
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Is the row the index Decision 1 names: on TapestryNode, over uuid? */
const isOurs = (row) => [].concat(row.labelsOrTypes || []).join() === LABEL && [].concat(row.properties || []).join() === 'uuid';

/**
 * Make tapestry_node_uuid when it is missing. Retries the graph's start-up errors, waiting 5 s and doubling to 60 s,
 * for up to `windowMs`; stops at any other error. Logs one line when it does anything other than find the index there.
 * Never throws, never rejects, never drops anything.
 * → Promise<{ outcome: 'present' | 'created' | 'not-created' | 'gave-up', code? }>
 */
async function ensureUuidIndexOnBoot({ runWrite, runRead, log = () => {}, sleep = sleepMs, windowMs = 30 * 60 * 1000 } = {}) {
  const say = (m) => { try { log(m); } catch { /* never throw */ } };
  try {
    let waited = 0;
    let delay = 5000;
    for (;;) {
      try {
        const rows = (await runRead(SHOW_INDEX, {})) || [];
        const row = rows.find((r) => r && r.name === UUID_INDEX);
        if (row && isOurs(row)) return { outcome: 'present' };
        if (row) {
          say(`[tapestry-keys] index ${UUID_INDEX} not created: name-taken (the name ${UUID_INDEX} is held by an index with another definition)`);
          return { outcome: 'not-created', code: 'name-taken' };
        }
        await runWrite(CREATE_INDEX, {});
        say(`[tapestry-keys] index ${UUID_INDEX} created (on ${LABEL}.uuid, for lookups by address; it comes online by itself)`);
        return { outcome: 'created' };
      } catch (err) {
        const code = (err && err.code) || 'no-status';
        if (!retriable(err)) {
          say(`[tapestry-keys] index ${UUID_INDEX} not created: ${code}`);
          return { outcome: 'not-created', code };
        }
        if (waited + delay > windowMs) {
          say(`[tapestry-keys] index ${UUID_INDEX} not created: ${code} (gave up after ${Math.round(waited / 1000)} s)`);
          return { outcome: 'gave-up', code };
        }
        await sleep(delay);
        waited += delay;
        delay = Math.min(delay * 2, 60000);
      }
    }
  } catch (err) {
    say(`[tapestry-keys] index ${UUID_INDEX} not created: ${(err && err.code) || 'no-status'}`);
    return { outcome: 'not-created', code: (err && err.code) || 'no-status' };
  }
}

/**
 * The change entries' indexes (story graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 5):
 * graph_change_at on GraphChange.at, which graph history orders by and filters since a time with, and
 * graph_change_by on GraphChange.byPubkey, which it filters by who with. Made at control-panel start, as
 * tapestry_node_uuid is, with the same retries: each one that is missing, never one whose name another definition holds.
 */
const CHANGE_INDEXES = Object.freeze([
  Object.freeze({ name: 'graph_change_at', label: 'GraphChange', property: 'at' }),
  Object.freeze({ name: 'graph_change_by', label: 'GraphChange', property: 'byPubkey' }),
]);
const createChangeIndex = (ix) => `CREATE INDEX ${ix.name} IF NOT EXISTS FOR (c:${ix.label}) ON (c.${ix.property})`;
const SHOW_CHANGE_INDEXES = `SHOW INDEXES WHERE name IN [${CHANGE_INDEXES.map((ix) => `'${ix.name}'`).join(', ')}]`;
const definedAs = (row, ix) => [].concat(row.labelsOrTypes || []).join() === ix.label && [].concat(row.properties || []).join() === ix.property;

/**
 * Make each of the change entries' indexes that is missing. Retries the graph's start-up errors as
 * ensureUuidIndexOnBoot does; stops at any other error. Never throws, never rejects.
 * → Promise<{ outcome: 'present' | 'created' | 'not-created' | 'gave-up', created?: string[], code? }>
 */
async function ensureChangeIndexesOnBoot({ runWrite, runRead, log = () => {}, sleep = sleepMs, windowMs = 30 * 60 * 1000 } = {}) {
  const say = (m) => { try { log(m); } catch { /* never throw */ } };
  const names = CHANGE_INDEXES.map((ix) => ix.name).join(' and ');
  try {
    let waited = 0;
    let delay = 5000;
    for (;;) {
      try {
        const rows = (await runRead(SHOW_CHANGE_INDEXES, {})) || [];
        const created = [];
        const taken = [];
        for (const ix of CHANGE_INDEXES) {
          const row = rows.find((r) => r && r.name === ix.name);
          if (row && definedAs(row, ix)) continue;
          if (row) { taken.push(ix.name); continue; }
          await runWrite(createChangeIndex(ix), {});
          created.push(ix.name);
        }
        if (created.length) say(`[graph-changes] index ${created.join(' and ')} created (on GraphChange, for graph history; it comes online by itself)`);
        if (taken.length) {
          say(`[graph-changes] index ${taken.join(' and ')} not created: name-taken (the name is held by an index with another definition)`);
          return { outcome: 'not-created', code: 'name-taken', created };
        }
        return { outcome: created.length ? 'created' : 'present', created };
      } catch (err) {
        const code = (err && err.code) || 'no-status';
        if (!retriable(err)) {
          say(`[graph-changes] index ${names} not created: ${code}`);
          return { outcome: 'not-created', code };
        }
        if (waited + delay > windowMs) {
          say(`[graph-changes] index ${names} not created: ${code} (gave up after ${Math.round(waited / 1000)} s)`);
          return { outcome: 'gave-up', code };
        }
        await sleep(delay);
        waited += delay;
        delay = Math.min(delay * 2, 60000);
      }
    }
  } catch (err) {
    say(`[graph-changes] index ${names} not created: ${(err && err.code) || 'no-status'}`);
    return { outcome: 'not-created', code: (err && err.code) || 'no-status' };
  }
}

module.exports = { ensureUuidIndexOnBoot, ensureChangeIndexesOnBoot, CREATE_INDEX, CHANGE_INDEXES };
