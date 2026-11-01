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
// The disabled and inactive states (review 1, Blocking 4): WCAG exempts them, and their opacity is what shows they're
// off, so they keep today's value in both looks (ADR 0002 Amendment 1).
const DISABLED = /:disabled|\[disabled\]|\.disabled\b|is-disabled|aria-disabled|\.saved\b|is-parked/;
// Files whose colours are content, not appearance (ADR 0003 sub-decision 4).
const CONTENT_FILES = ['utils/compositeAvatar.js'];

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
  // SearchInput is shared; its landing variant renders only on the search home, which is story 4.
  if (/-landing\b/.test(r.selector)) return false;
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
    if (!isFamilyRule(r, classes) || DISABLED.test(r.selector)) continue;
    for (const [p, v] of r.decls) {
      if (p !== 'opacity') continue;
      const m = v.match(/^var\(\s*(--bsp-opacity-(soft|dim))\s*,\s*([\d.]+)\s*\)$/);
      const x = m ? parseFloat(m[3]) : parseFloat(v);
      // opacity: 0 hides an element until a hover or focus reveals it; it isn't dimmed text (re-aimed in Implementation).
      if (!(x > 0 && x < 1)) continue;
      const want = x <= 0.6 ? '--bsp-opacity-dim' : '--bsp-opacity-soft';
      if (!m || m[1] !== want) wrong.push(`${r.context ? r.context + ' ' : ''}${r.selector} { opacity: ${v} } (want var(${want}, ${x}))`);
    }
  }
  assert(wrong.length === 0, `${wrong.length} opacity value(s) not on the ADR 0002 Amendment 1 rule:${NL}        ${wrong.slice(0, 15).join(`${NL}        `)}`);
});

test('T4 disabled and inactive states keep today\'s opacity in both looks: no --bsp- opacity token in their rules (review 1, Blocking 4)', () => {
  const wrapped = [];
  for (const r of H.parseCss(nowCss())) {
    if (S2.scoped(r.selector) || !DISABLED.test(r.selector)) continue;
    for (const [p, v] of r.decls) if (p === 'opacity' && /var\(\s*--bsp-opacity/.test(v)) wrapped.push(`${r.context ? r.context + ' ' : ''}${r.selector} { opacity: ${v} }`);
  }
  assert(wrapped.length === 0, `${wrapped.length} disabled state(s) would look enabled in Light:${NL}        ${wrapped.slice(0, 15).join(`${NL}        `)}`);
});

/** A wrapper's Dark value, resolved against :root (the admin palette) like the page resolves it. */
function rootTokens(rules) {
  const t = {};
  for (const r of rules) if (!r.context && r.selector === ':root') for (const [p, v] of r.decls) if (p.startsWith('--')) t[p] = v;
  return t;
}
function darkValue(expr, root, depth = 0) {
  const m = String(expr).trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (!m || depth > 6) return String(expr).trim();
  if (m[1] in root) return darkValue(root[m[1]], root, depth + 1);
  return m[2] ? darkValue(m[2], root, depth + 1) : null;
}

test('T5 a grey stays a grey: no --bsp-accent token wraps a grey Dark value (review 1, Blocking 3)', () => {
  const rules = H.parseCss(nowCss());
  const root = rootTokens(rules);
  const css = nowCss();
  const wrong = new Set();
  for (const m of css.matchAll(/var\(\s*(--bsp-accent[\w-]*)\s*,/g)) {
    // The wrapper's fallback: from after the comma to its matching parenthesis.
    let d = 1, j = m.index + m[0].length;
    for (; j < css.length && d > 0; j++) { if (css[j] === '(') d++; else if (css[j] === ')') d--; }
    const fallback = css.slice(m.index + m[0].length, j - 1).trim();
    const dark = darkValue(fallback, root);
    const c = dark && H.parseColour(dark);
    if (!c) continue;
    const [r, g, b] = c.rgb;
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (chroma < 0.2) wrong.add(`${m[1]} wraps ${fallback} (Dark ${dark}, a grey)`);
  }
  assert(wrong.size === 0, `${wrong.size} grey(s) turn into the accent in Light (muted text would read as a link):${NL}        ${[...wrong].slice(0, 15).join(`${NL}        `)}`);
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

// Re-aimed after review 1 (Blocking 2): every file the reading and working pages reach, not a hand-picked list.
const walkedFiles = () => S2.filesFrom([...S2.READING_FILES, ...WORKING_FILES])
  .map((f) => path.relative(UI_SRC, f)).filter((rel) => !CONTENT_FILES.includes(rel));

test('I1 the inline colours in every file the reading and working pages reach read --bsp- tokens', () => {
  const bare = [];
  for (const rel of walkedFiles()) {
    const text = fs.readFileSync(path.join(UI_SRC, rel), 'utf8');
    for (const m of text.matchAll(/['"`]([^'"`\n]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|var\(--(?!bsp-)[\w-]+\s*,\s*#)[^'"`\n]*)['"`]/g)) {
      if (/^var\(--bsp-[\w-]+\s*,/.test(m[1].trim())) continue;
      bare.push(`${rel}: ${show(m[1])}`);
    }
  }
  assert(bare.length === 0, `${bare.length} inline colour(s) don't read a --bsp- token:${NL}        ${bare.join(`${NL}        `)}`);
});

test('I4 no inline style in those files dims with a literal opacity (it reads var(--bsp-opacity-soft|dim, X)) (review 1, Blocking 2)', () => {
  const bare = [];
  for (const rel of walkedFiles()) {
    const text = fs.readFileSync(path.join(UI_SRC, rel), 'utf8');
    text.split(NL).forEach((line, i) => {
      for (const m of line.matchAll(/\bopacity:\s*(0?\.\d+)\b/g)) {
        if (/disabled/i.test(line)) continue; // a disabled control's own dimming stays as it is
        bare.push(`${rel}:${i + 1}: opacity ${m[1]}`);
      }
    });
  }
  assert(bare.length === 0, `${bare.length} literal inline opacit(ies):${NL}        ${bare.slice(0, 20).join(`${NL}        `)}`);
});

test('I2 the /about count chip\'s text reads the darker accent ink in Light, and today\'s accent in Dark', () => {
  const text = fs.readFileSync(path.join(UI_SRC, 'components/AboutThisInstance.jsx'), 'utf8');
  const chip = (text.match(/const chipStyle = \{([\s\S]*?)\};/) || [])[1] || '';
  assert(chip, 'AboutThisInstance.jsx should still define chipStyle');
  // A whole quoted or template value: the wrapper itself holds a comma (re-aimed in Implementation).
  const color = (chip.match(/color:\s*(`[^`]*`|'[^']*'|[^,\n]+)/) || [])[1] || '';
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

module.exports = { run, WORKING_FILES };
