const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

/**
 * appearance-setting #2 — a light look for the frame and the reading pages: what a visitor SEES.
 *
 * Story: engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.md
 * ADR:   engineering-team/decisions/appearance-setting/0002-light-only-token-layer-for-the-profile-family.md
 * Plan:  engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.test-plan.md
 * Node half: test/appearance-setting-light.test.js (the paths, the pre-render script, the stylesheet, contrast).
 *
 * Network-mocked like appearance-setting.spec.js. Run it against a BUILD (L4 holds the bundle under /assets/).
 *
 * The snapshot oracle (L3, L7): fixtures/appearance-setting-2-baseline.json holds the computed colours of every element
 * on each page, taken from a build of the story's base (56d76a2b4's UI) with APPEARANCE_BASELINE=write. Dark, and the
 * pages that must not change in Light, must match it exactly. Regenerate only from a build of the base, never of the
 * change.
 *
 *   L1 — in Light, every reading page is light: a light page, no dark surface, readable text; signed out and signed in
 *        with the menu open. Story 3's pieces are allowed to stay dark.                                     [AC-1]
 *   L2 — one light look: the reading pages' page background and link colour are the design shell's.         [AC-2]
 *   L3 — Dark is unchanged: every element on every reading page paints today's colours (snapshot).            [AC-3]
 *   L4 — no flash: before the bundle runs a reading page already shows the chosen look's background.           [AC-5]
 *   L5 — switching is instant, and System follows the computer live, on a reading page.                         [AC-4]
 *   L6 — at 375 and 414 px in Light, no reading page scrolls sideways and Sign in stays on one line.           [AC-6]
 *   L7 — in Light, the search home, /tapestry/, the design shell, and a story-3 page's content are unchanged.   [AC-7]
 */

const VIEWER = 'a1'.repeat(32);
const PK = 'b2'.repeat(32);
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: null, classification: 'customer' };
const OWNER_SESSION = { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' };
const KEY = 'tapestry_appearance';

const READING = ['/about', '/about-brainstorm-search', '/how-search-works', '/brainstorm-skill', '/personalization', '/settings',
  `/user/${PK}`, `/user/${PK}/follows`, `/user/${PK}/followers`, `/user/${PK}/reporters`, `/user/${PK}/muters`,
  `/user/${PK}/follows-hops`, `/user/${PK}/notes`, '/feed', '/event'];
// Story 3 owns these families; on a reading page they may stay dark in Light (story 2, AC-1; ADR 0002 sub-decision 7).
// Re-aimed after review 1: the bare .ptc, .ptd and .pcd (the Manage Tags dialog's box) are story 3's too.
const STORY3 = '.ptc, .ptd, .pcd, [class*="bs-tag"], [class*="bs-pin"], [class*="bs-tl"], [class*="ptc-"], [class*="ptd-"], [class*="pcd-"], '
  + '[class*="bs-assistant"], [class*="bs-idtags"], [class*="bs-outbox"], [class*="bs-setup-step"]';
const FRAME = '.bsp-top-bar, .bss-top-bar, .bs-usermenu, .bs-usermenu-dropdown, .bs-signin-group, .bs-setup-alert, .bs-topbar-pill';
const LIGHT_CANVAS = 'rgb(242, 243, 240)';
const ACCENT = 'rgb(114, 55, 255)';
const BASELINE_FILE = path.join(__dirname, 'fixtures', 'appearance-setting-2-baseline.json');
const WRITING = process.env.APPEARANCE_BASELINE === 'write';

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const EMPTY = { success: true, events: [], profiles: {}, data: [], rows: [], entries: [], relays: [], assistants: [], preferences: {}, items: [], count: 0 };

async function mockStack(page, { session = null } = {}) {
  await page.route('**/api/**', (r) => json(r, EMPTY));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} } : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', (r) => json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true, classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null, assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: { [PK]: { name: 'Pat Example', about: 'A profile used by the tests.' } } }));
  // Relay sockets aren't part of the look; keep them out so every load renders the same.
  await page.routeWebSocket(/.*/, (ws) => ws.close());
}

const attr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-appearance'));
function lum(s) {
  const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return NaN;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
}
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(700);
}
async function storeChoiceEveryLoad(context, value) {
  await context.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } }, [KEY, value]);
}
const pageBox = (page) => page.locator('.bsp-page, .bss-page').first();
const radio = (scope, name) => scope.getByRole('radiogroup', { name: 'Appearance' }).first().getByRole('radio', { name, exact: true });

/** Computed colours of every visible element under body, keyed by its tag path; `skip` subtrees are left out. */
async function colourSnapshot(page, skip = '') {
  return page.evaluate((skipSel) => {
    const out = {};
    const keyOf = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        let i = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) i++;
        parts.unshift(`${e.tagName.toLowerCase()}:${i}`);
      }
      return parts.join('>');
    };
    out.body = [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color].join(' | ');
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg, script, style, noscript')) continue;
      if (skipSel && el.closest(skipSel)) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.display === 'none' || s.visibility === 'hidden') continue;
      const bt = parseFloat(s.borderTopWidth) ? s.borderTopColor : '-';
      const bb = parseFloat(s.borderBottomWidth) ? s.borderBottomColor : '-';
      out[keyOf(el)] = [s.color, s.backgroundColor, bt, bb, s.backgroundImage === 'none' ? '-' : s.backgroundImage].join(' | ');
    }
    return out;
  }, skip);
}
function readBaseline() { try { return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch { return {}; } }
function compareSnapshot(name, now) {
  const base = readBaseline()[name];
  if (!base) throw new Error(`no baseline "${name}" in ${path.relative(process.cwd(), BASELINE_FILE)} (write it from a build of the base)`);
  const diffs = [];
  for (const [k, v] of Object.entries(base)) {
    if (!(k in now)) diffs.push(`${k}: gone (was ${v})`);
    else if (now[k] !== v) diffs.push(`${k}: ${now[k]} (was ${v})`);
  }
  for (const k of Object.keys(now)) if (!(k in base)) diffs.push(`${k}: new element (${now[k]})`);
  return diffs;
}
const baselineBucket = {};
test.afterAll(() => {
  if (!WRITING || !Object.keys(baselineBucket).length) return;
  const all = { ...readBaseline(), ...baselineBucket };
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(all, null, 1)}\n`);
});
async function snapshotCheck(name, page, skip) {
  const now = await colourSnapshot(page, skip);
  if (WRITING) { baselineBucket[name] = now; return; }
  const diffs = compareSnapshot(name, now);
  expect(diffs, `${name}: every element should paint its baseline colours`).toEqual([]);
}

/** Dark surfaces and unreadable text on the page, story 3's pieces left out. */
async function lightSweep(page) {
  return page.evaluate((story3) => {
    const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const L = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a >= 0.5) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
    // The text as rendered: its own alpha and every ancestor's opacity laid over the background (review 1, Blocking 2:
    // links in an opacity 0.85 container read 4.05:1 though their colour alone passes).
    const opacityOf = (el) => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
    const rendered = (fg, bg, o) => { const a = (fg.a == null ? 1 : fg.a) * o; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }; };
    const describe = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
    const text = []; const surface = []; let checked = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg') || el.closest(story3)) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && !el.closest(':disabled, [aria-disabled="true"]')) {
        checked++;
        const bg = bgOf(el); const o = opacityOf(el);
        const c = ratio(rendered(parse(s.color), bg, o), bg); const need = el.closest('a, p') ? 4.5 : 3;
        if (c < need) text.push(`${describe(el)}: ${c.toFixed(2)}:1 (needs ${need}), ${s.color} at opacity ${o.toFixed(2)} on ${JSON.stringify(bg)}`);
      }
      const bg = parse(s.backgroundColor);
      if (bg && bg.a >= 0.5 && r.width >= 40 && r.height >= 20 && L(bg) < 0.15 && !['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)) {
        surface.push(`${describe(el)}: a dark surface ${s.backgroundColor}`);
      }
    }
    return { text, surface, checked };
  }, STORY3);
}

/** Hold the bundle, sample the pre-render page, release, and return the samples. */
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

// ── L1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('L1 in Light, every reading page is light and readable', () => {
  for (const url of READING) {
    test(`${url}`, async ({ browser }) => {
      test.skip(WRITING, 'baseline run');
      // An owner on /settings too: its dashboard link shows only to owners and admins (review 1, Blocking 2).
      for (const session of url === '/settings' ? [null, CUSTOMER, OWNER_SESSION] : [null, CUSTOMER]) {
        const context = await browser.newContext({ colorScheme: 'light' });
        const page = await context.newPage();
        await mockStack(page, { session });
        await page.goto(url);
        await expect.poll(() => attr(page)).toBe('light');
        await settle(page);
        if (session) await page.locator('.bs-usermenu-avatar-btn').first().click();
        const who = session ? `signed in (${session.classification}), menu open` : 'signed out';
        await expect.poll(() => pageBox(page).evaluate((e) => getComputedStyle(e).backgroundColor), { message: `${url} (${who}): the page background` }).toBe(LIGHT_CANVAS);
        const { text, surface, checked } = await lightSweep(page);
        expect(checked, `${url} (${who}): the sweep read the page's text`).toBeGreaterThan(5);
        expect(surface, `${url} (${who}): no dark surface in Light`).toEqual([]);
        expect(text, `${url} (${who}): all text readable in Light`).toEqual([]);
        await context.close();
      }
    });
  }
});

// ── L2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('L2 one light look: a reading page\'s background and link colour are the design shell\'s', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/dictionary');
  await settle(page);
  const shell = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, accent: getComputedStyle(document.querySelector('.bsd-page')).getPropertyValue('--accent').trim() }));
  await page.goto('/about');
  await settle(page);
  const reading = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.bsp-page a')].find((x) => x.textContent.trim() && !x.closest('.bsp-top-bar'));
    return { page: getComputedStyle(document.querySelector('.bsp-page')).backgroundColor, body: getComputedStyle(document.body).backgroundColor, link: a ? getComputedStyle(a).color : null };
  });
  expect(reading.page, 'the reading page background equals the design shell\'s page background').toBe(shell.body);
  expect(reading.body, 'the body behind it too').toBe(shell.body);
  expect(shell.accent.toLowerCase()).toBe('#7237ff');
  expect(reading.link, 'a link in the page body is the design shell\'s accent').toBe(ACCENT);
});

// ── L3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('L3 Dark is unchanged: every element on every reading page paints today\'s colours', () => {
  for (const url of READING) {
    test(`${url}`, async ({ browser }) => {
      const runs = [
        { label: 'dark-chosen', scheme: 'light', stored: 'dark', session: null },
        { label: 'system-dark', scheme: 'dark', stored: null, session: null },
      ];
      if (url === '/about' || url === `/user/${PK}`) runs.push({ label: 'dark-signed-in-menu', scheme: 'light', stored: 'dark', session: CUSTOMER });
      for (const run of runs) {
        const context = await browser.newContext({ colorScheme: run.scheme });
        if (run.stored) await storeChoiceEveryLoad(context, run.stored);
        const page = await context.newPage();
        await mockStack(page, { session: run.session });
        await page.goto(url);
        await settle(page);
        if (run.session) await page.locator('.bs-usermenu-avatar-btn').first().click();
        await page.waitForTimeout(200);
        // The Appearance control marks the checked choice; Dark-chosen and System differ there only, by design.
        await snapshotCheck(`dark|${run.label}|${url}`, page, '.bs-appearance, .bs-appearance-compact-wrap');
        await context.close();
      }
    });
  }
});

// ── L4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('L4 no flash on a reading page', () => {
  for (const { url, stored, os, look } of [
    { url: '/about', stored: 'light', os: 'dark', look: 'light' },
    { url: `/user/${PK}`, stored: 'system', os: 'light', look: 'light' },
    { url: '/settings', stored: 'dark', os: 'light', look: 'dark' },
  ]) {
    test(`${url}: choice ${stored} on a ${os} computer shows only the ${look} look`, async ({ page, context }) => {
      test.skip(WRITING, 'baseline run');
      await page.emulateMedia({ colorScheme: os });
      await storeChoiceEveryLoad(context, stored);
      await mockStack(page);
      const samples = await sampleBeforeBundle(page, url);
      expect(samples.every((s) => !s.rendered), 'the bundle was held').toBe(true);
      for (const s of samples) expect(s.appearance).toBe(look);
      for (const s of samples) expect(s.body, 'steady while the bundle loads').toBe(samples[0].body);
      if (look === 'light') {
        expect(samples[0].body, 'the light canvas before render').toBe(LIGHT_CANVAS);
        await expect.poll(() => pageBox(page).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(LIGHT_CANVAS);
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'no change once rendered').toBe(samples[0].body);
      } else {
        expect(samples[0].body, 'Dark keeps today\'s pre-render background').toBe('rgb(13, 17, 23)');
      }
    });
  }
});

// ── L5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('L5 on a reading page, a choice applies at once and System follows the computer live', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockStack(page);
  await page.goto('/about');
  await settle(page);
  await page.evaluate(() => { window.__marker = 1; });
  const bg = () => pageBox(page).evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(lum(await bg())).toBeLessThan(0.05);
  await radio(page, 'Light').click();
  await expect.poll(bg).toBe(LIGHT_CANVAS);
  await radio(page, 'System').click();
  await expect.poll(async () => lum(await bg())).toBeLessThan(0.05);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(bg).toBe(LIGHT_CANVAS);
  expect(await page.evaluate(() => window.__marker), 'no reload').toBe(1);
});

// ── L6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('L6 at phone widths in Light, the reading pages fit', () => {
  for (const width of [375, 414]) {
    test(`${width} px`, async ({ browser }) => {
      test.skip(WRITING, 'baseline run');
      const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: 'light' });
      const page = await context.newPage();
      await mockStack(page);
      const wrong = [];
      for (const url of READING) {
        await page.goto(url);
        await settle(page);
        const m = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sign in with nostr');
          return { h: btn ? btn.getBoundingClientRect().height : 0, scroll: document.scrollingElement.scrollWidth, view: document.scrollingElement.clientWidth };
        });
        if (m.h > 44) wrong.push(`${url}: Sign in is ${m.h}px tall`);
        if (m.scroll > m.view) wrong.push(`${url}: ${m.scroll}px wide in ${m.view}px`);
      }
      await context.close();
      expect(wrong).toEqual([]);
    });
  }
});

// ── L7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('L7 in Light, the pages outside story 2 are unchanged', () => {
  for (const { url, skip, label } of [
    { url: '/', skip: '', label: 'the search home' },
    { url: '/tapestry/', skip: '', label: 'the admin dashboard' },
    { url: '/dictionary', skip: '', label: 'the design shell' },
    // The /tags entry ("a story-3 page's content is unchanged in Light") was story 2's interim. Story 3 converts that
    // content on purpose, so it is retired here; story 3's own spec (appearance-setting-working.spec.js) covers /tags
    // in Light (W1) and in Dark (W3).
  ]) {
    test(`${label} (${url})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: 'light' });
      await storeChoiceEveryLoad(context, 'light');
      const page = await context.newPage();
      await mockStack(page);
      await page.goto(url);
      await settle(page);
      const skipSel = [skip, '.bs-appearance, .bs-appearance-compact-wrap'].filter(Boolean).join(', ');
      if (url === '/tags') {
        // Compare only inside the page container, which is itself frame.
        // Text colour is left out: it inherits from the container, which turns light. What the content paints itself
        // (backgrounds, borders, images) must not change.
        const now = await colourSnapshot(page, skipSel);
        const inner = Object.fromEntries(Object.entries(now).filter(([k]) => k !== 'body' && k.split('>').length > 3)
          .map(([k, v]) => [k, v.split(' | ').slice(1).join(' | ')]));
        if (WRITING) { baselineBucket[`light|${url}`] = inner; } else {
          expect(compareSnapshot(`light|${url}`, inner), `${label}: unchanged`).toEqual([]);
        }
      } else {
        await snapshotCheck(`light|${url}`, page, skipSel);
      }
      await context.close();
    });
  }
});
