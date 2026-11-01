'use strict';
/**
 * appearance-setting #2: a light look for the frame and the reading pages.
 *
 * Story: engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.md
 * ADR:   engineering-team/decisions/appearance-setting/0002-light-only-token-layer-for-the-profile-family.md
 * Plan:  engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.test-plan.md
 * Browser half: tests/brainstorm/appearance-setting-light.spec.js (the light sweep, the Dark and "unchanged" snapshots,
 * no flash, switching, phones).
 *
 * Classes:
 *   C — the library: the reading paths, and which pre-render hint a path gets.                          [AC-5]
 *   P — the pre-render script agrees with the library on every path, and holds the same lists.            [AC-5]
 *   T — the stylesheet: Dark (and every untouched page) unchanged character for character once the --bsp-
 *       wrappers are stripped; the light scope; its core colours are the design shell's; every token read is
 *       declared; every colour a story-2 rule paints is wrapped.                              [AC-1, AC-2, AC-3, AC-7]
 *   I — the inline colours in JSX are wrapped too.                                                       [AC-1]
 *   K — contrast in Light: the core token pairs, and every pair a story-2 rule paints.                   [AC-1]
 *
 * Everything FAILS at the story's base except T1 (Dark unchanged), which passes before and after.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = require('./appearance-setting.test.js').helpers;

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/appearance.js');
const INDEX_HTML = path.join(REPO, 'ui/index.html');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const UI_SRC = path.join(REPO, 'ui/src');
// The staging merge story 2 starts from (story 1 on staging).
const BASE = '56d76a2b4abee6a07ba8be48e9b3856b66c3c15d';
const NL = String.fromCharCode(10);

const READING_PREFIXES = ['/about', '/about-brainstorm-search', '/how-search-works', '/brainstorm-skill', '/personalization',
  '/settings', '/user', '/feed', '/event'];
// The reading pages and the frame (story 2, ADR 0002 Context), followed through their local imports.
const READING_FILES = ['pages/BrainstormAbout.jsx', 'pages/BrainstormAboutSearch.jsx', 'pages/BrainstormHowSearchWorks.jsx',
  'pages/BrainstormSkill.jsx', 'pages/BrainstormPersonalization.jsx', 'pages/BrainstormSettings.jsx', 'pages/BrainstormProfile.jsx',
  'pages/BrainstormFollows.jsx', 'pages/BrainstormFollowers.jsx', 'pages/BrainstormFollowsHops.jsx', 'pages/BrainstormMuters.jsx',
  'pages/BrainstormReporters.jsx', 'pages/BrainstormUserNotes.jsx', 'pages/BrainstormFeed.jsx', 'pages/BrainstormEvent.jsx',
  'components/TopBar.jsx', 'components/BrainstormUserMenu.jsx'];
// Story 3's families (ADR 0002 sub-decision 7). `.bs-setup-alert` is frame, so only the step rules are story 3's.
// Re-aimed after review 1: the bare ptc, ptd and pcd (the Manage Tags dialog's own box) are story 3's too.
const STORY3 = /^(bs-tag|bs-tagindex|bs-pin|bs-pins|bs-pindetail|bs-tl|ptc\b|ptd\b|pcd\b|bs-assistant|bs-idtags|bs-outbox|bs-setup-step)/;
const INLINE_FILES = ['components/AboutThisInstance.jsx', 'pages/BrainstormAboutSearch.jsx', 'pages/BrainstormAbout.jsx',
  'pages/BrainstormPersonalization.jsx', 'pages/BrainstormHowSearchWorks.jsx', 'pages/BrainstormSkill.jsx'];
// The light scope (ADR 0002 sub-decision 3), compared with quotes and spaces normalized.
const SCOPE = ':root[data-appearance="light"] body:has(:is(.bsp-page,.bss-page))';
// Re-aimed by appearance-setting #4: the search home's .bs-page joins the :is() list (ADR 0004 sub-decision 1), so the
// scope is the rule of that shape whose list holds at least story 2's two pages.
function isScope(sel) {
  const m = normSel(sel).match(/^:root\[data-appearance="light"\] body:has\(:is\(([^)]*)\)\)$/);
  if (!m) return false;
  const pages = m[1].split(',');
  return pages.includes('.bsp-page') && pages.includes('.bss-page');
}
const COLOUR_PROPS = /^(color|background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|text-decoration-color|caret-color|column-rule-color)$/;
const LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/i;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);

function loadLib() { delete require.cache[require.resolve(LIB)]; return require(LIB); }
const normSel = (s) => s.replace(/'/g, '"').replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();

// ── C ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 READING_PATH_PREFIXES lists the reading pages\' paths, and isReadingPath matches them exactly or below them', () => {
  const L = loadLib();
  assert(show(L.READING_PATH_PREFIXES) === show(READING_PREFIXES), `READING_PATH_PREFIXES should be ${show(READING_PREFIXES)}, got ${show(L.READING_PATH_PREFIXES)}`);
  assert(typeof L.isReadingPath === 'function', 'isReadingPath should be exported');
  for (const p of ['/about', '/about/', '/user/abc', '/user/abc/notes', '/feed', '/event', '/settings', '/about-brainstorm-search']) {
    assert(L.isReadingPath(p) === true, `isReadingPath(${show(p)}) should be true`);
  }
  for (const p of ['/', '/aboutx', '/users', '/tags', '/pins', '/assistant', '/setup', '/dictionary', '/tapestry/settings', '/feeds']) {
    assert(L.isReadingPath(p) === false, `isReadingPath(${show(p)}) should be false`);
  }
});

test('C2 preloadFamily: "design" on design-shell paths, "profile" on reading paths, null elsewhere', () => {
  const L = loadLib();
  assert(typeof L.preloadFamily === 'function', 'preloadFamily should be exported');
  const cases = [['/dictionary', 'design'], ['/treasure-map/advanced', 'design'], ['/assistants', 'design'], ['/about', 'profile'],
    ['/user/abc/follows', 'profile'], ['/settings', 'profile'], ['/', 'profile'] /* re-aimed by #4 (ADR 0004) */, ['/tapestry/', null]];
  // Re-aimed by appearance-setting #3: /tags and /assistant/profile are working paths now ('profile'); story 3's C2 pins them.
  for (const [p, want] of cases) {
    const got = L.preloadFamily(p);
    assert(got === want, `preloadFamily(${show(p)}) should be ${show(want)}, got ${show(got)}`);
  }
});

// ── P ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

function preRenderScript() {
  const { scripts } = H.inlineHeadScripts(fs.readFileSync(INDEX_HTML, 'utf8'));
  assert(scripts.length >= 1, 'ui/index.html should carry the pre-render script');
  return scripts.map((s) => s.code).join(NL);
}

test('P1 the pre-render script holds the library\'s two path lists', () => {
  const L = loadLib();
  const code = preRenderScript();
  const lists = [...code.matchAll(/\[\s*('[^']*'(?:\s*,\s*'[^']*')*)\s*\]/g)].map((m) => m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')));
  const has = (want) => lists.some((l) => show(l) === show(want));
  assert(has(L.DESIGN_SHELL_PATH_PREFIXES), `the script should hold the design-shell list ${show(L.DESIGN_SHELL_PATH_PREFIXES)}; it holds ${show(lists)}`);
  assert(has(L.READING_PATH_PREFIXES || READING_PREFIXES), `the script should hold the reading list ${show(L.READING_PATH_PREFIXES || READING_PREFIXES)}; it holds ${show(lists)}`);
});

test('P2 the pre-render script sets data-preload-family exactly as preloadFamily says, on every path', () => {
  const L = loadLib();
  const code = preRenderScript();
  const all = [...L.DESIGN_SHELL_PATH_PREFIXES, ...(L.READING_PATH_PREFIXES || READING_PREFIXES)];
  const paths = [...all.flatMap((p) => [p, `${p}/`, `${p}/x`, `${p}x`]), '/', '/tags', '/pins', '/setup', '/tapestry/', '/assistant/x'];
  const wrong = [];
  for (const pathname of paths) for (const stored of [undefined, 'light', 'dark']) {
    const attrs = H.runPreRender(code, { stored, osDark: true, pathname });
    const want = typeof L.preloadFamily === 'function' ? L.preloadFamily(pathname) : '(no preloadFamily)';
    const got = attrs['data-preload-family'] === undefined ? null : attrs['data-preload-family'];
    if (got !== want) wrong.push(`${pathname} (${stored}): ${show(got)}, the library says ${show(want)}`);
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
const nowCss = () => fs.readFileSync(STYLES, 'utf8');
const scoped = (sel) => /\[data-appearance|\[data-preload-family/.test(sel);

/** Replace every var(--bsp-x, F) with F (recursively). Throws on a --bsp- read with no fallback. */
function stripBsp(value) {
  let out = value, guard = 0;
  for (;;) {
    const at = out.indexOf('var(--bsp-');
    if (at === -1 || guard++ > 200) return out;
    let d = 0, j = at + 3, comma = -1;
    for (; j < out.length; j++) {
      if (out[j] === '(') d++;
      else if (out[j] === ')') { d--; if (d === 0) break; }
      else if (out[j] === ',' && d === 1 && comma === -1) comma = j;
    }
    if (comma === -1) throw new Error(`a --bsp- token read with no fallback: ${out.slice(at, j + 1)}`);
    out = out.slice(0, at) + out.slice(comma + 1, j).trim() + out.slice(j + 1);
  }
}
/** Replace every var(--bsp-x, F) with the light value of --bsp-x. */
function lightBsp(value, tokens) {
  let out = value, guard = 0;
  for (;;) {
    const at = out.indexOf('var(--bsp-');
    if (at === -1 || guard++ > 200) return out;
    let d = 0, j = at + 3, comma = -1;
    for (; j < out.length; j++) {
      if (out[j] === '(') d++;
      else if (out[j] === ')') { d--; if (d === 0) break; }
      else if (out[j] === ',' && d === 1 && comma === -1) comma = j;
    }
    const name = out.slice(at + 4, comma === -1 ? j : comma).trim();
    const sub = name in tokens ? tokens[name] : (comma === -1 ? '' : out.slice(comma + 1, j).trim());
    out = out.slice(0, at) + sub + out.slice(j + 1);
  }
}
function lastByKey(rules, keep) {
  const map = new Map();
  for (const r of rules) { if (!keep(r)) continue; for (const [p, v] of r.decls) map.set(`${r.context}§${r.selector}§${p}`, { r, p, v }); }
  return map;
}
function lightScope(rules) {
  const tokens = {}; let seen = false; const decl = {};
  for (const r of rules) {
    if (r.context || !isScope(r.selector)) continue;
    seen = true;
    for (const [p, v] of r.decls) { if (p.startsWith('--bsp-')) tokens[p] = v; else decl[p] = v; }
  }
  return { seen, tokens, decl };
}

test('T1 Dark and every untouched page are unchanged: with the --bsp- wrappers stripped, every rule reads as it did at the base (regression)', () => {
  const before = H.parseCss(baseCss());
  const now = H.parseCss(nowCss());
  // Appearance-scoped rules are compared by T2/T3, not here; a --bsp- read the base already had (--bsp-bg in
  // .bsp-follows-colpanel, declared nowhere) is stripped on both sides.
  const b = lastByKey(before, (r) => !scoped(r.selector));
  const n = lastByKey(now, (r) => !scoped(r.selector));
  const diffs = [];
  for (const [k, { r, p, v }] of b) {
    const m = n.get(k);
    const where = `${r.context ? r.context + ' ' : ''}${r.selector} { ${p} }`;
    if (!m) { diffs.push(`${where} is gone`); continue; }
    let stripped, was;
    try { stripped = stripBsp(m.v); was = stripBsp(v); } catch (e) { diffs.push(`${where}: ${e.message}`); continue; }
    if (H.norm(stripped) !== H.norm(was)) diffs.push(`${where}: ${H.norm(stripped)} (was ${H.norm(was)})`);
  }
  for (const [k, { r }] of n) if (!b.has(k)) diffs.push(`new unscoped declaration: ${r.context ? r.context + ' ' : ''}${k.split('§').slice(1).join(' { ')} }`);
  assert(diffs.length === 0, `${diffs.length} difference(s) from the base:${NL}        ${diffs.slice(0, 12).join(`${NL}        `)}`);
});

test('T2 the light scope exists: the light canvas on body, color-scheme light, and the core colours equal the design shell\'s light ones', () => {
  const now = H.parseCss(nowCss());
  const { seen, tokens, decl } = lightScope(now);
  assert(seen, `there should be a rule ${SCOPE} (ADR 0002 sub-decision 3)`);
  assert(H.norm(decl.background || decl['background-color'] || '') === '#f2f3f0', `the light scope should paint body #f2f3f0, got ${show(decl.background || decl['background-color'])}`);
  assert(H.norm(decl['color-scheme'] || '') === 'light', `the light scope should declare color-scheme: light, got ${show(decl['color-scheme'])}`);
  const shell = {};
  for (const r of now) if (!r.context && r.selector === '.bsd-page') for (const [p, v] of r.decls) if (p.startsWith('--')) shell[p] = v;
  const pairs = [['--bsp-canvas', '--bg-primary'], ['--bsp-surface', '--bg'], ['--bsp-ink', '--text'], ['--bsp-ink-primary', '--text-primary'],
    ['--bsp-muted', '--text-muted'], ['--bsp-accent', '--accent']];
  const wrong = pairs.filter(([a, s]) => H.norm(tokens[a] || '(missing)') !== H.norm(shell[s] || '?')).map(([a, s]) => `${a} = ${show(tokens[a])}, the design shell's ${s} = ${show(shell[s])}`);
  assert(wrong.length === 0, `the light look should match the design shell's:${NL}        ${wrong.join(`${NL}        `)}`);
});

function jsxFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsxFiles(p, out); else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('T3 every --bsp- token read anywhere (stylesheet or JSX) is declared in the light scope', () => {
  const css = nowCss();
  const { tokens } = lightScope(H.parseCss(css));
  const reads = new Set([...css.matchAll(/var\(\s*(--bsp-[\w-]+)/g)].map((m) => m[1]));
  for (const f of jsxFiles(UI_SRC)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/var\(\s*(--bsp-[\w-]+)/g)) reads.add(m[1]);
  assert(reads.size > 0, 'nothing reads a --bsp- token yet (ADR 0002 sub-decision 4)');
  const missing = [...reads].filter((t) => !(t in tokens));
  assert(missing.length === 0, `${missing.length} token(s) read but not declared in the light scope (they'd stay dark in Light): ${missing.join(', ')}`);
});

/**
 * The page files reached from `files` through their local imports, and the classes they render.
 *
 * Re-aimed after appearance-setting #3's review 1 (Blocking 1): a class counts when ANY quoted or template string in a
 * walked file holds it as a word and the stylesheet defines it. The earlier finder read only className="…" and
 * className={…} expressions, and missed classes built in nested templates (TagChip), held in variables (TagPageRow,
 * SearchInput) or chosen inside ${…} (AssistantProfileEditor).
 */
const STATE_WORD = /^(active|selected|open|closed|disabled|loading|error|success|warning|info|hidden|visible|expanded|collapsed|current|checked|empty|saved|pending|done|stale|missing|is-[\w-]+|has-[\w-]+)$/;
let cssClassCache = null;
function cssClasses() {
  if (!cssClassCache) cssClassCache = new Set([...fs.readFileSync(STYLES, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]));
  return cssClassCache;
}
const NOT_A_CLASS = /(?:\b(?:role|type|name|id|key|htmlFor|rel|target|method|autoComplete|inputMode|aria-[\w-]+|data-[\w-]+)=\{?|\.(?:get|set|has|delete|append)\()\s*(['"])[\w-]*\1/g;
function walkFrom(files) {
  const seen = new Set(); const classes = new Set(); const defined = cssClasses();
  const resolve = (from, spec) => {
    if (!spec.startsWith('.')) return null;
    const base = path.resolve(path.dirname(from), spec);
    for (const ext of ['', '.jsx', '.js', '/index.jsx', '/index.js']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext;
    return null;
  };
  const walk = (file) => {
    if (seen.has(file) || !file.startsWith(UI_SRC)) return; seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    // State words ("active", "loading", "is-open" …) are everywhere in strings; they count only where a className
    // expression uses them. Every other class the stylesheet defines counts from any string, the strings inside a
    // template's ${…} included. A non-class attribute's value (role="tab") or a search param's name (p.set('tab', …))
    // isn't a class, so those are blanked first.
    const scan = (src, depth = 0) => {
      for (const m of src.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
        // Only a string shaped like a class list counts: prose ("the Pinned tab.") and URLs ("?tab=pinned") don't.
        // A nested template pairs its backticks wrongly; an unclosed ${… is cut off where it starts.
        const flat = m[2].replace(/\$\{[^}]*\}/g, ' ').replace(/\$\{.*$/, ' ').replace(/^[^{]*\}/, ' ');
        if (/^[\w\s-]*$/.test(flat)) for (const word of flat.split(/\s+/)) {
          if (/^[a-z][\w-]+$/.test(word) && defined.has(word) && !STATE_WORD.test(word)) classes.add(word);
        }
        if (m[1] !== '`' || depth > 2) continue;
        for (const inner of m[2].matchAll(/\$\{([^}]*)\}/g)) scan(inner[1], depth + 1);
      }
    };
    // Comments go first: their apostrophes and quotes would pair with a string's.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1').replace(NOT_A_CLASS, '');
    scan(code);
    // A class finished in code (`settings-message-${type}`) counts as every class the stylesheet defines with that
    // start. Only a template literal holds `-${`, so the whole file is read for it (nested templates included). The
    // start must name a family (two segments or more, `bs-tag-`), and a state start (`is-${…}`, `has-${…}`) never
    // counts: it would pull in every `is-*` class, admin pages' included (review 3-R2, ADR appearance-setting/0004).
    for (const p of code.matchAll(/[`\s'"]([a-z][\w-]*-)\$\{/g)) {
      if (!/^[a-z]\w*-[\w-]*\w-$/.test(p[1]) || /^(is|has)-/.test(p[1])) continue;
      for (const c of defined) if (c.startsWith(p[1])) classes.add(c);
    }
    for (const m of text.matchAll(/className=(?:"([^"]+)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g)) {
      const strings = m[1] !== undefined ? [m[1]] : [...m[2].matchAll(/(['"`])((?:(?!\1)[^\\])*)\1/g)].map((x) => x[2]);
      for (const str of strings) for (const c of str.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (/^[a-z][\w-]+$/.test(c)) classes.add(c);
    }
    for (const m of text.matchAll(/(?:import|from)\s+[^'"]*['"]([^'"]+)['"]/g)) { const r = resolve(file, m[1]); if (r) walk(r); }
  };
  files.forEach((f) => walk(path.join(UI_SRC, f)));
  return { files: [...seen], classes };
}
const classesFrom = (files) => walkFrom(files).classes;
const filesFrom = (files) => walkFrom(files).files;
const story2Classes = () => classesFrom(READING_FILES);
function isStory2Rule(r, classes) {
  if (scoped(r.selector) || /\.bsd-|bsd-page|\.dict-/.test(r.selector)) return false;
  const names = [...r.selector.matchAll(/\.([a-z][\w-]+)/g)].map((m) => m[1]);
  return names.some((c) => classes.has(c)) && !names.some((c) => STORY3.test(c));
}

test('T4 every colour a story-2 rule paints reads a --bsp- token (with today\'s value as its fallback)', () => {
  const classes = story2Classes();
  const now = H.parseCss(nowCss());
  const bare = [];
  for (const r of now) {
    if (!isStory2Rule(r, classes)) continue;
    for (const [p, v] of r.decls) {
      if (p.startsWith('--') || !COLOUR_PROPS.test(p)) continue;
      // Remove every --bsp- wrapper whole; what's left must hold no colour of its own.
      let rest = v, at;
      while ((at = rest.indexOf('var(--bsp-')) !== -1) {
        let d = 0, j = at + 3;
        for (; j < rest.length; j++) { if (rest[j] === '(') d++; else if (rest[j] === ')') { d--; if (d === 0) break; } }
        rest = rest.slice(0, at) + rest.slice(j + 1);
      }
      if (LITERAL.test(rest) || /var\(\s*--/.test(rest)) bare.push(`${r.context ? r.context + ' ' : ''}${r.selector} { ${p}: ${v} }`);
    }
  }
  assert(bare.length === 0, `${bare.length} colour(s) in story-2 rules don't read a --bsp- token:${NL}        ${bare.slice(0, 15).join(`${NL}        `)}`);
});

// T5 ("story 3's families are left as they are") was story 2's rule while story 3 was unbuilt. Story 3 converts those
// families on purpose (ADR appearance-setting/0003 sub-decision 1), so it is retired here; story 3's own suite
// (test/appearance-setting-working.test.js) requires them converted.

// ── I ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('I1 the inline colours in the reading pages\' JSX read --bsp- tokens', () => {
  const bare = [];
  for (const rel of INLINE_FILES) {
    const text = fs.readFileSync(path.join(UI_SRC, rel), 'utf8');
    for (const m of text.matchAll(/['"`]([^'"`\n]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d)[^'"`\n]*)['"`]/g)) {
      const s = m[1];
      if (/^var\(--bsp-[\w-]+\s*,/.test(s.trim())) continue;
      bare.push(`${rel}: ${show(s)}`);
    }
  }
  assert(bare.length === 0, `${bare.length} inline colour(s) don't read a --bsp- token:${NL}        ${bare.join(`${NL}        `)}`);
});

// ── K ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('K1 in Light, the core inks reach 4.5:1 on the light canvas and surface', () => {
  const { seen, tokens } = lightScope(H.parseCss(nowCss()));
  assert(seen, 'there is no light scope to measure (see T2)');
  const solid = (t) => { const c = H.parseColour(tokens[t] || ''); if (!c || c.a < 1) throw new Error(`${t} should be a solid colour, got ${show(tokens[t])}`); return c.rgb; };
  const low = [];
  // Re-aimed in Implementation: muted text is measured on the surface (cards) only. On the canvas it is 4.25:1, the
  // design shell's own pair (AC-2 requires that exact colour), and it is secondary text, not AC-1's body text or links;
  // L1 sweeps the text the pages actually paint and K2 every pair a rule paints.
  const pairs = [];
  for (const ink of ['--bsp-ink', '--bsp-ink-primary', '--bsp-accent']) for (const s of ['--bsp-canvas', '--bsp-surface']) pairs.push([ink, s]);
  pairs.push(['--bsp-muted', '--bsp-surface']);
  for (const [ink, s] of pairs) {
    const c = H.contrast(solid(ink), solid(s)); if (c < 4.5) low.push(`${ink} on ${s}: ${c.toFixed(2)}:1`);
  }
  assert(low.length === 0, `${low.join('; ')}`);
});

// Pairs K2 may skip, each with its reason. Key: selector.
const PAIR_ALLOWLIST = new Map([
]);

test('K2 in Light, every text-on-background pair a story-2 rule paints reaches 4.5:1 (WCAG AA)', () => {
  const classes = story2Classes();
  const now = H.parseCss(nowCss());
  const { seen, tokens } = lightScope(now);
  assert(seen, 'there is no light scope to measure (see T2)');
  const canvas = (H.parseColour(tokens['--bsp-canvas'] || '#f2f3f0') || { rgb: [242, 243, 240] }).rgb;
  const plain = now.filter((r) => !r.context && !scoped(r.selector));
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
  const resolve = (v) => H.norm(lightBsp(v, tokens));
  const low = [];
  for (const r of plain) {
    if (!isStory2Rule(r, classes) || PAIR_ALLOWLIST.has(r.selector)) continue;
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

async function run() {
  console.log(`${NL}=== appearance-setting-light (appearance-setting #2) ===`);
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
  console.log(`${NL}appearance-setting-light: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}

// The stylesheet helpers are shared with test/appearance-setting-working.test.js (appearance-setting #3).
module.exports = {
  run,
  helpers: { stripBsp, lightBsp, lastByKey, lightScope, classesFrom, filesFrom, scoped, normSel, READING_FILES, COLOUR_PROPS, LITERAL, SCOPE, isScope, STATE_WORD },
};
