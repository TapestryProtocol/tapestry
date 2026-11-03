/**
 * Story 12 (epic: security-auth-exposure) — a public query is a plain read.
 *
 * Story: engineering-team/stories/security-auth-exposure/12-public-query-plain-reads.md
 *
 * POST /api/neo4j/query stays open for reads, because the browsing UI is built on it. A caller
 * who is neither the owner's side nor direct-local may now run only a plain read: the handler
 * asks Neo4j for the query's plan (EXPLAIN, nothing runs) and refuses one that loads from a URL
 * (LOAD CSV), calls a procedure other than the three schema listings the UI uses, or runs a SHOW
 * other than constraints and indexes. As a second layer, Neo4j itself refuses to fetch from
 * loopback, link-local, private and IPv6-local addresses.
 *
 *   U-class (unit, stack-free) — the handler, with the Bolt driver stubbed through the require
 *     cache; each stubbed plan uses the operator names Neo4j 5.26 really returns (checked by L).
 *   S-class (source sentinels) — the Neo4j config lines in the Dockerfile and the non-Docker
 *     installer, and the driver's EXPLAIN helper running in READ mode.
 *   L-class (live, optional) — set NEO4J_PLAN_PROBE_URI (+ NEO4J_PLAN_PROBE_USER/_PASSWORD) to a
 *     Neo4j 5.26 with APOC; the real explainCypher and gate run against its planner. SKIP otherwise.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUERYPOST = path.join(ROOT, 'src/api/neo4j/queryPost.js');
const DRIVER = path.join(ROOT, 'src/lib/neo4j-driver.js');
const DOCKERFILE = path.join(ROOT, 'Dockerfile');
const INSTALLER = path.join(ROOT, 'setup/install-neo4j.sh');

const OWNER = 'a'.repeat(64);
const CONF = path.join(os.tmpdir(), `neo4j-query-public-reads-${process.pid}.conf`);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/* ─────────────── Stubbed driver ─────────────── */

// Plans as Neo4j 5.26 returns them (operatorType + arguments.Details), keyed by query.
const op = (operatorType, details, children = []) => ({ operatorType, arguments: details ? { Details: details } : {}, children });
const PLANS = {
  'MATCH (n) RETURN n LIMIT 1':
    op('ProduceResults@neo4j', 'n', [op('Limit@neo4j', '1', [op('AllNodesScan@neo4j', 'n')])]),
  'CALL db.labels() YIELD label RETURN label ORDER BY label':
    op('ProduceResults@neo4j', 'label', [op('Sort@neo4j', 'label ASC', [op('ProcedureCall@neo4j', 'db.labels() :: (label :: STRING)')])]),
  'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType':
    op('ProduceResults@neo4j', 'relationshipType', [op('ProcedureCall@neo4j', 'db.relationshipTypes() :: (relationshipType :: STRING)')]),
  'SHOW CONSTRAINTS YIELD name RETURN name':
    op('ProduceResults@neo4j', 'name', [op('ShowConstraints@neo4j', 'allConstraints, columns(name)')]),
  'SHOW INDEXES YIELD name RETURN name':
    op('ProduceResults@neo4j', 'name', [op('ShowIndexes@neo4j', 'allIndexes, columns(name)')]),
  "LOAD CSV FROM 'http://x/' AS r RETURN r":
    op('ProduceResults@neo4j', 'r', [op('LoadCSV@neo4j', 'r')]),
  "CALL apoc.load.json('http://x/') YIELD value RETURN value":
    op('ProduceResults@neo4j', 'value', [op('ProcedureCall@neo4j', 'apoc.load.json($autostring_0) :: (value :: MAP)')]),
  "CALL `apoc`.`load`.`jsonParams`('http://x/', {}, '') YIELD value RETURN value":
    op('ProduceResults@neo4j', 'value', [op('ProcedureCall@neo4j', 'apoc.load.jsonParams($autostring_0, $autoMap_1, $autostring_2) :: (value :: MAP)')]),
  "MATCH (n) WITH n LIMIT 1 CALL apoc.load.json('http://x/') YIELD value RETURN value":
    op('ProduceResults@neo4j', 'value', [op('ProcedureCall@neo4j', 'apoc.load.json($autostring_0) :: (value :: MAP)', [op('Limit@neo4j', '1', [op('AllNodesScan@neo4j', 'n')])])]),
  'CALL dbms.listConfig() YIELD name RETURN name':
    op('ProduceResults@neo4j', 'name', [op('ProcedureCall@neo4j', 'dbms.listConfig() :: (name :: STRING)')]),
  'CALL db.labelsX() YIELD label RETURN label':
    op('ProduceResults@neo4j', 'label', [op('ProcedureCall@neo4j', 'db.labelsX() :: (label :: STRING)')]),
  'SHOW SETTINGS YIELD name RETURN name':
    op('ProduceResults@neo4j', 'name', [op('ShowSettings@neo4j', 'allSettings, columns(name)')]),
  'SHOW PROCEDURES YIELD name RETURN name':
    op('ProduceResults@neo4j', 'name', [op('ShowProcedures@neo4j', 'proceduresForUser(all), columns(name)')]),
  // A subquery inside an expression is not planned as steps: its call is text in the parent's Details (review 12, B1).
  "RETURN [x IN [1] | COLLECT { CALL dbms.listConfig() YIELD name, value RETURN name + '=' + value }] AS y":
    op('ProduceResults@neo4j', 'y', [op('Projection@neo4j', "[x IN $autolist_1 | COLLECT { ResolvedCall(dbms.listConfig(searchString  =  '' :: STRING) :: name :: STRING, description :: STRING, value :: STRING) RETURN name + '=' + value }] AS y")]),
  "RETURN [x IN [1] | COLLECT { LOAD CSV FROM 'http://x/' AS r RETURN r }] AS y":
    op('ProduceResults@neo4j', 'y', [op('Projection@neo4j', '[x IN $autolist_0 | COLLECT { LOAD CSV FROM "http://x/" AS r RETURN r AS r }] AS y')]),
  "RETURN CASE WHEN true THEN COLLECT { CALL apoc.load.json('http://x/') YIELD value RETURN value } END AS y":
    op('ProduceResults@neo4j', 'y', [op('Projection@neo4j', "CASE\n  WHEN true THEN COLLECT { ResolvedCall(apoc.load.json(urlOrKeyOrBinary :: ANY, path  =  '' :: STRING, config  =  Map{} :: MAP) :: value :: MAP) RETURN value }\nEND AS y")]),
  // Administrative commands (review 12, B2).
  "TERMINATE TRANSACTIONS 'neo4j-transaction-1'":
    op('ProduceResults@neo4j', 'transactionId, username, message', [op('TerminateTransactions@neo4j', 'defaultColumns, transactions(neo4j-transaction-1)')]),
  'SHOW USERS': op('AdministrationCommand@system'),
  'SHOW DATABASES': op('AdministrationCommand@system'),
  // Nested reads that stay open.
  'MATCH (n) RETURN COUNT { (n)--() } AS c':
    op('ProduceResults@neo4j', 'c', [op('Projection@neo4j', 'getDegree((n)--()) AS c', [op('AllNodesScan@neo4j', 'n')])]),
  'MATCH (n) RETURN [x IN [1] | COLLECT { MATCH (m) RETURN m.name }] AS y':
    op('ProduceResults@neo4j', 'y', [op('Projection@neo4j', '[x IN $autolist_0 | COLLECT { MATCH (m) RETURN m.name AS `m.name` }] AS y', [op('AllNodesScan@neo4j', 'n')])]),
  // The driver's "no plan" value.
  'RETURN 1 AS noplan': null,
};

let driverCalls = [];

function loadQueryPost() {
  delete require.cache[require.resolve(QUERYPOST)];
  const id = require.resolve(DRIVER);
  require.cache[id] = {
    id, filename: id, loaded: true,
    exports: {
      runCypher: async (cypher) => { driverCalls.push({ fn: 'runCypher', cypher }); return []; },
      writeCypher: async (cypher) => { driverCalls.push({ fn: 'writeCypher', cypher }); return []; },
      explainCypher: async (cypher) => {
        driverCalls.push({ fn: 'explainCypher', cypher });
        if (cypher === 'MATCH (n RETURN n') throw new Error('Invalid input: expected ")"');
        if (!(cypher in PLANS)) throw new Error(`test stub has no plan for: ${cypher}`);
        return PLANS[cypher];
      },
      getDriver() { return null; },
      closeDriver() {},
      toJS(x) { return x; },
    },
  };
  return require(QUERYPOST).queryPost;
}

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

async function call(cypher, reqOver = {}) {
  driverCalls = [];
  const queryPost = loadQueryPost();
  const req = { method: 'POST', path: '/api/neo4j/query', headers: {}, session: {}, body: { cypher }, ...reqOver };
  const res = mkRes();
  await queryPost(req, res);
  return { res, ran: driverCalls.some((c) => c.fn === 'runCypher' || c.fn === 'writeCypher'), driverCalls };
}

const ownerSession = { session: { authenticated: true, pubkey: OWNER } };

/* ─────────────── Tests ─────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ── U-class: refused for a public caller, and nothing runs ──

const REFUSED = [
  ["LOAD CSV FROM 'http://x/' AS r RETURN r", 'LOAD CSV'],
  ["CALL apoc.load.json('http://x/') YIELD value RETURN value", 'apoc.load.json'],
  ["CALL `apoc`.`load`.`jsonParams`('http://x/', {}, '') YIELD value RETURN value", 'backticked apoc.load.jsonParams'],
  ["MATCH (n) WITH n LIMIT 1 CALL apoc.load.json('http://x/') YIELD value RETURN value", 'a procedure call below other operators'],
  ['CALL dbms.listConfig() YIELD name RETURN name', 'dbms.listConfig'],
  ['CALL db.labelsX() YIELD label RETURN label', 'a procedure whose name only starts like an allowed one'],
  ['SHOW SETTINGS YIELD name RETURN name', 'SHOW SETTINGS'],
  ['SHOW PROCEDURES YIELD name RETURN name', 'SHOW PROCEDURES'],
  ["RETURN [x IN [1] | COLLECT { CALL dbms.listConfig() YIELD name, value RETURN name + '=' + value }] AS y", 'a procedure call nested in a list comprehension'],
  ["RETURN [x IN [1] | COLLECT { LOAD CSV FROM 'http://x/' AS r RETURN r }] AS y", 'LOAD CSV nested in a list comprehension'],
  ["RETURN CASE WHEN true THEN COLLECT { CALL apoc.load.json('http://x/') YIELD value RETURN value } END AS y", 'apoc.load.json nested in a CASE'],
  ["TERMINATE TRANSACTIONS 'neo4j-transaction-1'", 'TERMINATE TRANSACTIONS'],
  ['SHOW USERS', 'SHOW USERS (system database)'],
  ['SHOW DATABASES', 'SHOW DATABASES (system database)'],
];
for (const [cypher, label] of REFUSED) {
  t(`U: a public caller is refused ${label} (403) and nothing runs`, async () => {
    const { res, ran } = await call(cypher);
    assert(res.statusCode === 403, `expected 403 for ${label}, got ${res.statusCode} (${JSON.stringify(res.body)}).`);
    assert(res.body && res.body.success === false, 'a refusal must answer success:false.');
    assert(!ran, `${label} reached runCypher/writeCypher — it must be refused before anything runs.`);
  });
}

t('U: a query Neo4j returns no plan for is refused (403) and nothing runs', async () => {
  const { res, ran } = await call('RETURN 1 AS noplan');
  assert(res.statusCode === 403 && !ran, `expected 403 with nothing run, got ${res.statusCode}.`);
});

t('U: a proxied request carrying X-Forwarded-For is still public (no localTrusted) — refused', async () => {
  const { res, ran } = await call("CALL apoc.load.json('http://x/') YIELD value RETURN value", { headers: { 'x-forwarded-for': '127.0.0.1' } });
  assert(res.statusCode === 403 && !ran, `expected 403 with nothing run, got ${res.statusCode}.`);
});

// ── U-class: still open for a public caller ──

const ALLOWED = [
  ['MATCH (n) RETURN n LIMIT 1', 'a plain MATCH'],
  ['CALL db.labels() YIELD label RETURN label ORDER BY label', 'db.labels() (useNeo4jLabels)'],
  ['CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType', 'db.relationshipTypes()'],
  ['SHOW CONSTRAINTS YIELD name RETURN name', 'SHOW CONSTRAINTS (Dashboard)'],
  ['SHOW INDEXES YIELD name RETURN name', 'SHOW INDEXES (Dashboard)'],
  ['MATCH (n) RETURN COUNT { (n)--() } AS c', 'a COUNT { } subquery'],
  ['MATCH (n) RETURN [x IN [1] | COLLECT { MATCH (m) RETURN m.name }] AS y', 'a nested COLLECT { MATCH … } read'],
];
for (const [cypher, label] of ALLOWED) {
  t(`U: a public caller may still run ${label}`, async () => {
    const { res, driverCalls: calls } = await call(cypher);
    assert(res.statusCode !== 403, `${label} must stay open; got ${res.statusCode} (${JSON.stringify(res.body)}).`);
    assert(res.body && res.body.success === true, `${label} must answer success:true; got ${JSON.stringify(res.body)}.`);
    assert(calls.some((c) => c.fn === 'runCypher' && c.cypher === cypher), `${label} did not reach runCypher unchanged.`);
  });
}

t('U: a public query that does not parse answers its planner error (success:false) and nothing runs', async () => {
  const { res, ran } = await call('MATCH (n RETURN n');
  assert(res.body && res.body.success === false && /Invalid input/.test(res.body.error || ''), `expected the planner error, got ${JSON.stringify(res.body)}.`);
  assert(!ran, 'a query that failed to plan must not run.');
});

// ── U-class: the owner's side and direct-local are not limited ──

t('U: the owner may run apoc.load.json, with no EXPLAIN round trip', async () => {
  fs.writeFileSync(CONF, `BRAINSTORM_OWNER_PUBKEY='${OWNER}'\n`);
  const prev = process.env.BRAINSTORM_CONF_PATH;
  process.env.BRAINSTORM_CONF_PATH = CONF;
  try {
    const { res, ran, driverCalls: calls } = await call("CALL apoc.load.json('http://x/') YIELD value RETURN value", ownerSession);
    assert(res.statusCode !== 403 && ran, `the owner must not be limited; got ${res.statusCode} (${JSON.stringify(res.body)}).`);
    assert(!calls.some((c) => c.fn === 'explainCypher'), 'the owner path must not pay for an EXPLAIN.');
  } finally {
    if (prev === undefined) delete process.env.BRAINSTORM_CONF_PATH; else process.env.BRAINSTORM_CONF_PATH = prev;
  }
});

t('U: a direct-local caller (req.localTrusted) may run LOAD CSV, with no EXPLAIN round trip', async () => {
  const { res, ran, driverCalls: calls } = await call("LOAD CSV FROM 'http://x/' AS r RETURN r", { localTrusted: true });
  assert(res.statusCode !== 403 && ran, `direct-local must not be limited; got ${res.statusCode}.`);
  assert(!calls.some((c) => c.fn === 'explainCypher'), 'the direct-local path must not pay for an EXPLAIN.');
});

t('U: the write gate still answers first — a public write is 403 before any EXPLAIN', async () => {
  const { res, ran, driverCalls: calls } = await call('MATCH (n) DETACH DELETE n');
  assert(res.statusCode === 403 && !ran, `expected 403 with nothing run, got ${res.statusCode}.`);
  assert(!calls.some((c) => c.fn === 'explainCypher'), 'a keyword-detected public write must be refused without planning it.');
});

// ── S-class: the second layer, and the driver helper ──

const BLOCKLIST_RANGES = ['127.0.0.0/8', '169.254.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '0.0.0.0/8', '::1/128', 'fc00::/7', 'fe80::/10'];

function blocklistLine(src) {
  const m = /internal\.dbms\.cypher_ip_blocklist=(\d[^"\s\\]*)/.exec(src || '');
  return m ? m[1].split(',') : null;
}

t('S: the Docker image tells Neo4j to refuse loopback, link-local, private and IPv6-local addresses', async () => {
  const ranges = blocklistLine(readSafe(DOCKERFILE));
  assert(ranges, 'Dockerfile does not write internal.dbms.cypher_ip_blocklist into neo4j.conf.');
  const missing = BLOCKLIST_RANGES.filter((r) => !ranges.includes(r));
  assert(missing.length === 0, `Dockerfile blocklist is missing: ${missing.join(', ')}.`);
});

t('S: the non-Docker installer writes the same blocklist', async () => {
  const ranges = blocklistLine(readSafe(INSTALLER));
  assert(ranges, 'setup/install-neo4j.sh does not write internal.dbms.cypher_ip_blocklist.');
  const missing = BLOCKLIST_RANGES.filter((r) => !ranges.includes(r));
  assert(missing.length === 0, `installer blocklist is missing: ${missing.join(', ')}.`);
});

t('S: the driver exports explainCypher, which plans in a READ session with EXPLAIN', async () => {
  const src = readSafe(DRIVER) || '';
  const start = src.indexOf('async function explainCypher');
  assert(start >= 0, 'src/lib/neo4j-driver.js has no explainCypher.');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert(/neo4j\.session\.READ/.test(body), 'explainCypher must open a READ session.');
  assert(/['"`]EXPLAIN /.test(body), 'explainCypher must prefix the query with EXPLAIN.');
  assert(/explainCypher/.test(src.slice(src.indexOf('module.exports'))), 'explainCypher is not exported.');
});

// ── L-class: the real planner (optional) ──

t('L: against a real Neo4j 5.26 + APOC, the gate refuses and allows the same queries', async () => {
  const uri = process.env.NEO4J_PLAN_PROBE_URI;
  if (!uri) return 'SKIP';
  // The driver reads its connection from the conf file only (src/utils/config.js), so point it at a temporary one.
  fs.writeFileSync(CONF, [
    `NEO4J_URI='${uri}'`,
    `NEO4J_USER='${process.env.NEO4J_PLAN_PROBE_USER || 'neo4j'}'`,
    `NEO4J_PASSWORD='${process.env.NEO4J_PLAN_PROBE_PASSWORD || ''}'`,
  ].join('\n') + '\n');
  const prevConf = process.env.BRAINSTORM_CONF_PATH;
  process.env.BRAINSTORM_CONF_PATH = CONF;
  delete require.cache[require.resolve(DRIVER)];
  delete require.cache[require.resolve(QUERYPOST)];
  const { queryPost } = require(QUERYPOST);
  const { closeDriver } = require(DRIVER);
  const live = async (cypher) => { const res = mkRes(); await queryPost({ method: 'POST', path: '/api/neo4j/query', headers: {}, session: {}, body: { cypher } }, res); return res; };
  try {
    for (const [cypher, label] of REFUSED) {
      const res = await live(cypher);
      if (label.startsWith('a procedure whose name')) continue; // db.labelsX doesn't exist on a real server: a planner error, also refused
      assert(res.statusCode === 403, `live: expected 403 for ${label}, got ${res.statusCode} (${JSON.stringify(res.body)}).`);
    }
    for (const [cypher, label] of ALLOWED) {
      const res = await live(cypher);
      assert(res.statusCode !== 403 && res.body && res.body.success === true, `live: ${label} must run; got ${res.statusCode} (${JSON.stringify(res.body)}).`);
    }
  } finally {
    await closeDriver();
    delete require.cache[require.resolve(DRIVER)];
    if (prevConf === undefined) delete process.env.BRAINSTORM_CONF_PATH; else process.env.BRAINSTORM_CONF_PATH = prevConf;
  }
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- a public query is a plain read (epic security-auth-exposure, Story 12) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  try { fs.unlinkSync(CONF); } catch { /* not written */ }
  console.log(`\nneo4j-query-public-reads: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
