'use strict';
/**
 * appearance-setting #1: the Appearance switch (System, Light or Dark), and a dark look for the design-shell pages.
 *
 * Story: engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.md
 * ADR:   engineering-team/decisions/appearance-setting/0001-appearance-attribute-preload-and-design-shell-tokens.md
 * Plan:  engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.test-plan.md
 * Browser half: tests/brainstorm/appearance-setting.spec.js (what a visitor SEES: placements, an instant change, no
 * flash, the live OS change, the dark sweep, the other families unchanged).
 *
 * Classes:
 *   C — the pure library src/lib/appearance.js: names, normalizing, resolving, storage that throws, the
 *       design-shell paths.                                                                       [AC-1, AC-3, AC-7]
 *   P — the pre-render script in ui/index.html, executed in a vm sandbox across every combination and compared with
 *       the library: the two must never disagree.                                                  [AC-1, AC-4, AC-7]
 *   T — the stylesheet against itself as it stood at BASE (git): Light is unchanged inside the design shell, the
 *       design-shell rules hold no literal colours, a dark token set exists, and nothing outside the design shell
 *       changed.                                                                                    [AC-5, AC-6]
 *   K — WCAG AA contrast of the dark text and link tokens on the dark surfaces.                    [AC-5]
 *
 * Everything except T1 and T4 FAILS against the code at BASE (there is no library, no pre-render script, no token
 * set). T1 and T4 are regressions that pass before and after (the stylesheet is unchanged at BASE).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/appearance.js');
const INDEX_HTML = path.join(REPO, 'ui/index.html');
const STYLES = path.join(REPO, 'ui/src/styles.css');
// The staging commit this story branched from; its stylesheet is "today" for every T test.
const BASE = '6d3bb6595574ddb649dd684534f5da95bff5e9eb';
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);

function loadLib() {
  assert(fs.existsSync(LIB), `src/lib/appearance.js should exist (ADR 0001, Implementation notes: "Pure logic")`);
  delete require.cache[require.resolve(LIB)];
  return require(LIB);
}

// ── storage and matchMedia stubs ───────────────────────────────────────────────────────────────────────────────────

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
const throwingStorage = () => ({
  getItem() { throw new Error('SecurityError: storage denied'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError: storage denied'); },
});

// ── C: the library ─────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 names: the key is tapestry_appearance, the choices are system/light/dark, the default is system', () => {
  const L = loadLib();
  assert(L.STORAGE_KEY === 'tapestry_appearance', `STORAGE_KEY should be "tapestry_appearance", got ${show(L.STORAGE_KEY)}`);
  assert(show(L.CHOICES) === show(['system', 'light', 'dark']), `CHOICES should be ["system","light","dark"], got ${show(L.CHOICES)}`);
  assert(L.DEFAULT_CHOICE === 'system', `DEFAULT_CHOICE should be "system" (David, 2026-10-31), got ${show(L.DEFAULT_CHOICE)}`);
});

test('C2 normalizeChoice keeps the three choices and reads anything else as system', () => {
  const L = loadLib();
  for (const c of ['system', 'light', 'dark']) assert(L.normalizeChoice(c) === c, `normalizeChoice(${show(c)}) should be ${show(c)}`);
  for (const junk of [null, undefined, '', 'Dark', 'LIGHT', 'auto', ' dark', 42, {}, 'brainstorm_theme']) {
    const got = L.normalizeChoice(junk);
    assert(got === 'system', `normalizeChoice(${show(junk)}) should read as "system", got ${show(got)}`);
  }
});

test('C3 resolveAppearance: System follows the computer; Light and Dark hold whatever the computer says', () => {
  const L = loadLib();
  const cases = [
    ['system', true, 'dark'], ['system', false, 'light'],
    ['light', true, 'light'], ['light', false, 'light'],
    ['dark', true, 'dark'], ['dark', false, 'dark'],
    ['nonsense', true, 'dark'], ['nonsense', false, 'light'],
  ];
  for (const [choice, osDark, want] of cases) {
    const got = L.resolveAppearance(choice, osDark);
    assert(got === want, `resolveAppearance(${show(choice)}, systemPrefersDark=${osDark}) should be ${show(want)}, got ${show(got)}`);
  }
});

test('C4 readStoredChoice reads the stored choice, and reads system when there is none, junk, or storage that throws', () => {
  const L = loadLib();
  for (const c of ['system', 'light', 'dark']) {
    const got = L.readStoredChoice(memoryStorage({ tapestry_appearance: c }));
    assert(got === c, `a stored ${show(c)} should read back as ${show(c)}, got ${show(got)}`);
  }
  const cases = [
    ['an empty storage', memoryStorage()],
    ['a junk value', memoryStorage({ tapestry_appearance: 'purple' })],
    ['Brainstorm-UI\'s key only', memoryStorage({ brainstorm_theme: 'dark' })],
    ['storage that throws', throwingStorage()],
    ['no storage at all (null)', null],
    ['no storage at all (undefined)', undefined],
  ];
  for (const [label, storage] of cases) {
    let got;
    try { got = L.readStoredChoice(storage); } catch (e) { throw new Error(`readStoredChoice must never throw (${label}): ${e.message}`); }
    assert(got === 'system', `${label} should read as "system", got ${show(got)}`);
  }
});

test('C5 writeStoredChoice stores the choice under the key and reports success; storage that throws reports false and never throws', () => {
  const L = loadLib();
  const s = memoryStorage();
  const ok = L.writeStoredChoice(s, 'dark');
  assert(ok === true, `a successful write should return true, got ${show(ok)}`);
  assert(s.dump().tapestry_appearance === 'dark', `the write should store "dark" under tapestry_appearance, storage holds ${show(s.dump())}`);
  L.writeStoredChoice(s, 'system');
  assert(L.readStoredChoice(s) === 'system', 'a written "system" should read back as "system"');
  for (const [label, storage] of [['storage that throws', throwingStorage()], ['null storage', null]]) {
    let got;
    try { got = L.writeStoredChoice(storage, 'light'); } catch (e) { throw new Error(`writeStoredChoice must never throw (${label}): ${e.message}`); }
    assert(got === false, `a failed write (${label}) should return false, got ${show(got)}`);
  }
});

test('C6 isDesignShellPath matches /dictionary, /treasure-map and /assistants exactly or below them, and nothing else', () => {
  const L = loadLib();
  const yes = ['/dictionary', '/dictionary/', '/dictionary/new', '/dictionary/39998%3Aabc%3Adog/items/x', '/treasure-map',
    '/treasure-map/advanced', '/assistants', '/assistants/'];
  const no = ['/', '', '/dictionaryx', '/dictionaries', '/treasure-mapping', '/assistant', '/assistant/profile',
    '/assistantsx', '/settings', '/about', '/tapestry/dictionaries/concepts', '/x/dictionary', '/user/abc'];
  for (const p of yes) assert(L.isDesignShellPath(p) === true, `isDesignShellPath(${show(p)}) should be true`);
  for (const p of no) assert(L.isDesignShellPath(p) === false, `isDesignShellPath(${show(p)}) should be false`);
});

// ── P: the pre-render script ───────────────────────────────────────────────────────────────────────────────────────

function readIndexHtml() { return fs.readFileSync(INDEX_HTML, 'utf8'); }

// The classic inline scripts in <head>: no src, no type="module".
function inlineHeadScripts(html) {
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || '';
  const out = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(head))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs) || /type\s*=\s*["']?module/.test(attrs)) continue;
    out.push({ index: m.index, code: m[2] });
  }
  return { head, scripts: out };
}

function preRenderScript() {
  const html = readIndexHtml();
  const { scripts } = inlineHeadScripts(html);
  assert(scripts.length >= 1, 'ui/index.html should carry a classic inline <script> in <head> (ADR 0001, "Pre-render script")');
  return scripts.map((s) => s.code).join(NL);
}

/**
 * Run the pre-render script in a sandbox: a documentElement that records attributes, a localStorage (or one whose
 * access throws), matchMedia (or one that throws), and location.pathname.
 */
function runPreRender(code, { stored, storageThrows = false, osDark = false, matchMediaThrows = false, pathname = '/' }) {
  const attrs = {};
  const documentElement = {
    setAttribute: (k, v) => { attrs[k] = String(v); },
    removeAttribute: (k) => { delete attrs[k]; },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k) => k in attrs,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
  };
  documentElement.dataset = new Proxy({}, {
    set(_, k, v) { attrs[`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = String(v); return true; },
    get(_, k) { return attrs[`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`]; },
    deleteProperty(_, k) { delete attrs[`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`]; return true; },
  });
  const storage = memoryStorage(stored === undefined ? {} : { tapestry_appearance: stored });
  const window = {};
  Object.defineProperty(window, 'localStorage', {
    get() { if (storageThrows) throw new Error('SecurityError: storage denied'); return storage; },
  });
  window.matchMedia = (q) => {
    if (matchMediaThrows) throw new Error('matchMedia unavailable');
    return { matches: /prefers-color-scheme:\s*dark/.test(q) ? osDark : false, media: q, addEventListener() {}, addListener() {} };
  };
  window.location = { pathname };
  window.document = { documentElement };
  window.window = window;
  window.self = window;
  window.globalThis = window;
  const ctx = vm.createContext(window);
  vm.runInContext(code, ctx, { timeout: 1000 });
  return attrs;
}

test('P1 ui/index.html runs a classic inline script in <head>, before any stylesheet and before the module script', () => {
  const html = readIndexHtml();
  const { head, scripts } = inlineHeadScripts(html);
  assert(scripts.length >= 1, 'ui/index.html <head> should hold a classic inline <script> (no src, not type="module")');
  const first = scripts[0].index;
  const link = head.search(/<link[^>]+rel=["']?stylesheet/i);
  const moduleInHead = head.search(/<script[^>]+type=["']?module/i);
  assert(link === -1 || first < link, 'the pre-render script should come before any stylesheet link');
  assert(moduleInHead === -1 || first < moduleInHead, 'the pre-render script should come before the module script');
  const moduleTag = html.search(/<script[^>]+type=["']?module/i);
  assert(moduleTag === -1 || html.indexOf('<head') < moduleTag, 'the module script still exists');
});

test('P2 the pre-render script and the library agree in every combination of stored choice, computer setting and path', () => {
  const L = loadLib();
  const code = preRenderScript();
  const storedValues = [undefined, 'system', 'light', 'dark', 'purple', ''];
  // The script's own prefix list must be the library's (review 1, non-blocking 4): a prefix added to one alone fails.
  const scriptList = (code.match(/\[\s*('[^']*'(?:\s*,\s*'[^']*')*)\s*\]/) || [])[1];
  const scriptPrefixes = scriptList ? scriptList.split(',').map((x) => x.trim().replace(/^'|'$/g, '')) : null;
  assert(show(scriptPrefixes) === show(L.DESIGN_SHELL_PATH_PREFIXES),
    `the pre-render script's design-shell paths ${show(scriptPrefixes)} should equal the library's ${show(L.DESIGN_SHELL_PATH_PREFIXES)}`);
  const derived = L.DESIGN_SHELL_PATH_PREFIXES.flatMap((pre) => [pre, `${pre}/`, `${pre}/x`, `${pre}x`]);
  const paths = [...derived, '/', '/about', '/settings', '/tapestry/dictionaries/concepts', '/assistant/profile'];
  const wrong = [];
  for (const stored of storedValues) {
    for (const osDark of [true, false]) {
      for (const pathname of paths) {
        let attrs;
        try { attrs = runPreRender(code, { stored, osDark, pathname }); } catch (e) {
          wrong.push(`stored=${show(stored)} osDark=${osDark} ${pathname}: the script threw ${e.message}`); continue;
        }
        const want = L.resolveAppearance(L.normalizeChoice(stored), osDark);
        if (attrs['data-appearance'] !== want) wrong.push(`stored=${show(stored)} osDark=${osDark} ${pathname}: data-appearance=${show(attrs['data-appearance'])}, the library says ${show(want)}`);
        const hint = attrs['data-preload-family'];
        const wantHint = L.isDesignShellPath(pathname) ? 'design' : undefined;
        if (hint !== wantHint) wrong.push(`stored=${show(stored)} osDark=${osDark} ${pathname}: data-preload-family=${show(hint)}, expected ${show(wantHint)}`);
      }
    }
  }
  assert(wrong.length === 0, `${wrong.length} combination(s) disagree:${NL}        ${wrong.slice(0, 12).join(`${NL}        `)}`);
});

test('P3 storage that throws: the script still sets data-appearance from the computer and never throws', () => {
  const code = preRenderScript();
  for (const osDark of [true, false]) {
    let attrs;
    try { attrs = runPreRender(code, { storageThrows: true, osDark, pathname: '/assistants' }); } catch (e) {
      throw new Error(`the pre-render script must not throw when storage is blocked: ${e.message}`);
    }
    const want = osDark ? 'dark' : 'light';
    assert(attrs['data-appearance'] === want, `with storage blocked and the computer ${want}, data-appearance should be ${show(want)}, got ${show(attrs['data-appearance'])}`);
    assert(attrs['data-preload-family'] === 'design', `the design-shell hint should still be set with storage blocked, got ${show(attrs['data-preload-family'])}`);
  }
});

test('P4 matchMedia that throws as well: the script falls back to light and never throws', () => {
  const code = preRenderScript();
  for (const stored of [undefined, 'system']) {
    let attrs;
    try { attrs = runPreRender(code, { stored, storageThrows: stored === undefined, matchMediaThrows: true, pathname: '/dictionary' }); } catch (e) {
      throw new Error(`the pre-render script must not throw when matchMedia throws: ${e.message}`);
    }
    assert(attrs['data-appearance'] === 'light', `with no usable matchMedia, data-appearance should fall back to "light", got ${show(attrs['data-appearance'])}`);
  }
  const attrs = runPreRender(code, { stored: 'dark', matchMediaThrows: true, pathname: '/dictionary' });
  assert(attrs['data-appearance'] === 'dark', `an explicit Dark needs no matchMedia; data-appearance should be "dark", got ${show(attrs['data-appearance'])}`);
});

// ── T: the stylesheet ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A small CSS reader: comments stripped; @media/@supports bodies read recursively with the prelude as context;
 * @font-face, @keyframes and other at-rules skipped. Returns [{ context, selector, decls: [[prop, value]] }], one
 * entry per selector of a selector list.
 */
function parseCss(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  function readBlock(start) { // src[start] === '{'; returns [body, indexAfterClose]
    let depth = 0, i = start, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return [src.slice(start + 1, i), i + 1]; }
    }
    return [src.slice(start + 1), src.length];
  }
  function walk(from, to, context) {
    let i = from;
    while (i < to) {
      const open = src.indexOf('{', i);
      if (open === -1 || open >= to) break;
      const prelude = src.slice(i, open).replace(/\s+/g, ' ').trim().replace(/^[;}\s]+/, '');
      const [body, after] = readBlock(open);
      if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
        walk(open + 1, after - 1, (context ? context + ' ' : '') + prelude);
      } else if (!prelude.startsWith('@')) {
        const decls = [];
        for (const part of body.split(/;(?![^(]*\))/)) {
          const k = part.indexOf(':');
          if (k === -1) continue;
          const prop = part.slice(0, k).trim();
          const value = part.slice(k + 1).replace(/\s+/g, ' ').trim();
          if (prop && value) decls.push([prop, value]);
        }
        for (const sel of splitSelectors(prelude)) rules.push({ context, selector: sel, decls });
      }
      i = after;
    }
  }
  walk(0, src.length, '');
  return rules;
}
function splitSelectors(prelude) {
  const out = []; let depth = 0, cur = '';
  for (const c of prelude) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\s+/g, ' ').replace(/'/g, '"').trim()).filter(Boolean);
}

const isDarkScoped = (sel) => /\[data-appearance=["']?dark["']?\]/.test(sel);
const isAppearanceScoped = (sel) => /\[data-appearance|\[data-preload-family/.test(sel);
const mentionsShell = (sel) => /\.bsd-|bsd-page/.test(sel);
const isCustom = (prop) => prop.startsWith('--');

// Last-wins declarations by context + selector + property.
function cascade(rules, keep = () => true) {
  const map = new Map();
  for (const r of rules) {
    if (!keep(r)) continue;
    for (const [prop, value] of r.decls) map.set(`${r.context}§${r.selector}§${prop}`, { rule: r, prop, value });
  }
  return map;
}

// Custom-property maps: ROOT (what reads outside the design shell) and SHELL (ROOT overlaid with the design shell's
// light tokens). Dark-scoped and other appearance-scoped rules never contribute.
function tokenMaps(rules) {
  const root = {}, shell = {};
  for (const r of rules) {
    if (r.context || isAppearanceScoped(r.selector)) continue;
    for (const [prop, value] of r.decls) {
      if (!isCustom(prop)) continue;
      if (mentionsShell(r.selector)) shell[prop] = value; else root[prop] = value;
    }
  }
  return { root, shell: { ...root, ...shell } };
}

function resolveVars(value, tokens, depth = 0) {
  if (depth > 12) return value;
  let out = '', i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at === -1) { out += value.slice(i); break; }
    out += value.slice(i, at);
    let d = 0, j = at + 3;
    for (; j < value.length; j++) { if (value[j] === '(') d++; else if (value[j] === ')') { d--; if (d === 0) break; } }
    const inner = value.slice(at + 4, j);
    const comma = inner.indexOf(',');
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();
    const sub = name in tokens ? tokens[name] : fallback;
    out += sub == null ? `var(${name})` : resolveVars(sub, tokens, depth + 1);
    i = j + 1;
  }
  return out;
}
const norm = (v) => v.toLowerCase().replace(/\s+/g, ' ').replace(/\s*([,()/])\s*/g, '$1').replace(/\s*!important/, ' !important').trim();

let baseCssCache = null;
function baseCss() {
  if (baseCssCache) return baseCssCache;
  try {
    baseCssCache = execFileSync('git', ['show', `${BASE}:ui/src/styles.css`], { cwd: REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`could not read ui/src/styles.css at ${BASE.slice(0, 9)} from git (a full history is needed — CI checks out with fetch-depth 0): ${e.message.split(NL)[0]}`);
  }
  return baseCssCache;
}

/**
 * Compare every non-appearance-scoped declaration at BASE with the same context + selector + property now, each
 * resolved against `which` (root or shell). `filter` picks the BASE rules to compare.
 */
function compareResolved(which, filter) {
  const before = parseCss(baseCss());
  const now = parseCss(fs.readFileSync(STYLES, 'utf8'));
  const tb = tokenMaps(before)[which];
  const tn = tokenMaps(now)[which];
  const cb = cascade(before, (r) => !isAppearanceScoped(r.selector) && filter(r));
  const cn = cascade(now, (r) => !isAppearanceScoped(r.selector));
  const diffs = [];
  for (const [key, b] of cb) {
    if (isCustom(b.prop)) continue; // tokens may move; what they paint is what's compared
    const n = cn.get(key);
    const ctx = b.rule.context ? `${b.rule.context} ` : '';
    if (!n) { diffs.push(`${ctx}${b.rule.selector} { ${b.prop} } is gone (was ${b.value})`); continue; }
    const vb = norm(resolveVars(b.value, tb));
    const vn = norm(resolveVars(n.value, tn));
    if (vb !== vn) diffs.push(`${ctx}${b.rule.selector} { ${b.prop}: ${vn} } — was ${vb}`);
  }
  return diffs;
}

test('T1 Light is unchanged inside the design shell: every declaration paints what it painted at BASE (regression)', () => {
  const diffs = compareResolved('shell', () => true);
  assert(diffs.length === 0, `${diffs.length} declaration(s) paint differently in Light inside the design shell:${NL}        ${diffs.slice(0, 12).join(`${NL}        `)}`);
});

// Colours allowed to stay literal in design-shell rules: each reads the same in both looks. Key: selector § property.
// Re-aimed after review 1 (Blocking 5, 6): T2 now covers the Dictionary's .dict- rules too, which render inside the
// shell, and every exception is named here with its reason.
const LITERAL_ALLOWLIST = new Map([
]);

const inShell = (sel) => mentionsShell(sel) || /\.dict-/.test(sel);

test('T2 the design-shell rules (.bsd- and the Dictionary\'s .dict- rules) hold no literal colours outside var() fallbacks and a named allowlist', () => {
  const now = parseCss(fs.readFileSync(STYLES, 'utf8'));
  const LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/i;
  const stripFallbacks = (v) => v.replace(/var\(\s*(--[\w-]+)\s*,[^()]*(\([^()]*\)[^()]*)*\)/g, 'var($1)');
  const found = [];
  for (const r of now) {
    if (!inShell(r.selector) || isAppearanceScoped(r.selector)) continue;
    // body and :root sit outside .bsd-page, so .bsd-page tokens can't reach them; they carry their own values.
    if (/^(body|html|:root)\b/.test(r.selector)) continue;
    for (const [prop, value] of r.decls) {
      if (isCustom(prop)) continue;
      if (LITERAL_ALLOWLIST.has(`${r.selector}§${prop}`)) continue;
      if (LITERAL.test(stripFallbacks(value))) found.push(`${r.context ? r.context + ' ' : ''}${r.selector} { ${prop}: ${value} }`);
    }
  }
  assert(found.length === 0, `${found.length} literal colour(s) left in design-shell rules (each should read a token with a light and a dark value):${NL}        ${found.slice(0, 15).join(`${NL}        `)}`);
});

function darkSet(rules) {
  const dark = {};
  let seen = false;
  for (const r of rules) {
    if (r.context) continue;
    const isBsd = /^(:root|html)\[data-appearance=["']?dark["']?\] \.bsd-page$/.test(r.selector);
    const isDict = /^(:root|html)\[data-appearance=["']?dark["']?\] .*\.dict-[\w-]+$/.test(r.selector);
    if (isBsd) seen = true;
    if (isBsd || isDict) for (const [prop, value] of r.decls) if (isBsd || isCustom(prop)) dark[prop] = value;
  }
  return { seen, dark };
}

// The tokens a design-shell element reads in Light: every custom property outside the design shell, overlaid with those
// declared in a design-shell rule (.bsd- or the Dictionary's skin, .dict-skin-light). Appearance-scoped rules never count.
function shellLightTokens(rules) {
  const base = {}, over = {};
  for (const r of rules) {
    if (r.context || isAppearanceScoped(r.selector)) continue;
    for (const [prop, value] of r.decls) {
      if (!isCustom(prop)) continue;
      if (mentionsShell(r.selector) || /dict-skin-light/.test(r.selector)) over[prop] = value; else base[prop] = value;
    }
  }
  return { ...base, ...over };
}

const COLOURISH = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|gradient\(|\b(white|black)\b/i;

test('T3 a dark token set exists: every colour token of the design shell has a dark value, with color-scheme dark', () => {
  const now = parseCss(fs.readFileSync(STYLES, 'utf8'));
  const { seen, dark } = darkSet(now);
  assert(seen, 'there should be a :root[data-appearance="dark"] .bsd-page rule carrying the dark token set (ADR 0001, Palette step 3)');
  const lightTokens = {};
  for (const r of now) {
    if (r.context || isAppearanceScoped(r.selector)) continue;
    if (!(r.selector === '.bsd-page' || /dict-skin-light/.test(r.selector))) continue;
    for (const [prop, value] of r.decls) if (isCustom(prop)) lightTokens[prop] = value;
  }
  const shell = shellLightTokens(now);
  const missing = Object.keys(lightTokens).filter((t) => COLOURISH.test(resolveVars(lightTokens[t], shell)) && !(t in dark));
  assert(missing.length === 0, `${missing.length} design-shell colour token(s) have no dark value: ${missing.join(', ')}`);
  assert(norm(dark['color-scheme'] || '') === 'dark', `the dark set should declare color-scheme: dark (got ${show(dark['color-scheme'])})`);
  const mustDiffer = ['--bg', '--bg-primary', '--bg-secondary', '--text', '--text-primary', '--text-muted', '--accent'];
  const same = mustDiffer.filter((t) => !(t in dark) || norm(resolveVars(dark[t], { ...shell, ...dark })) === norm(resolveVars(lightTokens[t] || '', shell)));
  assert(same.length === 0, `these tokens should take a different value in Dark: ${same.join(', ')}`);
});

test('T4 nothing outside the design shell changed: every rule that does not name .bsd- paints what it painted at BASE (regression)', () => {
  const diffs = compareResolved('root', (r) => !mentionsShell(r.selector));
  assert(diffs.length === 0, `${diffs.length} declaration(s) outside the design shell changed:${NL}        ${diffs.slice(0, 12).join(`${NL}        `)}`);
});

// ── K: contrast ────────────────────────────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
}
function luminance([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

test('K1 in Dark, body text, muted text, links and status colours reach 4.5:1 on every design-shell surface (WCAG AA)', () => {
  const now = parseCss(fs.readFileSync(STYLES, 'utf8'));
  const { seen, dark } = darkSet(now);
  assert(seen, 'there is no dark token set to measure (see T3)');
  const tokens = { ...shellLightTokens(now), ...dark };
  const solid = (t) => {
    const v = norm(resolveVars(tokens[t] || '', tokens));
    const rgb = /^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(v) ? hexToRgb(v) : null;
    if (!rgb) throw new Error(`${t} should be a solid hex colour in Dark to be measured, got ${show(tokens[t])}`);
    return rgb;
  };
  const inks = ['--text', '--text-primary', '--bsd-ink-2', '--text-muted', '--accent', '--accent-hover', '--red', '--green', '--orange'];
  const surfaces = ['--bg', '--bg-secondary', '--bg-tertiary', '--bg-primary'];
  const low = [];
  for (const ink of inks) for (const surface of surfaces) {
    const c = contrast(solid(ink), solid(surface));
    if (c < 4.5) low.push(`${ink} on ${surface}: ${c.toFixed(2)}:1`);
  }
  // Added after review 1 (Blocking 3, 4): text on the accent, and the Dictionary's cyan on the surfaces.
  for (const surface of ['--accent', '--accent-hover']) {
    const c = contrast(solid('--bsd-on-accent'), solid(surface));
    if (c < 4.5) low.push(`--bsd-on-accent on ${surface}: ${c.toFixed(2)}:1`);
  }
  if (!('--dict-cyan' in dark)) low.push('--dict-cyan has no dark value');
  else for (const surface of surfaces) {
    const c = contrast(solid('--dict-cyan'), solid(surface));
    if (c < 4.5) low.push(`--dict-cyan on ${surface}: ${c.toFixed(2)}:1`);
  }
  assert(low.length === 0, `${low.length} pair(s) below 4.5:1 in Dark:${NL}        ${low.join(`${NL}        `)}`);
});

// Pairs K2 may skip, each with its reason. Key: selector.
const PAIR_ALLOWLIST = new Map([
]);

function parseColour(value, under) {
  const v = norm(value);
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(v)) return { rgb: hexToRgb(v), a: 1 };
  if (v === 'white') return { rgb: [255, 255, 255], a: 1 };
  if (v === 'black') return { rgb: [0, 0, 0], a: 1 };
  const m = v.match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const rgb = [m[1], m[2], m[3]].map(Number);
  if (a >= 1 || !under) return { rgb, a };
  return { rgb: rgb.map((c, i) => Math.round(c * a + under[i] * (1 - a))), a: 1 };
}

/**
 * K2: every pair a design-shell rule paints, in Dark. A rule's text colour against its background; where a rule sets
 * only one, the other comes from the rule it refines, the longest selector that is a prefix of its own or of its last
 * compound (`.x.is-local` takes its colour from `.x`; `.row.is-local .avatar` from `.avatar`). A translucent
 * background is laid over the dark surface (--bg). Added after review 1 (Blocking 3, 6): K1 checks tokens; this checks
 * the pairs the rules actually paint.
 */
test('K2 in Dark, every text-on-background pair a design-shell rule paints reaches 4.5:1 (WCAG AA)', () => {
  const now = parseCss(fs.readFileSync(STYLES, 'utf8'));
  const { seen, dark } = darkSet(now);
  assert(seen, 'there is no dark token set to measure (see T3)');
  const tokens = { ...shellLightTokens(now), ...dark };
  const surface = parseColour(resolveVars(tokens['--bg'] || '#000000', tokens)).rgb;
  const plain = now.filter((r) => !r.context && !isAppearanceScoped(r.selector));
  const last = (r, props) => { let v = null; for (const [pr, val] of r.decls) if (props.includes(pr)) v = val; return v; };
  const BG = ['background', 'background-color'];
  const lastCompound = (sel) => sel.split(/\s*[\s>+~]\s*/).pop();
  const refines = (sel, base) => sel === base || (sel.startsWith(base) && /^[.:[]/.test(sel.slice(base.length)));
  function inherited(r, props) {
    const lc = lastCompound(r.selector);
    let best = null;
    for (const c of plain) {
      if (c === r || !last(c, props)) continue;
      if (!(refines(r.selector, c.selector) || refines(lc, c.selector))) continue;
      if (!best || c.selector.length > best.selector.length) best = c;
    }
    return best ? last(best, props) : null;
  }
  const low = [];
  for (const r of plain) {
    if (!inShell(r.selector) || /^(body|html|:root)\b/.test(r.selector)) continue;
    if (PAIR_ALLOWLIST.has(r.selector)) continue;
    const ownInk = last(r, ['color']);
    const ownBg = last(r, BG);
    if (!ownInk && !ownBg) continue;
    const ink = ownInk || inherited(r, ['color']);
    const bg = ownBg || inherited(r, BG);
    if (!ink || !bg) continue;
    const bgV = resolveVars(bg, tokens);
    if (/gradient\(|url\(/.test(bgV) || /^(none|transparent|inherit)$/.test(norm(bgV))) continue;
    const b = parseColour(bgV, surface);
    const t = b && parseColour(resolveVars(ink, tokens), b.rgb);
    if (!b || !t) continue;
    const c = contrast(t.rgb, b.rgb);
    if (c < 4.5) low.push(`${r.selector}: ${norm(resolveVars(ink, tokens))} on ${norm(bgV)}, ${c.toFixed(2)}:1`);
  }
  assert(low.length === 0, `${low.length} pair(s) below 4.5:1 in Dark:${NL}        ${low.slice(0, 25).join(`${NL}        `)}`);
});

async function run() {
  console.log(`${NL}=== appearance-setting (appearance-setting #1) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}appearance-setting: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}

module.exports = { run };
