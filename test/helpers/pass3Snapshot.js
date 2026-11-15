'use strict';
/**
 * A fingerprint of what Pass 3 leaves in a scratch container's concept graph (graph-operations-foundation #8, AC5):
 * the cached Tapestry JSON of each firmware node (the TA's, and the tag concepts' under ADR 0015's literal pubkey)
 * with one of the seven labels Pass 3 rebuilds, the JSON schemas'
 * json tags (where apply-enumerations writes), and each superset's HAS_ELEMENT targets (what wire-implicit-elements
 * wires). Comparable across instances: the TA pubkey reads as <TA>, a tapestryKey as the address of the node holding
 * it, and the times (derivedAt, lastValidated, updatedAt) and the slugs inside node references are left out, since
 * those depend on when a node was rebuilt and in what order, not on what the rebuild found.
 *
 *   TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/pass3Snapshot.js > test/fixtures/pass-3-snapshot-today.json
 *
 * The baseline in test/fixtures/ was captured from today's code (before the fix) on a freshly booted scratch stack.
 * It is tied to the firmware it was taken with: the check skips, saying so, when the container's firmware differs.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { cypher, http, sh, taPubkey } = require('./scratchLoopback');

/** The firmware's own authors on every instance: the TA, and the literal pubkey ADR 0015 keeps for the tag concepts. */
function firmwareAuthors(ta) {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/api/profile-tags/index.js'), 'utf8');
  const legacy = (src.match(/LEGACY_Z_TAG_PUBKEY\s*=\s*'([0-9a-f]{64})'/) || [])[1];
  if (!legacy) throw new Error('LEGACY_Z_TAG_PUBKEY not found in src/api/profile-tags/index.js');
  return [ta, legacy];
}

const LABELS = ['ListItem', 'ListHeader', 'ConceptHeader', 'JSONSchema', 'Property', 'Set', 'Superset'];
const TIMES = new Set(['derivedAt', 'lastValidated', 'updatedAt']);

function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function firmwareDigest() {
  return sh('cd /usr/local/lib/node_modules/brainstorm/firmware/active && find -L . -type f | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-64').trim();
}

const hash8 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
const ADDRESS = /\b\d+:[0-9a-f]{64}:[^\s"',\]\}]+/g;

/**
 * A name for each address that is the same on every instance. An address is kind:pubkey:d-tag, and the pubkey is the
 * instance's TA, which reads as <TA>. A child's d-tag ends in hash8(its parent's address) (src/lib/dtag.js), which
 * the TA changes too: that suffix reads as #<the parent's own name>, found by hashing every address. A d-tag that is a
 * hash of something else (the relationship items, "X IS_A_SUPERSET_OF Y") reads as the node's name, which is the same
 * everywhere.
 */
function addressNames(ta, rows) {
  const byHash = new Map();
  for (const { u } of rows) byHash.set(hash8(u), u);
  const nameOf = new Map(rows.map((r) => [r.u, r.name]));
  const memo = new Map();
  const canon = (u, depth = 0) => {
    if (memo.has(u)) return memo.get(u);
    const [kind, pubkey, ...rest] = u.split(':');
    const who = pubkey === ta ? '<TA>' : pubkey;
    const dtag = rest.join(':');
    const m = dtag.match(/^(.*?)(?:^|-)([0-9a-f]{8})(~\d+)?$/);
    let out = `${kind}:${who}:${dtag}`;
    if (m && byHash.has(m[2]) && byHash.get(m[2]) !== u && depth < 20) out = `${kind}:${who}:${m[1]}-#${canon(byHash.get(m[2]), depth + 1)}${m[3] || ''}`;
    else if (m && !m[1] && nameOf.get(u)) out = `${kind}:${who}:name=${nameOf.get(u)}`;
    memo.set(u, out);
    return out;
  };
  return canon;
}

function snapshot() {
  const ta = taPubkey();
  const addressed = cypher('MATCH (n) WHERE n.uuid IS NOT NULL RETURN n.uuid AS u, n.tapestryKey AS k, n.name AS name');
  const canon = addressNames(ta, addressed);
  const keyToUuid = new Map(addressed.filter((r) => r.k != null).map((r) => [r.k, r.u]));
  const known = new Set(addressed.map((r) => r.u));
  const text = (s) => s.replace(ADDRESS, (a) => (known.has(a) ? canon(a) : a)).split(ta).join('<TA>');
  const norm = (x) => {
    if (typeof x === 'string') return keyToUuid.has(x) ? `@${canon(keyToUuid.get(x))}` : text(x);
    if (Array.isArray(x)) {
      const out = x.map(norm);
      // Node references ({ tapestryKey, slug }) and schema entries ({ uuid, tapestryKey, … }) come back in the
      // database's order; compare them as sets.
      if (x.length && x.every((y) => y && typeof y === 'object' && !Array.isArray(y) && 'tapestryKey' in y)) return out.sort((a, b) => (stable(a) < stable(b) ? -1 : 1));
      return out;
    }
    if (x && typeof x === 'object') {
      const isRef = 'tapestryKey' in x && Object.keys(x).every((k) => k === 'tapestryKey' || k === 'slug');
      const out = {};
      for (const [k, v] of Object.entries(x)) {
        if (TIMES.has(k) || (isRef && k === 'slug')) continue;
        out[k] = norm(v);
      }
      return out;
    }
    return x;
  };

  // The firmware's own nodes only: a community header fetched at install can change upstream between two captures.
  const authors = firmwareAuthors(ta);
  const nodes = {};
  const rows = cypher(`MATCH (n) WHERE (${LABELS.map((l) => `n:${l}`).join(' OR ')}) AND split(n.uuid, ':')[1] IN $authors AND n.tapestryKey IS NOT NULL
                       RETURN n.uuid AS u, n.tapestryKey AS k ORDER BY u`, { authors });
  for (const { u, k } of rows) {
    const r = http('GET', `/api/tapestry-key/${encodeURIComponent(k)}`);
    const env = r.status === 200 && r.json && r.json.data ? r.json.data : null;
    nodes[canon(u)] = env ? sha(stable({ rebuiltFrom: env.rebuiltFrom || null, data: norm(env.data) })) : 'not cached';
  }

  const schemas = {};
  for (const { u, v } of cypher(`MATCH (js:JSONSchema)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) WHERE split(js.uuid, ':')[1] IN $authors
                                 RETURN js.uuid AS u, t.value AS v ORDER BY u`, { authors })) {
    let value = v;
    try { value = norm(JSON.parse(v)); } catch { value = typeof v === 'string' ? text(v) : v; }
    schemas[canon(u)] = sha(stable(value));
  }

  const implicit = {};
  for (const { s, e } of cypher(`MATCH (sup:Superset)-[:HAS_ELEMENT]->(x) WHERE split(sup.uuid, ':')[1] IN $authors
                                 RETURN sup.uuid AS s, collect(coalesce(x.uuid, 'no address')) AS e ORDER BY s`, { authors })) {
    implicit[canon(s)] = e.map((x) => (known.has(x) ? canon(x) : text(x))).sort();
  }

  return { firmwareDigest: firmwareDigest(), counts: { nodes: Object.keys(nodes).length, schemas: Object.keys(schemas).length, supersets: Object.keys(implicit).length }, nodes, schemas, implicit };
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(snapshot(), null, 1)}\n`); } catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = { snapshot, firmwareDigest, LABELS };
