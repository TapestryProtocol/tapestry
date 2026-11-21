'use strict';
/**
 * Stub executables for the child that runs today's importers stack-free (test/helpers/todaysImportersChild.js; story
 * graph-operations-first-slice #34, AC6; ADR graph-operations-first-slice/0034 Decision 10). The child puts a `strfry`
 * and a `cypher-shell` on its PATH, each `exec "<node>" this-file <tool> "$@"`, so today's handlers shell out as they do
 * in the container and these answer:
 *
 *   strfry scan '<filter>'      prints, one JSON line each, the events of TODAYS_STUB_STRFRY (a JSON list) that match the
 *                               NIP-01 filter, newest first (test/helpers/relayFake.js's matches)
 *   strfry import [--no-verify] reads events from stdin, one JSON line each, and keeps them in TODAYS_STUB_STRFRY, a newer
 *                               version replacing an older one at its address, as strfry keeps only the newest
 *   cypher-shell [... --format plain]  reads statements from stdin, split at each `;` outside a string, and runs each on
 *                               the graph in TODAYS_STUB_STATE with test/helpers/cypherEngine.js, saving it after each,
 *                               as cypher-shell commits each one; with plain, prints the last one's rows as cypher-shell's
 *                               plain format does (a header of the column names, then a line a row, text in quotes, a
 *                               missing value NULL). A statement that fails, or a DELETE that leaves a relationship
 *                               without its node, exits 1 with Neo4j's words on stderr
 * Each invocation and each statement goes to TODAYS_STUB_LOG as one JSON line: { at: 'strfry', cmd, filter | ids } and
 * { at: 'cypher-shell', query }. Nothing here opens Neo4j, strfry or the network.
 */

const fs = require('fs');
const path = require('path');

const [tool, ...args] = process.argv.slice(2);
const LOG = process.env.TODAYS_STUB_LOG;
const log = (entry) => { if (LOG) fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`); };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };

function stdin() {
  return new Promise((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { text += d; });
    process.stdin.on('end', () => resolve(text));
  });
}

/** Statements in cypher-shell's input: split at each `;` outside a quoted string. */
function statements(text) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < text.length) { cur += text[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; cur += c; continue; }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function plainValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

async function main() {
  const R = require(path.join(__dirname, 'relayFake.js'));
  if (tool === 'strfry') {
    const file = process.env.TODAYS_STUB_STRFRY;
    const held = readJson(file, []);
    if (args[0] === 'scan') {
      let filter = {};
      try { filter = JSON.parse(args[1] || '{}'); } catch { process.stderr.write('strfry scan: the filter is not JSON\n'); process.exit(1); }
      log({ at: 'strfry', cmd: 'scan', filter });
      for (const e of held.filter((x) => R.matches(filter, x)).sort(R.newestFirst)) process.stdout.write(`${JSON.stringify(e)}\n`);
      return 0;
    }
    if (args[0] === 'import') {
      const events = (await stdin()).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      log({ at: 'strfry', cmd: 'import', ids: events.map((e) => e.id) });
      let list = held;
      for (const e of events) {
        if (list.some((x) => x.id === e.id)) continue;
        const a = R.addressOfEvent(e);
        if (a) {
          if (list.some((x) => R.addressOfEvent(x) === a && (x.created_at > e.created_at || (x.created_at === e.created_at && x.id < e.id)))) continue;
          list = list.filter((x) => R.addressOfEvent(x) !== a);
        }
        list.push(e);
      }
      fs.writeFileSync(file, JSON.stringify(list));
      process.stdout.write(`imported ${events.length}\n`);
      return 0;
    }
    process.stderr.write(`strfry ${args.join(' ')}: the stub takes scan and import\n`);
    return 1;
  }
  if (tool === 'cypher-shell') {
    const E = require(path.join(__dirname, 'cypherEngine.js'));
    const file = process.env.TODAYS_STUB_STATE;
    const plain = args.includes('plain');
    let last = null;
    for (const q of statements(await stdin())) {
      log({ at: 'cypher-shell', query: q.replace(/\s+/g, ' ').slice(0, 600) });
      const state = readJson(file, null);
      if (!state) { process.stderr.write('cypher-shell: the stub has no graph\n'); return 1; }
      try {
        last = E.run(state, q, {}, { write: true });
      } catch (err) {
        process.stderr.write(`${err.code ? `${err.code}: ` : ''}${err.message}\n`);
        return 1;
      }
      if (E.danglingRels(state).length) { process.stderr.write('Neo.ClientError.Schema.ConstraintValidationFailed: Cannot delete a node, because it still has relationships\n'); return 1; }
      fs.writeFileSync(file, JSON.stringify(state));
    }
    if (plain && last && last.rows) {
      const cols = last.rows.length ? Object.keys(last.rows[0]) : [];
      if (cols.length) {
        process.stdout.write(`${cols.join(', ')}\n`);
        for (const r of last.rows) process.stdout.write(`${cols.map((c) => plainValue(r[c])).join(', ')}\n`);
      }
    }
    return 0;
  }
  process.stderr.write(`todaysImportersStubs: no tool ${tool}\n`);
  return 1;
}

main().then((code) => process.exit(code || 0), (err) => { process.stderr.write(`${err && err.stack ? err.stack : err}\n`); process.exit(1); });
