'use strict';
/**
 * appearance-setting #4: a light look for the search home.
 *
 * Story: engineering-team/stories/appearance-setting/4-light-look-search-home.md
 * ADR:   engineering-team/decisions/appearance-setting/0004-search-home-joins-the-light-token-layer.md
 * Plan:  engineering-team/stories/appearance-setting/4-light-look-search-home.test-plan.md
 * Browser half: tests/brainstorm/appearance-setting-home.spec.js.
 *
 * Classes:
 *   C — the library: the search home's exact path, /information-for-agents beside /developers, and every top-level route
 *       either hinted or named as outside every family.                                                     [AC-6]
 *   P — the pre-render script agrees with preloadFamily on the search home and its lookalikes.              [AC-6]
 *   S — the light scope takes in the search home's page.                                               [AC-1, AC-3]
 *   T — the stylesheet: Dark unchanged against this story's base; every rule naming a class the search home renders
 *       holds no bare colour and no undimmed-in-Light opacity.                                 [AC-1, AC-5, AC-8]
 *   M — the meanings carried by colour: the stale marker, the two badges, the POV name; the page's own canvas and ink.
 *                                                                                                     [AC-2, AC-3]
 *   K — every pair a search-home rule paints reaches 4.5:1 in Light.                                        [AC-1]
 *   I — inline colours and dimming in the files the search home reaches are wrapped.                        [AC-1]
 *
 * Everything FAILS at the story's base except T1 (Dark unchanged), which passes before and after. Story 3's T4
 * (disabled states keep their opacity) and T5 (no grey turns into the accent) read the whole stylesheet, so they guard
 * the search home's rules too.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = require('./appearance-setting.test.js').helpers;
const S2 = require('./appearance-setting-light.test.js').helpers;
const S3 = require('./appearance-setting-working.test.js').helpers;

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/appearance.js');
const INDEX_HTML = path.join(REPO, 'ui/index.html');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const UI_SRC = path.join(REPO, 'ui/src');
const APP = path.join(UI_SRC, 'App.jsx');
// The ADR 0004 commit: stories 1–3 done and on staging, story 4 not started.
const BASE = '7690c8e160f54f2d0d370f55b938e7eca186b7fb';
const NL = String.fromCharCode(10);

const HOME_FILES = ['pages/BrainstormSearch.jsx'];
// Light pages no story's inventory walked (review 4-R1, Blocking 2): /information-for-agents renders DevPage, so it has
// been light since story 3, but its own file was never read by a test.
const ADOPTED_FILES = ['pages/InformationForAgents.jsx'];
// Dimmed boxes that hold links read --bsp-opacity-soft whatever their value: a link must reach 4.5:1, and the dim token
// (0.72) over a box's ink would take it under (ADR 0002 Amendment 1 "soft covers links"; story 3's DevPage intro is the
// precedent). Key: selector; value: the links it holds.
const HOLDS_LINKS = new Map([
  ['.bs-personalization', '"What is this?" and the point-of-view picker'],
  ['.bs-personalization-compact', 'the same, in the results header'],
  ['.bs-footer', 'Developers, About Brainstorm Search, Settings'],
]);
// Top-level routes that belong to no family, with the reason (ADR 0004 "Paths in no family").
const NO_FAMILY = new Map([
  ['*', 'NotFound: a bare page on the dark global palette, in no family (out of scope)'],
]);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);
function loadLib() { delete require.cache[require.resolve(LIB)]; return require(LIB); }
const nowCss = () => fs.readFileSync(STYLES, 'utf8');
const homeClasses = () => S2.classesFrom([...HOME_FILES, ...ADOPTED_FILES]);
const homeFiles = () => S2.filesFrom([...HOME_FILES, ...ADOPTED_FILES]).map((f) => path.relative(UI_SRC, f)).filter((rel) => !S3.CONTENT_FILES.includes(rel));
const where = (r) => `${r.context ? r.context + ' ' : ''}${r.selector}`;

// ── C ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 SEARCH_HOME_PATH is "/", and isSearchHomePath matches it exactly and nothing else', () => {
  const L = loadLib();
  assert(L.SEARCH_HOME_PATH === '/', `SEARCH_HOME_PATH should be "/", got ${show(L.SEARCH_HOME_PATH)}`);
  assert(typeof L.isSearchHomePath === 'function', 'isSearchHomePath should be exported');
  assert(L.isSearchHomePath('/') === true, 'isSearchHomePath("/") should be true');
  for (const p of ['', '//', '/x', '/about', '/search', '/tapestry', '/tapestry/', '/?q=dog', null, undefined]) {
    assert(L.isSearchHomePath(p) === false, `isSearchHomePath(${show(p)}) should be false`);
  }
});

test('C2 preloadFamily: "profile" on the search home and /information-for-agents, null on an unknown path, the rest as before', () => {
  const L = loadLib();
  const cases = [['/', 'profile'], ['/information-for-agents', 'profile'], ['/information-for-agentsx', null],
    ['/no-such-page', null], ['//', null], ['/tapestry/', null], ['/tapestry', null], ['/dictionary', 'design'],
    ['/assistants', 'design'], ['/about', 'profile'], ['/tags', 'profile'], ['/developers', 'profile']];
  for (const [p, want] of cases) { const got = L.preloadFamily(p); assert(got === want, `preloadFamily(${show(p)}) should be ${show(want)}, got ${show(got)}`); }
});

test('C3 every top-level route outside /tapestry gets a pre-render hint, or is named as belonging to no family', () => {
  const L = loadLib();
  const app = fs.readFileSync(APP, 'utf8');
  const routes = [...new Set([...app.matchAll(/path:\s*'(\/[^']*)'/g)].map((m) => m[1]))].filter((p) => !p.startsWith('/tapestry'));
  assert(routes.length > 20, `expected the router's top-level paths, found ${routes.length}`);
  const missing = [];
  for (const r of routes) {
    if (NO_FAMILY.has(r)) continue;
    const sample = r.replace(/:[\w]+/g, 'x');
    if (L.preloadFamily(sample) == null) missing.push(`${r} (as ${sample})`);
  }
  assert(missing.length === 0, `${missing.length} route(s) would show the other look first:${NL}        ${missing.join(`${NL}        `)}`);
});

test('C4 every top-level route with a light pre-render hint has its page file in a test inventory (review 4-R1, Blocking 2)', () => {
  const L = loadLib();
  const S3mod = require('./appearance-setting-working.test.js');
  const app = fs.readFileSync(APP, 'utf8');
  const imports = new Map([...app.matchAll(/import\s+(\w+)\s+from\s+'(\.\/[^']+)'/g)].map((m) => [m[1], m[2].replace(/^\.\//, '')]));
  const walked = new Set(S2.filesFrom([...S2.READING_FILES, ...S3mod.WORKING_FILES, ...HOME_FILES, ...ADOPTED_FILES]).map((f) => path.relative(UI_SRC, f).replace(/\.jsx?$/, '').replace(/\/index$/, '')));
  const missing = [];
  for (const m of app.matchAll(/path:\s*'(\/[^']*)'\s*,\s*element:\s*<(\w+)/g)) {
    const [, route, comp] = m;
    if (L.preloadFamily(route.replace(/:[\w]+/g, 'x')) !== 'profile') continue;
    const file = imports.get(comp);
    if (!file) continue; // an inline element (a redirect): nothing to read
    if (!walked.has(file.replace(/\.jsx?$/, '').replace(/\/index$/, ''))) missing.push(`${route} → ${comp} (${file})`);
  }
  assert(missing.length === 0, `${missing.length} light page(s) whose file no test reads:${NL}        ${missing.join(`${NL}        `)}`);
});

// ── P ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

function preRenderScript() {
  const { scripts } = H.inlineHeadScripts(fs.readFileSync(INDEX_HTML, 'utf8'));
  return scripts.map((s) => s.code).join(NL);
}

test('P1 the pre-render script sets the hint preloadFamily gives on the search home and its lookalikes, in both looks', () => {
  const L = loadLib();
  const code = preRenderScript();
  const paths = ['/', '//', '/x', '/no-such-page', '/information-for-agents', '/information-for-agents/', '/information-for-agentsx', '/about', '/tapestry/'];
  const wrong = [];
  for (const pathname of paths) {
    for (const [stored, osDark] of [['light', true], ['dark', false], [null, true], [null, false]]) {
      const attrs = H.runPreRender(code, { stored, osDark, pathname });
      const got = attrs['data-preload-family'] === undefined ? null : attrs['data-preload-family'];
      const want = L.preloadFamily(pathname);
      if (got !== want) wrong.push(`${pathname} (stored ${stored}, ${osDark ? 'dark' : 'light'} computer): ${show(got)}, the library says ${show(want)}`);
    }
  }
  assert(L.preloadFamily('/') === 'profile', 'the library should give the search home the profile hint (C2)');
  assert(wrong.length === 0, `${wrong.length} case(s) disagree:${NL}        ${wrong.slice(0, 12).join(`${NL}        `)}`);
});

// ── S ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('S1 the light scope takes in the search home\'s page: body:has(:is(.bsp-page, .bss-page, .bs-page))', () => {
  const rules = H.parseCss(nowCss()).filter((r) => !r.context && S2.isScope(r.selector));
  assert(rules.length > 0, `there should be a light scope rule (${S2.SCOPE})`);
  const lists = rules.map((r) => S2.normSel(r.selector).match(/:is\(([^)]*)\)/)[1].split(','));
  assert(lists.every((l) => l.includes('.bs-page')), `every light scope rule should list .bs-page; they list ${show(lists)}`);
});

test('S2 every Light-only rule under the light scope paints with --bsp- tokens, never a literal colour (ADR 0004 Amendment 1; review 4-R2)', () => {
  const rules = H.parseCss(nowCss()).filter((r) => !r.context && S2.scoped(r.selector) && !S2.isScope(r.selector)
    && /^:root\[data-appearance="light"\] body:has\(:is\([^)]*\)\)\s+\S/.test(S2.normSel(r.selector)));
  assert(rules.length >= 3, `the Light-only rules should be found (the picker option, the card hover, the status hover); found ${rules.length}`);
  const bare = [];
  for (const r of rules) for (const [p, v] of r.decls) {
    if (p.startsWith('--') || !S2.COLOUR_PROPS.test(p)) continue;
    if (S2.LITERAL.test(v) || /var\(\s*--(?!bsp-)/.test(v)) bare.push(`${r.selector} { ${p}: ${v} }`);
  }
  assert(bare.length === 0, `${bare.length} Light-only colour(s) aren't --bsp- tokens:${NL}        ${bare.join(`${NL}        `)}`);
});

// ── T ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

let baseCache = null;
function baseCss() {
  if (baseCache) return baseCache;
  try { baseCache = execFileSync('git', ['show', `${BASE}:ui/src/styles.css`], { cwd: REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }); }
  catch (e) { throw new Error(`could not read ui/src/styles.css at ${BASE.slice(0, 9)} (a full history is needed): ${e.message.split(NL)[0]}`); }
  return baseCache;
}

test('T1 Dark and every untouched page are unchanged against this story\'s base: with the --bsp- wrappers stripped, every rule reads as it did (regression)', () => {
  const b = S2.lastByKey(H.parseCss(baseCss()), (r) => !S2.scoped(r.selector));
  const n = S2.lastByKey(H.parseCss(nowCss()), (r) => !S2.scoped(r.selector));
  const diffs = [];
  for (const [k, { r, p, v }] of b) {
    const m = n.get(k);
    const at = `${where(r)} { ${p} }`;
    if (!m) { diffs.push(`${at} is gone`); continue; }
    let a, w;
    try { a = S2.stripBsp(m.v); w = S2.stripBsp(v); } catch (e) { diffs.push(`${at}: ${e.message}`); continue; }
    if (H.norm(a) !== H.norm(w)) diffs.push(`${at}: ${H.norm(a)} (was ${H.norm(w)})`);
  }
  for (const [k, { r }] of n) if (!b.has(k)) diffs.push(`new unscoped declaration: ${r.context ? r.context + ' ' : ''}${k.split('§').slice(1).join(' { ')} }`);
  assert(diffs.length === 0, `${diffs.length} difference(s) from the base:${NL}        ${diffs.slice(0, 12).join(`${NL}        `)}`);
});

test('T2 every colour a search-home rule paints reads a --bsp- token (the landing variant included)', () => {
  const classes = homeClasses();
  assert(classes.size > 100, `the finder should find the search home's classes; it found ${classes.size}`);
  const bare = [];
  for (const r of H.parseCss(nowCss())) {
    if (!S3.isFamilyRule(r, classes)) continue;
    for (const [p, v] of r.decls) {
      if (p.startsWith('--') || !S2.COLOUR_PROPS.test(p)) continue;
      const rest = S3.withoutBsp(v);
      if (S2.LITERAL.test(rest) || /var\(\s*--/.test(rest)) bare.push(`${where(r)} { ${p}: ${v} }`);
    }
  }
  assert(bare.length === 0, `${bare.length} colour(s) in search-home rules don't read a --bsp- token:${NL}        ${bare.slice(0, 20).join(`${NL}        `)}`);
});

test('T3 every dimmed text in a search-home rule reads an opacity token (soft above 0.6 or holding links, dim at or below), disabled states aside', () => {
  const classes = homeClasses();
  const wrong = [];
  for (const r of H.parseCss(nowCss())) {
    if (!S3.isFamilyRule(r, classes) || S3.DISABLED.test(r.selector)) continue;
    for (const [p, v] of r.decls) {
      if (p !== 'opacity') continue;
      const m = v.match(/^var\(\s*(--bsp-opacity-(soft|dim))\s*,\s*([\d.]+)\s*\)$/);
      const x = m ? parseFloat(m[3]) : parseFloat(v);
      if (!(x > 0 && x < 1)) continue; // opacity 0 hides until hover or focus; it isn't dimmed text
      const want = x <= 0.6 && !HOLDS_LINKS.has(r.selector) ? '--bsp-opacity-dim' : '--bsp-opacity-soft';
      if (!m || m[1] !== want) wrong.push(`${where(r)} { opacity: ${v} } (want var(${want}, ${x}))`);
    }
  }
  assert(wrong.length === 0, `${wrong.length} opacity value(s) not on the ADR 0002 Amendment 1 rule:${NL}        ${wrong.slice(0, 20).join(`${NL}        `)}`);
});

// ── M ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The last value of `prop` in the unscoped rule whose selector is exactly `sel`. */
function declOf(sel, prop) {
  let v = null;
  for (const r of H.parseCss(nowCss())) {
    if (r.context || S2.normSel(r.selector) !== S2.normSel(sel)) continue;
    for (const [p, val] of r.decls) if (p === prop) v = val;
  }
  return v;
}
const reads = (v, token) => v != null && new RegExp(`^var\\(\\s*${token}\\s*,`).test(v.trim());
const readsAny = (v, tokenRe) => v != null && new RegExp(`^var\\(\\s*${tokenRe}\\s*,`).test(v.trim());

test('M1 the stale marker reads the warning ink in Light (and keeps today\'s amber in Dark)', () => {
  const v = declOf('.bs-result-age.stale', 'color');
  assert(reads(v, '--bsp-warn-ink'), `.bs-result-age.stale { color } should be var(--bsp-warn-ink, …), got ${show(v)}`);
  assert(H.norm(S2.stripBsp(v)) === '#d29922', `its Dark value should stay #d29922, got ${show(v && S2.stripBsp(v))}`);
});

test('M2 the badges keep apart: Verification Score reads cyan, Verified Followers reads the success green, each on its own tint', () => {
  const got = {
    rankInk: declOf('.bs-wot-rank', 'color'), rankBg: declOf('.bs-wot-rank', 'background'),
    folInk: declOf('.bs-wot-followers', 'color'), folBg: declOf('.bs-wot-followers', 'background'),
  };
  const wrong = [];
  if (!reads(got.rankInk, '--bsp-cyan-ink')) wrong.push(`.bs-wot-rank { color } should be var(--bsp-cyan-ink, …), got ${show(got.rankInk)}`);
  if (!readsAny(got.rankBg, '--bsp-cyan-tint-\\d')) wrong.push(`.bs-wot-rank { background } should be a var(--bsp-cyan-tint-N, …), got ${show(got.rankBg)}`);
  if (!reads(got.folInk, '--bsp-success-ink')) wrong.push(`.bs-wot-followers { color } should be var(--bsp-success-ink, …), got ${show(got.folInk)}`);
  if (!readsAny(got.folBg, '--bsp-success-tint-\\d')) wrong.push(`.bs-wot-followers { background } should be a var(--bsp-success-tint-N, …), got ${show(got.folBg)}`);
  assert(wrong.length === 0, wrong.join(`${NL}        `));
  const { tokens } = S2.lightScope(H.parseCss(nowCss()));
  assert(H.norm(tokens['--bsp-cyan-ink'] || '') === '#0e7490', `--bsp-cyan-ink should be declared #0e7490 (the design shell's cyan ink), got ${show(tokens['--bsp-cyan-ink'])}`);
});

test('M3 the POV name in the search home\'s avatar menu reads the accent ink (story 2\'s carry-over)', () => {
  const v = declOf('.bs-usermenu-pov-indicator strong', 'color');
  assert(reads(v, '--bsp-accent-ink'), `.bs-usermenu-pov-indicator strong { color } should be var(--bsp-accent-ink, …), got ${show(v)}`);
});

test('M5 the unavailable point-of-view option dims by colour in Light, so its Settings link is read whole (review 4-R1, Blocking 1; ADR 0004 Amendment 1)', () => {
  const all = H.parseCss(nowCss());
  const rules = all.filter((r) => !r.context && S2.scoped(r.selector) && /\.bs-pov-option\.disabled$/.test(S2.normSel(r.selector)));
  assert(rules.length > 0, 'a Light-only rule for .bs-pov-option.disabled should exist, inside the light scope');
  const decl = (p) => { let v = null; for (const r of rules) for (const [k, val] of r.decls) if (k === p) v = val; return v; };
  assert(decl('opacity') === '1', `in Light the option shouldn't fade its link: opacity 1, got ${show(decl('opacity'))}`);
  assert(/^var\(\s*--bsp-(muted|ink-2)\s*\)$/.test(String(decl('color') || '').trim()), `in Light the option dims by colour (--bsp-muted or --bsp-ink-2), got ${show(decl('color'))}`);
  for (const r of rules) assert(S2.isScope(S2.normSel(r.selector).replace(/\s+\.bs-pov-option\.disabled$/, '')), `${r.selector} should sit under the light scope`);
  assert(all.some((r) => !r.context && r.selector === '.bs-pov-option.disabled' && r.decls.some(([p, v]) => p === 'opacity' && v === '0.5')), 'Dark keeps the option\'s literal 0.5 (story 3 T4)');
});

test('M6 a hovered result card keeps its text in the ink in Light (review 4-R1, non-blocking 1)', () => {
  const rules = H.parseCss(nowCss()).filter((r) => !r.context && S2.scoped(r.selector) && /\.bs-result-card:hover$/.test(S2.normSel(r.selector)));
  const color = rules.flatMap((r) => r.decls.filter(([p]) => p === 'color').map(([, v]) => v)).pop();
  assert(/^var\(\s*--bsp-ink\s*\)$/.test(String(color || '').trim()), `a Light-only .bs-result-card:hover should set color: var(--bsp-ink), got ${show(color)}`);
});

test('M4 the search home\'s page reads the light canvas and ink', () => {
  const bg = declOf('.bs-page', 'background'); const ink = declOf('.bs-page', 'color');
  assert(reads(bg, '--bsp-canvas'), `.bs-page { background } should be var(--bsp-canvas, …), got ${show(bg)}`);
  assert(reads(ink, '--bsp-ink'), `.bs-page { color } should be var(--bsp-ink, …), got ${show(ink)}`);
});

// ── K ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Pairs K1's model can't judge, each with its reason. K1 lays a translucent background over the page canvas; these sit on
// something else. Key: selector. (Tester amendment in Implementation, test plan Amendment 1.)
const PAIR_ALLOWLIST = new Map([
  ['.bs-wot-rank', 'sits on a result card, white in Light: 4.67:1 as rendered (H4 measures it), 4.21:1 if laid on the canvas'],
]);

test('K1 in Light, every text-on-background pair a search-home rule paints reaches 4.5:1 (WCAG AA)', () => {
  const now = H.parseCss(nowCss());
  const { seen } = S2.lightScope(now);
  assert(seen, 'there is no light scope to measure');
  const classes = homeClasses();
  // Only pairs where a search-home rule owns the text or the background; lowPairs measures the whole family otherwise.
  const low = S3.lowPairs(classes).filter((line) => !PAIR_ALLOWLIST.has(line.slice(0, line.indexOf(':'))));
  assert(low.length === 0, `${low.length} pair(s) below 4.5:1 in Light:${NL}        ${low.slice(0, 20).join(`${NL}        `)}`);
  const unwrapped = now.filter((r) => S3.isFamilyRule(r, classes) && r.decls.some(([p, v]) => p === 'color' && !/var\(--bsp-/.test(v) && S2.LITERAL.test(v)));
  assert(unwrapped.length === 0, `${unwrapped.length} search-home text colour(s) aren't measured in Light because they don't read a token yet (T2):${NL}        ${unwrapped.slice(0, 8).map(where).join(`${NL}        `)}`);
});

// ── I ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('I1 the inline colours in every file the search home and /information-for-agents reach read --bsp- tokens', () => {
  const files = homeFiles();
  assert(files.includes('pages/BrainstormSearch.jsx'), 'the walk should start from the search home');
  const bare = S3.inlineColours(files);
  assert(bare.length === 0, `${bare.length} inline colour(s) don't read a --bsp- token:${NL}        ${bare.join(`${NL}        `)}`);
});

test('I2 no inline style in those files dims with a literal or conditional opacity (a disabled control\'s own aside)', () => {
  assert(homeFiles().includes('pages/InformationForAgents.jsx'), 'the walk should include /information-for-agents\'s page');
  const bare = S3.inlineOpacities(homeFiles());
  assert(bare.length === 0, `${bare.length} literal inline opacit(ies):${NL}        ${bare.slice(0, 20).join(`${NL}        `)}`);
});

async function run() {
  console.log(`${NL}=== appearance-setting-home (appearance-setting #4) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}appearance-setting-home: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}

module.exports = { run, HOME_FILES, ADOPTED_FILES };
