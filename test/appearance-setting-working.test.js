'use strict';
/**
 * appearance-setting #3: a light look for the working pages and the working pieces.
 *
 * Story: engineering-team/stories/appearance-setting/3-light-look-working-pages.md
 * ADR:   engineering-team/decisions/appearance-setting/0003-working-pages-join-the-light-token-layer.md
 * Plan:  engineering-team/stories/appearance-setting/3-light-look-working-pages.test-plan.md
 * Browser half: tests/brainstorm/appearance-setting-working.spec.js.
 *
 * Classes:
 *   C — the library: the working paths; preloadFamily gives them the 'profile' hint, and keeps /assistants (the design
 *       shell) apart from /assistant.                                                                    [AC-5]
 *   P — the pre-render script holds the working list and agrees with preloadFamily on every working path.  [AC-5]
 *   T — the stylesheet: Dark unchanged against this story's base; every rule in the whole profile family (reading and
 *       working pages, story 3's families included) holds no bare colour and no undimmed-in-Light opacity.
 *                                                                                           [AC-1, AC-2, AC-4, AC-8]
 *   K — every pair a profile-family rule paints reaches 4.5:1 in Light.                                  [AC-1, AC-2]
 *   I — the inline colours in the working pages' JSX are wrapped; the /about count chip reads the darker accent ink;
 *       the published avatar's ring colour is untouched.                                           [AC-1, AC-7, AC-8]
 *
 * Everything FAILS at the story's base except T1 (Dark unchanged) and I3 (the avatar ring), which pass before and after.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = require('./appearance-setting.test.js').helpers;
const S2 = require('./appearance-setting-light.test.js').helpers;

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/appearance.js');
const INDEX_HTML = path.join(REPO, 'ui/index.html');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const UI_SRC = path.join(REPO, 'ui/src');
// The ADR 0003 commit: story 2 done, story 3 not started.
const BASE = '34bd3957b66ebe43d47365e6283dc7410dfde2f8';
const NL = String.fromCharCode(10);

const WORKING_PREFIXES = ['/tags', '/tag', '/pins', '/pin', '/assistant', '/setup', '/developers'];
const WORKING_FILES = ['pages/Tags.jsx', 'pages/Tag.jsx', 'pages/Pins.jsx', 'components/PinRedirect.jsx',
  'pages/assistant/ActionPage.jsx', 'pages/assistant/AssistantTreasureMap.jsx', 'pages/assistant/DutyMenu.jsx',
  'pages/assistant/EditProfile.jsx', 'pages/assistant/IdentificationTags.jsx', 'pages/assistant/Index.jsx',
  'pages/assistant/OutboxRelays.jsx', 'pages/assistant/ProfileChecklist.jsx', 'pages/assistant/Scores.jsx',
  'pages/developers/DevPage.jsx', 'pages/developers/Hub.jsx', 'pages/developers/Nip50.jsx', 'pages/developers/OpenRanking.jsx',
  'pages/developers/TrustedAssertions.jsx', 'pages/developers/RelayTools.jsx', 'pages/setup/Index.jsx', 'pages/setup/Placeholders.jsx'];
const INLINE_FILES = ['components/AssistantProfileEditor.jsx', 'pages/developers/DevPage.jsx'];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);
function loadLib() { delete require.cache[require.resolve(LIB)]; return require(LIB); }
const nowCss = () => fs.readFileSync(STYLES, 'utf8');

// ── C ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 WORKING_PATH_PREFIXES lists the working pages\' paths, and isWorkingPath matches them exactly or below them', () => {
  const L = loadLib();
  assert(show(L.WORKING_PATH_PREFIXES) === show(WORKING_PREFIXES), `WORKING_PATH_PREFIXES should be ${show(WORKING_PREFIXES)}, got ${show(L.WORKING_PATH_PREFIXES)}`);
  assert(typeof L.isWorkingPath === 'function', 'isWorkingPath should be exported');
  for (const p of ['/tags', '/tag/abc', '/tag/slug/abc', '/pins', '/pin/x', '/assistant', '/assistant/profile/edit', '/setup', '/setup/follow', '/developers', '/developers/nip-50']) {
    assert(L.isWorkingPath(p) === true, `isWorkingPath(${show(p)}) should be true`);
  }
  for (const p of ['/', '/tagsx', '/assistants', '/assistants/x', '/pinsx', '/settings', '/setupx', '/dictionary', '/tapestry/tags']) {
    assert(L.isWorkingPath(p) === false, `isWorkingPath(${show(p)}) should be false`);
  }
});

test('C2 preloadFamily: "profile" on every working path, "design" still on /assistants, null on lookalikes', () => {
  const L = loadLib();
  const cases = [['/tags', 'profile'], ['/pin/abc', 'profile'], ['/assistant', 'profile'], ['/assistant/duty-menu', 'profile'],
    ['/setup/activate', 'profile'], ['/developers/relay-tools', 'profile'], ['/assistants', 'design'], ['/assistantsx', null],
    ['/about', 'profile'], ['/', null], ['/tapestry/', null]];
  for (const [p, want] of cases) { const got = L.preloadFamily(p); assert(got === want, `preloadFamily(${show(p)}) should be ${show(want)}, got ${show(got)}`); }
});

// ── P ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

function preRenderScript() {
  const { scripts } = H.inlineHeadScripts(fs.readFileSync(INDEX_HTML, 'utf8'));
  return scripts.map((s) => s.code).join(NL);
}

test('P1 the pre-render script holds the library\'s working list', () => {
  const L = loadLib();
  const want = L.WORKING_PATH_PREFIXES || WORKING_PREFIXES;
  const lists = [...preRenderScript().matchAll(/\[\s*('[^']*'(?:\s*,\s*'[^']*')*)\s*\]/g)].map((m) => m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')));
  assert(lists.some((l) => show(l) === show(want)), `the script should hold the working list ${show(want)}; it holds ${show(lists)}`);
});

test('P2 the pre-render script sets the hint preloadFamily gives, on every working path and its lookalikes', () => {
  const L = loadLib();
  const code = preRenderScript();
  const paths = [...WORKING_PREFIXES.flatMap((p) => [p, `${p}/`, `${p}/x`, `${p}x`]), '/assistants', '/assistants/x'];
  const wrong = [];
  for (const pathname of paths) {
    const attrs = H.runPreRender(code, { stored: 'light', osDark: true, pathname });
    const got = attrs['data-preload-family'] === undefined ? null : attrs['data-preload-family'];
    const want = L.preloadFamily(pathname);
    if (got !== want) wrong.push(`${pathname}: ${show(got)}, the library says ${show(want)}`);
  }
  assert(wrong.length === 0, `${wrong.length} path(s) disagree:${NL}        ${wrong.slice(0, 12).join(`${NL}        `)}`);
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
  const before = H.parseCss(baseCss());
  const now = H.parseCss(nowCss());
  const b = S2.lastByKey(before, (r) => !S2.scoped(r.selector));
  const n = S2.lastByKey(now, (r) => !S2.scoped(r.selector));
  const diffs = [];
  for (const [k, { r, p, v }] of b) {
    const m = n.get(k);
    const where = `${r.context ? r.context + ' ' : ''}${r.selector} { ${p} }`;
    if (!m) { diffs.push(`${where} is gone`); continue; }
    let a, w;
    try { a = S2.stripBsp(m.v); w = S2.stripBsp(v); } catch (e) { diffs.push(`${where}: ${e.message}`); continue; }
    if (H.norm(a) !== H.norm(w)) diffs.push(`${where}: ${H.norm(a)} (was ${H.norm(w)})`);
  }
  for (const [k, { r }] of n) if (!b.has(k)) diffs.push(`new unscoped declaration: ${r.context ? r.context + ' ' : ''}${k.split('§').slice(1).join(' { ')} }`);
  assert(diffs.length === 0, `${diffs.length} difference(s) from the base:${NL}        ${diffs.slice(0, 12).join(`${NL}        `)}`);
});

const familyClasses = () => S2.classesFrom([...S2.READING_FILES, ...WORKING_FILES]);
function isFamilyRule(r, classes) {
  if (S2.scoped(r.selector) || /\.bsd-|bsd-page|\.dict-/.test(r.selector)) return false;
  const names = [...r.selector.matchAll(/\.([a-z][\w-]+)/g)].map((m) => m[1]);
  return names.some((c) => classes.has(c));
}
function withoutBsp(v) {
  let rest = v, at;
  while ((at = rest.indexOf('var(--bsp-')) !== -1) {
    let d = 0, j = at + 3;
    for (; j < rest.length; j++) { if (rest[j] === '(') d++; else if (rest[j] === ')') { d--; if (d === 0) break; } }
    rest = rest.slice(0, at) + rest.slice(j + 1);
  }
  return rest;
}

test('T2 every colour a profile-family rule paints (reading and working pages, story 3\'s families included) reads a --bsp- token', () => {
  const classes = familyClasses();
  const bare = [];
  for (const r of H.parseCss(nowCss())) {
    if (!isFamilyRule(r, classes)) continue;
    for (const [p, v] of r.decls) {
      if (p.startsWith('--') || !S2.COLOUR_PROPS.test(p)) continue;
      const rest = withoutBsp(v);
      if (S2.LITERAL.test(rest) || /var\(\s*--/.test(rest)) bare.push(`${r.context ? r.context + ' ' : ''}${r.selector} { ${p}: ${v} }`);
    }
  }
  assert(bare.length === 0, `${bare.length} colour(s) in profile-family rules don't read a --bsp- token:${NL}        ${bare.slice(0, 15).join(`${NL}        `)}`);
});

test('T3 every dimmed text in a profile-family rule reads an opacity token (soft above 0.6, dim at or below), disabled states aside', () => {
  const classes = familyClasses();
  const wrong = [];
  for (const r of H.parseCss(nowCss())) {
    if (!isFamilyRule(r, classes) || /:disabled|\.disabled|is-disabled/.test(r.selector)) continue;
    for (const [p, v] of r.decls) {
      if (p !== 'opacity') continue;
      const m = v.match(/^var\(\s*(--bsp-opacity-(soft|dim))\s*,\s*([\d.]+)\s*\)$/);
      const x = m ? parseFloat(m[3]) : parseFloat(v);
      if (!(x < 1)) continue;
      const want = x <= 0.6 ? '--bsp-opacity-dim' : '--bsp-opacity-soft';
      if (!m || m[1] !== want) wrong.push(`${r.context ? r.context + ' ' : ''}${r.selector} { opacity: ${v} } (want var(${want}, ${x}))`);
    }
  }
  assert(wrong.length === 0, `${wrong.length} opacity value(s) not on the ADR 0002 Amendment 1 rule:${NL}        ${wrong.slice(0, 15).join(`${NL}        `)}`);
});

// ── K ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const PAIR_ALLOWLIST = new Map([
]);

test('K1 in Light, every text-on-background pair a profile-family rule paints reaches 4.5:1 (WCAG AA)', () => {
  const classes = familyClasses();
  const now = H.parseCss(nowCss());
  const { seen, tokens } = S2.lightScope(now);
  assert(seen, 'there is no light scope to measure');
  const canvas = (H.parseColour(tokens['--bsp-canvas'] || '#f2f3f0') || { rgb: [242, 243, 240] }).rgb;
  const plain = now.filter((r) => !r.context && !S2.scoped(r.selector));
  const last = (r, props) => { let v = null; for (const [p, val] of r.decls) if (props.includes(p)) v = val; return v; };
  const BG = ['background', 'background-color'];
  const lastCompound = (sel) => sel.split(/\s*[\s>+~]\s*/).pop();
  const refines = (sel, base) => sel === base || (sel.startsWith(base) && /^[.:[]/.test(sel.slice(base.length)));
  const inherited = (r, props) => {
    const lc = lastCompound(r.selector); let best = null;
    for (const c of plain) {
      if (c === r || !last(c, props)) continue;
      if (!(refines(r.selector, c.selector) || refines(lc, c.selector))) continue;
      if (!best || c.selector.length > best.selector.length) best = c;
    }
    return best ? last(best, props) : null;
  };
  const resolve = (v) => H.norm(S2.lightBsp(v, tokens));
  const low = [];
  for (const r of plain) {
    if (!isFamilyRule(r, classes) || PAIR_ALLOWLIST.has(r.selector)) continue;
    const ownInk = last(r, ['color']); const ownBg = last(r, BG);
    if (!ownInk && !ownBg) continue;
    const ink = ownInk || inherited(r, ['color']); const bg = ownBg || inherited(r, BG);
    if (!ink || !bg) continue;
    const bgV = resolve(bg);
    if (/gradient\(|url\(|var\(/.test(bgV) || /^(none|transparent|inherit)$/.test(bgV)) continue;
    const b = H.parseColour(bgV, canvas);
    const inkV = resolve(ink);
    const t = b && !/var\(/.test(inkV) && H.parseColour(inkV, b.rgb);
    if (!b || !t) continue;
    const c = H.contrast(t.rgb, b.rgb);
    if (c < 4.5) low.push(`${r.selector}: ${inkV} on ${bgV}, ${c.toFixed(2)}:1`);
  }
  assert(low.length === 0, `${low.length} pair(s) below 4.5:1 in Light:${NL}        ${low.slice(0, 20).join(`${NL}        `)}`);
});

// ── I ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('I1 the inline colours in the working pages\' JSX read --bsp- tokens', () => {
  const bare = [];
  for (const rel of INLINE_FILES) {
    const text = fs.readFileSync(path.join(UI_SRC, rel), 'utf8');
    for (const m of text.matchAll(/['"`]([^'"`\n]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|var\(--(?!bsp-)[\w-]+\s*,\s*#)[^'"`\n]*)['"`]/g)) {
      if (/^var\(--bsp-[\w-]+\s*,/.test(m[1].trim())) continue;
      bare.push(`${rel}: ${show(m[1])}`);
    }
  }
  assert(bare.length === 0, `${bare.length} inline colour(s) don't read a --bsp- token:${NL}        ${bare.join(`${NL}        `)}`);
});

test('I2 the /about count chip\'s text reads the darker accent ink in Light, and today\'s accent in Dark', () => {
  const text = fs.readFileSync(path.join(UI_SRC, 'components/AboutThisInstance.jsx'), 'utf8');
  const chip = (text.match(/const chipStyle = \{([\s\S]*?)\};/) || [])[1] || '';
  assert(chip, 'AboutThisInstance.jsx should still define chipStyle');
  const color = (chip.match(/color:\s*([^,\n]+)/) || [])[1] || '';
  assert(/var\(--bsp-accent-ink,\s*\$\{ACCENT\}\)|'var\(--bsp-accent-ink, var\(--bsp-accent, #a5b4fc\)\)'|'var\(--bsp-accent-ink, #a5b4fc\)'/.test(color),
    `chipStyle.color should read var(--bsp-accent-ink, <today's accent>) (ADR 0003 sub-decision 6), got ${show(color.trim())}`);
});

test('I3 the published avatar\'s ring colour is untouched: compositeAvatar.js still draws #0d1117 (regression)', () => {
  const text = fs.readFileSync(path.join(UI_SRC, 'utils/compositeAvatar.js'), 'utf8');
  assert(/const RING_COLOR = '#0d1117';/.test(text), 'compositeAvatar.js RING_COLOR is drawn into a published image and must stay #0d1117 (ADR 0003 sub-decision 4)');
});

async function run() {
  console.log(`${NL}=== appearance-setting-working (appearance-setting #3) ===`);
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
  console.log(`${NL}appearance-setting-working: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}

module.exports = { run };
