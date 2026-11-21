/**
 * Set Deriver — computes tapestryJSON for Set and Superset nodes.
 *
 * Structure (per glossary/graph-context.md):
 *   - word (universal): slug, name, description, wordTypes, coreMemberOf
 *   - set (concept-scoped): slug, name — present because this is a Set
 *   - superset (concept-scoped): slug, name — present if this is a Superset
 *   - graphContext (local, never shared):
 *       identifiers { tapestryKey, uuid }
 *       parentSets { direct[], indirect[] }
 *       childSets { direct[], indirect[] }
 *       elements { direct[], indirect[] }
 *       elementOf { direct[], indirect[] }
 *       parentJsonSchemas[]
 *       derivedAt
 *
 * Node references in graphContext use { tapestryKey, slug } where slug
 * is resolved from the referenced node's tapestryJSON (concept-scoped slug),
 * NOT from Neo4j node properties.
 *
 * parentJsonSchemas holds the rule element-fits-schema's verdicts on the tapestryJson built here, through the one check
 * the rule uses, against the concepts the rule judges (./schema-verdicts.js; story graph-operations-first-slice #42; ADR
 * graph-operations-first-slice/0042 Decision 5). A derive pass passes ctx.judge, one checker for all its nodes.
 */

const { runCypher } = require('../neo4j-driver');
const store = require('../tapestry-store');
const { resolveValue, isLmdbRef } = require('../tapestry-resolve');
const { schemaVerdicts } = require('./schema-verdicts');

async function getExistingWordJson(node) {
  const existing = store.get(node.tapestryKey);
  if (existing?.data?.word) return existing.data;

  const rows = await runCypher(`
    MATCH (n) WHERE elementId(n) = $elementId
    MATCH (n)-[:HAS_TAG]->(tag { type: 'json' })
    RETURN tag.value AS value
    LIMIT 1
  `, { elementId: node.elementId });

  if (rows.length === 0 || !rows[0].value) return null;
  const raw = rows[0].value;

  if (isLmdbRef(raw)) {
    const resolved = resolveValue(raw);
    return resolved?.word ? resolved : null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.word ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the concept-scoped slug for a node from its tapestryJSON in LMDB.
 * Looks through all top-level keys (excluding word, graphContext) for a .slug field.
 * Falls back to word.slug if no concept-scoped slug found.
 */
function resolveSlug(tapestryKey) {
  if (!tapestryKey) return null;
  const entry = store.get(tapestryKey);
  const data = entry?.data;
  if (!data) return null;

  // Look for concept-scoped slug (first non-word, non-graphContext key with a slug)
  for (const key of Object.keys(data)) {
    if (key === 'word' || key === 'graphContext') continue;
    if (data[key]?.slug) return data[key].slug;
  }
  // Fall back to word.slug
  return data.word?.slug || null;
}

/** Map a query row to a nodeRef { tapestryKey, slug }. */
function nodeRef(row) {
  return {
    tapestryKey: row.tapestryKey,
    slug: resolveSlug(row.tapestryKey),
  };
}

function deriveSlug(name) {
  if (!name) return null;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** The node properties lifecycle seed-firmware records, each JSON text (ADR graph-operations-first-slice/0037 Decision 6). */
const RECORD_SECTIONS = ['cameFrom', 'installed'];
/** A record property, parsed; null when there is none or it can't be read. */
function recordSection(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  try { const v = JSON.parse(value); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

async function deriveSet(node, ctx = {}) {
  const { uuid, tapestryKey, name, labels, elementId } = node;
  const isSuperset = labels.includes('Superset');

  const base = await getExistingWordJson(node) || {};

  // ── word section ──
  const wordTypes = ['word'];
  if (isSuperset) wordTypes.push('superset');
  wordTypes.push('set');

  if (!base.word) base.word = {};
  base.word.slug = base.word.slug || node.slug || deriveSlug(name);
  base.word.name = base.word.name || name || null;
  base.word.wordTypes = wordTypes;

  // ── Concept-scoped blocks ──
  if (!base.set) base.set = {};
  base.set.slug = base.set.slug || deriveSlug(name);
  base.set.name = base.set.name || name || null;

  if (isSuperset) {
    if (!base.superset) base.superset = {};
    base.superset.slug = base.superset.slug || deriveSlug(name);
    base.superset.name = base.superset.name || name || null;
  }

  // ── Graph queries (return tapestryKey only — slugs resolved from LMDB) ──
  // Each starts from the set itself, by its element id: a direct lookup, where a match on its uuid with no label read
  // every node in the graph (graph-operations-foundation #8).

  const directElements = await runCypher(`
    MATCH (s) WHERE elementId(s) = $elementId
    MATCH (s)-[:HAS_ELEMENT]->(e)
    RETURN e.tapestryKey AS tapestryKey
  `, { elementId });

  const indirectElements = await runCypher(`
    MATCH (s) WHERE elementId(s) = $elementId
    MATCH (s)-[:IS_A_SUPERSET_OF*1..10]->(child)-[:HAS_ELEMENT]->(e)
    WHERE NOT (s)-[:HAS_ELEMENT]->(e)
    RETURN DISTINCT e.tapestryKey AS tapestryKey
  `, { elementId });

  const directChildSets = await runCypher(`
    MATCH (s) WHERE elementId(s) = $elementId
    MATCH (s)-[:IS_A_SUPERSET_OF]->(child)
    RETURN child.tapestryKey AS tapestryKey
  `, { elementId });

  const indirectChildSets = await runCypher(`
    MATCH (s) WHERE elementId(s) = $elementId
    MATCH (s)-[:IS_A_SUPERSET_OF*2..10]->(child)
    WHERE NOT (s)-[:IS_A_SUPERSET_OF]->(child)
    RETURN DISTINCT child.tapestryKey AS tapestryKey
  `, { elementId });

  const directParentSets = await runCypher(`
    MATCH (s) WHERE elementId(s) = $elementId
    MATCH (parent)-[:IS_A_SUPERSET_OF]->(s)
    RETURN parent.tapestryKey AS tapestryKey
  `, { elementId });

  const indirectParentSets = await runCypher(`
    MATCH (s) WHERE elementId(s) = $elementId
    MATCH (parent)-[:IS_A_SUPERSET_OF*2..10]->(s)
    WHERE NOT (parent)-[:IS_A_SUPERSET_OF]->(s)
    RETURN DISTINCT parent.tapestryKey AS tapestryKey
  `, { elementId });

  const directElementOf = await runCypher(`
    MATCH (n) WHERE elementId(n) = $elementId
    MATCH (parent)-[:HAS_ELEMENT]->(n)
    RETURN parent.tapestryKey AS tapestryKey
  `, { elementId });

  const indirectElementOf = await runCypher(`
    MATCH (n) WHERE elementId(n) = $elementId
    MATCH (parent)-[:HAS_ELEMENT]->(n)
    MATCH (ancestor)-[:IS_A_SUPERSET_OF*1..10]->(parent)
    WHERE NOT (ancestor)-[:HAS_ELEMENT]->(n)
    RETURN DISTINCT ancestor.tapestryKey AS tapestryKey
  `, { elementId });

  // ── The install record (ADR graph-operations-first-slice/0037 Decision 6) ──
  // lifecycle seed-firmware's cameFrom and installed, from the node's own properties, only when it carries them: in a
  // node with none, a section of either name may be a concept's own, and stays as it is (Amendment 3, item 6).
  const record = [];
  for (const k of RECORD_SECTIONS) {
    const v = recordSection(node[k]);
    if (v) { base[k] = v; record.push(k); }
  }

  // ── Build graphContext first (before validation) ──
  const now = Math.floor(Date.now() / 1000);

  base.graphContext = {
    identifiers: { tapestryKey, uuid },
    parentSets: {
      direct: directParentSets.map(nodeRef),
      indirect: indirectParentSets.map(nodeRef),
    },
    childSets: {
      direct: directChildSets.map(nodeRef),
      indirect: indirectChildSets.map(nodeRef),
    },
    elements: {
      direct: directElements.map(nodeRef),
      indirect: indirectElements.map(nodeRef),
    },
    elementOf: {
      direct: directElementOf.map(nodeRef),
      indirect: indirectElementOf.map(nodeRef),
    },
    parentJsonSchemas: [],
    derivedAt: now,
  };

  // Remove old artifacts, before the verdicts, so they judge what is stored (review round 1, non-blocking 4)
  if (base['x-tapestry']?.derived) {
    delete base['x-tapestry'].derived;
    if (Object.keys(base['x-tapestry']).length === 0) {
      delete base['x-tapestry'];
    }
  }

  // ── The rule's verdicts on this tapestryJson (ADR graph-operations-first-slice/0042 Decision 5) ──
  base.graphContext.parentJsonSchemas = await schemaVerdicts({ tapestryKey, json: base, judge: ctx.judge || null, now, record });

  return base;
}

module.exports = deriveSet;
