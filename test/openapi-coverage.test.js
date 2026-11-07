'use strict';
/**
 * The API document's coverage gate — openapi-coverage #1.
 *   Story: engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.md (Bug; no ADR — Architecture
 *          skipped at the planning gate)
 *   Plan:  engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.test-plan.md
 *
 * It compares three sets, each as "METHOD /path":
 *   registered — what the server registers under /api/: the admin-action sweep's router walk (test/helpers/routeWalk.js)
 *                in a CHILD PROCESS (register(app) has side effects the gate must not see), plus any /api/ route the
 *                entrypoint bin/control-panel.js registers itself, found by a scan of its source (none today);
 *   documented — the method entries under `paths:` in src/api/openapi.yaml, read with js-yaml, the reader the server
 *                uses to serve /docs, so a path key in quotes counts like any other;
 *   gaps       — test/fixtures/openapi-known-gaps.json, one "METHOD /path" string per route registered but not yet
 *                documented. It can only shrink: GAP_CEILING below is lowered when a story documents an area, and
 *                never raised.
 * `:param`, `{param}` and `*` read as one path segment, a trailing slash is ignored, and a documented HEAD counts as
 * registered wherever GET is (Express answers HEAD for every GET route).
 *
 *   W1 — the child walk returns the whole router without touching a router file.                          [AC1]
 *   E1 — the entrypoint scan: bin/control-panel.js registers no /api/ route today; an added one is found.   [AC1]
 *   M1 — matching: :param, {param} and * are one segment; the method counts; trailing slash; HEAD as GET.  [AC1]
 *   M2 — quoted path keys (single and double) are read like plain ones, in a fragment and in the real
 *        document (today '/api/settings/{keyPath}', which documents DELETE /api/settings/*).              [AC1]
 *   G1 — the gap list exists and holds one "METHOD /api/…" string per line.                                [AC2]
 *   C2 — every registered route has an entry or a gap-list line, else it is named.                          [AC2 a]
 *   C3 — no gap-list line names a documented route (the list only shrinks).                                [AC2 b]
 *   C4 — every documented method and path is registered.                                                    [AC2 c]
 *   C5 — every gap-list line names a registered route, and none is there twice.                             [AC2 d]
 *   C6 — the gap list holds at most GAP_CEILING lines.                                                     [AC3]
 *   D1 — each rule, on made-up sets: it names the offending route, and stops once the cause is gone.        [AC2]
 *   D2 — the suite itself, run in a throwaway copy of the tree: the unchanged copy passes; with a route added
 *        to src/api/index.js and no entry, and a documented route's line put on the gap list, it exits
 *        non-zero and names both (the way the admin-action sweep's AC6b shows its own failure).               [AC2]
 *        Skipped when OPENAPI_COVERAGE_SKIP_DEMO=1 (set for the copy's own run, so the demo never recurses).
 *
 * Stack-free: no running instance, no container, no network.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const OPENAPI = path.join(ROOT, 'src/api/openapi.yaml');
const GAPS = path.join(ROOT, 'test/fixtures/openapi-known-gaps.json');
const ENTRYPOINT = path.join(ROOT, 'bin/control-panel.js');
const WALKER = path.join(ROOT, 'test/helpers/routeWalk.js');
const NL = String.fromCharCode(10);

/** The most lines the gap list may hold. Lower it when a story documents an area; never raise it. */
const GAP_CEILING = 196;

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];
const LINE_RE = /^(GET|POST|PUT|PATCH|DELETE) \/api\/\S*$/;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const list = (xs) => `${NL}        ${xs.join(NL + '        ')}`;

// ── Matching ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** One path segment's matching form: a parameter (:name, {name}) or a wildcard (*) reads as {}. */
function normSegment(seg) {
  if (/^\{[^}]*\}$/.test(seg)) return '{}';
  if (seg.includes('*')) return '{}';
  if (seg.startsWith(':')) return seg.replace(/^:[A-Za-z0-9_]+\??/, '{}');
  return seg;
}
function normPath(p) {
  const trimmed = p.length > 1 ? p.replace(/\/+$/, '') : p;
  return trimmed.split('/').map(normSegment).join('/');
}
/** The matching key of a method and a path. */
const keyOf = (method, p) => `${String(method).toUpperCase()} ${normPath(p)}`;

/** Map key → first spelling seen ("METHOD /path" as written), over [method, path] pairs. */
function keyed(pairs) {
  const m = new Map();
  for (const [method, p] of pairs) {
    const k = keyOf(method, p);
    if (!m.has(k)) m.set(k, `${String(method).toUpperCase()} ${p}`);
  }
  return m;
}

/** The documented [method, path] pairs of an OpenAPI document's text. Throws if the YAML doesn't load. */
function documentedPairs(text) {
  const doc = yaml.load(text);
  const out = [];
  for (const [p, item] of Object.entries((doc && doc.paths) || {})) {
    for (const m of METHODS) if (item && item[m]) out.push([m.toUpperCase(), p]);
  }
  return out;
}

/** "METHOD /path" lines → [method, path] pairs. */
const linePairs = (lines) => lines.map((l) => { const sp = l.indexOf(' '); return [l.slice(0, sp), l.slice(sp + 1)]; });

/**
 * Every problem the gate reports. registered and documented are [method, path] pairs; gaps is the list's lines.
 * Each result lists "METHOD /path" spellings: registered spelling for undocumented routes, the document's for
 * unregistered entries, the list's own line for gap-list problems.
 */
function findProblems({ registered, documented, gaps, ceiling = GAP_CEILING }) {
  const reg = keyed(registered.filter(([, p]) => p.startsWith('/api/')));
  const docd = keyed(documented.filter(([, p]) => p.startsWith('/api/')));
  const gapKeys = new Map();
  const doubledGaps = [];
  for (const line of gaps) {
    const [m, p] = linePairs([line])[0];
    const k = keyOf(m, p);
    if (gapKeys.has(k)) doubledGaps.push(line); else gapKeys.set(k, line);
  }
  const isRegistered = (k) => reg.has(k) || (k.startsWith('HEAD ') && reg.has(`GET ${k.slice(5)}`));
  return {
    undocumented: [...reg.entries()].filter(([k]) => !docd.has(k) && !gapKeys.has(k)).map(([, s]) => s),
    listedButDocumented: [...gapKeys.entries()].filter(([k]) => docd.has(k)).map(([, s]) => s),
    documentedNotRegistered: [...docd.entries()].filter(([k]) => !isRegistered(k)).map(([, s]) => s),
    staleGaps: [...gapKeys.entries()].filter(([k]) => !reg.has(k)).map(([, s]) => s),
    doubledGaps,
    overCeiling: gaps.length > ceiling ? [`${gaps.length} lines, ceiling ${ceiling}`] : [],
  };
}

// ── Registered routes ──────────────────────────────────────────────────────────────────────────────────────────────

/** /api/ routes an entrypoint source registers itself with a literal path (app.<method>('/api/…')). */
function scanEntrypoint(src) {
  const out = [];
  const re = /\bapp\.(get|post|put|patch|delete|all)\(\s*(['"`])(\/api\/[^'"`]*)\2/g;
  let m;
  while ((m = re.exec(src))) out.push([m[1].toUpperCase(), m[3]]);
  return out;
}

let WALK = null;
function walk() {
  if (WALK) return WALK;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-walk-'));
  const outFile = path.join(dir, 'out.json');
  const env = {
    ...process.env,
    TAPESTRY_SETTINGS_PATH: path.join(dir, 'settings.json'),
    BRAINSTORM_BASE_DIR: dir,
    BRAINSTORM_CONF_PATH: path.join(dir, 'brainstorm.conf'),
  };
  delete env.TASK_QUEUE_ENABLED;
  fs.writeFileSync(env.BRAINSTORM_CONF_PATH, '');
  const r = spawnSync(process.execPath, [WALKER, outFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 90000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by W1 */ }
  fs.rmSync(dir, { recursive: true, force: true });
  WALK = { child: r, data };
  return WALK;
}

/** Registered [method, path] pairs: the walk plus the entrypoint's own /api/ routes. Throws if the walk failed. */
function registeredPairs() {
  const { child, data } = walk();
  assert(child.status === 0 && data && !data.registerError,
    `the router walk failed (exit ${child.status}): ${(data && data.registerError) || (child.stderr || '').slice(0, 300)}`);
  return [...data.routes.map((r) => [r.method, r.path]), ...scanEntrypoint(fs.readFileSync(ENTRYPOINT, 'utf8'))];
}

/** The gap list's lines, or throw the right failing reason. */
function gapLines() {
  assert(fs.existsSync(GAPS), 'the gap list test/fixtures/openapi-known-gaps.json does not exist yet (story AC2)');
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(GAPS, 'utf8')); } catch (e) { throw new Error(`the gap list is not valid JSON: ${e.message}`); }
  assert(Array.isArray(parsed), 'the gap list must be a JSON array of "METHOD /path" strings');
  return parsed;
}

function current() {
  return {
    registered: registeredPairs(),
    documented: documentedPairs(fs.readFileSync(OPENAPI, 'utf8')),
    gaps: gapLines(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('W1: the child walk returns the whole router without touching a router file', () => {
  const { child, data } = walk();
  assert(child.status === 0, `the walker exited ${child.status}: ${(child.stderr || '').slice(0, 300)}`);
  assert(data, 'the walker wrote no parseable result');
  assert(!data.registerError, `register(app) failed in the walker: ${data.registerError}`);
  const api = data.routes.filter((r) => r.path.startsWith('/api/'));
  assert(api.length > 300, `expected the full router (300+ /api/ routes), got ${api.length}`);
  assert(data.routerWrites === 0, `the walk wrote the strfry router config/state ${data.routerWrites} time(s)`);
});

test('E1: the entrypoint registers no /api/ route itself today, and one added to it would be counted', () => {
  const real = scanEntrypoint(fs.readFileSync(ENTRYPOINT, 'utf8'));
  assert(real.length === 0, `bin/control-panel.js registers /api/ routes itself: ${JSON.stringify(real)} — they count as registered; document them or list them`);
  const injected = `app.use(authMiddleware);${NL}app.get('/api/__entry_demo__', (req, res) => res.json({}));${NL}app.post("/api/__entry_demo_post__/:id", h);`;
  const found = scanEntrypoint(injected).map(([m, p]) => `${m} ${p}`);
  assert(found.includes('GET /api/__entry_demo__') && found.includes('POST /api/__entry_demo_post__/:id'),
    `the entrypoint scan must find routes added to bin/control-panel.js; found ${JSON.stringify(found)}`);
});

test('M1: :param, {param} and * read as one segment; the method counts; a trailing slash and a documented HEAD don\'t', () => {
  const registered = [['GET', '/api/a/:id'], ['DELETE', '/api/s/*'], ['POST', '/api/t/'], ['GET', '/api/h'], ['GET', '/api/a/:id/x']];
  const documented = [['GET', '/api/a/{pubkey}'], ['DELETE', '/api/s/{keyPath}'], ['POST', '/api/t'], ['HEAD', '/api/h'], ['GET', '/api/h'], ['POST', '/api/a/{id}']];
  const p = findProblems({ registered, documented, gaps: [], ceiling: 999 });
  assert(JSON.stringify(p.undocumented) === JSON.stringify(['GET /api/a/:id/x']),
    `only GET /api/a/:id/x should be undocumented (a deeper path is not the same route); got ${JSON.stringify(p.undocumented)}`);
  assert(JSON.stringify(p.documentedNotRegistered) === JSON.stringify(['POST /api/a/{id}']),
    `only POST /api/a/{id} should be unregistered (the method counts; HEAD rides on GET); got ${JSON.stringify(p.documentedNotRegistered)}`);
});

test('M2: a path key in single or double quotes is read like a plain one — in a fragment and in the real document', () => {
  const fragment = [
    'openapi: 3.0.3', 'info: {title: t, version: "1"}', 'paths:',
    "  '/api/q1/{keyPath}':", '    delete:', '      responses: {"200": {description: ok}}',
    '  "/api/q2":', '    get:', '      responses: {"200": {description: ok}}',
    '  /api/plain:', '    post:', '      responses: {"200": {description: ok}}',
  ].join(NL);
  const got = documentedPairs(fragment).map(([m, p]) => `${m} ${p}`).sort();
  assert(JSON.stringify(got) === JSON.stringify(['DELETE /api/q1/{keyPath}', 'GET /api/q2', 'POST /api/plain']),
    `the reader must read quoted and plain keys alike; got ${JSON.stringify(got)}`);
  const text = fs.readFileSync(OPENAPI, 'utf8');
  const quoted = [...text.matchAll(/^ {2}(['"])(\/[^'"]+)\1:\s*$/gm)].map((m) => m[2]);
  const docd = new Set(documentedPairs(text).map(([, p]) => p));
  const missed = quoted.filter((p) => !docd.has(p));
  assert(missed.length === 0, `quoted path keys read with no method: ${missed.join(', ')}`);
  const p = findProblems({ registered: [['DELETE', '/api/settings/*']], documented: documentedPairs(text), gaps: [], ceiling: 999 });
  if (quoted.includes('/api/settings/{keyPath}')) {
    assert(p.undocumented.length === 0, `'/api/settings/{keyPath}' must document DELETE /api/settings/*; got undocumented ${JSON.stringify(p.undocumented)}`);
  }
});

test('G1: the gap list exists and holds one "METHOD /api/…" string per line', () => {
  const lines = gapLines();
  const bad = lines.filter((l) => typeof l !== 'string' || !LINE_RE.test(l));
  assert(bad.length === 0, `malformed gap-list line(s) — each must be "METHOD /api/…":${list(bad.map((b) => JSON.stringify(b)))}`);
});

test('C2: every registered /api/ route has an entry in the document or a line on the gap list (AC2 a)', () => {
  const p = findProblems(current());
  assert(p.undocumented.length === 0,
    `${p.undocumented.length} registered route(s) with no entry in src/api/openapi.yaml and no line on the gap list:${list(p.undocumented)}`);
});

test('C3: no gap-list line names a documented route — take it off the list (AC2 b)', () => {
  const p = findProblems(current());
  assert(p.listedButDocumented.length === 0,
    `gap-list line(s) for routes the document now covers — remove them from test/fixtures/openapi-known-gaps.json:${list(p.listedButDocumented)}`);
});

test('C4: every method and path the document lists is registered (AC2 c)', () => {
  const p = findProblems({ registered: registeredPairs(), documented: documentedPairs(fs.readFileSync(OPENAPI, 'utf8')), gaps: [] });
  assert(p.documentedNotRegistered.length === 0,
    `documented method(s) and path(s) the server doesn't register:${list(p.documentedNotRegistered)}`);
});

test('C5: every gap-list line names a registered route, and no route is listed twice (AC2 d)', () => {
  const p = findProblems(current());
  const bad = [...p.staleGaps.map((s) => `${s}  (not registered)`), ...p.doubledGaps.map((s) => `${s}  (listed twice)`)];
  assert(bad.length === 0, `gap-list line(s) to remove:${list(bad)}`);
});

test(`C6: the gap list holds at most ${GAP_CEILING} lines — it only shrinks`, () => {
  const lines = gapLines();
  assert(lines.length <= GAP_CEILING,
    `the gap list holds ${lines.length} lines; the ceiling is ${GAP_CEILING}. Document the new route instead of listing it.`);
});

test('D1: each rule names the offending route on made-up sets, and stops once the cause is gone', () => {
  const registered = [['GET', '/api/one'], ['POST', '/api/two/:id']];
  const documented = [['GET', '/api/one']];
  // (a) an undocumented, unlisted route is named; listing it clears it.
  let p = findProblems({ registered, documented, gaps: [] });
  assert(JSON.stringify(p.undocumented) === JSON.stringify(['POST /api/two/:id']), `(a) must name POST /api/two/:id; got ${JSON.stringify(p.undocumented)}`);
  p = findProblems({ registered, documented, gaps: ['POST /api/two/:id'] });
  assert(p.undocumented.length === 0, `(a) a gap-list line must clear it; got ${JSON.stringify(p.undocumented)}`);
  // (b) a line for a documented route is named; documenting-and-removing clears it.
  p = findProblems({ registered, documented: [...documented, ['POST', '/api/two/{id}']], gaps: ['POST /api/two/:id'] });
  assert(JSON.stringify(p.listedButDocumented) === JSON.stringify(['POST /api/two/:id']), `(b) must name the listed, documented route; got ${JSON.stringify(p.listedButDocumented)}`);
  p = findProblems({ registered, documented: [...documented, ['POST', '/api/two/{id}']], gaps: [] });
  assert(p.listedButDocumented.length === 0 && p.undocumented.length === 0, `(b) removing the line must clear it; got ${JSON.stringify(p)}`);
  // (c) a documented, unregistered route is named.
  p = findProblems({ registered, documented: [...documented, ['PUT', '/api/ghost']], gaps: ['POST /api/two/:id'] });
  assert(JSON.stringify(p.documentedNotRegistered) === JSON.stringify(['PUT /api/ghost']), `(c) must name PUT /api/ghost; got ${JSON.stringify(p.documentedNotRegistered)}`);
  // (d) a stale line and a doubled line are each named.
  p = findProblems({ registered, documented, gaps: ['POST /api/two/:id', 'POST /api/two/:id', 'GET /api/removed'] });
  assert(JSON.stringify(p.staleGaps) === JSON.stringify(['GET /api/removed']), `(d) must name the stale line; got ${JSON.stringify(p.staleGaps)}`);
  assert(JSON.stringify(p.doubledGaps) === JSON.stringify(['POST /api/two/:id']), `(d) must name the doubled line; got ${JSON.stringify(p.doubledGaps)}`);
  // the ceiling
  p = findProblems({ registered, documented, gaps: ['POST /api/two/:id'], ceiling: 0 });
  assert(p.overCeiling.length === 1, 'a list longer than its ceiling must be reported');
});

/** Copy what the suite needs into a fresh temp tree (node_modules linked, not copied). */
function throwawayCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-copy-'));
  for (const d of ['src', 'lib', 'firmware']) {
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true, verbatimSymlinks: true });
  }
  for (const f of ['bin/control-panel.js', 'test/openapi-coverage.test.js', 'test/helpers/routeWalk.js', 'test/fixtures/openapi-known-gaps.json']) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  return dir;
}
function runSuiteIn(dir) {
  const env = { ...process.env, OPENAPI_COVERAGE_SKIP_DEMO: '1' };
  return spawnSync(process.execPath, [path.join(dir, 'test/openapi-coverage.test.js')], { cwd: dir, env, encoding: 'utf8', timeout: 180000 });
}
const failLines = (out) => out.split(NL).filter((l) => /^\s+FAIL\s/.test(l)).join(NL).slice(0, 600);

test('D2: in a throwaway copy, the suite passes unchanged, then fails naming a route added to src/api/index.js with no entry and a documented route left on the gap list', () => {
  if (process.env.OPENAPI_COVERAGE_SKIP_DEMO === '1') return 'skip';
  const dir = throwawayCopy();
  try {
    const clean = runSuiteIn(dir);
    assert(clean.status === 0,
      `the unchanged copy must pass the suite before the demo means anything; it exited ${clean.status}:${NL}${failLines(clean.stdout || '') || (clean.stderr || '').slice(0, 400)}`);

    const DEMO = '/api/__coverage_demo_undocumented__';
    const idx = path.join(dir, 'src/api/index.js');
    const src = fs.readFileSync(idx, 'utf8');
    const anchor = /async function register\(app\)\s*\{/;
    assert(anchor.test(src), 'src/api/index.js has no `async function register(app) {` to add the demo route after');
    fs.writeFileSync(idx, src.replace(anchor, (m) => `${m}${NL}  app.get('${DEMO}', (req, res) => res.json({}));`));

    const documented = documentedPairs(fs.readFileSync(path.join(dir, 'src/api/openapi.yaml'), 'utf8'));
    const [kept] = documented.filter(([, p]) => p.startsWith('/api/') && !p.includes('{'));
    assert(kept, 'the document has no parameter-free /api/ entry to keep on the gap list');
    const keptLine = `${kept[0]} ${kept[1]}`;
    const gapFile = path.join(dir, 'test/fixtures/openapi-known-gaps.json');
    fs.writeFileSync(gapFile, JSON.stringify([...JSON.parse(fs.readFileSync(gapFile, 'utf8')), keptLine], null, 2));

    const broken = runSuiteIn(dir);
    const out = broken.stdout || '';
    assert(broken.status !== 0, `with both changes the suite must exit non-zero; it exited ${broken.status}`);
    assert(/FAIL\s+C2:/.test(out) && out.includes(`GET ${DEMO}`), `C2 must fail naming GET ${DEMO}; got:${NL}${failLines(out)}`);
    assert(/FAIL\s+C3:/.test(out) && out.includes(keptLine), `C3 must fail naming ${keptLine}; got:${NL}${failLines(out)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function run() {
  console.log(`${NL}=== openapi-coverage ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'skip') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}openapi-coverage: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run, findProblems, documentedPairs, scanEntrypoint, keyOf, GAP_CEILING };
