/**
 * Tapestry Derivation Engine — computes tapestryJSON for nodes by type.
 *
 * The engine maintains a registry of derivation functions, keyed by Neo4j label.
 * When deriveNode() is called, it picks the most specific matching function
 * based on the node's labels, runs it, stores the result in LMDB, and
 * updates tapestryJsonUpdatedAt in Neo4j.
 *
 * Usage:
 *   const { deriveNode, deriveByKey, deriveAll } = require('../lib/tapestry-derive');
 *
 *   // Derive a single node by tapestryKey
 *   const result = await deriveByKey('a3f7c2d1-...');
 *
 *   // Derive all nodes of a given label
 *   const results = await deriveAll('Set');
 *
 * Adding new derivation functions:
 *   Register them in the `derivers` map below. The key is a Neo4j label.
 *   Priority: most specific label wins (Set > ListItem > NostrEvent).
 */

const { runCypher, writeCypher } = require('./neo4j-driver');
const store = require('./tapestry-store');

// ── Derivation Registry ──

/**
 * Map of Neo4j label → async derivation function.
 * Each function receives { uuid, tapestryKey, name, labels, ...props }
 * and returns a plain JS object to store as tapestryJSON.
 */
const derivers = new Map();

/**
 * Label priority — higher number = more specific = preferred.
 * Labels not listed default to priority 0.
 */
const labelPriority = {
  NostrEvent: 0,
  NostrEventTag: 0,
  ListItem: 1,
  ListHeader: 2,
  Set: 3,
  Superset: 4,
  ConceptHeader: 5,
  JSONSchema: 5,
  Property: 5,
  NostrUser: 5,
};

/**
 * Register a derivation function for a label.
 * @param {string} label - Neo4j label
 * @param {Function} fn - async (node) => object
 */
function registerDeriver(label, fn) {
  derivers.set(label, fn);
}

/**
 * Pick the best deriver for a node based on its labels.
 * Returns { label, fn } or null if no deriver matches.
 */
function pickDeriver(labels) {
  let best = null;
  let bestPriority = -1;
  for (const label of labels) {
    if (derivers.has(label)) {
      const p = labelPriority[label] ?? 0;
      if (p > bestPriority) {
        best = { label, fn: derivers.get(label) };
        bestPriority = p;
      }
    }
  }
  return best;
}

// ── Core Engine ──

/**
 * What a deriver reads of a node, and the node's element id. Every query of a rebuild starts from the node itself
 * (`MATCH (n) WHERE elementId(n) = $elementId`, a direct lookup), so no query reads the whole graph to find it:
 * 3.85 million nodes on staging since `tapestry-keys` (graph-operations-foundation #8).
 */
const NODE_FIELDS = `n.tapestryKey AS tapestryKey, n.uuid AS uuid, n.name AS name,
           n.slug AS slug, n.kind AS kind, n.pubkey AS pubkey,
           labels(n) AS labels, elementId(n) AS elementId`;

/**
 * Find a node by its tapestryKey. The rule tapestry_key indexes the keys of every TapestryNode node. An instance that
 * hasn't run `tapestry-keys` yet still has keyed nodes without that label, so a miss falls back to the lookup with no
 * label, which reads every node (ADR graph-operations-foundation/0003, Decision 9).
 */
async function findByKey(tapestryKey) {
  const rows = await runCypher(`MATCH (n:TapestryNode {tapestryKey: $key}) RETURN ${NODE_FIELDS}`, { key: tapestryKey });
  if (rows.length > 0) return rows[0];
  const unlabelled = await runCypher(`MATCH (n {tapestryKey: $key}) RETURN ${NODE_FIELDS}`, { key: tapestryKey });
  return unlabelled[0] || null;
}

/**
 * Derive tapestryJSON for a single node.
 * @param {{ tapestryKey: string, uuid: string, labels: string[], elementId?: string, ... }} node
 * @returns {{ tapestryKey, derivedBy, envelope }|null}
 */
async function deriveNode(node) {
  const deriver = pickDeriver(node.labels || []);
  if (!deriver) return null;

  // The derivers' queries start from the node's element id; a caller that has only its key gets it here.
  if (!node.elementId) {
    const found = await findByKey(node.tapestryKey);
    if (!found) return null;
    node = { ...node, elementId: found.elementId };
  }

  const data = await deriver.fn(node);
  if (!data) return null;

  const envelope = await store.put(node.tapestryKey, data, {
    rebuiltFrom: `derive:${deriver.label}`,
  });

  // Update Neo4j timestamp, on the node itself
  await writeCypher(`
    MATCH (n) WHERE elementId(n) = $elementId AND n.tapestryKey = $key
    SET n.tapestryJsonUpdatedAt = $ts
  `, { elementId: node.elementId, key: node.tapestryKey, ts: envelope.updatedAt });

  return { tapestryKey: node.tapestryKey, derivedBy: deriver.label, envelope };
}

/**
 * Derive tapestryJSON for a node identified by its tapestryKey.
 * Fetches the node from Neo4j, then delegates to deriveNode().
 */
async function deriveByKey(tapestryKey) {
  const node = await findByKey(tapestryKey);
  if (!node) return null;
  return deriveNode(node);
}

/**
 * Derive tapestryJSON for all nodes with a given label.
 * Returns { derived, skipped, errors }.
 */
async function deriveAll(label) {
  if (!derivers.has(label)) {
    return { derived: 0, skipped: 0, errors: 0, message: `No deriver registered for label: ${label}` };
  }

  // The nodes with a key and an address (a uuid or an id), as the cache counts count them (story
  // graph-operations-foundation #7): the concept graph's nodes. Since `tapestry-keys` every node has a key, and the
  // trust pipeline's SetOfNostrUserWotMetricsCards carry the label Set with no address; nothing reads a Tapestry JSON
  // for them, and there were 370,377 on staging (graph-operations-foundation #8).
  const rows = await runCypher(`
    MATCH (n:${label})
    WHERE n.tapestryKey IS NOT NULL AND (n.uuid IS NOT NULL OR n.id IS NOT NULL)
    RETURN ${NODE_FIELDS}
  `);

  let derived = 0, skipped = 0, errors = 0;

  for (const node of rows) {
    try {
      const result = await deriveNode(node);
      if (result) derived++;
      else skipped++;
    } catch (err) {
      console.error(`[tapestry-derive] Error deriving ${node.tapestryKey}:`, err.message);
      errors++;
    }
  }

  return { derived, skipped, errors, total: rows.length };
}

/**
 * Get a list of registered deriver labels.
 */
function registeredLabels() {
  return [...derivers.keys()];
}

module.exports = {
  registerDeriver,
  pickDeriver,
  deriveNode,
  deriveByKey,
  deriveAll,
  registeredLabels,
};
