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

module.exports = { ensureUuidIndexOnBoot, CREATE_INDEX };
