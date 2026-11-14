'use strict';
/**
 * relationship-type-allowed: a relationship the owner or an admin adds or removes has a type the graph declares, and
 * not one reserved for another operation or the nostr import (story graph-operations-foundation #4, AC2; ADR
 * graph-operations-foundation/0004 Decision 6 and Amendment 1). Its entry in the rules document is docs/GRAPH_RULES.md.
 *
 * Its items are { type, from, to }. For each, in this order:
 *   reserved    the type is one firmware declares (read from the active firmware's relationship type elements, so a
 *               type a later firmware adds is reserved with no edit here), or one the instance's own code writes
 *               (CODE_MADE): refused reserved-type, naming what makes it, even when the graph declares it;
 *   declared    otherwise the type must be the alias of an element in the class thread of this instance's
 *               relationship type concept, 39998:<TA>:relationship-type, read from each element's json tag (an LMDB
 *               reference resolved as src/lib/derivers/word.js does): refused undeclared-type if not.
 * Any element in that class thread counts, whoever wrote it: the rule asks only whether the owner's graph knows the
 * type. Which declarations are trusted is a question for whoever reads and ranks them, per point of view.
 */

const NAME = 'relationship-type-allowed';
const CONCEPT_SLUG = 'relationship-type';

/** What the instance's own code writes that firmware doesn't declare, and what makes each (ADR Context 4, Amendment 1). */
const CODE_MADE = Object.freeze({
  INHERITS_FROM: 'import nostr, from a b tag',
  FOLLOWS: 'the trust pipeline, from follow lists',
  MUTES: 'the trust pipeline, from mute lists',
  REPORTS: 'the trust pipeline, from reports',
  TAGS: 'the tagging-edges pass',
  PROVIDED_THE_TEMPLATE_FOR: 'graph copy-node',
  IMPORT: 'graph merge-nodes (BIBLE §10, rule 8)',
  SUPERCEDES: 'graph merge-nodes (BIBLE §10, rule 8)',
  SPECIFIC_INSTANCE: "each customer's cards",
  WOT_METRICS_CARDS: "each customer's cards",
  SERVES: "the second brain's goals",
});

/** What makes the types firmware declares: by type where the catalog names an operation, else by category. */
const FIRMWARE_MADE = Object.freeze({
  IS_THE_CONCEPT_FOR: 'graph create-concept',
  IS_A_SUPERSET_OF: 'graph link-set and create-set',
  HAS_ELEMENT: 'graph add-to-concept and create-element',
  IS_A_PROPERTY_OF: 'graph add-property',
  ENUMERATES: 'graph enumerate',
});
const BY_CATEGORY = Object.freeze({
  coreNodeWiring: 'graph create-concept',
  classThread: 'graph create-concept, link-set or add-to-concept',
  propertyTree: 'graph add-property or enumerate',
  nostr: 'import nostr',
});

let firmwareReserved = null;
/** { alias: what makes it } for every relationship type the active firmware declares. Read once. */
function firmwareTypes() {
  if (firmwareReserved) return firmwareReserved;
  const fs = require('fs');
  const path = require('path');
  const firmware = require('../../api/normalize/firmware');
  const out = {};
  const add = (rt) => {
    if (!rt || typeof rt.alias !== 'string' || !rt.alias) return;
    out[rt.alias] = FIRMWARE_MADE[rt.alias] || BY_CATEGORY[rt.category] || 'firmware';
  };
  const entry = (firmware.getManifest().concepts || []).find((c) => c && c.slug === CONCEPT_SLUG);
  if (entry) {
    const dir = path.join(firmware.firmwareDir(), entry.dir, 'elements');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
        try { add(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).relationshipType); } catch { /* a broken file declares nothing */ }
      }
    }
  }
  for (const data of Object.values(firmware.allRelationshipTypes() || {})) add(data && data.relationshipType);
  firmwareReserved = Object.freeze(out);
  return firmwareReserved;
}

/** What makes `type` when it is reserved, or null. */
function reservedBy(type) {
  if (Object.prototype.hasOwnProperty.call(CODE_MADE, type)) return CODE_MADE[type];
  const fw = firmwareTypes();
  return Object.prototype.hasOwnProperty.call(fw, type) ? fw[type] : null;
}

/** The handle of this instance's relationship type concept, or null with no assistant pubkey. */
function conceptHandle() {
  const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
  const ta = getOwnerAssistantPubkey();
  return ta ? `39998:${ta}:${CONCEPT_SLUG}` : null;
}

/** The relationship type a declared element's json names, or null. */
function aliasOf(raw) {
  if (raw === null || raw === undefined) return null;
  let data = raw;
  if (typeof raw === 'string') {
    const { isLmdbRef, resolveValue } = require('../../lib/tapestry-resolve');
    if (isLmdbRef(raw)) data = resolveValue(raw);
    else {
      try { data = JSON.parse(raw); } catch { return null; }
    }
  }
  const rt = data && typeof data === 'object' ? data.relationshipType : null;
  return rt && typeof rt.alias === 'string' && rt.alias ? rt.alias : null;
}

/** { found: boolean, aliases: Set } — the types the graph declares, read through `read`. */
async function declaredTypes(read, handle) {
  if (!handle) return { found: false, aliases: new Set() };
  const firmware = require('../../api/normalize/firmware');
  const INIT = firmware.relAlias('CLASS_THREAD_INITIATION');
  const PROP = firmware.relAlias('CLASS_THREAD_PROPAGATION');
  const TERM = firmware.relAlias('CLASS_THREAD_TERMINATION');
  const header = await read('MATCH (h:NostrEvent|TapestryNode {uuid: $handle}) WHERE h:ConceptHeader RETURN h.uuid AS uuid', { handle });
  if (!header.length) return { found: false, aliases: new Set() };
  const rows = await read(
    `MATCH (h:NostrEvent|TapestryNode {uuid: $handle}) WHERE h:ConceptHeader
     MATCH (h)-[:${INIT}]->(:Superset)-[:${PROP}*0..]->()-[:${TERM}]->(e)
     WITH DISTINCT e
     OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
     RETURN e.tapestryKey AS key, t.value AS json`,
    { handle },
  );
  const aliases = new Set();
  for (const r of rows) {
    const alias = aliasOf(r.json);
    if (alias) aliases.add(alias);
  }
  return { found: true, aliases };
}

module.exports = {
  name: NAME,
  summary: 'A relationship the owner or an admin adds or removes has a type the graph declares, and not one reserved for another operation or the nostr import.',
  refuses: true,
  refusals: [
    { code: 'undeclared-type', status: 409, when: 'The relationship type is not one the graph declares as an element of its relationship type concept' },
    { code: 'reserved-type', status: 409, when: 'The relationship type is reserved for another operation, or for the nostr import, which make it with the checks it needs' },
  ],

  async violations(items, read) {
    const out = [];
    let declared = null;
    let handle;
    for (const item of items || []) {
      const type = item && typeof item.type === 'string' ? item.type : '';
      const maker = reservedBy(type);
      if (maker) {
        out.push({ item, code: 'reserved-type', message: `${type} is reserved: ${maker} makes it, with the checks it needs. graph add-relationship and remove-relationship take only a relationship type an owner or admin declares.` });
        continue;
      }
      if (!declared) { handle = conceptHandle(); declared = await declaredTypes(read, handle); }
      if (declared.aliases.has(type)) continue;
      out.push({
        item,
        code: 'undeclared-type',
        message: declared.found
          ? `${type} isn't a relationship type this graph declares. Declare it first, as an element of the relationship type concept (${handle}), then add relationships of it.`
          : `${type} isn't declared: this instance's relationship type concept${handle ? ` (${handle})` : ''} isn't in the graph, so it declares no types. Install the firmware first.`,
      });
    }
    return out;
  },
};
