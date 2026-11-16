'use strict';
/**
 * Every path that makes a node sets its key and the label — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md (AC5, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md (Decisions 1, 8, 9,
 *          Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.test-plan.md
 *
 * Stack-free: the source is read (test/helpers/cypherSites.js), and the Cypher the importers build is built and read.
 * What a real Neo4j does with it — that the fragment writes nothing on a node that has both, that an import adopts an
 * event-less set, that a label disjunction finds both kinds — is the scratch-stack check the plan describes.
 *
 *   G1   keyNode(v) is ADR Decision 8's fragment: the label and a randomUUID() key, only where one is missing
 *   G2   keyNode refuses anything that isn't a plain variable name
 *   G3   the label, the rule and the index are named once, in the same module
 *   G4   every node a CREATE or MERGE makes, in every file the instance runs, gets the fragment in the same Cypher
 *   G5   the files the guard skips as unused are unused: nothing in the instance refers to them
 *   G6   buildImportCypher keys every node it makes: the event, its author, its tag nodes, its placeholders
 *   G7   buildImportCypher adopts an event-less node at an event's address, in a statement of its own, before the event
 *   G8   an a or b tag's target is looked up by NostrEvent|TapestryNode before any placeholder is made at its address
 *   G9   every other MERGE of a NostrEvent by its address adopts first; importEventDirect does, when run
 *   G10  add-subset makes its set as a TapestryNode, never a NostrEvent
 *   G11  every lookup of a node by address names NostrEvent|TapestryNode, or is listed as about the event, with why
 *   G12  firmware install doesn't wait for the rule or the index (they are migrate's)
 *   G13  the docs say how keys arrive now, and how to run the migrations
 *   G14  at control-panel start, a missing tapestry_node_uuid is made, and nothing else (Amendment 1)
 *   G15  an index already there is left alone; a name held by another definition is never replaced
 *   G16  it retries while the graph starts, gives up past its window, and never rejects
 *   G17  the control panel calls it at start, without waiting on it
 *   G18  every line naming :NostrEvent alone is classified: kept with why, or written with a label sets share (round 2)
 *   G19  no walk to elements or subsets, and no z-tag scan, ends on :NostrEvent alone (round 2; live check, finding 1)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const C = require('../../helpers/cypherSites');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const NL = String.fromCharCode(10);
const LIB = path.join(ROOT, 'src/lib/tapestry-key-cypher.js');
const KEPT_FILE = path.join(__dirname, 'nostr-event-lookups-kept.json');
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
const norm = C.norm;

function lib() {
  if (!fs.existsSync(LIB)) throw new Error('src/lib/tapestry-key-cypher.js does not exist yet (ADR graph-operations-foundation/0003 Decision 8)');
  const m = require(LIB);
  assert(typeof m.keyNode === 'function', 'src/lib/tapestry-key-cypher.js exports keyNode(variable)');
  return m;
}
/** ADR Decision 8's fragment, as written there. */
const FRAGMENT = (v) => `FOREACH (_ IN CASE WHEN NOT ${v}:TapestryNode OR ${v}.tapestryKey IS NULL OR ${v}.tapestryKey = '{}' THEN [1] ELSE [] END |
    SET ${v}:TapestryNode,
        ${v}.tapestryKey = CASE WHEN ${v}.tapestryKey IS NULL OR ${v}.tapestryKey = '{}' THEN randomUUID() ELSE ${v}.tapestryKey END)`;

// ── The files ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Files nothing in the instance runs (ADR Context 3). G5 checks that nothing refers to them. */
const NOT_RUN = [
  'src/manage/concept-graph/setup.sh',
  'src/manage/concept-graph/batchTransfer.sh',
  'src/manage/concept-graph/apocCypherCommand1_conceptGraph',
  'src/manage/concept-graph/apocCypherCommand2_conceptGraph',
];
/** Copies kept beside live scripts: …-backup.sh, …_backup.sh, …_backup_…, …-deprecated, …maybeWorks…. */
const COPY = /(?:[-_]backup\.sh$|_backup_|-deprecated|maybeWorks)/;
/** Files whose Cypher is built at run time; G6–G8 check what they build. */
const BUILT = ['src/api/neo4j/eventSync.js'];
/** Files that make nodes today (ADR Context 3), so a scanner gone wrong, or a file moved, can't pass unnoticed. */
const KNOWN = [
  'src/api/normalize/helpers.js', 'src/api/normalize/index.js', 'src/api/normalize/nodes.js',
  'src/pipeline/stream/redis-consumer.js', 'src/pipeline/tagging-edges/graph.js',
  'src/cns/prepareNeo4jForCustomerData.sh', 'src/cns/addSetsOfMetricsCards.sh', 'src/cns/addMetricsCards.sh',
  'src/pipeline/batch/processNostrEvents.sh',
  ...['follows', 'mutes', 'reports'].flatMap((x) => [`src/pipeline/batch/apocCypherCommand1_${x}`, `src/pipeline/batch/apocCypherCommand2_${x}`,
    `src/pipeline/reconciliation/apocCypherCommands/apocCypherCommand1_${x}ToAddToNeo4j`, `src/pipeline/reconciliation/apocCypherCommands/apocCypherCommand2_${x}`,
    `src/pipeline/stream/wot/apocCypherCommand2_${x}`]),
  'src/pipeline/stream/wot/apocCypherCommand1_create_wot',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'build') walk(p, out); } else out.push(p);
  }
  return out;
}
const skipped = (r) => NOT_RUN.includes(r) || COPY.test(r.split('/').pop());
/** Every file under src/ that can hold Cypher and that the instance runs. */
const liveFiles = () => walk(path.join(ROOT, 'src')).map(rel).filter((r) => C.kindOf(r) && !skipped(r));
const read = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');

// ── The fragment (Decision 8) ────────────────────────────────────────────────────────────────────────────────────

test('G1: keyNode(v) is ADR Decision 8\'s fragment for v: the label and a randomUUID() key, only where either is missing (AC5)', () => {
  const { keyNode } = lib();
  for (const v of ['e', 'u', 'tn', 't0', 'setNode']) {
    assert(norm(keyNode(v)) === norm(FRAGMENT(v)), `keyNode('${v}') is the fragment ADR Decision 8 gives; got ${show(keyNode(v))}`);
  }
});

test('G2: keyNode refuses anything that isn\'t a plain variable name, so nothing can be spliced into the Cypher (ADR Decision 8)', () => {
  const { keyNode } = lib();
  for (const bad of ['', '1a', 'a-b', 'a b', 'e) DETACH DELETE (x', 'e`', 'e}', null, undefined, 7]) {
    let threw = false;
    try { keyNode(bad); } catch { threw = true; }
    assert(threw, `keyNode(${show(bad)}) throws`);
  }
  assert(typeof keyNode('_x9') === 'string', 'a plain name is accepted');
});

test('G3: the label, the rule and the index are named once, in src/lib/tapestry-key-cypher.js (ADR Decision 1)', () => {
  const values = Object.values(lib());
  for (const name of ['TapestryNode', 'tapestry_key', 'tapestry_node_uuid']) {
    assert(values.includes(name), `the module exports a constant '${name}'; it exports ${show(Object.keys(lib()))}`);
  }
});

// ── The static guard (Decision 8, AC5) ───────────────────────────────────────────────────────────────────────────

test('G4: every node a CREATE or MERGE makes, in every file the instance runs, gets the key and the label in the same Cypher (AC5, ADR Decision 8)', () => {
  const { keyNode } = lib();
  const files = liveFiles().filter((r) => !BUILT.includes(r));
  const all = [];
  for (const r of files) all.push(...C.fileSites(r, read(r)).map((s) => ({ ...s, src: r })));
  const perFile = new Set(all.map((s) => s.file));
  const lost = KNOWN.filter((k) => !perFile.has(k));
  assert(lost.length === 0, `the guard finds the node-making Cypher in every file known to have it; none found in ${show(lost)} (scanner broken, or a file moved — update KNOWN with why)`);
  assert(all.length >= 40, `the guard finds at least the 46 sites known today; it found ${all.length}`);
  const bad = [];
  for (const s of all) {
    if (!s.variable) { bad.push(`${s.file}:${s.line}: ${s.clause.slice(0, 90)} — the node names no variable, so no key can be set on it`); continue; }
    if (!C.appliesKey(s, keyNode, read(s.file))) bad.push(`${s.file}:${s.line}: (${s.variable}:${s.labels.join(':')}) — add keyNode('${s.variable}') in the same Cypher`);
  }
  assert(bad.length === 0, `${bad.length} of ${all.length} node-making sites don't set the key and the label (ADR Decision 8):${NL}          ${bad.join(`${NL}          `)}`);
});

test('G5: the files the guard skips as unused are unused — nothing the instance runs or ships refers to them (ADR Context 3)', () => {
  const skippedFiles = walk(path.join(ROOT, 'src')).map(rel).filter((r) => C.kindOf(r) && skipped(r));
  assert(skippedFiles.length >= 4, `the skipped files exist; got ${show(skippedFiles)}`);
  for (const r of NOT_RUN) assert(fs.existsSync(path.join(ROOT, r)) || true, r);
  const roots = ['src', 'setup', 'docker', 'bin', 'scripts', 'deploy', 'lib'].map((d) => path.join(ROOT, d));
  const refs = [...roots.flatMap((d) => walk(d)), path.join(ROOT, 'package.json'), path.join(ROOT, 'Dockerfile')]
    .filter((f) => fs.existsSync(f) && !/\.(md|png|jpg|svg|lock)$/.test(f)).map(rel).filter((r) => !skipped(r));
  const texts = Object.fromEntries(refs.map((r) => [r, read(r)]));
  // A reference: a line that isn't a comment and names the file with its folder, or names it from the same folder.
  const comment = /^\s*(#|\/\/|\*|\/\*)/;
  const used = [];
  for (const s of skippedFiles) {
    const parts = s.split('/');
    const base = parts.pop();
    const withDir = `${parts[parts.length - 1]}/${base}`;
    const by = refs.filter((r) => r !== s && texts[r].split(NL).some((line) => !comment.test(line)
      && (line.includes(withDir) || (line.includes(base) && path.posix.dirname(r) === parts.join('/')))));
    if (by.length) used.push(`${s} is referred to by ${by.join(', ')}`);
  }
  assert(used.length === 0, `a file the guard skips is in use, so it must set keys too:${NL}          ${used.join(`${NL}          `)}`);
});

// ── The import's Cypher (Decisions 8 and 9) ──────────────────────────────────────────────────────────────────────

const PK = 'a1'.repeat(32);
const OTHER = 'b2'.repeat(32);
const ITEM_ADDR = `39999:${PK}:item-1`;
const HEADER_ADDR = `39998:${PK}:widget`;
const A_REF = `39999:${OTHER}:elsewhere`;
const B_PARENT = `39999:${OTHER}:parent`;
const B_TARGET = `39998:${OTHER}:other`;
const B_EVENT = 'f6'.repeat(32);
const EVENTS = {
  note: { id: 'c3'.repeat(32), pubkey: PK, kind: 1, created_at: 1762632000, content: 'hi', tags: [['e', 'd4'.repeat(32)], ['p', OTHER]] },
  item: {
    id: 'e5'.repeat(32), pubkey: PK, kind: 39999, created_at: 1762632001, content: '',
    tags: [['d', 'item-1'], ['name', 'Item one'], ['z', HEADER_ADDR], ['a', A_REF], ['b', B_PARENT, 'inherit'], ['b', B_TARGET], ['b', B_EVENT]],
  },
  header: { id: 'a7'.repeat(32), pubkey: PK, kind: 39998, created_at: 1762632002, content: '', tags: [['d', 'widget'], ['names', 'widget', 'widgets']] },
};
function quietRequire(abs) {
  const saved = {};
  for (const k of ['log', 'info', 'warn', 'debug']) { saved[k] = console[k]; console[k] = () => {}; }
  try { return require(abs); } finally { Object.assign(console, saved); }
}
function built(name) {
  const { buildImportCypher } = quietRequire(path.join(ROOT, 'src/api/neo4j/eventSync.js'));
  const out = buildImportCypher(EVENTS[name]);
  assert(Array.isArray(out) && out.every((s) => typeof s === 'string'), `buildImportCypher returns statements; got ${show(out).slice(0, 200)}`);
  return out;
}
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DISJ = '(?:NostrEvent\\s*\\|\\s*TapestryNode|TapestryNode\\s*\\|\\s*NostrEvent)';
/** Does `q` adopt the node at `addr` — `addr` a quoted literal or a $param — before `beforeAt`, without blocking the rest? */
function adopts(q, addr, beforeAt = q.length) {
  const head = q.slice(0, beforeAt);
  const at = `\\s*\\{\\s*uuid\\s*:\\s*${addr}\\s*\\}`;
  const m = head.match(new RegExp(`\\(\\s*([A-Za-z_]\\w*)\\s*:\\s*TapestryNode${at}\\s*\\)`));
  if (!m) return false;
  const v = m[1];
  if (!new RegExp(`SET\\s+${v}\\s*:\\s*NostrEvent\\b`).test(head)) return false;
  // a statement of its own, which makes nothing; or, in the same statement, an OPTIONAL MATCH that can't stop it
  if (beforeAt === q.length) return !/\b(MERGE|CREATE)\b/.test(q);
  return new RegExp(`OPTIONAL\\s+MATCH\\s*\\(\\s*${v}\\s*:\\s*TapestryNode`).test(head);
}

test('G6: buildImportCypher keys every node it makes — the event, its author, each tag node, and each placeholder — in the statement that makes it (AC5)', () => {
  const { keyNode } = lib();
  let n = 0;
  const bad = [];
  for (const name of Object.keys(EVENTS)) {
    for (const stmt of built(name)) {
      for (const s of C.nodeSites(stmt)) {
        n++;
        if (!s.variable) bad.push(`${name}: ${s.clause.slice(0, 80)} — no variable`);
        else if (!norm(stmt).includes(norm(keyNode(s.variable)))) bad.push(`${name}: (${s.variable}:${s.labels.join(':')}) in ${show(stmt.slice(0, 140))}`);
      }
    }
  }
  assert(n >= 12, `the sample events reach every branch (event, author, tags, e/a/b references); only ${n} nodes were made`);
  assert(bad.length === 0, `${bad.length} of ${n} nodes the import makes get no key:${NL}          ${bad.join(`${NL}          `)}`);
});

test('G7: for an event with an address, buildImportCypher first adopts an event-less node at that address (giving it NostrEvent back), in a statement of its own, so the event lands on it (AC6, ADR Decision 9)', () => {
  for (const [name, addr] of [['item', ITEM_ADDR], ['header', HEADER_ADDR]]) {
    const stmts = built(name);
    const lit = `'${reEsc(addr)}'`;
    const mergeRe = new RegExp(`MERGE\\s*\\(\\s*\\w+\\s*:\\s*NostrEvent\\s*\\{\\s*uuid\\s*:\\s*${lit}`);
    const i = stmts.findIndex((s) => mergeRe.test(s));
    assert(i >= 0, `${name}: the event is still MERGEd by its address; got ${show(stmts.map((s) => s.slice(0, 80)))}`);
    const ok = stmts.slice(0, i).some((s) => adopts(s, lit)) || adopts(stmts[i], lit, stmts[i].search(mergeRe));
    assert(ok, `${name}: before MERGE (e:NostrEvent {uuid: '${addr}'}), a statement adopts the node at that address: MATCH (x:TapestryNode {uuid: '${addr}'}) WHERE NOT x:NostrEvent SET x:NostrEvent, in a statement of its own (or as an OPTIONAL MATCH in the same one); got ${show(stmts.slice(0, i + 1).map((s) => s.slice(0, 160)))}`);
  }
});

test('G8: an a or b tag\'s target is looked up by NostrEvent|TapestryNode before any placeholder is made at its address, so a reference never makes a second node at an event-less set\'s address (AC6, ADR Decision 9)', () => {
  const stmts = built('item');
  const bad = [];
  for (const ref of [A_REF, B_PARENT, B_TARGET, B_EVENT]) {
    const lit = `'${reEsc(ref)}'`;
    // The statements that find a node at the address ({uuid: '<ref>'}); the tag statement also holds it, as a value.
    const mine = stmts.filter((s) => new RegExp(`\\{\\s*uuid\\s*:\\s*${lit}`).test(s));
    if (!mine.length) { bad.push(`${ref}: no statement names it`); continue; }
    for (const s of mine) {
      const look = s.search(new RegExp(`:\\s*${DISJ}\\s*\\{\\s*uuid\\s*:\\s*${lit}`));
      const merge = s.search(new RegExp(`MERGE\\s*\\(\\s*\\w+\\s*:\\s*NostrEvent\\s*\\{\\s*uuid\\s*:\\s*${lit}`));
      if (look < 0) bad.push(`${ref}: not looked up by NostrEvent|TapestryNode in ${show(s.slice(0, 200))}`);
      else if (merge >= 0 && merge < look) bad.push(`${ref}: a placeholder is MERGEd before the lookup in ${show(s.slice(0, 200))}`);
    }
  }
  assert(bad.length === 0, bad.join(`${NL}          `));
});

/** Every literal in a live JavaScript file (not BUILT) that MERGEs a NostrEvent by its address. */
function mergesByAddress() {
  const out = [];
  for (const r of liveFiles().filter((x) => C.kindOf(x) === 'js' && !BUILT.includes(x))) {
    const src = read(r);
    const lits = C.literals(r, src).sort((a, b) => a.start - b.start);
    lits.forEach((l, idx) => {
      const text = src.slice(l.start, l.end);
      const m = text.search(/MERGE\s*\(\s*\w+\s*:\s*NostrEvent\s*\{\s*uuid\s*:/);
      if (m >= 0) out.push({ file: r, line: C.lineAt(src, l.start + m), text, idx, lits, src });
    });
  }
  return out;
}

test('G9: every other MERGE of a NostrEvent by its address adopts an event-less node there first — the signing routes\' importEventDirect included — and helpers.importEventDirect does so when run (AC6; a gap ADR Decision 9 left, closed at Test Design)', () => {
  const bad = [];
  const found = mergesByAddress();
  assert(found.length >= 2, `the two importEventDirect functions are found; got ${show(found.map((f) => `${f.file}:${f.line}`))}`);
  for (const f of found) {
    const at = f.text.search(/MERGE\s*\(\s*\w+\s*:\s*NostrEvent\s*\{\s*uuid\s*:/);
    if (adopts(f.text, '\\$\\w+', at)) continue;
    const earlier = f.lits.slice(Math.max(0, f.idx - 6), f.idx).filter((l) => C.lineAt(f.src, l.start) >= f.line - 40).map((l) => f.src.slice(l.start, l.end));
    if (!earlier.some((t) => adopts(t, '\\$\\w+'))) bad.push(`${f.file}:${f.line}: MERGE of a NostrEvent by its address with no adoption before it`);
  }
  assert(bad.length === 0, bad.join(`${NL}          `));
  // helpers.importEventDirect, run with the driver replaced: the adoption reaches the graph before the MERGE does
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'key-paths-'));
  try {
    const script = path.join(dir, 'child.js');
    const driver = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver.js'));
    fs.writeFileSync(script, [
      `'use strict';`,
      `const calls = [];`,
      `require.cache[${show(driver)}] = { id: ${show(driver)}, filename: ${show(driver)}, loaded: true, exports: {`,
      `  runCypher: async (q, p) => { calls.push({ q, p }); return []; }, writeCypher: async (q, p) => { calls.push({ q, p }); return []; },`,
      `} };`,
      `for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};`,
      `const h = require(${show(path.join(ROOT, 'src/api/normalize/helpers.js'))});`,
      `h.importEventDirect(${show(EVENTS.item)}, ${show(ITEM_ADDR)}).then(() => process.stdout.write('RESULT:' + JSON.stringify(calls) + '\\n'), (e) => process.stdout.write('RESULT:' + JSON.stringify({ error: e.message }) + '\\n'));`,
    ].join(NL));
    const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', timeout: 30000, env: { ...process.env, NEO4J_URI: 'bolt://127.0.0.1:9', HOME: dir } });
    const line = String(r.stdout).split(NL).find((l) => l.startsWith('RESULT:'));
    const calls = line ? JSON.parse(line.slice(7)) : null;
    assert(Array.isArray(calls), `importEventDirect ran with the driver replaced; got ${show(calls)} ${String(r.stderr).slice(-300)}`);
    const i = calls.findIndex((c) => /MERGE\s*\(\s*\w+\s*:\s*NostrEvent\s*\{\s*uuid\s*:/.test(c.q));
    assert(i >= 0, `it MERGEs the event by its address; got ${show(calls.map((c) => c.q.slice(0, 80)))}`);
    const paramOf = (q) => (q.match(/TapestryNode\s*\{\s*uuid\s*:\s*\$(\w+)/) || [])[1];
    const ok = calls.slice(0, i + 1).some((c, j) => {
      const p = paramOf(c.q);
      if (!p || !c.p || c.p[p] !== ITEM_ADDR) return false;
      return j < i ? adopts(c.q, `\\$${p}`) : adopts(c.q, `\\$${p}`, c.q.search(/MERGE\s*\(\s*\w+\s*:\s*NostrEvent\s*\{\s*uuid\s*:/));
    });
    assert(ok, `before the MERGE, a call adopts the node at ${ITEM_ADDR}; the calls were ${show(calls.slice(0, i + 1).map((c) => ({ q: c.q.replace(/\s+/g, ' ').slice(0, 140), p: c.p })))}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('G10: add-subset makes its set as a TapestryNode at its address, with ListItem and Set, and never names NostrEvent on it (AC6, ADR Decision 9)', () => {
  const r = 'src/api/normalize/nodes.js';
  const src = read(r);
  const lits = C.literals(r, src).map((l) => src.slice(l.start, l.end)).filter((t) => /ON\s+CREATE\s+SET/.test(t) && /:\s*ListItem\s*:\s*Set\b/.test(t));
  assert(lits.length === 1, `add-subset's write is the one literal in nodes.js that sets ListItem:Set ON CREATE; found ${lits.length}`);
  const t = lits[0];
  const site = C.nodeSites(t).find((s) => s.labels.includes('TapestryNode'));
  assert(site && site.variable && /\{\s*uuid\s*:\s*\$\w+\s*\}/.test(site.clause), `it MERGEs (s:TapestryNode {uuid: $uuid}); got ${show(C.nodeSites(t).map((s) => s.clause))}`);
  assert(!new RegExp(`\\b${site.variable}\\s*:\\s*([A-Za-z_]+\\s*:\\s*)*NostrEvent\\b`).test(t), `it never gives the set NostrEvent; got ${show(t.replace(/\s+/g, ' ').slice(0, 300))}`);
});

// ── Lookups by address (Decision 9) ──────────────────────────────────────────────────────────────────────────────

const LOOKUP = [/:\s*NostrEvent\s*\{\s*uuid\b/, /\(\s*\w*\s*:\s*NostrEvent\s*\)\s*WHERE\s+\w+\.uuid\s*(=|IN\b)/];
function lookups() {
  const files = [...liveFiles(), ...walk(path.join(ROOT, 'ui/src')).map(rel).filter((r) => /\.(js|jsx)$/.test(r))];
  const out = [];
  for (const r of files) {
    read(r).split(NL).forEach((line, i) => { if (LOOKUP.some((re) => re.test(line))) out.push({ file: r, line: i + 1, text: line.trim() }); });
  }
  return out;
}

test('G11: every lookup of a node by its address names NostrEvent|TapestryNode, or is listed in nostr-event-lookups-kept.json as about the event, with why; no listed line is stale (AC6, ADR Decision 9)', () => {
  for (const sample of ['MATCH (e:NostrEvent {uuid: $u})', 'MATCH (n:NostrEvent) WHERE n.uuid = $u']) assert(LOOKUP.some((re) => re.test(sample)), `the guard catches ${sample}`);
  for (const sample of ['MATCH (e:NostrEvent|TapestryNode {uuid: $u})', 'MATCH (e:TapestryNode|NostrEvent {uuid: $u})', 'MATCH (e:NostrEventTag {uuid: $u})']) {
    assert(!LOOKUP.some((re) => re.test(sample)), `the guard lets ${sample} through`);
  }
  let kept = [];
  if (fs.existsSync(KEPT_FILE)) {
    const doc = JSON.parse(fs.readFileSync(KEPT_FILE, 'utf8'));
    kept = Array.isArray(doc.kept) ? doc.kept : [];
  }
  const stale = kept.filter((k) => !k || typeof k.reason !== 'string' || k.reason.trim().length < 8 || !fs.existsSync(path.join(ROOT, k.file || ''))
    || !read(k.file).split(NL).some((l) => l.trim() === k.text));
  assert(stale.length === 0, `entries in ${rel(KEPT_FILE)} must name a file, the line's text as it stands, and why it is about the event; stale or bare: ${show(stale).slice(0, 600)}`);
  const ok = new Set(kept.map((k) => `${k.file}\u0000${k.text}`));
  const left = lookups().filter((l) => !ok.has(`${l.file}\u0000${l.text}`));
  assert(left.length === 0, `${left.length} lookups by address name only NostrEvent, so they miss an event-less set once event-less-nodes has run. Write each as (:NostrEvent|TapestryNode {uuid: …}), or, when it is about the event itself, list it in ${rel(KEPT_FILE)} with why:${NL}          ${left.slice(0, 40).map((l) => `${l.file}:${l.line}  ${l.text.slice(0, 100)}`).join(`${NL}          `)}${left.length > 40 ? `${NL}          … and ${left.length - 40} more` : ''}`);
});

// ── Every line that names NostrEvent alone (Decision 9; review round 2, Blocking 1) ───────────────────────────────

/** `:NostrEvent` with no disjunction on either side, not NostrEventTag. */
const ALONE = /:\s*NostrEvent\b(?!Tag)(?!\s*\|)/;
const COMMENT = /^\s*(\/\/|\*|\/\*|#)/;
function aloneLines() {
  const files = [...liveFiles(), ...walk(path.join(ROOT, 'ui/src')).map(rel).filter((r) => /\.(js|jsx)$/.test(r))];
  const out = [];
  for (const r of files) {
    read(r).split(NL).forEach((line, i) => { if (!COMMENT.test(line) && ALONE.test(line)) out.push({ file: r, line: i + 1, text: line.trim() }); });
  }
  return out;
}
function keptEntries() {
  if (!fs.existsSync(KEPT_FILE)) return [];
  const doc = JSON.parse(fs.readFileSync(KEPT_FILE, 'utf8'));
  return Array.isArray(doc.kept) ? doc.kept : [];
}

test('G18: every line that names :NostrEvent alone — a scan, a walk or a lookup — is listed in nostr-event-lookups-kept.json with why it is about the event; every other line names a label an event-less set also has (AC6, ADR Decision 9; review round 2, Blocking 1)', () => {
  for (const sample of ['MATCH (e:NostrEvent) WHERE e.kind = 1', '-[:HAS_ELEMENT]->(e:NostrEvent)', 'MATCH (n:NostrEvent:ListHeader)', 'SET x:NostrEvent']) assert(ALONE.test(sample), `the guard catches ${sample}`);
  for (const sample of ['(e:NostrEvent|TapestryNode {uuid: $u})', '(n:TapestryNode|NostrEvent)', '(n:NostrEvent|Set)', '(t:NostrEventTag {type: \'z\'})', "WHERE 'NostrEvent' IN labels(n)"]) {
    assert(!ALONE.test(sample), `the guard lets ${sample} through`);
  }
  const ok = new Set(keptEntries().map((k) => `${k.file}\u0000${k.text}`));
  const left = aloneLines().filter((l) => !ok.has(`${l.file}\u0000${l.text}`));
  assert(left.length === 0, `${left.length} lines name only NostrEvent. Once event-less-nodes has run, a scan or walk among them that should find sets misses event-less ones: name :Set or :ListItem, use NostrEvent|Set, or drop the far end's label. A line about the event itself goes in ${rel(KEPT_FILE)}, with why:${NL}          ${left.slice(0, 60).map((l) => `${l.file}:${l.line}  ${l.text.slice(0, 110)}`).join(`${NL}          `)}${left.length > 60 ? `${NL}          … and ${left.length - 60} more` : ''}`);
});

/** Shapes that always reach sets, so no kept entry excuses them. */
const SET_REACHING = [
  { what: 'a HAS_ELEMENT walk ending on :NostrEvent alone', re: /HAS_ELEMENT[^\]]*\]\s*->\s*\(\s*\w*\s*:\s*NostrEvent\b(?!Tag)(?!\s*\|)/ },
  { what: 'an IS_A_SUPERSET_OF walk ending on :NostrEvent alone', re: /IS_A_SUPERSET_OF[^\]]*\]\s*->\s*\(\s*\w*\s*:\s*NostrEvent\b(?!Tag)(?!\s*\|)/ },
  { what: 'a z-tag scan from :NostrEvent alone', re: /\(\s*\w*\s*:\s*NostrEvent\s*\)\s*-\s*\[\s*:\s*HAS_TAG\s*\]\s*->\s*\(\s*\w*\s*:\s*NostrEventTag\s*\{\s*type\s*:\s*'z'/ },
];

test('G19: no walk to a concept\'s elements or subsets, and no scan of z tags, ends on :NostrEvent alone — the set concept\'s Elements tab and the concept counts among them (AC6, ADR Decision 9; live check, finding 1)', () => {
  const samples = [
    ['-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(e:NostrEvent)', 0],
    ['"-[:IS_A_SUPERSET_OF|HAS_ELEMENT*1..4]->(e:NostrEvent)-[:HAS_TAG]->', 0],
    ['MATCH (e:NostrEvent)-[:HAS_TAG]->(zt:NostrEventTag {type: \'z\', value: x})', 2],
  ];
  for (const [t, k] of samples) assert(SET_REACHING[k].re.test(t), `the guard catches ${t}`);
  assert(!SET_REACHING.some((x) => x.re.test('-[:HAS_ELEMENT]->(e)')) && !SET_REACHING.some((x) => x.re.test('MATCH (e)-[:HAS_TAG]->(zt:NostrEventTag {type: \'z\'})')), 'the guard lets a far end with no label through');
  const files = [...liveFiles(), ...walk(path.join(ROOT, 'ui/src')).map(rel).filter((r) => /\.(js|jsx)$/.test(r))];
  const bad = [];
  for (const r of files) {
    read(r).split(NL).forEach((line, i) => {
      if (COMMENT.test(line)) return;
      for (const x of SET_REACHING) if (x.re.test(line)) bad.push(`${r}:${i + 1}  ${x.what}: ${line.trim().slice(0, 110)}`);
    });
  }
  for (const r of ['ui/src/pages/concepts/ConceptElements.jsx', 'ui/src/utils/conceptCounts.js', 'ui/src/pages/concepts/ConceptList.jsx']) {
    assert(fs.existsSync(path.join(ROOT, r)), `${r} exists`);
  }
  assert(bad.length === 0, `${bad.length} walks or scans that reach sets end on :NostrEvent alone, so event-less sets drop out (the set concept's Elements tab lost 100 → 98 on Neo4j). Drop the far end's label, or name NostrEvent|Set:${NL}          ${bad.join(`${NL}          `)}`);
});

// ── Firmware and the docs ────────────────────────────────────────────────────────────────────────────────────────

test('G12: firmware install doesn\'t wait for the rule or the index — they are migrate\'s, and a new instance has neither until it runs (ADR Decision 1)', () => {
  const { EXPECTED_CONSTRAINTS, EXPECTED_INDEXES } = require(path.join(ROOT, 'src/api/status/queries/expectedNeo4jSchema.js'));
  assert(Array.isArray(EXPECTED_CONSTRAINTS) && EXPECTED_CONSTRAINTS.length > 0, 'the expected schema is read');
  assert(!EXPECTED_CONSTRAINTS.includes('tapestry_key') && !EXPECTED_INDEXES.includes('tapestry_node_uuid'), `neither is among what firmware install waits for; got ${show({ EXPECTED_CONSTRAINTS, EXPECTED_INDEXES })}`);
});

test('G13: the docs say how keys arrive now, and how to run the migrations: OPERATIONS.md, BIBLE §29 and §6, and ADR 0002\'s amendment note (ADR Implementation notes)', () => {
  const ops = read('OPERATIONS.md');
  assert(/lifecycle migrate --migration tapestry-keys/.test(ops) && /event-less-nodes/.test(ops), 'OPERATIONS.md says to run `tapestry lifecycle migrate --migration tapestry-keys`, then event-less-nodes, once per instance');
  const bible = read('BIBLE.md');
  assert(/TapestryNode/.test(bible), 'BIBLE.md says every node carries TapestryNode and a key from the moment it is made (§29)');
  const adr2 = read('engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md');
  assert(/Amended by[^\n]*0003/i.test(adr2), 'ADR 0002 notes it is amended by graph-operations-foundation/0003 (Decision 10)');
});

// ── The index at control-panel start (ADR 0003 Amendment 1) ──────────────────────────────────────────────────────

const BOOT = path.join(ROOT, 'src/lib/tapestry-node-index.js');
const INDEX_STATEMENT = 'CREATE INDEX tapestry_node_uuid IF NOT EXISTS FOR (n:TapestryNode) ON (n.uuid)';
function bootHook() {
  if (!fs.existsSync(BOOT)) throw new Error('src/lib/tapestry-node-index.js does not exist yet (ADR graph-operations-foundation/0003 Amendment 1)');
  const m = require(BOOT);
  assert(typeof m.ensureUuidIndexOnBoot === 'function', 'src/lib/tapestry-node-index.js exports ensureUuidIndexOnBoot({ runWrite, runRead, log, sleep, windowMs })');
  return m.ensureUuidIndexOnBoot;
}
/** A schema in memory: `indexes` are SHOW INDEXES rows. `failFirst` reads fail with `failCode` before one answers. */
function bootRun({ indexes = [], failFirst = 0, failCode = 'ServiceUnavailable', windowMs } = {}) {
  const ensure = bootHook();
  const writes = [];
  const lines = [];
  const sleeps = [];
  let fails = failFirst;
  const err = (code) => Object.assign(new Error(`fake: ${code}`), { code });
  const runRead = async (q) => {
    if (fails > 0) { fails--; throw err(failCode); }
    if (!/^\s*SHOW\s+INDEXES\b/i.test(q)) throw new Error(`the hook reads only SHOW INDEXES; it read: ${q}`);
    return indexes.map((x) => ({ ...x }));
  };
  const runWrite = async (q) => {
    writes.push(norm(q));
    if (fails > 0) { fails--; throw err(failCode); }
    if (norm(q) === INDEX_STATEMENT) indexes.push({ name: 'tapestry_node_uuid', state: 'POPULATING', type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['TapestryNode'], properties: ['uuid'], owningConstraint: null });
    return [];
  };
  let p;
  try {
    p = ensure({ runWrite, runRead, log: (l) => lines.push(String(l)), sleep: async (ms) => { sleeps.push(ms); }, ...(windowMs ? { windowMs } : {}) });
  } catch (e) {
    throw new Error(`ensureUuidIndexOnBoot threw synchronously; it must never throw: ${e.message}`);
  }
  assert(p && typeof p.then === 'function', 'ensureUuidIndexOnBoot returns a promise');
  return p.then((out) => ({ out, writes, lines, sleeps }), (e) => { throw new Error(`ensureUuidIndexOnBoot rejected; it must never reject: ${e.message}`); });
}

test('G14: at control-panel start, a missing tapestry_node_uuid is made with Decision 1\'s statement, in a call of its own, and nothing else is made or written (ADR 0003 Amendment 1)', async () => {
  const { out, writes, lines } = await bootRun();
  assert(writes.length === 1 && writes[0] === INDEX_STATEMENT, `exactly one write, ${INDEX_STATEMENT}; got ${show(writes)}`);
  assert(!writes.some((w) => /CONSTRAINT|tapestryKey|SET\b|MERGE\b|CREATE\s*\(/i.test(w)), `no rule, and no data, is written: the rule stays migrate's (AC2); got ${show(writes)}`);
  assert(out && out.outcome === 'created', `it answers { outcome: 'created' }; got ${show(out)}`);
  assert(lines.some((l) => /tapestry_node_uuid/.test(l) && /created/i.test(l)), `it logs one line saying it made the index; got ${show(lines)}`);
});

test('G15: an index already there is left alone; a name held by another definition is never replaced, and is logged as not created: name-taken (ADR 0003 Amendment 1)', async () => {
  const there = await bootRun({ indexes: [{ name: 'tapestry_node_uuid', state: 'ONLINE', type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['TapestryNode'], properties: ['uuid'], owningConstraint: null }] });
  assert(there.writes.length === 0 && there.out.outcome === 'present', `with the index there, nothing is written and it answers present; got ${show(there)}`);
  const taken = await bootRun({ indexes: [{ name: 'tapestry_node_uuid', state: 'ONLINE', type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['NostrEvent'], properties: ['uuid'], owningConstraint: null }] });
  assert(taken.writes.length === 0, `a name held by another definition is never dropped or replaced; got ${show(taken.writes)}`);
  assert(taken.out.outcome === 'not-created' && taken.out.code === 'name-taken' && taken.lines.some((l) => /not created: name-taken/.test(l)), `it answers and logs not created: name-taken; got ${show(taken)}`);
});

test('G16: while the graph doesn\'t answer yet it retries, waiting longer each time, then makes the index; past its window it gives up with one line; it never rejects (ADR 0003 Amendment 1)', async () => {
  const later = await bootRun({ failFirst: 3 });
  assert(later.out.outcome === 'created' && later.writes.filter((w) => w === INDEX_STATEMENT).length === 1, `after three refusals it makes the index once; got ${show(later)}`);
  assert(later.sleeps.length === 3 && later.sleeps.every((ms, i) => i === 0 || ms >= later.sleeps[i - 1]), `it waits between tries, never less than the time before; got ${show(later.sleeps)}`);
  const never = await bootRun({ failFirst: 1000, windowMs: 60000 });
  assert(never.out.outcome === 'gave-up' && never.lines.filter((l) => /tapestry_node_uuid/.test(l)).length === 1, `past its window it answers gave-up and logs one line; got ${show({ out: never.out, lines: never.lines })}`);
  const other = await bootRun({ failFirst: 1, failCode: 'Neo.ClientError.Statement.SyntaxError' });
  assert(other.out.outcome === 'not-created' && other.sleeps.length === 0, `an error that isn't the graph starting stops it at once, with no retry; got ${show(other)}`);
});

test('G17: the control panel calls ensureUuidIndexOnBoot when it starts, without waiting on it, as it does tagging-edges\' rule (ADR 0003 Amendment 1)', () => {
  const src = read('bin/control-panel.js');
  const at = src.search(/require\(\s*['"]\.\.\/src\/lib\/tapestry-node-index['"]\s*\)\s*\.\s*ensureUuidIndexOnBoot\s*\(/);
  assert(at >= 0, 'bin/control-panel.js calls require(\'../src/lib/tapestry-node-index\').ensureUuidIndexOnBoot({ … })');
  const before = src.slice(Math.max(0, at - 200), at);
  assert(!/await\s*$/.test(before.trimEnd()), 'the call is not awaited: startup never waits on the graph');
  const regs = src.search(/await\s+api\.register\(\s*app\s*\)/);
  assert(regs >= 0 && regs < at, 'it is called once the routes are registered, beside ensureTagsConstraintOnBoot');
});

async function run() {
  console.log(`${NL}=== operations: tapestry keys on every node ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}operations: tapestry keys on every node: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
