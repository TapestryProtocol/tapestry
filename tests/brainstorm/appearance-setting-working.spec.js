const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

/**
 * appearance-setting #3 — a light look for the working pages and the working pieces: what a visitor SEES.
 *
 * Story: engineering-team/stories/appearance-setting/3-light-look-working-pages.md
 * ADR:   engineering-team/decisions/appearance-setting/0003-working-pages-join-the-light-token-layer.md
 * Plan:  engineering-team/stories/appearance-setting/3-light-look-working-pages.test-plan.md
 * Node half: test/appearance-setting-working.test.js.
 *
 * Network-mocked like appearance-setting-light.spec.js. Run it against a BUILD. The Dark oracle (W3) is
 * fixtures/appearance-setting-3-baseline.json, written with APPEARANCE_BASELINE=write from a build of this story's base
 * (34bd3957b's UI). Rewrite it only from a build of the base.
 *
 * The sweep here is stricter than story 2's L1 (review 2-R2-1): every background, translucent ones included, is laid
 * over what's beneath it, and each group's opacity fades its backgrounds as well as its text.
 *
 *   W1 — in Light, every working page is light and readable: signed out, as a customer, and as an owner where a page
 *        has owner-only parts.                                                                              [AC-1]
 *   W2 — in Light, the working pieces on a reading page are light too: a profile with the Manage Tags dialog open.
 *                                                                                                            [AC-2]
 *   W3 — Dark is unchanged: every element on every working page paints today's colours (snapshot).          [AC-4]
 *   W4 — no flash on a working page.                                                                         [AC-5]
 *   W5 — at 375 and 414 px in Light, no working page scrolls sideways.                                       [AC-6]
 *   W6 — the /about Admins count reads at 3:1 or better in Light as rendered, and is today's accent in Dark.  [AC-7]
 *   W7 — one light look: a working page's background and links are the rest of the light site's.            [AC-3]
 */

const VIEWER = 'a1'.repeat(32);
const PK = 'b2'.repeat(32);
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: null, classification: 'customer' };
const OWNER_SESSION = { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' };
const KEY = 'tapestry_appearance';
const LIGHT_CANVAS = 'rgb(242, 243, 240)';
const ACCENT = 'rgb(114, 55, 255)';

const WORKING = ['/tags', '/tag/abc', '/pins', '/pin/abc', '/assistant', '/assistant/profile', '/assistant/profile/edit',
  '/assistant/identification-tags', '/assistant/outbox-relays', '/assistant/duty-menu', '/assistant/treasure-map',
  '/assistant/trusted-assertions', '/assistant/trusted-lists', '/setup', '/setup/create-account', '/setup/follow',
  '/setup/activate', '/developers', '/developers/nip-50', '/developers/open-ranking', '/developers/trusted-assertions',
  '/developers/relay-tools'];
const OWNER_PARTS = (url) => url.startsWith('/assistant') || url.startsWith('/setup');
const BASELINE_FILE = path.join(__dirname, 'fixtures', 'appearance-setting-3-baseline.json');
const WRITING = process.env.APPEARANCE_BASELINE === 'write';

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const EMPTY = { success: true, events: [], profiles: {}, data: [], rows: [], entries: [], relays: [], assistants: [], preferences: {}, items: [], count: 0 };

async function mockStack(page, { session = null } = {}) {
  await page.route('**/api/**', (r) => json(r, EMPTY));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: false }, activate: { done: false } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session
    ? { success: true, signedIn: true, hasAssistant: !!session.assistantPubkey, actions: {} } : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', (r) => json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true, classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null, assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: { [PK]: { name: 'Pat Example', about: 'A profile used by the tests.' } } }));
  await page.routeWebSocket(/.*/, (ws) => ws.close());
}
const attr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-appearance'));
async function settle(page) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(700); }
async function storeChoiceEveryLoad(context, value) {
  await context.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } }, [KEY, value]);
}
const pageBox = (page) => page.locator('.bsp-page, .bss-page').first();

/**
 * Text and surfaces as rendered in Light. Backgrounds are laid over the body from the top down, each faded by the
 * opacity of its own element and its ancestors; text is faded the same way over that result.
 */
async function lightSweep(page, root = 'body') {
  return page.evaluate((rootSel) => {
    const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const L = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const over = (top, a, under) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });
    const chain = (el) => { const out = []; for (let e = el; e && e !== document.body; e = e.parentElement) out.unshift(e); return out; };
    const backdrop = (el) => {
      let c = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      let o = 1;
      for (const e of chain(el)) {
        o *= parseFloat(getComputedStyle(e).opacity);
        const bg = parse(getComputedStyle(e).backgroundColor);
        if (bg && bg.a > 0) c = over(bg, bg.a * o, c);
      }
      return { c, o };
    };
    const describe = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
    const text = []; const surface = []; let checked = 0;
    const scope = document.querySelector(rootSel) || document.body;
    for (const el of scope.querySelectorAll('*')) {
      if (el.closest('svg')) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      // An inactive control and its own label are exempt (WCAG 1.4.3): e.g. a parked Identification Tags row, whose
      // name labels a disabled checkbox (re-aimed in Implementation; it reads under 3:1 in Dark today as well).
      const label = el.closest('label');
      const inactive = el.closest(':disabled, [aria-disabled="true"], [aria-hidden="true"]') || (label && label.querySelector('input:disabled, select:disabled, textarea:disabled'));
      if (own && !inactive) {
        checked++;
        const { c: bg, o } = backdrop(el);
        const fg = parse(s.color);
        const shown = over(fg, (fg.a == null ? 1 : fg.a) * o, bg);
        const c = ratio(shown, bg); const need = el.closest('a, p') ? 4.5 : 3;
        if (c < need) text.push(`${describe(el)}: ${c.toFixed(2)}:1 (needs ${need}), ${s.color} at opacity ${o.toFixed(2)}`);
      }
      const bg = parse(s.backgroundColor);
      if (bg && bg.a >= 0.5 && r.width >= 40 && r.height >= 20 && L(bg) < 0.15 && !['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)) {
        surface.push(`${describe(el)}: a dark surface ${s.backgroundColor}`);
      }
    }
    return { text, surface, checked };
  }, root);
}

async function colourSnapshot(page, skip = '') {
  return page.evaluate((skipSel) => {
    const out = {};
    const keyOf = (el) => { const parts = []; for (let e = el; e && e !== document.body; e = e.parentElement) { let i = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) i++; parts.unshift(`${e.tagName.toLowerCase()}:${i}`); } return parts.join('>'); };
    out.body = [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color].join(' | ');
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg, script, style, noscript')) continue;
      if (skipSel && el.closest(skipSel)) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.display === 'none' || s.visibility === 'hidden') continue;
      const bt = parseFloat(s.borderTopWidth) ? s.borderTopColor : '-';
      const bb = parseFloat(s.borderBottomWidth) ? s.borderBottomColor : '-';
      out[keyOf(el)] = [s.color, s.backgroundColor, bt, bb, s.backgroundImage === 'none' ? '-' : s.backgroundImage, s.opacity].join(' | ');
    }
    return out;
  }, skip);
}
function readBaseline() { try { return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch { return {}; } }
const bucket = {};
test.afterAll(() => {
  if (!WRITING || !Object.keys(bucket).length) return;
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify({ ...readBaseline(), ...bucket }, null, 1)}\n`);
});

async function sampleBeforeBundle(page, url) {
  let release; const gate = new Promise((r) => { release = r; });
  await page.route(/\/assets\/[^?]*\.js(\?.*)?$/, async (route) => { await gate; await route.continue(); });
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => { const l = document.querySelector('link[rel="stylesheet"]'); try { return !!(document.body && l && l.sheet && l.sheet.cssRules.length); } catch { return false; } });
  const samples = [];
  for (let i = 0; i < 5; i++) {
    samples.push(await page.evaluate(() => ({ appearance: document.documentElement.getAttribute('data-appearance'), body: getComputedStyle(document.body).backgroundColor, rendered: !!document.querySelector('#root > *') })));
    await page.waitForTimeout(100);
  }
  release();
  return samples;
}

// ── W1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('W1 in Light, every working page is light and readable', () => {
  for (const url of WORKING) {
    test(`${url}`, async ({ browser }) => {
      test.skip(WRITING, 'baseline run');
      const sessions = OWNER_PARTS(url) ? [null, CUSTOMER, OWNER_SESSION] : [null, CUSTOMER];
      for (const session of sessions) {
        const context = await browser.newContext({ colorScheme: 'light' });
        const page = await context.newPage();
        await mockStack(page, { session });
        await page.goto(url);
        await expect.poll(() => attr(page)).toBe('light');
        await settle(page);
        const who = session ? session.classification : 'signed out';
        await expect.poll(() => pageBox(page).evaluate((e) => getComputedStyle(e).backgroundColor), { message: `${url} (${who}): the page background` }).toBe(LIGHT_CANVAS);
        const { text, surface, checked } = await lightSweep(page);
        expect(checked, `${url} (${who}): the sweep read the page's text`).toBeGreaterThan(3);
        expect(surface, `${url} (${who}): no dark surface in Light`).toEqual([]);
        expect(text, `${url} (${who}): all text readable in Light, as rendered`).toEqual([]);
        await context.close();
      }
    });
  }
});

// ── W2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('W2 in Light, a profile\'s working pieces are light too: the Manage Tags dialog opened, and the whole page swept', async ({ browser }) => {
  test.skip(WRITING, 'baseline run');
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await mockStack(page, { session: CUSTOMER });
  await page.goto(`/user/${PK}`);
  await settle(page);
  const manage = page.getByRole('button', { name: 'Manage' }).first();
  await expect(manage, 'the profile\'s tags section offers Manage when signed in').toBeVisible();
  await manage.click();
  await expect(page.locator('.ptd').first(), 'the Manage Tags dialog opens').toBeVisible();
  const box = await page.locator('.ptd').first().evaluate((e) => getComputedStyle(e).backgroundColor);
  const { text, surface } = await lightSweep(page);
  expect(surface, 'no dark surface on the profile or in its dialog').toEqual([]);
  expect(text, `all text readable on the profile and in its dialog (dialog box ${box})`).toEqual([]);
  await context.close();
});

// ── W3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('W3 Dark is unchanged: every element on every working page paints today\'s colours', () => {
  for (const url of WORKING) {
    test(`${url}`, async ({ browser }) => {
      const runs = [{ label: 'dark-chosen', scheme: 'light', stored: 'dark', session: null }, { label: 'system-dark', scheme: 'dark', stored: null, session: null }];
      if (OWNER_PARTS(url)) runs.push({ label: 'dark-owner', scheme: 'light', stored: 'dark', session: OWNER_SESSION });
      for (const run of runs) {
        const context = await browser.newContext({ colorScheme: run.scheme });
        if (run.stored) await storeChoiceEveryLoad(context, run.stored);
        const page = await context.newPage();
        await mockStack(page, { session: run.session });
        await page.goto(url);
        await settle(page);
        const now = await colourSnapshot(page, '.bs-appearance, .bs-appearance-compact-wrap');
        const name = `dark|${run.label}|${url}`;
        if (WRITING) { bucket[name] = now; } else {
          const base = readBaseline()[name];
          expect(base, `no baseline "${name}"`).toBeTruthy();
          const diffs = [];
          for (const [k, v] of Object.entries(base)) { if (!(k in now)) diffs.push(`${k}: gone (was ${v})`); else if (now[k] !== v) diffs.push(`${k}: ${now[k]} (was ${v})`); }
          for (const k of Object.keys(now)) if (!(k in base)) diffs.push(`${k}: new (${now[k]})`);
          expect(diffs, `${name}: every element paints its baseline colours and opacity`).toEqual([]);
        }
        await context.close();
      }
    });
  }
});

// ── W4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('W4 no flash on a working page', () => {
  for (const url of ['/tags', '/assistant', '/developers']) {
    test(`${url}: Light on a dark computer shows only the light canvas, before and after render`, async ({ page, context }) => {
      test.skip(WRITING, 'baseline run');
      await page.emulateMedia({ colorScheme: 'dark' });
      await storeChoiceEveryLoad(context, 'light');
      await mockStack(page);
      const samples = await sampleBeforeBundle(page, url);
      expect(samples.every((s) => !s.rendered), 'the bundle was held').toBe(true);
      for (const s of samples) expect(s.body, 'the light canvas before render').toBe(LIGHT_CANVAS);
      await expect.poll(() => pageBox(page).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(LIGHT_CANVAS);
    });
  }
});

// ── W5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('W5 at phone widths in Light, the working pages fit', () => {
  for (const width of [375, 414]) {
    test(`${width} px`, async ({ browser }) => {
      test.skip(WRITING, 'baseline run');
      const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: 'light' });
      const page = await context.newPage();
      await mockStack(page);
      const wrong = [];
      for (const url of WORKING) {
        await page.goto(url);
        await settle(page);
        const m = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, view: document.scrollingElement.clientWidth }));
        if (m.scroll > m.view) wrong.push(`${url}: ${m.scroll}px wide in ${m.view}px`);
      }
      await context.close();
      expect(wrong).toEqual([]);
    });
  }
});

// ── W6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('W6 the /about Admins count reads at 3:1 or better in Light as rendered, and is today\'s accent in Dark', async ({ browser }) => {
  test.skip(WRITING, 'baseline run');
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await mockStack(page);
    await page.goto('/about');
    await settle(page);
    const label = page.getByText(/^Admins$/i).first();
    await expect(label, 'the Admins label renders').toBeVisible();
    const chip = label.locator('xpath=..').locator('span').last();
    if (scheme === 'dark') {
      expect(await chip.evaluate((e) => getComputedStyle(e).color), 'Dark keeps today\'s accent').toBe('rgb(165, 180, 252)');
    } else {
      const { text } = await lightSweep(page, '#this-instance');
      expect(text, 'the instance section, its count chips included, reads in Light as rendered').toEqual([]);
    }
    await context.close();
  }
});

// ── W7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('W7 one light look: /developers shares the light site\'s canvas, and a body link is the accent', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/developers');
  await settle(page);
  const got = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.bsp-page a')].find((x) => x.textContent.trim() && !x.closest('.bsp-top-bar'));
    return { page: getComputedStyle(document.querySelector('.bsp-page')).backgroundColor, link: a ? getComputedStyle(a).color : null };
  });
  expect(got.page).toBe(LIGHT_CANVAS);
  expect(got.link, 'a body link is the light site\'s accent').toBe(ACCENT);
});

// ── W8 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * W8 — the class probe (review 1, Blocking 1). The other sweeps only see what empty mocks render, so pieces that
 * show only with data (tag chips, scored rows, results, stale markers, typed text) were never measured. For every
 * profile-family rule (the reading and working pages' classes, as the Node suites find them), build the elements its
 * selector describes inside the light page, put text in the innermost one, and measure it as rendered. Disabled and
 * inactive states, pseudo-classes and pseudo-elements are left out (WCAG exempts the first; the others can't be built).
 */
const AP = require('../../test/appearance-setting.test.js').helpers;
const AP2 = require('../../test/appearance-setting-light.test.js').helpers;
const AP3 = require('../../test/appearance-setting-working.test.js');
// Pieces the probe can't judge fairly, each with its reason. Key: selector.
const PROBE_ALLOWLIST = new Map([
  // SearchInput is shared; its landing variant only renders on the search home, which is story 4.
  ['.bs-search-box-landing', 'the search home\'s box (story 4)'],
  ['.bs-search-input-landing', 'the search home\'s input (story 4)'],
]);
function probeSelectors() {
  const classes = AP2.classesFrom([...AP2.READING_FILES, ...AP3.WORKING_FILES]);
  const rules = AP.parseCss(fs.readFileSync(path.join(__dirname, '../../ui/src/styles.css'), 'utf8'));
  const out = new Set();
  for (const r of rules) {
    const sel = r.selector;
    if (r.context || AP2.scoped(sel) || /\.bsd-|bsd-page|\.dict-|\[|:|\*|svg|img|path|^(html|body)\b/.test(sel)) continue;
    if (/disabled|\.saved\b|is-parked|is-hidden|hidden/.test(sel)) continue;
    const names = [...sel.matchAll(/\.([a-z][\w-]+)/g)].map((m) => m[1]);
    if (!names.some((c) => classes.has(c))) continue;
    if (!r.decls.some(([p]) => /^(color|background|background-color|opacity)$/.test(p))) continue;
    if (PROBE_ALLOWLIST.has(sel)) continue;
    out.add(sel);
  }
  return [...out];
}

test('W8 in Light, every profile-family rule\'s piece reads as rendered, data or no data (class probe)', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  test.setTimeout(120000);
  const selectors = probeSelectors();
  expect(selectors.length, 'the probe found the family\'s rules').toBeGreaterThan(100);
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/tags');
  await settle(page);
  const result = await page.evaluate((sels) => {
    const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const L = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const over = (top, a, under) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });
    const host = document.querySelector('.bsp-page');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;padding:8px';
    host.appendChild(wrap);
    const build = (sel) => {
      const compounds = sel.split(/\s*>\s*|\s+/).filter(Boolean);
      let parent = wrap; let el = null;
      for (const c of compounds) {
        const tag = (c.match(/^[a-z][a-z0-9]*/) || ['div'])[0];
        el = document.createElement(tag === 'input' || tag === 'textarea' || tag === 'select' ? 'span' : tag);
        el.className = [...c.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).join(' ');
        parent.appendChild(el); parent = el;
      }
      el.textContent = 'Sample text 123';
      return el;
    };
    const backdrop = (el) => {
      let c = parse(getComputedStyle(document.body).backgroundColor); let o = 1;
      const chain = []; for (let e = el; e && e !== document.body; e = e.parentElement) chain.unshift(e);
      for (const e of chain) { o *= parseFloat(getComputedStyle(e).opacity); const bg = parse(getComputedStyle(e).backgroundColor); if (bg && bg.a > 0) c = over(bg, bg.a * o, c); }
      return { c, o };
    };
    const low = []; let measured = 0;
    for (const sel of sels) {
      let el;
      try { el = build(sel); } catch { continue; }
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) { el.remove(); continue; }
      const { c: bg, o } = backdrop(el);
      const fg = parse(s.color);
      if (!fg) continue;
      const shown = over(fg, (fg.a == null ? 1 : fg.a) * o, bg);
      const need = /^(a|p)$/i.test(el.tagName) || el.closest('a, p') ? 4.5 : 3;
      const c = ratio(shown, bg);
      measured++;
      if (c < need) low.push(`${sel}: ${c.toFixed(2)}:1 (needs ${need}), ${s.color} at opacity ${o.toFixed(2)}`);
      const own = parse(s.backgroundColor);
      // A dark grey or slate surface is the Dark look left behind; a solid hue (the accent button, the done marker) is
      // the light look's own.
      const chroma = own ? (Math.max(own.r, own.g, own.b) - Math.min(own.r, own.g, own.b)) / 255 : 0;
      if (own && own.a >= 0.5 && L(own) < 0.15 && chroma < 0.2) low.push(`${sel}: a dark surface ${s.backgroundColor}`);
    }
    wrap.remove();
    return { low, measured };
  }, selectors);
  expect(result.measured, 'the probe measured the family\'s pieces').toBeGreaterThan(100);
  expect(result.low, 'every piece reads in Light as rendered').toEqual([]);
});
