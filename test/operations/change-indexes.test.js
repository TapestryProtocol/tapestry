'use strict';
/**
 * The change entries' indexes, made when the control panel starts — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC5: history reads them)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decision 5, "Indexes")
 *
 * Stack-free. The contract, as tapestry_node_uuid's (ADR 0003 Amendment 1; its tests are tapestry-key-paths.test.js's
 * G16 and G17): ensureChangeIndexesOnBoot({ runWrite, runRead, log, sleep, windowMs }), exported from
 * src/lib/tapestry-node-index.js or a sibling module in src/lib/, reads SHOW INDEXES and makes each of
 * graph_change_at (GraphChange.at) and graph_change_by (GraphChange.byPubkey) that is missing, with
 * CREATE INDEX … IF NOT EXISTS. It retries the graph's start-up errors, never throws and never rejects.
 *
 *   I1 with neither index it makes both, once each; with both there it writes nothing
 *   I2 it waits out the graph starting, and stops at once on any other error, never throwing or rejecting
 *   I3 the control panel calls it when it starts
 */

const fs = require('fs');
const path = require('path');
const S = require('../helpers/graphOpsSuite');

const { ROOT, assert, show } = S;
const { test, run } = S.makeSuite('operations: the change entries\' indexes');

const CANDIDATES = () => [path.join(ROOT, 'src/lib/tapestry-node-index.js'),
  ...fs.readdirSync(path.join(ROOT, 'src/lib')).filter((f) => /change.*index|index.*change/i.test(f)).map((f) => path.join(ROOT, 'src/lib', f))];
const AT = /^\s*CREATE\s+INDEX\s+graph_change_at\s+IF\s+NOT\s+EXISTS\s+FOR\s*\(\s*(\w+)\s*:\s*GraphChange\s*\)\s*ON\s*\(\s*\1\s*\.\s*at\s*\)\s*$/i;
const BY = /^\s*CREATE\s+INDEX\s+graph_change_by\s+IF\s+NOT\s+EXISTS\s+FOR\s*\(\s*(\w+)\s*:\s*GraphChange\s*\)\s*ON\s*\(\s*\1\s*\.\s*byPubkey\s*\)\s*$/i;

function ensure() {
  for (const f of CANDIDATES()) {
    if (!fs.existsSync(f)) continue;
    const m = require(f);
    if (typeof m.ensureChangeIndexesOnBoot === 'function') return { fn: m.ensureChangeIndexesOnBoot, file: path.relative(ROOT, f) };
  }
  throw new Error('no module in src/lib/ exports ensureChangeIndexesOnBoot({ runWrite, runRead, log, sleep, windowMs }) yet (ADR graph-operations-foundation/0004 Decision 5)');
}

/** A schema in memory: `indexes` are SHOW INDEXES rows; the first `failFirst` reads fail with `failCode`. */
function schema({ indexes = [], failFirst = 0, failCode = 'ServiceUnavailable' } = {}) {
  const writes = [];
  let fails = failFirst;
  const runRead = async (q) => {
    if (!/^\s*SHOW\s+INDEXES\b/i.test(q)) throw new Error(`the hook reads only SHOW INDEXES; it read: ${q}`);
    if (fails > 0) { fails--; const e = new Error('the graph is starting'); e.code = failCode; throw e; }
    return indexes;
  };
  const runWrite = async (q) => { writes.push(String(q)); return []; };
  return { runRead, runWrite, writes };
}
async function call(fn, sch, { windowMs } = {}) {
  const lines = [];
  const sleeps = [];
  let p;
  try {
    p = fn({ runWrite: sch.runWrite, runRead: sch.runRead, log: (l) => lines.push(String(l)), sleep: async (ms) => { sleeps.push(ms); }, ...(windowMs ? { windowMs } : {}) });
  } catch (e) {
    throw new Error(`ensureChangeIndexesOnBoot threw; it must never throw: ${e.message}`);
  }
  assert(p && typeof p.then === 'function', 'ensureChangeIndexesOnBoot returns a promise');
  const out = await p.then((x) => x, (e) => { throw new Error(`ensureChangeIndexesOnBoot rejected; it must never reject: ${e.message}`); });
  return { out, lines, sleeps, writes: sch.writes };
}
const row = (name, property) => ({ name, labelsOrTypes: ['GraphChange'], properties: [property], state: 'ONLINE', type: 'RANGE' });

test('I1: with neither index it makes both, once each; with both there it writes nothing', async () => {
  const { fn } = ensure();
  const none = await call(fn, schema());
  assert(none.writes.filter((w) => AT.test(w)).length === 1 && none.writes.filter((w) => BY.test(w)).length === 1 && none.writes.length === 2,
    `it makes graph_change_at on GraphChange.at and graph_change_by on GraphChange.byPubkey, once each, IF NOT EXISTS; it wrote ${show(none.writes)}`);
  assert(none.out && none.out.outcome === 'created', `it answers { outcome: 'created' }; got ${show(none.out)}`);
  const both = await call(fn, schema({ indexes: [row('graph_change_at', 'at'), row('graph_change_by', 'byPubkey')] }));
  assert(both.writes.length === 0 && both.out.outcome === 'present', `with both there it writes nothing and answers present; got ${show({ out: both.out, writes: both.writes })}`);
  const one = await call(fn, schema({ indexes: [row('graph_change_at', 'at')] }));
  assert(one.writes.length === 1 && BY.test(one.writes[0]), `with one there it makes only the other; it wrote ${show(one.writes)}`);
});

test('I2: it waits out the graph starting, and stops at once on any other error, never throwing or rejecting', async () => {
  const { fn } = ensure();
  const later = await call(fn, schema({ failFirst: 3 }));
  assert(later.out.outcome === 'created' && later.writes.length === 2 && later.sleeps.length === 3, `after three start-up refusals it makes both, having waited three times; got ${show({ out: later.out, writes: later.writes.length, sleeps: later.sleeps })}`);
  const never = await call(fn, schema({ failFirst: 1000 }), { windowMs: 60000 });
  assert(never.out.outcome === 'gave-up' && never.writes.length === 0, `past its window it answers gave-up and writes nothing; got ${show(never.out)}`);
  const other = await call(fn, schema({ failFirst: 1, failCode: 'Neo.ClientError.Statement.SyntaxError' }));
  assert(other.out.outcome === 'not-created' && other.sleeps.length === 0, `an error that isn't the graph starting stops it at once, with no retry; got ${show(other.out)}`);
});

test('I3: the control panel calls it when it starts', () => {
  const { file } = ensure();
  const src = fs.readFileSync(path.join(ROOT, 'bin/control-panel.js'), 'utf8');
  const mod = file.replace(/^src\//, '../src/').replace(/\.js$/, '');
  const re = new RegExp(`require\\(\\s*['"]${mod.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]\\s*\\)\\s*\\.\\s*ensureChangeIndexesOnBoot\\s*\\(`);
  assert(re.test(src), `bin/control-panel.js calls require('${mod}').ensureChangeIndexesOnBoot({ … }) when it starts, as it does ensureUuidIndexOnBoot`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
