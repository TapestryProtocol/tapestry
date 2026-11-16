'use strict';
/**
 * What today's create-concept route makes, for story graph-operations-first-slice #16's AC2 ("the names, slugs, key,
 * description and word-wrapper JSON that today's create-concept gives the same name and plural").
 *
 * It runs the route's own code, not a copy of it: handleCreateConcept and the name functions before it are read from
 * src/api/normalize/index.js and run in a sandbox (node:vm), where signing, the relay and Neo4j are replaced by
 * recorders. So the oracle can't drift from the route: when the route changes, this changes with it, and when the route
 * moves, this fails, saying where it looked.
 *
 *   todaysConcept({ name, plural?, description?, ta })
 *     → { answer, events: [{ uuid, kind, tags }], labels: { [uuid]: [label…] }, wiring: [{ from, to, type }],
 *         memberships: [{ superset, node }], names }
 *   events are the last version of each node the route signs (the core nodes graph and the concept graph are signed
 *   twice); labels are the role labels its SETs add, beside NostrEvent and the import's ListHeader or ListItem;
 *   wiring is each MERGE between two nodes by address; memberships each HAS_ELEMENT from a firmware concept's superset,
 *   which the sandbox gives the address 39999:<ta>:<slug>-superset.
 *   names(singular, plural) runs the route's own deriveAllNames.
 *
 * Nothing here opens Neo4j, a relay, a key or the network.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const REL_NAMES = ['CLASS_THREAD_INITIATION', 'CLASS_THREAD_PROPAGATION', 'CLASS_THREAD_TERMINATION', 'CORE_NODE_JSON_SCHEMA', 'CORE_NODE_PRIMARY_PROPERTY',
  'CORE_NODE_PROPERTIES', 'CORE_NODE_PROPERTY_TREE_GRAPH', 'CORE_NODE_CORE_GRAPH', 'CORE_NODE_CONCEPT_GRAPH', 'PROPERTY_MEMBERSHIP', 'PROPERTY_ENUMERATION'];

let SOURCE = null;
/** The route's code: the name functions and handleCreateConcept, as the file has them. */
function source() {
  if (SOURCE) return SOURCE;
  const src = fs.readFileSync(INDEX, 'utf8');
  const slice = (from, to, what) => {
    const at = src.search(from);
    if (at < 0) throw new Error(`test/helpers/todaysCreateConcept.js can't find ${what} in src/api/normalize/index.js (looked for ${from}); the route moved, so move this oracle with it`);
    const rest = src.slice(at);
    const end = rest.search(to);
    if (end < 0) throw new Error(`test/helpers/todaysCreateConcept.js can't find the end of ${what} in src/api/normalize/index.js (looked for ${to})`);
    return rest.slice(0, end);
  };
  SOURCE = {
    names: slice(/^function toSlugName\(/m, /^async function handleCreateConcept\(/m, 'the name functions'),
    handler: slice(/^async function handleCreateConcept\(/m, /^\/\/ ═+\n\/\/ POST \/api\/normalize\/create-element/m, 'handleCreateConcept'),
  };
  return SOURCE;
}

function rel() {
  const firmware = require(path.join(ROOT, 'src/api/normalize/firmware.js'));
  return Object.fromEntries(REL_NAMES.map((k) => [k, firmware.relAlias(k)]));
}

/** A sandbox with the route's code loaded and recorders in place of what it signs, stores and writes. */
function sandbox(ta) {
  const rec = { imports: new Map(), order: [], writes: [] };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Object, Set, Map, Math, Date, Array, String, Number, Promise,
    getPrivkey: () => new Uint8Array(32),
    nt: () => ({ getPublicKey: () => ta }),
    runCypher: async (q, p) => (/IS_THE_CONCEPT_FOR\]->\(sup:Superset\)/.test(q) && p && p.fwConceptUuid ? [{ supersetUuid: `39999:${ta}:${p.fwConceptUuid.split(':')[2]}-superset` }] : []),
    writeCypher: async (q, p) => { rec.writes.push({ q: String(q).replace(/\s+/g, ' ').trim(), p: p || {} }); return []; },
    randomDTag: () => 'random',
    dtag: require(path.join(ROOT, 'src/lib/dtag.js')),
    signAndFinalize: (t) => ({ ...t, id: null, pubkey: ta, sig: null, created_at: 0 }),
    publishToStrfry: async () => {},
    importEventDirect: async (event, uuid) => { if (!rec.imports.has(uuid)) rec.order.push(uuid); rec.imports.set(uuid, event); },
    firmware: { conceptUuid: (slug) => `39998:${ta}:${slug}` },
    REL: rel(),
  };
  vm.createContext(ctx);
  const { names, handler } = source();
  vm.runInContext(`${names}\n${handler}\nthis.handleCreateConcept = handleCreateConcept; this.deriveAllNames = deriveAllNames;`, ctx, { filename: 'src/api/normalize/index.js (handleCreateConcept, sandboxed)' });
  return { ctx, rec };
}

/** What today's route makes for one name; see the file's header. */
async function todaysConcept({ name, plural, description, ta }) {
  if (typeof ta !== 'string' || !/^[0-9a-f]{64}$/.test(ta)) throw new Error('todaysConcept needs the assistant pubkey, ta');
  const { ctx, rec } = sandbox(ta);
  let answer = null;
  const res = { json(x) { answer = x; return res; }, status() { return res; } };
  const body = { name };
  if (plural !== undefined) body.plural = plural;
  if (description !== undefined) body.description = description;
  await ctx.handleCreateConcept({ body }, res);
  if (!answer || answer.success !== true) throw new Error(`today's create-concept didn't create ${JSON.stringify(name)} in the sandbox: ${JSON.stringify(answer)}`);
  const events = rec.order.map((uuid) => ({ uuid, kind: rec.imports.get(uuid).kind, tags: rec.imports.get(uuid).tags.map((t) => [...t]) }));
  const labels = {};
  const wiring = [];
  const memberships = [];
  for (const w of rec.writes) {
    let m;
    if ((m = w.q.match(/^MATCH \((\w+):NostrEvent\|TapestryNode \{uuid: \$uuid\}\) SET ((?:\w+:\w+(?:, )?)+)$/))) {
      const added = m[2].split(',').map((x) => x.trim().split(':')[1]);
      labels[w.p.uuid] = [...new Set([...(labels[w.p.uuid] || []), ...added])];
      continue;
    }
    if ((m = w.q.match(/MERGE \(a\)-\[:(\w+)\]->\(b\)/))) { wiring.push({ from: w.p.from, to: w.p.to, type: m[1] }); continue; }
    if (/MERGE \(sup\)-\[:\w+\]->\(node\)/.test(w.q)) { memberships.push({ superset: w.p.supersetUuid, node: w.p.nodeUuid }); continue; }
    throw new Error(`test/helpers/todaysCreateConcept.js doesn't know a write today's route made: ${w.q}`);
  }
  return { answer, events, labels, wiring, memberships };
}

/** Today's route's own deriveAllNames(singular, plural). */
function names(singular, plural) {
  const { ctx } = sandbox('00'.repeat(32));
  return JSON.parse(JSON.stringify(ctx.deriveAllNames(singular, plural)));
}

module.exports = { todaysConcept, names };
