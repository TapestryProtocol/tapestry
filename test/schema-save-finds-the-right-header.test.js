'use strict';
/**
 * Saving a concept's schema never lands on another author's header — graph-operations-foundation #10 (a bug).
 *   Story: engineering-team/stories/graph-operations-foundation/10-schema-save-finds-the-right-header.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/10-schema-save-finds-the-right-header.test-plan.md
 *   ADR:   none (the Standard bug path, chosen by the owner on 2026-11-15)
 *
 * Stack-free (every run, CI included). The real code runs in a child process (test/helpers/saveSchemaChild.js) over a
 * fake graph (test/helpers/pathCypherFake.js): POST /api/normalize/save-schema, POST /api/normalize/apply-enumerations,
 * and the firmware install's Pass 2. Where a save landed is read from what the code wrote (the addresses its writes
 * name, and the json it wrote there), not from the query text. "Storage order" is the order the fake meets the nodes
 * in: today's code keeps whichever same-named header comes first, so each check runs in more than one order.
 *   S1a Pass 2 saves the six shared-name firmware concepts' schemas on the instance's own headers (theirs have none)  [AC1]
 *   S1b the same when the other authors' headers have schemas; those are left as they were                       [AC1]
 *   S1c a second header of the instance's own with the same name doesn't take the firmware address's place        [AC1]
 *   S1e a firmware header with two schema nodes: the first by address is saved, and Pass 2's log names it          [AC1]
 *   S2a apply-enumerations saves on the schema it enumerated (another author's same-named header has no schema)   [AC2]
 *   S2b the same when that header has a schema of its own; it is left as it was                                  [AC2]
 *   S2c a second header of the instance's own with the same name doesn't take the enumerated schema's place       [AC2]
 *   S3a sentinel: one header with the name, the instance's own — today's answer                                   [AC3]
 *   S3b sentinel: one header with the name, another author's — today's answer                                     [AC3]
 *   S3c several share the name, one is the instance's own: saved there, in every storage order, the same answer   [AC3]
 *   S3d several share the name, none is the instance's own: nothing changes; the error names them                 [AC3]
 *   S3e several share the name, two are the instance's own: nothing changes; the error names them                 [AC3]
 *   S3f the primary-property record brought up to date in the same call is the saved concept's                   [AC3]
 *   S3g sentinel: no header has the name — today's answer                                                          [AC3]
 *   S3h a header with two schema nodes has the first by address saved, and the fold reconciles against it         [AC3]
 *   (S1b, S3f, S5a and S5b include an author whose addresses sort before the TA's: EARLY < TA < OTHER.)
 *   S4a the Schema tab's two saves send the tapestryKey of the header the page shows                               [AC4]
 *   S4b the client sends the tapestryKey it is given, and without one sends today's body                           [AC4]
 *   S4c a save that names its header by tapestryKey lands on that header's schema                                 [AC4]
 *   S4d a tapestryKey that no node has: nothing changes                                                            [AC4]
 *   S4e the route's documentation lists tapestryKey                                                                [AC4]
 *   S4f sentinel: a concept with no event (graph create-concept's) is refused, by key or by name; nothing signed  [AC4]
 *   S4g a tapestryKey two concept headers hold, or a "{}" placeholder: nothing changes                             [AC4]
 *   S4h a value that isn't a tapestryKey answers 400 and changes nothing                                           [AC4]
 *   S4i a concept whose header or schema node, but not both, came from no event is refused, by key or by name     [AC4]
 *   S5a before tapestry-keys (no TapestryNode label): a save by key lands on its header; the fold reconciles it   [AC4]
 *   S5b before tapestry-keys, no keys at all: a save by name lands on the instance's own header                  [AC3]
 *
 * A caller names the header it means by the header's tapestryKey, which every node has (ADR
 * graph-operations-foundation/0003) and the graph operations name nodes by. The owner chose it at the Test Design gate.
 *
 * Live (only with TAPESTRY_CONTAINER naming a scratch container, tapestry-scratch…; never the shared stack).
 *   L1  on a stack holding the community's "tag" header, a save by name, and one by tapestryKey, reach the TA's own   [AC1, AC3]
 *   L2  [SCHEMA_SAVE_INSTALL=1, a container that has run one install] a second install: Pass 2 logs 0 errors, and the
 *       five tag schemas come out as the first install left them; every other difference is printed for the plan  [AC5]
 *
 *   node test/schema-save-finds-the-right-header.test.js                                          # stack-free only
 *   TAPESTRY_CONTAINER=tapestry-scratch node test/schema-save-finds-the-right-header.test.js      # + L1
 *   TAPESTRY_CONTAINER=tapestry-scratch SCHEMA_SAVE_INSTALL=1 node test/schema-save-finds-the-right-header.test.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const live = require('./helpers/scratchLoopback');

const ROOT = path.resolve(__dirname, '..');
const CHILD = path.join(__dirname, 'helpers/saveSchemaChild.js');
const SCHEMA_TAB = path.join(ROOT, 'ui/src/pages/concepts/ConceptSchema.jsx');
const CONCEPT_PAGE = path.join(ROOT, 'ui/src/pages/concepts/ConceptDetail.jsx');
const UI_CLIENT = path.join(ROOT, 'ui/src/api/normalize.js');
const FIRMWARE = path.join(ROOT, 'firmware/active');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const short = (x, n = 400) => { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
const same = (a, b) => stable(a) === stable(b);
function permutations(xs) {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/* ───────────── who's who ───────────── */

// The fake instance's Tapestry Assistant. Every instance has its own, found at runtime (CLAUDE.md); this one is the test's.
const TA_PRIVKEY = '11'.repeat(32);
const nt = require(path.join(ROOT, 'node_modules/nostr-tools'));
const TA = nt.getPublicKey(Uint8Array.from(Buffer.from(TA_PRIVKEY, 'hex')));
// Another author, with no part in the firmware.
const OTHER = 'ab'.repeat(32);
// An author whose addresses sort before the TA's. On an instance the TA's pubkey is random, so "the first by address"
// and "the instance's own" needn't agree; every other author here sorts after the TA, so without this one a lookup by
// name that orders by address would land on the instance's own by luck (review round 2, Blocking 1).
const EARLY = '00'.repeat(32);
if (!(EARLY < TA && TA < OTHER)) throw new Error(`the fixtures need EARLY < TA < OTHER; the TA is ${TA}`);

const MANIFEST = JSON.parse(fs.readFileSync(path.join(FIRMWARE, 'manifest.json'), 'utf8'));
/** The firmware concepts whose name a community header shares, as the manifest names them (story 10, Background). */
const SHARED = MANIFEST.concepts.filter((c) => c.communityReference).map((c) => {
  const header = JSON.parse(fs.readFileSync(path.join(FIRMWARE, c.dir, c.conceptHeader), 'utf8'));
  const schema = JSON.parse(fs.readFileSync(path.join(FIRMWARE, c.dir, c.jsonSchema), 'utf8'));
  const [, author, dTag] = c.communityReference.headerATag.split(':');
  return { slug: c.slug, name: header.conceptHeader.oNames.singular.toLowerCase(), community: { author, dTag }, firmwareSchema: schema.jsonSchema };
});
const TAG = SHARED.find((c) => c.slug === 'tag');
const TAG_CONCEPTS = SHARED.filter((c) => c.slug !== 'nostr-relay');

/** What save-schema stores for a schema it is given (today's code; unchanged by the story). */
const stored = (schema) => ({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', ...schema });

/* ───────────── the fake graph ───────────── */

/** A tapestryKey as keyNode mints one (a version 4 UUID), made from `seed` so a test's graph is the same every run. */
function keyOf(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * A graph built concept by concept, in storage order. Each concept is laid out as the import lays out an event: a
 * header (kind 39998, ListHeader, and ConceptHeader unless `list`), with d, name and slug tags; its JSON Schema node
 * (IS_THE_JSON_SCHEMA_FOR) with a json tag { word, jsonSchema }, when `schema` is given; and its primary property
 * (IS_THE_PRIMARY_PROPERTY_FOR) with a json tag { word, property }, when `pp` is given. Every node has a tapestryKey and
 * the shared label (ADR graph-operations-foundation/0003); `key` overrides the header's. An `eventless` concept is laid
 * out as graph create-concept makes one (A10.16): its nodes have addresses but no event, so no NostrEvent label and no id.
 */
function makeGraph({ migrated = true, keyed = true } = {}) {
  // `migrated: false` lays the graph out as on an instance that hasn't run tapestry-keys: no node has the shared label.
  // Its concept-graph nodes still hold keys, as POST /api/tapestry-key/initialize stamps them without the label; with
  // `keyed: false` they hold none.
  const nodes = [];
  const rels = [];
  let seq = 0;
  const eid = (p) => `${p}-${seq++}`;
  const shared = migrated ? ['TapestryNode'] : [];
  const keyFor = (seed) => (keyed ? { tapestryKey: keyOf(seed) } : {});
  const node = (labels, props, tags) => {
    const e = eid('n');
    nodes.push({ eid: e, labels: [...labels, ...shared], props: { ...keyFor(props.uuid || e), ...props } });
    for (const [type, value] of tags) {
      const t = eid('t');
      nodes.push({ eid: t, labels: ['NostrEventTag', ...shared], props: { uuid: `tag-${t}`, ...keyFor(`tag-${t}`), type, value } });
      rels.push({ eid: eid('r'), type: 'HAS_TAG', from: e, to: t, props: {} });
    }
    return e;
  };
  const rel = (type, from, to, props = {}) => rels.push({ eid: eid('r'), type, from, to, props });
  const event = (kind, author, dTag, eventless) => ({ uuid: `${kind}:${author}:${dTag}`, kind, pubkey: author, ...(eventless ? {} : { id: `event-${kind}-${author.slice(0, 6)}-${dTag}` }) });

  const g = {
    nodes, rels, eidOf: new Map(),
    concept({ author, dTag, name, list = false, schema, pp, key, eventless = false, eventlessSchema = eventless, twoSchemas }) {
      // `eventlessSchema`: the schema node came from no event, whatever the header did. `twoSchemas`: the header has a
      // second schema node, `<dTag>-json-schema-b`, laid out after the first ('in order') or before it ('reversed').
      const lettered = (labels, none = eventless) => (none ? labels : ['NostrEvent', ...labels]);
      const h = event(39998, author, dTag, eventless);
      const hEid = node(lettered(list ? ['ListHeader'] : ['ListHeader', 'ConceptHeader']), { ...h, name, ...(key !== undefined ? { tapestryKey: key } : {}) },
        [['d', dTag], ['name', name], ['slug', dTag]]);
      g.eidOf.set(h.uuid, hEid);
      const out = { header: h.uuid, key: nodes.find((n) => n.eid === hEid).props.tapestryKey, schema: null, pp: null, all: [h.uuid] };
      const schemaNode = (suffix) => {
        const s = event(39999, author, `${dTag}-json-schema${suffix}`, eventlessSchema);
        const wrapper = { word: { slug: `json-schema-for-the-concept-of-${dTag}`, name: `JSON schema for the concept of ${name}`, wordTypes: ['word', 'jsonSchema'], coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${dTag}`, uuid: h.uuid }] }, jsonSchema: schema };
        const sEid = node(lettered(['ListItem', 'JSONSchema'], eventlessSchema), { ...s, name: `json schema for the concept of ${name}` },
          [['d', s.uuid.split(':')[2]], ['name', `json schema for the concept of ${name}`], ['json', JSON.stringify(wrapper)]]);
        rel('IS_THE_JSON_SCHEMA_FOR', sEid, hEid);
        g.eidOf.set(s.uuid, sEid);
        out.all.push(s.uuid);
        return s.uuid;
      };
      if (schema) {
        if (twoSchemas === 'reversed') out.secondSchema = schemaNode('-b');
        out.schema = schemaNode('');
        if (twoSchemas === 'in order') out.secondSchema = schemaNode('-b');
      }
      if (pp) {
        const p = event(39999, author, `${dTag}-primary-property`, eventless);
        const wrapper = { word: { slug: `primary-property-for-the-concept-of-${dTag}`, name: `primary property for the concept of ${name}`, wordTypes: ['word', 'property'] }, property: pp };
        const pEid = node(lettered(['ListItem', 'Property']), { ...p, name: `primary property for the concept of ${name}` },
          [['d', p.uuid.split(':')[2]], ['name', `primary property for the concept of ${name}`], ['json', JSON.stringify(wrapper)]]);
        rel('IS_THE_PRIMARY_PROPERTY_FOR', pEid, hEid);
        g.eidOf.set(p.uuid, pEid);
        out.pp = p.uuid;
        out.all.push(p.uuid);
      }
      return out;
    },
    /** A superset with elements, enumerating `schemaUuid` at `destinationPath` (an ENUMERATES edge, as Pass 3 finds it). */
    enumeration({ author, dTag, names, schemaUuid, destinationPath }) {
      const sup = event(39999, author, dTag);
      const supEid = node(['NostrEvent', 'ListItem', 'Superset'], { ...sup, name: dTag }, [['d', dTag], ['name', dTag]]);
      for (const n of names) {
        const e = event(39999, author, `${dTag}-${n}`);
        const elEid = node(['NostrEvent', 'ListItem'], { ...e, name: n }, [['d', `${dTag}-${n}`], ['name', n]]);
        rel('HAS_ELEMENT', supEid, elEid);
      }
      rel('ENUMERATES', supEid, g.eidOf.get(schemaUuid), { destinationPath });
      return sup.uuid;
    },
  };
  return g;
}

/** Builds one graph from parts given in storage order: each part is (graph) => the concept it made. */
function build(parts, opts) {
  const g = makeGraph(opts);
  const made = {};
  for (const [name, part] of parts) made[name] = part(g);
  return { graph: { nodes: g.nodes, rels: g.rels }, made, g };
}

/* ───────────── the child ───────────── */

// Nothing the child loads may reach a real service: every endpoint it could read points at a closed port. The child
// stubs the database driver; were the stub ever bypassed, the driver reads its address only from the conf file
// (src/lib/neo4j-driver.js, src/utils/config.js), and without one it falls back to bolt://localhost:7687, which on the
// owner's Mac is the agent-memory instance. So the child gets a conf of its own whose Neo4j is a closed port too.
const DEAD_CONF = path.join(require('os').tmpdir(), `schema-save-dead-${process.pid}.conf`);
fs.writeFileSync(DEAD_CONF, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
process.on('exit', () => { try { fs.unlinkSync(DEAD_CONF); } catch { /* already gone */ } });
const DEAD = { BRAINSTORM_CONF_PATH: DEAD_CONF, TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };

function child(scenario) {
  const r = spawnSync(process.execPath, [CHILD], {
    input: JSON.stringify({ taPrivkey: TA_PRIVKEY, ...scenario }),
    encoding: 'utf8', env: { ...process.env, ...DEAD }, maxBuffer: 64 << 20, timeout: 120000,
  });
  const at = (r.stdout || '').lastIndexOf('@@RESULT@@');
  assert(at >= 0, `the child process printed no result (exit ${r.status}): ${short(r.stderr || r.stdout, 800)}`);
  const out = JSON.parse(r.stdout.slice(at + 10).split('\n')[0]);
  assert(!out.error, `the schema-save code threw in the child process: ${short(out.error, 1000)}`);
  assert(out.taPubkey === TA, `the child's Tapestry Assistant is ${out.taPubkey}, not the test's ${TA}`);
  return out;
}

/** Every address a run's writes name: the node each write lands on. */
const writtenTo = (out) => new Set(out.writes.flatMap((w) => [w.params.uuid, w.params.eventUuid]).filter((x) => typeof x === 'string'));
/** The json a run last wrote on a node, parsed; undefined when it wrote none there. */
function savedJson(out, uuid) {
  const ws = out.writes.filter((w) => w.params.eventUuid === uuid && w.params.type === 'json');
  return ws.length ? JSON.parse(ws[ws.length - 1].params.value) : undefined;
}
/** Why a run failed, for a failure message: its answer, and any read the fake couldn't run. */
const why = (out, answer) => `${short(answer, 500)}${out.unread.length ? ` — reads the fake graph couldn't run: ${short(out.unread, 600)}` : ''}`;
function untouched(out, addresses, what) {
  const hit = [...writtenTo(out)].filter((u) => addresses.includes(u));
  assert(hit.length === 0, `${what} must be left exactly as it was; the run wrote to ${hit.join(', ')}`);
}

/* ───────────── the tests ───────────── */

const tests = [];
const t = (name, fn) => tests.push([name, fn]);

const STARTER = { type: 'object', properties: {} };

t('S1a (AC1): Pass 2 saves the six shared-name concepts\' schemas on the instance\'s own headers, when other authors\' same-named headers have no schema', () => {
  for (const order of ['theirs first', 'own first']) {
    const own = (g) => Object.fromEntries(SHARED.map((c) => [c.slug, g.concept({ author: TA, dTag: c.slug, name: c.name, schema: STARTER })]));
    const theirs = (g) => Object.fromEntries(SHARED.map((c) => [c.slug, g.concept({ author: c.community.author, dTag: c.community.dTag, name: c.name, list: true })]));
    const { graph, made } = build(order === 'theirs first' ? [['theirs', theirs], ['own', own]] : [['own', own], ['theirs', theirs]]);
    const out = child({ kind: 'pass2', graph });
    const pass2 = out.results[0];
    assert(pass2.errors.length === 0, `[${order}] Pass 2 must log no errors; it logged ${pass2.errors.length}: ${why(out, pass2.errors)}`);
    for (const c of SHARED) {
      assert(pass2.updated.includes(c.slug), `[${order}] Pass 2 must enrich ${c.slug}; updated: ${short(pass2.updated)}`);
      const saved = savedJson(out, made.own[c.slug].schema);
      assert(saved && same(saved.jsonSchema, stored(c.firmwareSchema)), `[${order}] ${c.slug}'s schema on ${made.own[c.slug].header} must be the firmware's; ${saved ? `it is ${short(saved.jsonSchema)}` : 'nothing was saved there'}`);
    }
    untouched(out, Object.values(made.theirs).flatMap((x) => x.all), `[${order}] the other authors' headers`);
  }
});

t('S1b (AC1): the same when the other authors\' same-named headers have schemas of their own, which are left as they were', () => {
  // The community's headers sort after the TA's; EARLY's sort before it, as another author's may on any instance.
  const theirSchema = { type: 'object', properties: { theirs: { type: 'string' } } };
  const parts = [
    ['own', (g) => Object.fromEntries(SHARED.map((c) => [c.slug, g.concept({ author: TA, dTag: c.slug, name: c.name, schema: STARTER })]))],
    ['theirs', (g) => Object.fromEntries(SHARED.map((c) => [c.slug, g.concept({ author: c.community.author, dTag: c.community.dTag, name: c.name, list: true, schema: theirSchema })]))],
    ['early', (g) => Object.fromEntries(SHARED.map((c) => [c.slug, g.concept({ author: EARLY, dTag: c.slug, name: c.name, list: true, schema: theirSchema })]))],
  ];
  for (const order of permutations(parts)) {
    const { graph, made } = build(order);
    const label = `order ${order.map(([n]) => n).join(', ')}`;
    const out = child({ kind: 'pass2', graph });
    const pass2 = out.results[0];
    assert(pass2.errors.length === 0, `[${label}] Pass 2 must log no errors; it logged ${pass2.errors.length}: ${why(out, pass2.errors)}`);
    for (const c of SHARED) {
      const saved = savedJson(out, made.own[c.slug].schema);
      assert(saved && same(saved.jsonSchema, stored(c.firmwareSchema)), `[${label}] ${c.slug}'s schema on ${made.own[c.slug].header} must be the firmware's; ${saved ? `it is ${short(saved.jsonSchema)}` : 'nothing was saved there'}`);
    }
    untouched(out, [...Object.values(made.theirs), ...Object.values(made.early)].flatMap((x) => x.all), `[${label}] the other authors' headers and their schemas`);
  }
});

t('S1e (AC1): a firmware header with two schema nodes has the first by address saved, and Pass 2\'s log names that one', () => {
  for (const order of ['in order', 'reversed']) {
    const { graph, made } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: TAG.name, schema: STARTER, twoSchemas: order })]]);
    const out = child({ kind: 'pass2', graph });
    const pass2 = out.results[0];
    assert(pass2.errors.length === 0 && pass2.updated.includes('tag'), `[${order}] Pass 2 must enrich tag with no errors; it answered ${why(out, pass2)}`);
    const saved = savedJson(out, made.own.schema);
    assert(saved && same(saved.jsonSchema, stored(TAG.firmwareSchema)), `[${order}] the firmware's tag schema must be saved on the first schema node by address, ${made.own.schema}`);
    untouched(out, [made.own.secondSchema], `[${order}] the header's second schema node`);
    const logged = out.log.filter((l) => /Schema enriched/.test(l));
    assert(logged.some((l) => l.includes(`(${made.own.schema})`)) && !logged.some((l) => l.includes(`(${made.own.secondSchema})`)),
      `[${order}] Pass 2's log must name the schema node the save wrote, ${made.own.schema}; it logged ${short(logged)}`);
  }
});

t('S1c (AC1): a second header of the instance\'s own named "tag" doesn\'t take the place of 39998:<TA>:tag', () => {
  for (const order of ['twin first', 'firmware first']) {
    const firmwareTag = (g) => g.concept({ author: TA, dTag: 'tag', name: TAG.name, schema: STARTER });
    const twin = (g) => g.concept({ author: TA, dTag: 'tag-made-by-hand', name: TAG.name, schema: { type: 'object', properties: { twin: { type: 'string' } } } });
    const { graph, made } = build(order === 'twin first' ? [['twin', twin], ['firmwareTag', firmwareTag]] : [['firmwareTag', firmwareTag], ['twin', twin]]);
    const out = child({ kind: 'pass2', graph });
    const pass2 = out.results[0];
    assert(pass2.errors.length === 0, `[${order}] Pass 2 must log no errors; it logged ${pass2.errors.length}: ${why(out, pass2.errors)}`);
    const saved = savedJson(out, made.firmwareTag.schema);
    assert(saved && same(saved.jsonSchema, stored(TAG.firmwareSchema)), `[${order}] the firmware's tag schema must be saved on 39998:<TA>:tag's schema; ${saved ? `it is ${short(saved.jsonSchema)}` : 'nothing was saved there'}`);
    untouched(out, made.twin.all, `[${order}] the instance's other header named "tag"`);
  }
});

// apply-enumerations: a superset of kinds enumerates tag.kind on the instance's own tag schema.
const TAG_SCHEMA = { type: 'object', properties: { tag: { type: 'object', properties: { kind: { type: 'string' } } } } };
const KINDS = ['beta', 'alpha'];
const enumerated = (schema) => schema && schema.properties && schema.properties.tag && schema.properties.tag.properties.kind && schema.properties.tag.properties.kind.enum;

function enumerationRun(order, other) {
  const own = (g) => {
    const c = g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: TAG_SCHEMA });
    g.enumeration({ author: TA, dTag: 'kinds-of-tag', names: KINDS, schemaUuid: c.schema, destinationPath: 'tag.kind' });
    return c;
  };
  const { graph, made } = build(order === 'other first' ? [['other', other], ['own', own]] : [['own', own], ['other', other]]);
  const out = child({ kind: 'applyEnumerations', graph, body: {} });
  return { out, made, answer: out.results[0] };
}

function assertEnumeratedOnOwn({ out, made, answer }, order) {
  assert(answer.statusCode === 200 && answer.body && answer.body.success === true, `[${order}] apply-enumerations must answer success; ${why(out, answer)}`);
  assert(answer.body.updated === 1, `[${order}] apply-enumerations must save the one schema it enumerated; it saved ${answer.body.updated}: ${why(out, (answer.body.log || []).filter((l) => /❌|⚠️|Save/.test(l)))}`);
  const saved = savedJson(out, made.own.schema);
  assert(saved && same(enumerated(saved.jsonSchema), [...KINDS].sort()), `[${order}] the enumerated values must be saved on ${made.own.schema}; ${saved ? `tag.kind there is ${short(saved.jsonSchema.properties)}` : 'nothing was saved there'}`);
}

t('S2a (AC2): apply-enumerations saves on the schema it enumerated, when another author\'s same-named header has no schema', () => {
  for (const order of ['other first', 'own first']) {
    const run = enumerationRun(order, (g) => g.concept({ author: TAG.community.author, dTag: 'tag', name: 'tag', list: true }));
    assertEnumeratedOnOwn(run, order);
    untouched(run.out, run.made.other.all, `[${order}] the community's "tag" header`);
  }
});

t('S2b (AC2): the same when that header has a schema of its own, which is left as it was', () => {
  for (const order of ['other first', 'own first']) {
    const run = enumerationRun(order, (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: { type: 'object', properties: { tag: { type: 'object', properties: { kind: { type: 'string' } } } } } }));
    assertEnumeratedOnOwn(run, order);
    untouched(run.out, run.made.other.all, `[${order}] the other author's "tag" header and its schema`);
  }
});

t('S2c (AC2): a second header of the instance\'s own named "tag", with a schema, doesn\'t take the enumerated schema\'s place', () => {
  for (const order of ['other first', 'own first']) {
    const run = enumerationRun(order, (g) => g.concept({ author: TA, dTag: 'tag-made-by-hand', name: 'tag', schema: { type: 'object', properties: { tag: { type: 'object', properties: { kind: { type: 'string' } } } } } }));
    assertEnumeratedOnOwn(run, order);
    untouched(run.out, run.made.other.all, `[${order}] the instance's other header named "tag"`);
  }
});

// save-schema by name: the body every caller sends today.
const NEW_SCHEMA = { properties: { tag: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string' } } } } };
const byName = (graph, name = 'tag') => child({ kind: 'saveSchema', graph, body: { concept: name, schema: NEW_SCHEMA } });

function assertSavedOn(out, schemaUuid, label) {
  const answer = out.results[0];
  assert(answer.statusCode === 200 && answer.body && answer.body.success === true, `${label}: the save must succeed; ${why(out, answer)}`);
  assert(answer.body.schemaUuid === schemaUuid, `${label}: the save must answer schemaUuid ${schemaUuid}; it answered ${answer.body.schemaUuid}`);
  const saved = savedJson(out, schemaUuid);
  assert(saved && same(saved.jsonSchema, stored(NEW_SCHEMA)), `${label}: the new schema must be saved on ${schemaUuid}; ${saved ? `it is ${short(saved.jsonSchema)}` : 'nothing was saved there'}`);
}

t('S3a (AC3, sentinel): with one header named "tag", the instance\'s own, a save by name does what it does today', () => {
  const { graph, made } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER })]]);
  const out = byName(graph);
  assertSavedOn(out, made.own.schema, 'one header');
  const body = out.results[0].body;
  assert(body.message === 'JSON Schema for "tag" updated.', `the answer's message must stay as it is today; it is ${short(body.message)}`);
  assert(body.primaryProperty && typeof body.primaryProperty.result === 'string', `the answer must still report the primary-property fold; it is ${short(body.primaryProperty)}`);
});

t('S3b (AC3, sentinel): with one header named "tag", another author\'s, a save by name does what it does today', () => {
  const { graph, made } = build([['theirs', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER })]]);
  assertSavedOn(byName(graph), made.theirs.schema, 'one header, another author\'s');
});

t('S3c (AC3): when several headers share the name and one is the instance\'s own, the save goes there, the same in every storage order', () => {
  const parts = [
    ['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER })],
    ['otherWithSchema', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER })],
    ['communityWithout', (g) => g.concept({ author: TAG.community.author, dTag: 'tag', name: 'tag', list: true })],
  ];
  const answers = new Set();
  for (const order of permutations(parts)) {
    const { graph, made } = build(order);
    const label = `order ${order.map(([n]) => n).join(', ')}`;
    const out = byName(graph);
    assertSavedOn(out, made.own.schema, label);
    untouched(out, [...made.otherWithSchema.all, ...made.communityWithout.all], `${label}: the other authors' headers`);
    answers.add(stable({ ...out.results[0].body, primaryProperty: undefined }));
  }
  assert(answers.size === 1, `the same request must get the same answer in every storage order; it got ${answers.size} different answers`);
});

function assertRefused(out, addresses, label) {
  const answer = out.results[0];
  assert(answer.body && answer.body.success === false, `${label}: the save must be refused; ${why(out, answer)}`);
  const error = String(answer.body.error || '');
  for (const a of addresses) assert(error.includes(a), `${label}: the error must name every header that shares the name, ${a} among them; it is ${short(error)}`);
  const words = addresses.reduce((s, a) => s.split(a).join(' '), error);
  assert(/\btag\b/.test(words), `${label}: the error must say which name is shared, apart from the addresses; it is ${short(error)}`);
  assert(out.writes.length === 0 && out.published.length === 0, `${label}: a refused save changes nothing; it wrote ${out.writes.length} time(s) and published ${out.published.length} event(s)`);
  return String(answer.body.error);
}

/** Every storage order of `parts` is refused, naming `names(made)`, with one and the same answer: never the database's choice. */
function assertRefusedInEveryOrder(parts, names) {
  const errors = new Set();
  for (const order of permutations(parts)) {
    const { graph, made } = build(order);
    errors.add(assertRefused(byName(graph), names(made), `order ${order.map(([n]) => n).join(', ')}`));
  }
  assert(errors.size === 1, `the same request must get the same answer in every storage order; it got ${errors.size}:\n        ${[...errors].join('\n        ')}`);
}

t('S3d (AC3): when several headers share the name and none is the instance\'s own, nothing changes, and the error names them', () => {
  assertRefusedInEveryOrder([
    ['other', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER })],
    ['community', (g) => g.concept({ author: TAG.community.author, dTag: 'tag', name: 'tag', list: true, schema: STARTER })],
  ], (made) => [made.other.header, made.community.header]);
});

t('S3e (AC3): when several headers share the name and two are the instance\'s own, nothing changes, and the error names them', () => {
  assertRefusedInEveryOrder([
    ['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER })],
    ['ownTwin', (g) => g.concept({ author: TA, dTag: 'tag-made-by-hand', name: 'tag', schema: STARTER })],
    ['other', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER })],
  ], (made) => [made.own.header, made.ownTwin.header, made.other.header]);
});

t('S3f (AC3): the primary-property record the save brings up to date in the same call is the saved concept\'s own', () => {
  // Both primary properties lag the new schema (they lack `color`), so the fold reconciles whichever concept it reads.
  // OTHER's addresses sort after the TA's and EARLY's before them, so neither storage order nor address order can
  // stand in for "the concept the save found".
  const lagging = { key: 'tag', title: 'tag', type: 'object', required: [], properties: { name: { type: 'string' } } };
  const parts = [
    ['other', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER, pp: lagging })],
    ['early', (g) => g.concept({ author: EARLY, dTag: 'tag', name: 'tag', schema: STARTER, pp: lagging })],
    ['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER, pp: lagging })],
  ];
  for (const order of permutations(parts)) {
    const { graph, made } = build(order);
    const label = `order ${order.map(([n]) => n).join(', ')}`;
    const out = byName(graph);
    assertSavedOn(out, made.own.schema, label);
    const fold = out.results[0].body.primaryProperty;
    assert(fold && fold.result === 'reconciled', `${label}: the fold must reconcile the instance's own primary property; it reported ${short(fold)}`);
    const pp = savedJson(out, made.own.pp);
    assert(pp && pp.property && pp.property.properties && pp.property.properties.color, `${label}: ${made.own.pp} must be brought up to date with the saved schema; ${pp ? `it holds ${short(pp.property)}` : 'nothing was written there'}`);
    untouched(out, [...made.other.all, ...made.early.all], `${label}: the other authors' concepts, their schemas and their primary properties`);
  }
});

t('S3g (AC3, sentinel): with no header of that name, a save by name does what it does today', () => {
  const { graph } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER })]]);
  const out = byName(graph, 'no such concept');
  const answer = out.results[0];
  assert(answer.body && answer.body.success === false && answer.body.error === 'Concept "no such concept" not found', `the answer must stay as it is today; it is ${short(answer)}`);
  assert(out.writes.length === 0, `nothing may be written; ${out.writes.length} write(s)`);
});

t('S3h (AC3): a header with two schema nodes has the first by address saved, and the fold reconciles against that one, in either storage order', () => {
  const lagging = { key: 'tag', title: 'tag', type: 'object', required: [], properties: { name: { type: 'string' } } };
  for (const order of ['in order', 'reversed']) {
    const { graph, made } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER, pp: lagging, twoSchemas: order })]]);
    const out = byName(graph);
    assertSavedOn(out, made.own.schema, `[${order}]`);
    untouched(out, [made.own.secondSchema], `[${order}] the header's second schema node, ${made.own.secondSchema}`);
    // The second schema node still holds the starter, with no properties; only the saved one gives the fold `color`.
    const fold = out.results[0].body.primaryProperty;
    assert(fold && fold.result === 'reconciled', `[${order}] the fold must reconcile against the schema node the save wrote; it reported ${short(fold)}`);
    const pp = savedJson(out, made.own.pp);
    assert(pp && pp.property && pp.property.properties && pp.property.properties.color, `[${order}] ${made.own.pp} must follow the saved schema node; ${pp ? `it holds ${short(pp.property)}` : 'nothing was written there'}`);
  }
});

t('S4a (AC4): both of the Schema tab\'s saves, visual and raw, send the tapestryKey of the header the page shows', () => {
  const tab = fs.readFileSync(SCHEMA_TAB, 'utf8');
  const page = fs.readFileSync(CONCEPT_PAGE, 'utf8');
  assert(/const\s*\{[^}]*\buuid\b[^}]*\}\s*=\s*useOutletContext\(\)/.test(tab), 'the Schema tab must still find its header through the concept page (useOutletContext)');
  // The page's header query hands the tab its concept: the key travels as concept.tapestryKey, read off the header.
  assert(/\bh\.tapestryKey\s+AS\s+tapestryKey\b/.test(page), 'the concept page\'s header query must return the header\'s key as `h.tapestryKey AS tapestryKey`, which the tab sends');
  const calls = tab.match(/saveSchema\(\{[^)]*\}\)/g) || [];
  assert(calls.length === 2, `the Schema tab should save in two places (the visual editor and raw mode); found ${calls.length}: ${short(calls)}`);
  for (const call of calls) {
    assert(/\btapestryKey:\s*concept\.tapestryKey\b/.test(call), `each save must send the header's own key, tapestryKey: concept.tapestryKey; this one doesn't: ${call}`);
  }
  // The tab shows the schema the save writes: of a header's schema nodes, the first by address.
  const read = tab.slice(tab.indexOf('MATCH (js:JSONSchema)'), tab.indexOf('LIMIT 1', tab.indexOf('MATCH (js:JSONSchema)')));
  assert(/ORDER BY\s+(js\.)?uuid\b(?!\s+DESC)/i.test(read), `the tab's schema read must order by address, ascending, as the save chooses, before its LIMIT 1; it reads: ${short(read.replace(/\s+/g, ' '), 300)}`);
});

t('S4b (AC4): the client sends the tapestryKey it is given with the concept and the schema, and without one sends today\'s body', async () => {
  const sent = [];
  const fetch0 = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 200, json: async () => ({ success: true, schemaUuid: 'x' }) };
  };
  const key = keyOf('S4b');
  try {
    const client = await import(pathToFileURL(UI_CLIENT).href);
    await client.saveSchema({ concept: 'tag', tapestryKey: key, schema: NEW_SCHEMA });
    await client.saveSchema({ concept: 'tag', schema: NEW_SCHEMA });
    // A header that holds the "{}" placeholder, or nothing, has no key to send: the save falls back to the name.
    await client.saveSchema({ concept: 'tag', tapestryKey: '{}', schema: NEW_SCHEMA });
    await client.saveSchema({ concept: 'tag', tapestryKey: '', schema: NEW_SCHEMA });
  } finally {
    globalThis.fetch = fetch0;
  }
  assert(sent.length === 4 && sent.every((s) => /\/api\/normalize\/save-schema$/.test(s.url)), `the client must POST each save to /api/normalize/save-schema; it sent ${short(sent)}`);
  const [withKey, withoutKey, placeholder, empty] = sent.map((s) => s.body || {});
  assert(withKey.tapestryKey === key, `the request must carry the tapestryKey it was given; its body is ${short(withKey)}`);
  assert(withKey.concept === 'tag' && same(withKey.schema, NEW_SCHEMA), `the request must still carry the concept and the schema; its body is ${short(withKey)}`);
  for (const [label, body] of [['given no tapestryKey', withoutKey], ['given the "{}" placeholder', placeholder], ['given an empty key', empty]]) {
    assert(same(body, { concept: 'tag', schema: NEW_SCHEMA }), `a save ${label} must send today's body, { concept, schema }; it sent ${short(body)}`);
  }
});

t('S4c (AC4): a save that names its header by tapestryKey lands on that header\'s schema', () => {
  // The instance's own header, named, while another author's same-named header comes first.
  {
    const { graph, made } = build([
      ['other', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER })],
      ['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER })],
    ]);
    const out = child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: made.own.key, schema: NEW_SCHEMA } });
    assertSavedOn(out, made.own.schema, 'another author\'s header first');
    untouched(out, made.other.all, 'the other author\'s header and its schema');
  }
  // Two of the instance's own headers share the name: the one named is the one saved, in both orders.
  for (const order of ['firmware first', 'twin first']) {
    for (const target of ['firmwareTag', 'twin']) {
      const firmwareTag = (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER });
      const twin = (g) => g.concept({ author: TA, dTag: 'tag-made-by-hand', name: 'tag', schema: STARTER });
      const { graph, made } = build(order === 'firmware first' ? [['firmwareTag', firmwareTag], ['twin', twin]] : [['twin', twin], ['firmwareTag', firmwareTag]]);
      const other = target === 'twin' ? 'firmwareTag' : 'twin';
      const out = child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: made[target].key, schema: NEW_SCHEMA } });
      assertSavedOn(out, made[target].schema, `[${order}] naming ${made[target].header} by its key`);
      untouched(out, made[other].all, `[${order}] the header not named, ${made[other].header}`);
    }
  }
});

function assertNothingChanged(out, label) {
  const answer = out.results[0];
  assert(answer.body && answer.body.success === false && typeof answer.body.error === 'string' && answer.body.error.length > 0, `${label}: the save must be refused with an error; ${why(out, answer)}`);
  assert(out.writes.length === 0 && out.published.length === 0, `${label}: nothing may change; it wrote ${out.writes.length} time(s) and published ${out.published.length} event(s)`);
}

t('S4d (AC4): a save whose tapestryKey no node has changes nothing', () => {
  const { graph } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER })]]);
  assertNothingChanged(child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: keyOf('no such node'), schema: NEW_SCHEMA } }), 'a key no node has');
});

t('S4e (AC4): the route\'s documentation lists tapestryKey in save-schema\'s request body', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'src/api/openapi.yaml'), 'utf8');
  const at = doc.indexOf('\n  /api/normalize/save-schema:');
  assert(at >= 0, 'src/api/openapi.yaml must still document POST /api/normalize/save-schema');
  const next = doc.indexOf('\n  /api/', at + 1);
  const entry = doc.slice(at, next < 0 ? undefined : next);
  const body = entry.slice(entry.indexOf('requestBody:'), entry.indexOf('responses:'));
  assert(/\n\s+tapestryKey:/.test(body), `save-schema's documented request body must list tapestryKey beside concept and schema; it documents: ${short(body.replace(/\s+/g, ' ').trim(), 300)}`);
});

t('S4f (AC4, sentinel): a concept with no event is refused, by its tapestryKey or by its name, and nothing is signed or published', () => {
  // As graph create-concept makes one (A10.16): addresses, no event. The save signs and publishes, so it must not reach one.
  const { graph, made } = build([['draft', (g) => g.concept({ author: TA, dTag: 'recipe', name: 'recipe', schema: STARTER, eventless: true })]]);
  assertNothingChanged(child({ kind: 'saveSchema', graph, body: { concept: 'recipe', tapestryKey: made.draft.key, schema: NEW_SCHEMA } }), 'by its tapestryKey');
  assertNothingChanged(child({ kind: 'saveSchema', graph, body: { concept: 'recipe', schema: NEW_SCHEMA } }), 'by its name');
});

t('S4g (AC4): a tapestryKey two concept headers hold, or a "{}" placeholder, is refused and changes nothing', () => {
  // Before tapestry-keys adds its uniqueness rule, nothing stops two nodes holding one key, and some nodes hold "{}" as
  // a key (ADR graph-operations-foundation/0003, Context 2).
  const shared = keyOf('held twice');
  for (const [label, key] of [['a key two headers hold', shared], ['the "{}" placeholder', '{}']]) {
    const { graph } = build([
      ['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER, key })],
      ['ownTwin', (g) => g.concept({ author: TA, dTag: 'tag-made-by-hand', name: 'tag', schema: STARTER, key })],
    ]);
    assertNothingChanged(child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: key, schema: NEW_SCHEMA } }), label);
  }
});

t('S4h (AC4): a value that isn\'t a tapestryKey answers 400 and changes nothing, even when one header holds it', () => {
  for (const [label, key, holder] of [['a value no node holds', 'not-a-key', undefined], ['the "{}" placeholder, held by one header', '{}', '{}']]) {
    const { graph } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER, key: holder })]]);
    const out = child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: key, schema: NEW_SCHEMA } });
    assertNothingChanged(out, label);
    assert(out.results[0].statusCode === 400, `${label}: a value that isn't a tapestryKey must answer 400; it answered ${out.results[0].statusCode}`);
  }
});

t('S4i (AC4): a concept whose header or schema node, but not both, came from no event is refused, by key or by name', () => {
  // Each half of the check on its own: the header from an event and the schema node from none, and the other way round.
  for (const [label, shape] of [['the schema node came from no event', { eventlessSchema: true }], ['the header came from no event', { eventless: true, eventlessSchema: false }]]) {
    const { graph, made } = build([['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER, ...shape })]]);
    assertNothingChanged(child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: made.own.key, schema: NEW_SCHEMA } }), `${label}, by its tapestryKey`);
    assertNothingChanged(child({ kind: 'saveSchema', graph, body: { concept: 'tag', schema: NEW_SCHEMA } }), `${label}, by its name`);
  }
});

// Before tapestry-keys: production's state until the migration runs there (story 3). No node has the shared label.
const LAGGING_PP = { key: 'tag', title: 'tag', type: 'object', required: [], properties: { name: { type: 'string' } } };

// Three concepts named "tag", whose addresses sort EARLY < TA < OTHER, each with a primary property behind the new schema.
const SHARED_TAG_PARTS = [
  ['other', (g) => g.concept({ author: OTHER, dTag: 'tag', name: 'tag', schema: STARTER, pp: LAGGING_PP })],
  ['early', (g) => g.concept({ author: EARLY, dTag: 'tag', name: 'tag', schema: STARTER, pp: LAGGING_PP })],
  ['own', (g) => g.concept({ author: TA, dTag: 'tag', name: 'tag', schema: STARTER, pp: LAGGING_PP })],
];

t('S5a (AC4, before tapestry-keys): a save by tapestryKey still lands on its header, and the fold reconciles that header', () => {
  for (const order of permutations(SHARED_TAG_PARTS)) {
    const { graph, made } = build(order, { migrated: false });
    const label = `order ${order.map(([n]) => n).join(', ')}`;
    assert(graph.nodes.every((n) => !n.labels.includes('TapestryNode')), 'the fixture must have no TapestryNode label anywhere');
    const out = child({ kind: 'saveSchema', graph, body: { concept: 'tag', tapestryKey: made.own.key, schema: NEW_SCHEMA } });
    assertSavedOn(out, made.own.schema, `[${label}]`);
    const fold = out.results[0].body.primaryProperty;
    assert(fold && fold.result === 'reconciled', `[${label}] the fold must reconcile the header the save found; it reported ${short(fold)}`);
    untouched(out, [...made.other.all, ...made.early.all], `[${label}] the other authors' concepts`);
  }
});

t('S5b (AC3, before tapestry-keys, no keys at all): a save by name still lands on the instance\'s own header, and the fold reconciles it', () => {
  for (const order of permutations(SHARED_TAG_PARTS)) {
    const { graph, made } = build(order, { migrated: false, keyed: false });
    const label = `order ${order.map(([n]) => n).join(', ')}`;
    assert(graph.nodes.every((n) => n.props.tapestryKey === undefined), 'the fixture must have no tapestryKey anywhere');
    const out = byName(graph);
    assertSavedOn(out, made.own.schema, `[${label}]`);
    const fold = out.results[0].body.primaryProperty;
    assert(fold && fold.result === 'reconciled', `[${label}] the fold must reconcile the instance's own primary property; it reported ${short(fold)}`);
    untouched(out, [...made.other.all, ...made.early.all], `[${label}] the other authors' concepts`);
  }
});

/* ───────────── live, on a scratch stack ───────────── */

let liveNote = false;
function liveOrSkip() {
  const refusal = live.scratchRefusal();
  if (refusal) {
    if (!liveNote) { console.log(`  NOTE  live checks skipped: ${refusal}`); liveNote = true; }
    return false;
  }
  return true;
}

/** The instance's own header for a firmware concept, its schema node, and that node's json tag (parsed). */
function ownSchema(ta, slug) {
  const rows = live.cypher(`MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h {uuid: $uuid})
                            OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
                            RETURN js.uuid AS schemaUuid, head(collect(jt.value)) AS json`, { uuid: `39998:${ta}:${slug}` });
  assert(rows.length === 1, `expected one schema for 39998:<TA>:${slug}; found ${rows.length}`);
  return { header: `39998:${ta}:${slug}`, schemaUuid: rows[0].schemaUuid, json: rows[0].json };
}
const communityHeader = (c) => `39998:${c.community.author}:${c.community.dTag}`;
const present = (uuid) => live.cypher('MATCH (h {uuid: $uuid}) RETURN count(h) AS c', { uuid })[0].c > 0;
const schemasOf = (uuid) => Number(live.cypher('MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h {uuid: $uuid}) RETURN count(js) AS c', { uuid })[0].c);

t('L1 (AC1, AC3, live): on a stack holding the community\'s "tag" header, a save by name, and one by tapestryKey, reach the TA\'s own', () => {
  if (!liveOrSkip()) return 'SKIP';
  if (!present(communityHeader(TAG))) { console.log(`  NOTE  L1 needs the community's tag header, ${communityHeader(TAG)}, which the stack's first install fetches; this stack has none.`); return 'SKIP'; }
  const ta = live.taPubkey();
  const mine = ownSchema(ta, 'tag');
  const schema = JSON.parse(mine.json).jsonSchema;
  const key = live.cypher('MATCH (h {uuid: $uuid}) RETURN h.tapestryKey AS k', { uuid: mine.header })[0].k;
  assert(typeof key === 'string' && key !== '{}', `the TA's tag header must have a tapestryKey; it has ${short(key)}`);
  const theirsBefore = schemasOf(communityHeader(TAG));
  for (const body of [{ concept: TAG.name, schema }, { concept: TAG.name, tapestryKey: key, schema }]) {
    const r = live.http('POST', '/api/normalize/save-schema', body, 120);
    assert(r.status === 200 && r.json && r.json.success === true, `save-schema ${short(Object.keys(body))} must succeed: HTTP ${r.status} ${short(r.text)}`);
    assert(r.json.schemaUuid === mine.schemaUuid, `save-schema ${short(Object.keys(body))} must save on the TA's own tag schema, ${mine.schemaUuid}; it answered ${r.json.schemaUuid}`);
  }
  assert(schemasOf(communityHeader(TAG)) === theirsBefore, 'the community\'s tag header must be left as it was');
  assert(same(JSON.parse(ownSchema(ta, 'tag').json).jsonSchema, schema), 'saving the TA\'s own schema back must leave it as it was');
});

t('L2 (AC5, live, SCHEMA_SAVE_INSTALL=1): a second install logs 0 errors in Pass 2, and the five tag schemas come out as the first install left them', () => {
  if (!liveOrSkip()) return 'SKIP';
  if (process.env.SCHEMA_SAVE_INSTALL !== '1') { console.log('  NOTE  L2 runs a firmware install (minutes); set SCHEMA_SAVE_INSTALL=1 to run it.'); return 'SKIP'; }
  const installs = Number(live.sh('grep -c "FIRMWARE INSTALL COMPLETE" /var/log/supervisor/brainstorm.log || true').trim());
  if (installs !== 1) { console.log(`  NOTE  L2 compares a second install with the first; this container's log shows ${installs} install(s). Boot a fresh scratch stack to run it.`); return 'SKIP'; }
  const missing = SHARED.filter((c) => !present(communityHeader(c)));
  if (missing.length === SHARED.length) { console.log('  NOTE  L2 needs the community headers the first install fetches; this stack has none.'); return 'SKIP'; }
  if (missing.length) console.log(`  NOTE  this stack lacks ${missing.length} community header(s): ${missing.map((c) => c.slug).join(', ')}`);

  const ta = live.taPubkey();
  const { snapshot } = require('./helpers/pass3Snapshot');
  const before = { schemas: Object.fromEntries(SHARED.map((c) => [c.slug, ownSchema(ta, c.slug)])), snapshot: snapshot() };
  const r = live.http('POST', '/api/firmware/install', {}, 3600);
  assert(r.status === 200 && r.json && r.json.success === true, `the second install must succeed: HTTP ${r.status} ${short(r.text)}`);
  const pass2 = r.json.pass2 || {};
  assert(Array.isArray(pass2.errors) && pass2.errors.length === 0, `the second install's Pass 2 must log 0 errors; it logged ${short(pass2.errors)}`);
  const after = { schemas: Object.fromEntries(SHARED.map((c) => [c.slug, ownSchema(ta, c.slug)])), snapshot: snapshot() };

  // The record the plan asks for: every difference between the two installs' graphs, printed.
  const diff = [];
  for (const part of ['nodes', 'schemas', 'implicit']) {
    const keys = new Set([...Object.keys(before.snapshot[part]), ...Object.keys(after.snapshot[part])]);
    for (const k of keys) if (stable(before.snapshot[part][k]) !== stable(after.snapshot[part][k])) diff.push(`${part} ${k}: ${before.snapshot[part][k] === undefined ? 'new' : after.snapshot[part][k] === undefined ? 'gone' : 'differs'}`);
  }
  console.log(`  NOTE  the second install left ${diff.length} difference(s) from the first${diff.length ? `:\n        ${diff.join('\n        ')}` : ''}`);
  const relay = SHARED.find((c) => c.slug === 'nostr-relay');
  if (relay) console.log(`  NOTE  nostr relay's own schema ${before.schemas[relay.slug].json === after.schemas[relay.slug].json ? 'came out the same' : 'came out different'}`);

  const changed = TAG_CONCEPTS.filter((c) => before.schemas[c.slug].json !== after.schemas[c.slug].json);
  assert(changed.length === 0, `the five tag concepts' schemas must come out as the first install left them; these changed: ${changed.map((c) => c.slug).join(', ')}`);
});

/* ───────────── run ───────────── */

async function run() {
  console.log('\n=== saving a concept\'s schema never lands on another author\'s header (graph-operations-foundation #10) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nschema-save-finds-the-right-header: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
