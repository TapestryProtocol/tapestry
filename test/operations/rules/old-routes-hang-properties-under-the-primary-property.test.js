'use strict';
/**
 * Today's POST /api/normalize/enumerate and POST /api/normalize/create-property hang a property under its concept's
 * primary property, never on its JSON schema node — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md (AC6, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0045-property-has-one-parent.md (Decisions 11, 12)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.test-plan.md
 *
 * Stack-free. The real handlers run in a child process (test/helpers/saveSchemaChild.js, kind 'route') over a small
 * graph built here: reads run on the fake graph, every write is recorded with its parameters and none is applied, and
 * every event the route signs is recorded where `strfry import` would take it; nothing is launched and nothing leaves
 * the process. So the tests read where a property was hung from the writes' parameter values and the events signed,
 * not from the query text.
 *
 * The graph: grok bot (its JSON schema node, its primary property, and project under it, as graph add-property made
 * it, with no event), robot (its schema and primary property), project (the source concept, with its superset), and
 * kiosk (a schema, no primary property).
 *
 *   OR1 [AC6] enumerate on a property under its primary property: the ENUMERATES and its event, as today, and no
 *       IS_A_PROPERTY_OF to a JSON schema node written or signed; schemaWired is false
 *   OR2 [AC6] enumerate with createProperty: the new property's address comes from grok bot's primary property, it is
 *       hung under that, never on the schema, and no relationship event is signed for that link
 *   OR3 [AC6] enumerate with createProperty on a concept with no primary property: refused, naming the concept and
 *       POST /api/normalize/skeleton, before anything is signed or written
 *   OR4 [AC7] create-property with no parent: hung under the primary property, its address from it, never on the
 *       schema; the answer's target is the primary property
 *   OR5 [AC7] create-property with a parent: its address from that parent
 *   OR6 [AC7] the same name made on two concepts is two nodes, each under its own primary property
 *   OR7 [AC7] create-property on a concept with no primary property: refused, naming POST /api/normalize/skeleton,
 *       before anything is signed
 *   Review round 1, blocking 1 (ADR 0045 Amendment 2):
 *   OR8 [AC7] create-property of a name that slugs like a property already under the parent (first-name beside
 *       first_name, which graph add-property made with no event): refused, naming the node that holds the address,
 *       before anything is signed or written, so that node's tags and JSON stay as they are
 *   OR9 [AC6] enumerate with createProperty of the same name: refused the same way
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert, show } = S;
const { test, run } = S.makeSuite('operations: the old enumerate and create-property routes hang a property under its primary property');

const CHILD = path.join(ROOT, 'test/helpers/saveSchemaChild.js');
const MEMBER = 'IS_A_PROPERTY_OF';
const TA_PRIVKEY = '22'.repeat(32);
const nt = require(path.join(ROOT, 'node_modules/nostr-tools'));
const TA = nt.getPublicKey(Uint8Array.from(Buffer.from(TA_PRIVKEY, 'hex')));
const hash8 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
const slugOf = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const childD = (name, parentUuid) => `${slugOf(name)}-${hash8(parentUuid)}`;

const DEAD_CONF = path.join(os.tmpdir(), `old-routes-dead-${process.pid}.conf`);
fs.writeFileSync(DEAD_CONF, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
process.on('exit', () => { try { fs.unlinkSync(DEAD_CONF); } catch { /* already gone */ } });
const DEAD = { BRAINSTORM_CONF_PATH: DEAD_CONF, TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };

const U = {
  grok: `39998:${TA}:grok-bot`, grokSchema: `39999:${TA}:grok-bot-schema`, grokPP: `39999:${TA}:grok-bot-primary-property`,
  robot: `39998:${TA}:robot`, robotSchema: `39999:${TA}:robot-schema`, robotPP: `39999:${TA}:robot-primary-property`,
  projectConcept: `39998:${TA}:project`, projectSuperset: `39999:${TA}:project-superset`,
  kiosk: `39998:${TA}:kiosk`, kioskSchema: `39999:${TA}:kiosk-schema`,
  property: `39998:${TA}:property`, propertySuperset: `39999:${TA}:property-superset`,
};
U.project = `39999:${TA}:${childD('project', U.grokPP)}`;
// grok bot's first_name, as graph add-property makes one: no event, its address from its parent (review round 1).
U.firstName = `39999:${TA}:${childD('first_name', U.grokPP)}`;

/** The graph, as { nodes, rels } for the fake (test/helpers/pathCypherFake.js). */
function makeGraph() {
  const nodes = [];
  const rels = [];
  let seq = 0;
  const eid = (p) => `${p}-${seq++}`;
  const key = () => crypto.randomUUID();
  const node = (labels, props, tags = []) => {
    const e = eid('n');
    nodes.push({ eid: e, labels: [...labels, 'TapestryNode'], props: { tapestryKey: key(), ...props } });
    for (const t of tags) {
      const te = eid('t');
      nodes.push({ eid: te, labels: ['NostrEventTag', 'TapestryNode'], props: { uuid: `tag-${te}`, tapestryKey: key(), type: t[0], value: t[1], ...(t[2] !== undefined ? { value1: t[2] } : {}) } });
      rels.push({ eid: eid('r'), type: 'HAS_TAG', from: e, to: te, props: {} });
    }
    return e;
  };
  const rel = (type, from, to) => rels.push({ eid: eid('r'), type, from, to, props: {} });
  const lettered = (uuid, kind = 39999) => ({ uuid, kind, pubkey: TA, id: `event-${hash8(uuid)}` });
  const header = (uuid, singular, plural) => node(['NostrEvent', 'ListHeader', 'ConceptHeader'], { ...lettered(uuid, 39998), name: singular }, [['d', uuid.split(':')[2]], ['names', singular, plural], ['slug', uuid.split(':')[2]]]);
  const schemaOf = (uuid, plural, h) => { const e = node(['NostrEvent', 'ListItem', 'JSONSchema'], { ...lettered(uuid), name: `JSON schema for the concept of ${plural}` }, [['d', uuid.split(':')[2]], ['name', `JSON schema for the concept of ${plural}`]]); rel('IS_THE_JSON_SCHEMA_FOR', e, h); return e; };
  const ppOf = (uuid, plural, h, schemaE) => { const e = node(['NostrEvent', 'ListItem', 'Property'], { ...lettered(uuid), name: `primary property for the concept of ${plural}` }, [['d', uuid.split(':')[2]], ['name', `primary property for the concept of ${plural}`]]); rel('IS_THE_PRIMARY_PROPERTY_FOR', e, h); rel(MEMBER, e, schemaE); return e; };

  const grok = header(U.grok, 'grok bot', 'grok bots');
  const grokSchema = schemaOf(U.grokSchema, 'grok bots', grok);
  const grokPP = ppOf(U.grokPP, 'grok bots', grok, grokSchema);
  const project = node(['ListItem', 'Property'], { uuid: U.project, kind: 39999, pubkey: TA, name: 'project' }, [['d', U.project.split(':')[2]], ['name', 'project']]);
  rel(MEMBER, project, grokPP);
  const firstName = node(['ListItem', 'Property'], { uuid: U.firstName, kind: 39999, pubkey: TA, name: 'first_name' }, [['d', U.firstName.split(':')[2]], ['name', 'first_name'], ['json', JSON.stringify({ property: { key: 'first_name', type: 'string', schema: { type: 'string' } } })]]);
  rel(MEMBER, firstName, grokPP);
  const robot = header(U.robot, 'robot', 'robots');
  ppOf(U.robotPP, 'robots', robot, schemaOf(U.robotSchema, 'robots', robot));
  const pc = header(U.projectConcept, 'project', 'projects');
  const ps = node(['NostrEvent', 'ListItem', 'Superset'], { ...lettered(U.projectSuperset), name: 'superset for the concept of projects' }, [['d', 'project-superset'], ['name', 'superset for the concept of projects']]);
  rel('IS_THE_CONCEPT_FOR', pc, ps);
  const kiosk = header(U.kiosk, 'kiosk', 'kiosks');
  schemaOf(U.kioskSchema, 'kiosks', kiosk);
  const prop = header(U.property, 'property', 'properties');
  const propSup = node(['NostrEvent', 'ListItem', 'Superset'], { ...lettered(U.propertySuperset), name: 'superset for the concept of properties' }, [['d', 'property-superset'], ['name', 'superset for the concept of properties']]);
  rel('IS_THE_CONCEPT_FOR', prop, propSup);
  return { nodes, rels };
}

function child(calls) {
  const r = spawnSync(process.execPath, [CHILD], {
    input: JSON.stringify({ kind: 'route', calls, graph: makeGraph(), taPrivkey: TA_PRIVKEY }),
    encoding: 'utf8', env: { ...process.env, ...DEAD }, maxBuffer: 64 << 20, timeout: 120000,
  });
  const at = (r.stdout || '').lastIndexOf('@@RESULT@@');
  assert(at >= 0, `the child process printed no result (exit ${r.status}): ${String(r.stderr || r.stdout).slice(-800)}`);
  const out = JSON.parse(r.stdout.slice(at + 10).split('\n')[0]);
  assert(!out.error, `the route threw in the child process: ${String(out.error).slice(0, 1000)}`);
  assert(out.taPubkey === TA, `the child's Tapestry Assistant is ${out.taPubkey}, not the test's ${TA}`);
  return out;
}
const ENUMERATE = 'POST /api/normalize/enumerate';
const CREATE = 'POST /api/normalize/create-property';
const valuesOf = (w) => Object.values(w.params || {}).filter((v) => typeof v === 'string');
/** Writes that hang `from` (an address) under `to` by IS_A_PROPERTY_OF, read from the parameters' values. */
const hangs = (out, from, to) => out.writes.filter((w) => w.cypher.includes(MEMBER) && valuesOf(w).includes(from) && valuesOf(w).includes(to));
/** Any write that names IS_A_PROPERTY_OF together with a JSON schema node's address. */
const onASchema = (out) => out.writes.filter((w) => w.cypher.includes(MEMBER) && valuesOf(w).some((v) => [U.grokSchema, U.robotSchema, U.kioskSchema].includes(v)));
const tagOf = (e, name) => (e.tags.find((t) => t[0] === name) || [])[1];
const relationshipEvents = (out, type) => out.published.filter((e) => tagOf(e, 'relationshipType') === type);
const propertyEvents = (out) => out.published.filter((e) => tagOf(e, 'z') === U.property);
const said = (x) => show(x).slice(0, 700);

test('OR1 [AC6, Decision 11]: enumerate on a property under its primary property hangs nothing on the JSON schema', () => {
  const out = child([{ route: ENUMERATE, body: { enumeratingConcept: 'project', property: 'project', targetConcept: 'grok bot' } }]);
  const res = out.results[0];
  assert(res.statusCode === 200 && res.body.success === true, `the link is made; got ${said(res)}`);
  assert(relationshipEvents(out, 'ENUMERATES').length === 1 && out.writes.some((w) => w.cypher.includes('ENUMERATES') && valuesOf(w).includes(U.projectSuperset) && valuesOf(w).includes(U.project)),
    `the ENUMERATES from project's superset to project, and its event, as today (D15); got events ${said(out.published.map((e) => tagOf(e, 'relationshipType')))}`);
  assert(onASchema(out).length === 0, `no IS_A_PROPERTY_OF to a JSON schema node is written; got ${said(onASchema(out))}`);
  assert(relationshipEvents(out, MEMBER).length === 0, `no relationship event is signed for IS_A_PROPERTY_OF; got ${said(relationshipEvents(out, MEMBER).map((e) => e.tags))}`);
  assert(res.body.schemaWired === false, `schemaWired stays in the answer, false; got ${show(res.body.schemaWired)}`);
});

test('OR2 [AC6, Decision 11]: enumerate with createProperty hangs the new property under the target\'s primary property, its address from it', () => {
  const out = child([{ route: ENUMERATE, body: { enumeratingConcept: 'project', property: 'sponsor', targetConcept: 'grok bot', createProperty: true } }]);
  const res = out.results[0];
  assert(res.statusCode === 200 && res.body.success === true, `the property is made and linked; got ${said(res)}`);
  const want = `39999:${TA}:${childD('sponsor', U.grokPP)}`;
  const made = propertyEvents(out);
  assert(made.length === 1 && tagOf(made[0], 'd') === want.split(':')[2], `the new property's d-tag comes from grok bot's primary property (${want.split(':')[2]}); got ${said(made.map((e) => tagOf(e, 'd')))}`);
  assert(res.body.property && res.body.property.uuid === want, `the answer names the new property at that address; got ${said(res.body.property)}`);
  assert(hangs(out, want, U.grokPP).length >= 1, `it is hung under grok bot's primary property; got writes ${said(out.writes.filter((w) => w.cypher.includes(MEMBER)))}`);
  assert(onASchema(out).length === 0 && relationshipEvents(out, MEMBER).length === 0, `never on a schema node, and no relationship event for the link; got ${said({ writes: onASchema(out), events: relationshipEvents(out, MEMBER).length })}`);
});

test('OR3 [AC6, Decision 11]: enumerate with createProperty on a concept with no primary property is refused before anything is signed', () => {
  const out = child([{ route: ENUMERATE, body: { enumeratingConcept: 'project', property: 'stall', targetConcept: 'kiosk', createProperty: true } }]);
  const res = out.results[0];
  assert(res.body && res.body.success === false && /kiosk/.test(res.body.error) && /normalize\/skeleton/.test(res.body.error), `refused, naming kiosk and POST /api/normalize/skeleton; got ${said(res)}`);
  assert(out.published.length === 0 && out.writes.length === 0, `nothing signed, nothing written; got ${said({ published: out.published.length, writes: out.writes.map((w) => w.cypher.slice(0, 80)) })}`);
});

test('OR4 [AC7, Decision 12]: create-property with no parent hangs the property under the primary property, its address from it', () => {
  const out = child([{ route: CREATE, body: { name: 'model', concept: 'grok bot' } }]);
  const res = out.results[0];
  assert(res.statusCode === 200 && res.body.success === true, `the property is made; got ${said(res)}`);
  const want = `39999:${TA}:${childD('model', U.grokPP)}`;
  assert(res.body.property.uuid === want && res.body.property.targetUuid === U.grokPP, `its address comes from grok bot's primary property, its target; got ${said(res.body.property)}`);
  assert(hangs(out, want, U.grokPP).length >= 1 && onASchema(out).length === 0, `hung under the primary property, never on the schema; got ${said(out.writes.filter((w) => w.cypher.includes(MEMBER)))}`);
});

test('OR5 [AC7, Decision 12]: create-property with a parent takes its address from that parent', () => {
  const out = child([{ route: CREATE, body: { name: 'url', parentUuid: U.project } }]);
  const res = out.results[0];
  const want = `39999:${TA}:${childD('url', U.project)}`;
  assert(res.statusCode === 200 && res.body.success === true && res.body.property.uuid === want, `its address comes from project, its parent (${want}); got ${said(res)}`);
  assert(hangs(out, want, U.project).length >= 1, 'it is hung under project');
});

test('OR6 [AC7, Decision 12]: the same name made on two concepts is two nodes, each under its own primary property', () => {
  const out = child([{ route: CREATE, body: { name: 'model', concept: 'grok bot' } }, { route: CREATE, body: { name: 'model', concept: 'robot' } }]);
  const [a, b] = out.results;
  assert(a.body.success && b.body.success, `both are made; got ${said(out.results)}`);
  assert(a.body.property.uuid !== b.body.property.uuid, `two addresses, so two nodes; got ${a.body.property.uuid} and ${b.body.property.uuid}`);
  assert(hangs(out, a.body.property.uuid, U.grokPP).length >= 1 && hangs(out, b.body.property.uuid, U.robotPP).length >= 1, "each is hung under its own concept's primary property");
  assert(hangs(out, a.body.property.uuid, U.robotPP).length === 0 && hangs(out, b.body.property.uuid, U.grokPP).length === 0, "neither is hung under the other's");
});

test('OR7 [AC7, Decision 12]: create-property on a concept with no primary property is refused, naming POST /api/normalize/skeleton', () => {
  const out = child([{ route: CREATE, body: { name: 'stall', concept: 'kiosk' } }]);
  const res = out.results[0];
  assert(res.body && res.body.success === false && /kiosk/.test(res.body.error) && /normalize\/skeleton/.test(res.body.error), `refused, naming kiosk and POST /api/normalize/skeleton; got ${said(res)}`);
  assert(out.published.length === 0 && out.writes.length === 0, `nothing signed, nothing written; got ${said({ published: out.published.length, writes: out.writes.length })}`);
});

test('OR8 [AC7, Amendment 2]: create-property of a name that slugs like a property already under the parent is refused, naming that node, before anything is signed', () => {
  assert(childD('first-name', U.grokPP) === U.firstName.split(':')[2], 'first-name and first_name slug alike, so they share an address under grok bot');
  const out = child([{ route: CREATE, body: { name: 'first-name', concept: 'grok bot' } }]);
  const res = out.results[0];
  assert(res.body && res.body.success === false && res.body.error.includes(U.firstName) && /first_name/.test(res.body.error), `refused, naming the node that holds the address; got ${said(res)}`);
  assert(out.published.length === 0 && out.writes.length === 0, `nothing signed, nothing written, so first_name's tags and JSON stay as they are; got ${said({ published: out.published.length, writes: out.writes.map((w) => w.cypher.slice(0, 80)) })}`);
});

test('OR9 [AC6, Amendment 2]: enumerate with createProperty of that name is refused the same way, before anything is signed', () => {
  const out = child([{ route: ENUMERATE, body: { enumeratingConcept: 'project', property: 'first-name', targetConcept: 'grok bot', createProperty: true } }]);
  const res = out.results[0];
  assert(res.body && res.body.success === false && res.body.error.includes(U.firstName) && /first_name/.test(res.body.error), `refused, naming the node that holds the address; got ${said(res)}`);
  assert(out.published.length === 0 && out.writes.length === 0, `nothing signed, nothing written; got ${said({ published: out.published.length, writes: out.writes.map((w) => w.cypher.slice(0, 80)) })}`);
});

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));
