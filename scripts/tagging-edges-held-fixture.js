#!/usr/bin/env node
/**
 * The evidence fixture for confirming held removals (tagging-edges story 7, ADR tagging-edges/0007 § Evidence): a held
 * list made only of relationships created for the test, checked to be exactly theirs before the owner confirms, and
 * taken out again afterwards. For the local stack and staging only, never production.
 *
 *   docker exec tapestry node /usr/local/lib/node_modules/brainstorm/scripts/tagging-edges-held-fixture.js <command>
 *
 *   counts                                 TAGS, TAGS at tagging addresses, NostrUser, and the fixture's nodes and
 *                                          relationships
 *   plan                                   B, the TAGS at tagging addresses, and T, the fixture count that makes a pass
 *                                          hold every fixture removal over them
 *   create --run <tag> --count <T> --host <domain>
 *                                          two TaggingEdgesEvidence nodes and T TAGS between them, in one transaction;
 *                                          refused unless --host is this instance's configured domain (STRFRY_DOMAIN),
 *                                          and while any TaggingEdgesEvidence node exists. <tag> is [a-z0-9]{1,16}
 *   check --run <tag> --count <T>          the latest pass held exactly the fixture's T removals, each not-on-relay:
 *                                          exit 0, and the owner may confirm from the panel; else exit 1, do not confirm
 *   cleanup --run <tag> | --all            DETACH DELETE the fixture's nodes, which removes only their relationships
 *
 * The fixture. Its nodes are labelled TaggingEdgesEvidence, never NostrUser, so no real person is ever shown tagging or
 * tagged. Its relationships sit at 39999:<64 f>:tagging-edges-7-<tag>-<i>: that author is above the secp256k1 field
 * prime, so no tagging and no kind 5 can ever be signed for it. A pass always finds nothing on the relay there and
 * removes them (holding them, over the limit), and the real-time path, which removes only on a revoke a kind 5 proves,
 * never does. A pass removes a relationship by its address alone; its ends' labels play no part.
 *
 * Safety. It reads Neo4j's settings as the pass does (its wrapper sources brainstorm.conf) and passes them only to the
 * driver: no setting, credential or driver message is printed, only error codes. It writes only the fixture's own
 * nodes and relationships and deletes only those. It writes nothing to any relay, never calls the confirm route (the
 * owner confirms from the panel, after check), and does nothing when required.
 */

const http = require('http');
const { execFileSync } = require('child_process');
const { isTaggingAddress, LIMIT } = require('../src/lib/tagging-edges/sweep');

const FIXTURE_AUTHOR = 'f'.repeat(64);
const RUN_RE = /^[a-z0-9]{1,16}$/;
const COUNT_RE = /^[1-9]\d{0,6}$/;
const HELD_PATH = '/api/tagging-edges/held';
const HELD_PAGE = 1000;
const HTTP_TIMEOUT_MS = 30000;

/** Every statement the script runs. Only CREATE and the two cleanups write, and they touch fixture nodes only. */
const CYPHER = Object.freeze({
  READ_ADDRESSES: 'MATCH ()-[r:TAGS]->() RETURN r.address AS address',
  COUNT_PEOPLE: 'MATCH (u:NostrUser) RETURN count(u) AS people',
  COUNT_FIXTURE: 'MATCH (n:TaggingEdgesEvidence) OPTIONAL MATCH (n)-[r]-() RETURN count(DISTINCT n) AS nodes, count(DISTINCT r) AS relationships',
  CREATE: `CREATE (a:TaggingEdgesEvidence {run: $run, end: 'from'}), (b:TaggingEdgesEvidence {run: $run, end: 'to'})
WITH a, b UNWIND $addresses AS address
CREATE (a)-[:TAGS {address: address, evidence: $run}]->(b)`,
  CLEANUP: 'MATCH (n:TaggingEdgesEvidence {run: $run}) DETACH DELETE n',
  CLEANUP_ALL: 'MATCH (n:TaggingEdgesEvidence) DETACH DELETE n',
});

/** The i-th fixture address of a run (i from 1): tagging-shaped, so the pass judges it, and distinct per run and i. */
function fixtureAddress(run, i) {
  return `39999:${FIXTURE_AUTHOR}:tagging-edges-7-${run}-${i}`;
}

/**
 * T for a graph with B relationships at tagging addresses: floor(B / 9) + 1 + max(20, ceil(B / 450)), so that T is more
 * than a tenth of B + T with a margin for taggings that arrive meanwhile; and never less than the pass's floor plus
 * one, so a small graph's pass holds them too.
 */
function fixtureCount(B) {
  const base = Number.isInteger(B) && B > 0 ? B : 0;
  return Math.max(LIMIT.floor + 1, Math.floor(base / 9) + 1 + Math.max(20, Math.ceil(base / 450)));
}

/**
 * Pure. Is the held list exactly the fixture's: every address 1..count of this run, once each, each not-on-relay, and
 * nothing else? → { ok, total, expected, unexpected, missing }
 */
function checkHeld(items, { run, count } = {}) {
  const list = Array.isArray(items) ? items : [];
  const expected = Number.isInteger(count) && count > 0 ? count : 0;
  const want = new Set(Array.from({ length: expected }, (_, i) => fixtureAddress(run, i + 1)));
  const seen = new Set();
  let unexpected = 0;
  for (const it of list) {
    const address = it && typeof it === 'object' ? it.address : undefined;
    if (!want.has(address) || seen.has(address) || it.reason !== 'not-on-relay') { unexpected += 1; continue; }
    seen.add(address);
  }
  const missing = expected - seen.size;
  return { ok: expected > 0 && list.length === expected && unexpected === 0 && missing === 0, total: list.length, expected, unexpected, missing };
}

// ─── running it ──────────────────────────────────────────────────────────────────────────────────────────────────

const USAGE = `usage: tagging-edges-held-fixture.js counts
       tagging-edges-held-fixture.js plan
       tagging-edges-held-fixture.js create --run <tag> --count <T> --host <domain>
       tagging-edges-held-fixture.js check --run <tag> --count <T>
       tagging-edges-held-fixture.js cleanup --run <tag> | --all`;

/** An error's code, for printing: a plain token, else 'error' (a driver message can repeat NEO4J_URI). */
const codeOf = (err) => (err && typeof err.code === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(err.code) ? err.code : 'error');
const refusal = (message) => Object.assign(new Error(message), { refusal: true });

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--all') opts.all = true;
    else if (a === '--run' || a === '--count' || a === '--host') { opts[a.slice(2)] = rest[i + 1]; i += 1; }
    else throw refusal(`unknown argument ${JSON.stringify(a)}\n${USAGE}`);
  }
  return opts;
}
function runOf(opts) {
  if (typeof opts.run !== 'string' || !RUN_RE.test(opts.run)) throw refusal('--run must be 1 to 16 of a-z and 0-9');
  return opts.run;
}
function countOf(opts) {
  if (typeof opts.count !== 'string' || !COUNT_RE.test(opts.count)) throw refusal('--count must be a whole number from 1');
  return Number(opts.count);
}

/**
 * The settings the pass reads, as its wrapper gets them: brainstorm.conf sourced over the environment. The values go
 * back through a pipe and are never printed; bash's own messages are dropped, since they can repeat a line of the file.
 */
function passSettings() {
  const conf = process.env.BRAINSTORM_CONF_PATH || '/etc/brainstorm.conf';
  const names = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'STRFRY_DOMAIN'];
  const script = `source "$1" >/dev/null 2>&1 || exit 3; printf '%s\\0' ${names.map((n) => `"$${n}"`).join(' ')}`;
  let out;
  try {
    out = execFileSync('bash', ['-c', script, 'bash', conf], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  } catch (err) {
    throw refusal(`could not read the instance's settings (${err && err.status === 3 ? 'brainstorm.conf did not load' : codeOf(err)})`);
  }
  const values = out.split('\0');
  return Object.fromEntries(names.map((n, i) => [n, values[i] || '']));
}

async function withGraph(fn, settings = passSettings()) {
  for (const k of ['NEO4J_URI', 'NEO4J_USER']) if (!settings[k].trim()) throw refusal(`${k} is not set`);
  const neo4j = require('neo4j-driver');
  let driver;
  try {
    driver = neo4j.driver(settings.NEO4J_URI, neo4j.auth.basic(settings.NEO4J_USER, settings.NEO4J_PASSWORD), { disableLosslessIntegers: true });
  } catch (err) {
    throw refusal(`the Neo4j driver could not be built from NEO4J_URI (${codeOf(err)})`);
  }
  const session = driver.session();
  try {
    return await fn(session);
  } finally {
    await session.close().catch(() => {});
    await driver.close().catch(() => {});
  }
}

async function readCounts(session) {
  const addresses = (await session.executeRead((tx) => tx.run(CYPHER.READ_ADDRESSES))).records.map((r) => r.get('address'));
  const people = (await session.executeRead((tx) => tx.run(CYPHER.COUNT_PEOPLE))).records[0].get('people');
  const fixture = (await session.executeRead((tx) => tx.run(CYPHER.COUNT_FIXTURE))).records[0];
  return {
    tags: addresses.length,
    taggingTags: addresses.filter((a) => typeof a === 'string' && isTaggingAddress(a)).length,
    people,
    fixtureNodes: fixture.get('nodes'),
    fixtureRelationships: fixture.get('relationships'),
  };
}

async function counts() {
  const c = await withGraph(readCounts);
  console.log(`TAGS: ${c.tags}`);
  console.log(`TAGS at tagging addresses: ${c.taggingTags}`);
  console.log(`NostrUser: ${c.people}`);
  console.log(`TaggingEdgesEvidence nodes: ${c.fixtureNodes}, their relationships: ${c.fixtureRelationships}`);
  return 0;
}

async function plan() {
  const c = await withGraph(readCounts);
  if (c.fixtureNodes > 0) console.log(`note: ${c.fixtureNodes} TaggingEdgesEvidence nodes exist; B includes their relationships, and create is refused until cleanup`);
  console.log(`B: ${c.taggingTags}`);
  console.log(`T: ${fixtureCount(c.taggingTags)}`);
  return 0;
}

async function create(opts) {
  const run = runOf(opts);
  const count = countOf(opts);
  if (typeof opts.host !== 'string' || !opts.host.trim()) throw refusal('--host must name this instance\'s configured domain');
  const settings = passSettings();
  const domain = settings.STRFRY_DOMAIN.trim().toLowerCase();
  if (!domain || opts.host.trim().toLowerCase() !== domain) throw refusal('--host is not this instance\'s configured domain (STRFRY_DOMAIN); nothing was created');
  const addresses = Array.from({ length: count }, (_, i) => fixtureAddress(run, i + 1));
  // One transaction: the check, both nodes and every relationship, so a pass reads none or all of them.
  const made = await withGraph((session) => session.executeWrite(async (tx) => {
    const existing = (await tx.run(CYPHER.COUNT_FIXTURE)).records[0].get('nodes');
    if (existing > 0) throw refusal(`${existing} TaggingEdgesEvidence nodes exist; run cleanup first. Nothing was created`);
    return (await tx.run(CYPHER.CREATE, { run, addresses })).summary.counters.updates();
  }), settings);
  console.log(`created ${made.nodesCreated} TaggingEdgesEvidence nodes and ${made.relationshipsCreated} TAGS for run ${run}`);
  return 0;
}

/** One page of the held list from this instance's own control panel. → { status, body } */
function getHeldPage(query) {
  const port = Number(process.env.CONTROL_PANEL_PORT) || 7778;
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: `${HELD_PATH}?${new URLSearchParams(query)}`, timeout: HTTP_TIMEOUT_MS }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (_) { reject(Object.assign(new Error('not JSON'), { code: 'EBADJSON' })); }
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
  });
}

async function check(opts) {
  const run = runOf(opts);
  const count = countOf(opts);
  const items = [];
  let first = null;
  for (;;) {
    const query = { offset: String(items.length), limit: String(HELD_PAGE) };
    if (first) query.runId = first.runId; // a newer pass in between answers 404, and the check fails
    let page;
    try { page = await getHeldPage(query); } catch (err) { throw refusal(`the held list could not be read (${codeOf(err)})`); }
    const b = page.body || {};
    if (page.status !== 200 || b.success !== true || !Array.isArray(b.items)) throw refusal(`the held list could not be read (status ${page.status})`);
    if (!first) first = { runId: b.runId, outcome: b.outcome, total: b.total };
    items.push(...b.items);
    if (items.length >= first.total || b.items.length === 0) break;
  }
  const verdict = checkHeld(items, { run, count });
  const problems = [];
  if (first.outcome !== 'done-removals-held') problems.push(`the latest pass's outcome is ${first.outcome}, not done-removals-held`);
  if (first.total !== count) problems.push(`it holds ${first.total}, not ${count}`);
  if (!verdict.ok) problems.push(`${verdict.unexpected} held entries are not this run's fixture, and ${verdict.missing} of its fixture are not held`);
  console.log(`latest pass ${first.runId}: ${first.outcome}, ${first.total} held`);
  if (problems.length) {
    console.log(`NOT the fixture's held list: ${problems.join('; ')}. Do not confirm it; run cleanup.`);
    return 1;
  }
  console.log(`the held list is exactly run ${run}'s ${count} fixture removals, each not-on-relay: the owner may confirm it from the panel`);
  return 0;
}

async function cleanup(opts) {
  const all = opts.all === true;
  if (all && opts.run !== undefined) throw refusal('give --run or --all, not both');
  const run = all ? null : runOf(opts);
  const done = await withGraph((session) => session.executeWrite(async (tx) => (
    await tx.run(all ? CYPHER.CLEANUP_ALL : CYPHER.CLEANUP, all ? {} : { run })
  ).summary.counters.updates()));
  console.log(`removed ${done.nodesDeleted} TaggingEdgesEvidence nodes and ${done.relationshipsDeleted} relationships${all ? '' : ` for run ${run}`}`);
  return 0;
}

const COMMANDS = { counts, plan, create, check, cleanup };

async function main(argv) {
  try {
    const opts = parseArgs(argv);
    const command = Object.prototype.hasOwnProperty.call(COMMANDS, opts.command) ? COMMANDS[opts.command] : null;
    if (!command) { console.error(USAGE); return 2; }
    return await command(opts);
  } catch (err) {
    console.error(err && err.refusal ? `refused: ${err.message}` : `failed: ${codeOf(err)}`);
    return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { FIXTURE_AUTHOR, CYPHER, fixtureAddress, fixtureCount, checkHeld };
