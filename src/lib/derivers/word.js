/**
 * Generic Word Deriver — computes tapestryJSON for any word node.
 *
 * Produces:
 *   - word (universal): slug, name, wordTypes
 *   - graphContext: identifiers, elementOf, parentJsonSchemas, derivedAt
 *
 * This is the base deriver for nodes that don't have a more specific one
 * (Set, Superset, etc.). It does NOT include set-specific fields like
 * elements, childSets, or parentSets.
 *
 * parentJsonSchemas holds the rule element-fits-schema's verdicts on the tapestryJson built here, through the one check
 * the rule uses, against the concepts the rule judges (./schema-verdicts.js; story graph-operations-first-slice #42; ADR
 * graph-operations-first-slice/0042 Decision 5). A derive pass passes ctx.judge, one checker for all its nodes.
 *
 * The owner's sections kept beside another author's letter or firmware's definition (the node property
 * tapestryOwnSections, which graph add-to-concept writes) are laid over the base before the word block and graphContext
 * are built, so a node's tapestryJson holds them, and the rule judges them there (story graph-operations-first-slice
 * #22; ADR graph-operations-first-slice/0022 Decision 6 and Amendment 1, item 12).
 */

const { runCypher } = require('../neo4j-driver');
const store = require('../tapestry-store');
const { resolveValue, isLmdbRef } = require('../tapestry-resolve');
const { schemaVerdicts } = require('./schema-verdicts');

/**
 * Resolve the concept-scoped slug for a node from its tapestryJSON in LMDB.
 */
function resolveSlug(tapestryKey) {
  if (!tapestryKey) return null;
  const entry = store.get(tapestryKey);
  const data = entry?.data;
  if (!data) return null;

  for (const key of Object.keys(data)) {
    if (key === 'word' || key === 'graphContext') continue;
    if (data[key]?.slug) return data[key].slug;
  }
  return data.word?.slug || null;
}

function nodeRef(row) {
  return { tapestryKey: row.tapestryKey, slug: resolveSlug(row.tapestryKey) };
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
 * Derive tapestryJSON for a generic word node.
 */
async function deriveWord(node, ctx = {}) {
  const { uuid, tapestryKey, name, labels, elementId } = node;

  const existing = await getExistingWordJson(node) || {};
  // The owner's sections beside the letter (ADR graph-operations-first-slice/0022 Decision 6). Sections that can't be
  // read are left out, so the node still derives from its letter.
  const { overlaySections, ownSectionsOf } = require('../../operations/catalog/graph/_fields');
  const own = ownSectionsOf(node.tapestryOwnSections).sections;
  const base = own ? overlaySections(existing, own) : existing;

  // ── word section ──
  if (!base.word) base.word = {};
  base.word.slug = base.word.slug || node.slug || deriveSlug(name);
  base.word.name = base.word.name || name || null;
  if (!base.word.wordTypes) {
    base.word.wordTypes = ['word'];
  }

  // ── elementOf ──
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
  // lifecycle seed-firmware's cameFrom and installed, from the node's own properties, never from an older copy.
  for (const k of RECORD_SECTIONS) {
    delete base[k];
    const v = recordSection(node[k]);
    if (v) base[k] = v;
  }

  // ── Build graphContext first ──
  const now = Math.floor(Date.now() / 1000);

  base.graphContext = {
    identifiers: {
      tapestryKey,
      uuid,
    },
    elementOf: {
      direct: directElementOf.map(nodeRef),
      indirect: indirectElementOf.map(nodeRef),
    },
    parentJsonSchemas: [],
    derivedAt: now,
  };

  // ── The rule's verdicts on this tapestryJson (ADR graph-operations-first-slice/0042 Decision 5) ──
  base.graphContext.parentJsonSchemas = await schemaVerdicts({ tapestryKey, json: base, judge: ctx.judge || null, now });

  return base;
}

module.exports = deriveWord;
