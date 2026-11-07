'use strict';
/**
 * What the API document says — openapi-coverage #1.
 *   Story: engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.md (Bug; no ADR)
 *   Plan:  engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.test-plan.md
 * The coverage gate itself (registered vs documented vs the gap list) is test/openapi-coverage.test.js.
 *
 *   S1 — `servers` is a single entry, url `/`, so Try it out calls the instance serving the page.         [AC4]
 *   S2 — info.contact.url is the team's repository on gitworkshop.dev.                                    [AC4]
 *   S3 — info.description says Try it out sends real requests to this instance with your session.         [AC4]
 *   B1 — BIBLE §11's "API Documentation" paragraph says what /docs covers: no "all REST endpoints", and it
 *        names the coverage suite and the gap list.                                                       [AC5]
 *   N1 — each of the 20 normalize routes has an entry under its method, tagged Normalize, with a summary.   [AC3]
 *   N2 — each says who may call it, as the route table decides (src/middleware/routeAccess.js): an owner
 *        action names the owner, admins and direct-local callers and answers 401 and 403; a public read
 *        says it is public and answers neither.                                                          [AC3]
 *   N3 — each POST documents a JSON body carrying every field its handler reads from req.body (and, where the
 *        handler passes the body to pickIntentFields, the four intent fields).                             [AC3]
 *   N4 — each documents a 2xx JSON answer and every status its handler sends (scanned from the handler and
 *        the same-file functions it hands req or res to).                                                 [AC3]
 *   N5 — where BIBLE §11 has a row for the route, the entry agrees with it: every status the row names is a
 *        documented answer, and every name the row puts in backticks appears in the entry.                 [AC3]
 *   R1 — both suites are in the gate's registry, and `node test/openapi-coverage.test.js` runs its tests on
 *        its own (a result line per test and a summary), exiting 0 exactly when none failed.             [AC1]
 *
 * N3/N4 read handler source: a status or field reached only through another module is not seen, and the
 * Reviewer checks those by hand (plan § Edge cases). Stack-free: no running instance, no container, no network.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');
const { NORMALIZE_ROUTES } = require('./helpers/openapiNormalizeRoutes');

const ROOT = path.resolve(__dirname, '..');
const OPENAPI = path.join(ROOT, 'src/api/openapi.yaml');
const BIBLE = path.join(ROOT, 'BIBLE.md');
const NORMALIZE_DIR = path.join(ROOT, 'src/api/normalize');
const REGISTRY = path.join(ROOT, 'test/registry.js');
const NL = String.fromCharCode(10);
const CONTACT_URL = 'https://gitworkshop.dev/npub1zhma4lzxyjc7dvq2klux8hs62wm3je6jspcwclgcxlr6grquwfcq28ccgm/relay.ngit.dev/Tapestry';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const list = (xs) => `${NL}        ${xs.join(NL + '        ')}`;

let DOC = null;
const doc = () => (DOC = DOC || yaml.load(fs.readFileSync(OPENAPI, 'utf8')));
const op = (method, p) => { const item = (doc().paths || {})[p]; return item && item[method.toLowerCase()]; };
const opText = (o) => `${o.summary || ''} ${o.description || ''}`;

// ── Handler source ─────────────────────────────────────────────────────────────────────────────────────────────────

const SOURCES = fs.readdirSync(NORMALIZE_DIR).filter((f) => f.endsWith('.js'))
  .map((f) => ({ file: path.join(NORMALIZE_DIR, f), src: fs.readFileSync(path.join(NORMALIZE_DIR, f), 'utf8') }));

/** The body (braces included) of `function name(` in src, or null. */
function fnBody(src, name) {
  const m = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if (!m) return null;
  const open = src.indexOf('{', src.indexOf(')', m.index));
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(open, k + 1);
  }
  return null;
}

/** The handler registered for METHOD path in src/api/normalize (a literal app.<method>('<path>', <name>) line). */
function handlerOf(method, p) {
  const re = new RegExp(`app\\.${method.toLowerCase()}\\(\\s*['"\`]${p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"\`]\\s*,\\s*([A-Za-z_$][\\w$]*)\\s*\\)`);
  const reg = SOURCES.map((s) => re.exec(s.src)).find(Boolean);
  assert(reg, `no app.${method.toLowerCase()}('${p}', <handler>) registration found under src/api/normalize`);
  const name = reg[1];
  const home = SOURCES.find((s) => fnBody(s.src, name));
  assert(home, `handler ${name} for ${method} ${p} is not defined under src/api/normalize`);
  return { name, src: home.src, body: fnBody(home.src, name), file: path.relative(ROOT, home.file) };
}

/** Statuses the handler sends: res.status(NNN), helper(res, NNN), and in same-file functions it hands req/res to. */
function sentStatuses(h) {
  const out = new Set();
  const scan = (b) => {
    for (const m of b.matchAll(/res\.status\(\s*(\d{3})\s*\)/g)) out.add(m[1]);
    for (const m of b.matchAll(/\b[A-Za-z_$][\w$]*\(\s*res\s*,\s*(\d{3})\b/g)) out.add(m[1]);
  };
  scan(h.body);
  for (const m of h.body.matchAll(/\b([A-Za-z_$][\w$]*)\(\s*(?:req|res)\b/g)) {
    const b = fnBody(h.src, m[1]);
    if (!b || b === h.body) continue;
    scan(b);
    for (const s of b.matchAll(/\bstatus\s*:\s*(\d{3})\b/g)) out.add(s[1]);
  }
  return [...out].sort();
}

/** Fields the handler reads from req.body: `const { a, b: c, d = 1 } = req.body` and `req.body.x`. */
function bodyFields(h) {
  const out = new Set();
  for (const m of h.body.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.body\b/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/[\s:=]/)[0];
      if (n && !n.startsWith('...')) out.add(n);
    }
  }
  for (const m of h.body.matchAll(/req\.body\??\.([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  if (/pickIntentFields\(\s*req\.body/.test(h.body)) {
    for (const f of require(path.join(ROOT, 'src/lib/brain/goals')).INTENT_FIELDS) out.add(f);
  }
  return [...out];
}

// ── BIBLE ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const bibleText = () => fs.readFileSync(BIBLE, 'utf8');
/** The text under the first heading `headingRe` matches in `text`, up to the next heading `stopRe` matches. */
function under(text, headingRe, stopRe) {
  const i = text.search(headingRe);
  if (i < 0) return null;
  const start = text.indexOf(NL, i) + 1;
  const rest = start > 0 ? text.slice(start) : '';
  const j = rest.search(stopRe);
  return j < 0 ? rest : rest.slice(0, j);
}
/** BIBLE §11's text, from its heading to the next `## ` heading. */
function section11() {
  const s = under(bibleText(), /^## 11\. API Reference\s*$/m, /^## /m);
  assert(s !== null, 'BIBLE.md has no "## 11. API Reference" heading');
  return s;
}
/** BIBLE §11's row description for METHOD path, or null. */
function bibleRow(method, p) {
  for (const line of section11().split(NL)) {
    const m = /^\|\s*([A-Z]+)\s*\|\s*`([^`]+)`\s*\|(.*)\|\s*$/.exec(line);
    if (m && m[1] === method && m[2].split('?')[0] === p) return m[3];
  }
  return null;
}

// ── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('S1: servers is a single entry, url "/", so Try it out calls the instance serving the page', () => {
  const s = doc().servers;
  assert(Array.isArray(s) && s.length === 1 && s[0] && s[0].url === '/',
    `servers must be exactly one entry with url "/"; got ${JSON.stringify(s)}`);
});

test('S2: info.contact.url is the team\'s repository on gitworkshop.dev', () => {
  const url = doc().info && doc().info.contact && doc().info.contact.url;
  assert(url === CONTACT_URL, `info.contact.url must be ${CONTACT_URL}; got ${JSON.stringify(url)}`);
});

test('S3: info.description says Try it out sends real requests to this instance, with your session', () => {
  const d = (doc().info && doc().info.description) || '';
  const missing = [[/try it out/i, '"Try it out"'], [/this instance/i, '"this instance"'], [/\bsession\b/i, '"session"'], [/\breal\b/i, '"real"']]
    .filter(([re]) => !re.test(d)).map(([, w]) => w);
  assert(missing.length === 0, `info.description must say Try it out sends real requests to this instance with your session; it lacks ${missing.join(', ')}`);
});

test('B1: BIBLE §11 says what /docs covers — not "all REST endpoints" — and names the coverage suite and the gap list', () => {
  const para = under(section11(), /^### API Documentation\s*$/m, /^#{2,3} /m);
  assert(para !== null, 'BIBLE §11 has no "### API Documentation" subsection');
  const problems = [];
  if (/all REST endpoints/i.test(para)) problems.push('still says "all REST endpoints"');
  for (const must of ['/docs', 'test/openapi-coverage.test.js', 'test/fixtures/openapi-known-gaps.json']) {
    if (!para.includes(must)) problems.push(`does not name ${must}`);
  }
  assert(problems.length === 0, `BIBLE §11 "API Documentation": ${problems.join('; ')}`);
});

test('N1: each of the 20 normalize routes has an entry under its method, tagged Normalize, with a summary', () => {
  const bad = [];
  for (const [m, p] of NORMALIZE_ROUTES) {
    const o = op(m, p);
    if (!o) { bad.push(`${m} ${p}  (no entry)`); continue; }
    if (!Array.isArray(o.tags) || !o.tags.includes('Normalize')) bad.push(`${m} ${p}  (not tagged Normalize)`);
    if (!o.summary || !String(o.summary).trim()) bad.push(`${m} ${p}  (no summary)`);
  }
  assert(bad.length === 0, `normalize entries missing or incomplete:${list(bad)}`);
});

test('N2: each says who may call it, as the route table decides — owner actions answer 401 and 403, public reads neither', () => {
  const { resolveRouteAccess } = require(path.join(ROOT, 'src/middleware/routeAccess.js'));
  const bad = [];
  for (const [m, p] of NORMALIZE_ROUTES) {
    const o = op(m, p);
    if (!o) { bad.push(`${m} ${p}  (no entry)`); continue; }
    const access = resolveRouteAccess(m, p);
    const text = opText(o);
    const codes = Object.keys(o.responses || {});
    if (access === 'owner') {
      for (const [re, w] of [[/\bowner\b/i, 'the owner'], [/\badmins?\b/i, 'admins'], [/direct-local/i, 'direct-local callers']]) {
        if (!re.test(text)) bad.push(`${m} ${p}  (owner action: does not name ${w})`);
      }
      for (const c of ['401', '403']) if (!codes.includes(c)) bad.push(`${m} ${p}  (owner action: no ${c} answer)`);
    } else if (access === 'public') {
      if (!/\bpublic\b|\banyone\b/i.test(text)) bad.push(`${m} ${p}  (public read: does not say anyone may call it)`);
      for (const c of ['401', '403']) if (codes.includes(c)) bad.push(`${m} ${p}  (public read: documents ${c})`);
    } else {
      bad.push(`${m} ${p}  (route table says ${access}; this story covers owner actions and public reads only)`);
    }
  }
  assert(bad.length === 0, `who-may-call problems:${list(bad)}`);
});

test('N3: each POST documents a JSON body with every field its handler reads from req.body', () => {
  const bad = [];
  for (const [m, p] of NORMALIZE_ROUTES) {
    if (m !== 'POST') continue;
    const o = op(m, p);
    if (!o) { bad.push(`${m} ${p}  (no entry)`); continue; }
    const schema = o.requestBody && o.requestBody.content && o.requestBody.content['application/json'] && o.requestBody.content['application/json'].schema;
    if (!schema) { bad.push(`${m} ${p}  (no application/json request body schema)`); continue; }
    const props = Object.keys(schema.properties || {});
    const h = handlerOf(m, p);
    const missing = bodyFields(h).filter((f) => !props.includes(f));
    if (missing.length) bad.push(`${m} ${p}  (${h.name} reads ${missing.join(', ')}; not in the body schema)`);
  }
  assert(bad.length === 0, `request-body problems:${list(bad)}`);
});

test('N4: each documents a 2xx JSON answer and every status its handler sends', () => {
  const bad = [];
  for (const [m, p] of NORMALIZE_ROUTES) {
    const o = op(m, p);
    if (!o) { bad.push(`${m} ${p}  (no entry)`); continue; }
    const responses = o.responses || {};
    const ok = Object.keys(responses).filter((c) => /^2\d\d$/.test(c));
    if (!ok.some((c) => responses[c] && responses[c].content && responses[c].content['application/json'] && responses[c].content['application/json'].schema)) {
      bad.push(`${m} ${p}  (no 2xx answer with an application/json schema)`);
    }
    const h = handlerOf(m, p);
    const missing = sentStatuses(h).filter((c) => !(c in responses));
    if (missing.length) bad.push(`${m} ${p}  (${h.name} in ${h.file} sends ${missing.join(', ')}; not documented)`);
  }
  assert(bad.length === 0, `answer problems:${list(bad)}`);
});

test('N5: where BIBLE §11 has a row for the route, the entry names every status and every backticked name in it', () => {
  const bad = [];
  let rows = 0;
  for (const [m, p] of NORMALIZE_ROUTES) {
    const row = bibleRow(m, p);
    if (row === null) continue;
    rows++;
    const o = op(m, p);
    if (!o) { bad.push(`${m} ${p}  (no entry; BIBLE has a row)`); continue; }
    const text = JSON.stringify(o);
    const codes = Object.keys(o.responses || {});
    const statuses = [...new Set([...row.matchAll(/\b([1-5]\d\d)\b/g)].map((x) => x[1]))].filter((c) => !codes.includes(c));
    if (statuses.length) bad.push(`${m} ${p}  (BIBLE names ${statuses.join(', ')}; not documented answers)`);
    const names = new Set();
    for (const span of row.matchAll(/`([^`]+)`/g)) for (const n of span[1].matchAll(/[A-Za-z_][A-Za-z0-9_-]{2,}/g)) names.add(n[0]);
    const absent = [...names].filter((n) => !text.includes(n));
    if (absent.length) bad.push(`${m} ${p}  (BIBLE's row names ${absent.join(', ')}; the entry doesn't)`);
  }
  assert(rows >= 5, `expected BIBLE §11 rows for at least the 5 event-less primitives and probes; found ${rows}`);
  assert(bad.length === 0, `entries that disagree with BIBLE §11:${list(bad)}`);
});

test('R1: both suites are in the gate\'s registry, and the coverage suite runs on its own with a result per test', () => {
  const { suites } = require(REGISTRY);
  const files = suites.map((s) => s.file).filter(Boolean);
  for (const f of ['openapi-coverage.test.js', 'openapi-document.test.js']) assert(files.includes(f), `test/registry.js must list ${f}`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'test/openapi-coverage.test.js')],
    { cwd: ROOT, env: { ...process.env, OPENAPI_COVERAGE_SKIP_DEMO: '1' }, encoding: 'utf8', timeout: 180000 });
  const out = r.stdout || '';
  const results = out.split(NL).filter((l) => /^\s+(PASS|FAIL|SKIP)\s+\S/.test(l));
  const summary = /openapi-coverage: (\d+) passed, (\d+) failed, (\d+) skipped/.exec(out);
  assert(results.length >= 10, `node test/openapi-coverage.test.js printed ${results.length} result line(s) — it must run its tests on its own (a require.main block); stderr: ${(r.stderr || '').slice(0, 200)}`);
  assert(summary, 'node test/openapi-coverage.test.js printed no summary line');
  assert((r.status === 0) === (summary[2] === '0'), `exit ${r.status} disagrees with "${summary[0]}"`);
});

async function run() {
  console.log(`${NL}=== openapi-document ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}openapi-document: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
