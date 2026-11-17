'use strict';
/**
 * graph search's full-text index, made when the control panel starts — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/8-search.md (AC7: an existing instance gets it when it
 *          upgrades and a fresh one when it starts, and nothing in the graph is removed or rewritten to make it)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0008-search.md (Decision 1)
 *
 * Stack-free. The contract, as the change entries' indexes' (test/operations/change-indexes.test.js): the module
 * src/lib/graph-search-index.js exports ensureSearchIndexOnBoot({ runWrite, runRead, log, sleep, windowMs }). It reads
 * the full-text indexes there are (SHOW FULLTEXT INDEXES, or SHOW INDEXES) and makes graph_search_text when it is
 * missing:
 *
 *   CREATE FULLTEXT INDEX graph_search_text IF NOT EXISTS
 *   FOR (n:TapestryNode) ON EACH [n.name, n.tapestryValue, n.value]
 *   OPTIONS { indexConfig: { `fulltext.analyzer`: 'standard-no-stop-words', `fulltext.eventually_consistent`: false } }
 *
 * It answers { outcome: 'present' | 'created' | 'not-created' | 'gave-up', code? }. It retries the graph's start-up
 * errors, never throws, never rejects and never drops anything. It makes nothing when the name is held by another
 * definition (name-taken), or when an index under another name covers the same label and properties
 * (equivalent-exists), since Neo4j would make nothing.
 *
 *   XI1 with no index it makes graph_search_text once, as Decision 1 defines it, and says so in one log line
 *   XI2 with it there it writes nothing and logs nothing
 *   XI3 a name held by another definition (other properties, or another analyzer) is name-taken: nothing written, one
 *       line naming it
 *   XI4 an index under another name over the same label and properties is equivalent-exists: nothing written, one line
 *       naming that index
 *   XI5 it waits out the graph starting, stops at once on any other error, and gives up past its window, never
 *       throwing or rejecting
 *   XI6 its writes are its index alone: no node, relationship or property is written to make it
 *   XI7 the control panel calls it when it starts
 */

const fs = require('fs');
const path = require('path');
const S = require('../helpers/graphOpsSuite');

const { ROOT, assert, show } = S;
const { test, run } = S.makeSuite('operations: graph search\'s full-text index');

const MODULE = path.join(ROOT, 'src/lib/graph-search-index.js');
const CREATE = /^\s*CREATE\s+FULLTEXT\s+INDEX\s+graph_search_text\s+IF\s+NOT\s+EXISTS\s+FOR\s*\(\s*(\w+)\s*:\s*TapestryNode\s*\)\s*ON\s+EACH\s*\[([^\]]*)\]\s*OPTIONS\s*\{([\s\S]*)\}\s*$/i;
const PROPERTIES = ['name', 'tapestryValue', 'value'];
const CONFIG = { 'fulltext.analyzer': 'standard-no-stop-words', 'fulltext.eventually_consistent': false };

function ensure() {
  if (!fs.existsSync(MODULE)) throw new Error('src/lib/graph-search-index.js does not exist yet (ADR graph-operations-first-slice/0008, Decision 1 and Implementation notes)');
  const m = require(MODULE);
  if (typeof m.ensureSearchIndexOnBoot !== 'function') throw new Error('src/lib/graph-search-index.js exports no ensureSearchIndexOnBoot({ runWrite, runRead, log, sleep, windowMs }) yet');
  return m.ensureSearchIndexOnBoot;
}

/** Is `q` the index Decision 1 defines: on TapestryNode, over name, tapestryValue and value, its two settings as given? */
function isOurs(q) {
  const m = CREATE.exec(String(q));
  if (!m) return false;
  const v = m[1];
  const props = m[2].split(',').map((s) => s.trim()).map((s) => (s.startsWith(`${v}.`) ? s.slice(v.length + 1) : null));
  if (props.some((p) => p === null) || show([...props].sort()) !== show([...PROPERTIES].sort())) return false;
  const opts = m[3];
  return /fulltext\.analyzer`?\s*:\s*['"]standard-no-stop-words['"]/.test(opts) && /fulltext\.eventually_consistent`?\s*:\s*false\b/.test(opts);
}

/** A schema in memory: `indexes` are SHOW FULLTEXT INDEXES rows; the first `failFirst` reads fail with `failCode`. */
function schema({ indexes = [], failFirst = 0, failCode = 'ServiceUnavailable' } = {}) {
  const writes = [];
  const reads = [];
  let fails = failFirst;
  const runRead = async (q) => {
    reads.push(String(q));
    if (!/^\s*SHOW\s+(FULLTEXT\s+)?INDEXES\b/i.test(q)) throw new Error(`the hook reads only SHOW FULLTEXT INDEXES or SHOW INDEXES; it read: ${q}`);
    if (fails > 0) { fails--; const e = new Error('the graph is starting'); e.code = failCode; throw e; }
    return indexes;
  };
  const runWrite = async (q) => { writes.push(String(q)); return []; };
  return { runRead, runWrite, writes, reads };
}
async function call(fn, sch, { windowMs } = {}) {
  const lines = [];
  const sleeps = [];
  let p;
  try {
    p = fn({ runWrite: sch.runWrite, runRead: sch.runRead, log: (l) => lines.push(String(l)), sleep: async (ms) => { sleeps.push(ms); }, ...(windowMs ? { windowMs } : {}) });
  } catch (e) {
    throw new Error(`ensureSearchIndexOnBoot threw; it must never throw: ${e.message}`);
  }
  assert(p && typeof p.then === 'function', 'ensureSearchIndexOnBoot returns a promise');
  const out = await p.then((x) => x, (e) => { throw new Error(`ensureSearchIndexOnBoot rejected; it must never reject: ${e.message}`); });
  return { out, lines, sleeps, writes: sch.writes };
}
const row = ({ name = 'graph_search_text', properties = PROPERTIES, analyzer = CONFIG['fulltext.analyzer'], labels = ['TapestryNode'] } = {}) => ({
  name, type: 'FULLTEXT', entityType: 'NODE', labelsOrTypes: labels, properties, state: 'ONLINE', populationPercent: 100,
  options: { indexProvider: 'fulltext-1.0', indexConfig: { ...CONFIG, 'fulltext.analyzer': analyzer } },
});

test('XI1: with no index it makes graph_search_text once, as Decision 1 defines it, and says so in one log line', async () => {
  const fn = ensure();
  const none = await call(fn, schema());
  assert(none.writes.length === 1 && isOurs(none.writes[0]), `it makes graph_search_text on TapestryNode over name, tapestryValue and value, standard-no-stop-words and eventually_consistent false, IF NOT EXISTS, once; it wrote ${show(none.writes)}`);
  assert(none.out && none.out.outcome === 'created', `it answers { outcome: 'created' }; got ${show(none.out)}`);
  assert(none.lines.length === 1 && /graph_search_text/.test(none.lines[0]), `one log line, naming the index; got ${show(none.lines)}`);
});

test('XI2: with it there it writes nothing and logs nothing', async () => {
  const fn = ensure();
  const there = await call(fn, schema({ indexes: [row()] }));
  assert(there.writes.length === 0 && there.out.outcome === 'present', `with graph_search_text there it writes nothing and answers present; got ${show({ out: there.out, writes: there.writes })}`);
  assert(there.lines.length === 0, `finding it there is nothing to log; got ${show(there.lines)}`);
  const reordered = await call(fn, schema({ indexes: [row({ properties: ['value', 'name', 'tapestryValue'] })] }));
  assert(reordered.writes.length === 0 && reordered.out.outcome === 'present', `the same three properties in another order are the same index; got ${show(reordered.out)}`);
});

test('XI3: a name held by another definition is name-taken: nothing written, one line naming it', async () => {
  const fn = ensure();
  for (const [label, other] of [['other properties', row({ properties: ['name'] })], ['another analyzer', row({ analyzer: 'english' })], ['another label', row({ labels: ['NostrEventTag'] })]]) {
    const r = await call(fn, schema({ indexes: [other] }));
    assert(r.writes.length === 0, `${label}: it makes nothing, and drops nothing; it wrote ${show(r.writes)}`);
    assert(r.out.outcome === 'not-created' && r.out.code === 'name-taken', `${label}: it answers not-created, name-taken; got ${show(r.out)}`);
    assert(r.lines.length === 1 && /graph_search_text/.test(r.lines[0]) && /name-taken/.test(r.lines[0]), `${label}: one line naming the index and why; got ${show(r.lines)}`);
  }
});

test('XI4: an index under another name over the same label and properties is equivalent-exists: nothing written, one line naming it', async () => {
  const fn = ensure();
  const r = await call(fn, schema({ indexes: [row({ name: 'my_search' })] }));
  assert(r.writes.length === 0, `Neo4j would make nothing, so it writes nothing; it wrote ${show(r.writes)}`);
  assert(r.out.outcome === 'not-created' && r.out.code === 'equivalent-exists', `it answers not-created, equivalent-exists; got ${show(r.out)}`);
  assert(r.lines.length === 1 && /my_search/.test(r.lines[0]), `one line naming the index that covers it; got ${show(r.lines)}`);
});

test('XI5: it waits out the graph starting, stops at once on any other error, and gives up past its window, never throwing or rejecting', async () => {
  const fn = ensure();
  const later = await call(fn, schema({ failFirst: 3 }));
  assert(later.out.outcome === 'created' && later.writes.length === 1 && later.sleeps.length === 3, `after three start-up refusals it makes the index, having waited three times; got ${show({ out: later.out, writes: later.writes.length, sleeps: later.sleeps })}`);
  const never = await call(fn, schema({ failFirst: 1000 }), { windowMs: 60000 });
  assert(never.out.outcome === 'gave-up' && never.writes.length === 0, `past its window it answers gave-up and writes nothing; got ${show(never.out)}`);
  const other = await call(fn, schema({ failFirst: 1, failCode: 'Neo.ClientError.Statement.SyntaxError' }));
  assert(other.out.outcome === 'not-created' && other.sleeps.length === 0 && other.writes.length === 0, `an error that isn't the graph starting stops it at once, with no retry; got ${show(other.out)}`);
  const throwing = await call(fn, { runRead: () => { throw new Error('boom'); }, runWrite: async () => [], writes: [] });
  assert(throwing.out && throwing.out.outcome === 'not-created', `a read that throws as it is called is answered not-created; got ${show(throwing.out)}`);
});

test('XI6: its writes are its index alone: no node, relationship or property is written to make it', async () => {
  const fn = ensure();
  const r = await call(fn, schema({ failFirst: 1 }));
  for (const w of r.writes) {
    assert(!/\b(MERGE|SET|DELETE|REMOVE|DETACH|DROP)\b/i.test(w) && !/\bCREATE\s*\(/i.test(w), `a write that changes the graph's data, or drops an index: ${w}`);
  }
});

test('XI7: the control panel calls it when it starts', () => {
  ensure();
  const src = fs.readFileSync(path.join(ROOT, 'bin/control-panel.js'), 'utf8');
  const re = /require\(\s*['"]\.\.\/src\/lib\/graph-search-index(?:\.js)?['"]\s*\)\s*\.\s*ensureSearchIndexOnBoot\s*\(/;
  assert(re.test(src), "bin/control-panel.js calls require('../src/lib/graph-search-index').ensureSearchIndexOnBoot({ … }) when it starts, as it does ensureChangeIndexesOnBoot");
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
