const { test, expect } = require('@playwright/test');

/**
 * appearance-setting #1 — the Appearance switch, and a dark look for the design-shell pages: what a visitor SEES.
 *
 * Story: engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.md
 * ADR:   engineering-team/decisions/appearance-setting/0001-appearance-attribute-preload-and-design-shell-tokens.md
 * Plan:  engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.test-plan.md
 * Node half: test/appearance-setting.test.js (the library, the pre-render script, the tokens, contrast).
 *
 * Network-mocked (the my-assistants.spec.js idiom): a catch-all answers every /api read with empty collections,
 * sign-in comes from /api/auth/status and /api/auth/user-classification. Run it against a BUILD (`vite preview`, or
 * :7778 after /cycle-local), never the dev server: E6 holds the bundle under /assets/ to see the page before React.
 *
 * The markup contract these tests add (plan § Test infrastructure): the control is a radiogroup named "Appearance"
 * whose three radios are named System, Light and Dark and carry aria-checked; signed out it sits in the same top bar
 * row as the "Sign in with nostr" button.
 *
 *   E1 — first visit follows the computer, on every design-shell page.                                      [AC-1]
 *   E2 — under System the page follows a change of the computer's setting without a reload; under an explicit
 *        choice it doesn't.                                                                                 [AC-1, AC-3]
 *   E3 — where the control is: the signed-in avatar menu and /settings; signed out, beside Sign in (design shell
 *        and the profile family) and on the signed-out /settings page. System is checked by default.         [AC-2]
 *   E4 — a choice applies at once (no reload), survives a reload and a new tab, and System goes back to the
 *        computer; nothing is written to the server.                                                        [AC-3]
 *   E5 — another browser keeps its own choice.                                                               [AC-3]
 *   E6 — no flash: before the bundle runs, the page already has the chosen look's background, and it doesn't
 *        change once the page renders.                                                                      [AC-4]
 *   E7 — in Dark, every design-shell page is dark: no light surface, text readable (3:1, links and paragraphs
 *        4.5:1), signed out and signed in with the avatar menu open.                                         [AC-5]
 *   E8 — in Light, the design shell looks as today (regression).                                             [AC-5]
 *   E9 — the profile family, the Settings page, the search home and the admin pages look as today whatever is
 *        chosen, before and after render (regression).                                                       [AC-6]
 *   E10 — storage blocked: the page follows the computer, the control still works, no page error.            [AC-7]
 *   E11 — at phone widths (375 and 414 px), signed out, every top bar keeps Sign in on one line beside the control,
 *         and no page scrolls sideways.                                                                     [AC-2, AC-6]
 *
 * Widened after review 1 (Blocking 1, 2, 3, 6): E3 covers the search home's own user menu; E7 also sweeps a
 * Dictionary entry page and an /assistants list with your local Assistant; E4 checks for writes at its end too; E11
 * is new.
 */

const VIEWER = 'a1'.repeat(32);
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: null, classification: 'customer' };

const KEY = 'tapestry_appearance';
const DESIGN = ['/dictionary', '/treasure-map', '/treasure-map/advanced', '/assistants'];
const LIGHT_PAGE_BG = 'rgb(242, 243, 240)';
const LIGHT_INK = 'rgb(10, 14, 24)';

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const EMPTY = { success: true, events: [], profiles: {}, data: [], rows: [], entries: [], relays: [], assistants: [], preferences: {}, items: [], count: 0 };

async function mockStack(page, { session = null, rows = [] } = {}) {
  // Registered first so every specific route below wins (Playwright runs the last-registered match first).
  await page.route('**/api/**', (r) => json(r, EMPTY));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  // The page's own read says who is signed in (my-assistants ADR 0001): without signedIn it shows the sign-in line.
  await page.route('**/api/assistant/my-assistants', (r) => json(r, { success: true, signedIn: !!session, rows }));
  await page.route('**/api/auth/status', (r) => json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/dictionaries/concepts**', (r) => {
    const url = new URL(r.request().url());
    if (url.pathname !== '/api/dictionaries/concepts') return json(r, EMPTY);
    const coord = `39998:${OWNER_TA}:dog-breed`;
    return json(r, {
      success: true, metric: 'gum1', authors: [OWNER, OWNER_TA],
      entries: [{
        coord, name: 'dog breed', plural: 'dog breeds', description: 'Breeds of dog.', author: OWNER_TA, targets: [],
        selfDeclared: true, isFirmware: false, itemCount: 3, sharedCoord: coord, gum: 1, gum2: 1, recognizedBy: 1,
        totalAuthorCount: 1, totalEventCount: 1, override: null,
      }],
      pov: { branch: 'house', observer: null, fellBackToHouse: false, cutoff: 0.01, threshold: 2 },
    });
  });
}

// ── reading the page ──────────────────────────────────────────────────────────────────────────────────────────────

const attr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-appearance'));
function rgbOf(s) { const m = String(s).match(/rgba?\(([^)]+)\)/); return m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : null; }
function lum(s) {
  const p = rgbOf(s); if (!p) return NaN;
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
}
async function shellColours(page) {
  await page.locator('.bsd-page').first().waitFor();
  return page.evaluate(() => {
    const el = document.querySelector('.bsd-page');
    return { ink: getComputedStyle(el).color, body: getComputedStyle(document.body).backgroundColor };
  });
}
// Which look the design shell is SHOWING: its body text is dark in Light and light in Dark.
async function shownLook(page) { const { ink } = await shellColours(page); return lum(ink) > 0.5 ? 'dark' : 'light'; }
async function expectLook(page, look) {
  await expect.poll(() => attr(page), { message: `<html data-appearance> should be "${look}"` }).toBe(look);
  await expect.poll(() => shownLook(page), { message: `the design shell should show its ${look} look` }).toBe(look);
}
const group = (scope) => scope.getByRole('radiogroup', { name: 'Appearance' });
const radio = (scope, name) => group(scope).getByRole('radio', { name, exact: true });
async function markNoReload(page) { await page.evaluate(() => { window.__appearanceMarker = 1; }); }
async function stillNoReload(page) { return page.evaluate(() => window.__appearanceMarker === 1); }
async function storeChoiceEveryLoad(context, value) {
  await context.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } }, [KEY, value]);
}
async function openAvatarMenu(page) {
  await page.locator('.bs-usermenu-avatar-btn').first().click();
  await expect(page.locator('.bs-usermenu-dropdown')).toBeVisible();
  return page.locator('.bs-usermenu-dropdown');
}

/** Hold the bundle, sample the page every 100 ms, release it, and return the samples. */
async function sampleBeforeBundle(page, url) {
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(/\/assets\/[^?]*\.js(\?.*)?$/, async (route) => { await gate; await route.continue(); });
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => {
    const l = document.querySelector('link[rel="stylesheet"]');
    try { return !!(document.body && l && l.sheet && l.sheet.cssRules.length); } catch { return false; }
  });
  const samples = [];
  for (let i = 0; i < 6; i++) {
    samples.push(await page.evaluate(() => ({
      appearance: document.documentElement.getAttribute('data-appearance'),
      body: getComputedStyle(document.body).backgroundColor,
      rendered: !!document.querySelector('#root > *'),
    })));
    await page.waitForTimeout(100);
  }
  release();
  return samples;
}

// ── E1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E1 a first visit follows the computer', () => {
  for (const os of ['dark', 'light']) {
    test(`with no choice made and the computer set to ${os}, every design-shell page shows its ${os} look`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: os });
      await mockStack(page);
      for (const url of DESIGN) {
        await page.goto(url);
        await expectLook(page, os);
      }
    });
  }
});

// ── E2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E2 the computer changes while the page is open', () => {
  test('under System, the page follows the computer from light to dark and back without a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockStack(page);
    await page.goto('/treasure-map');
    await expectLook(page, 'light');
    await markNoReload(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectLook(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectLook(page, 'light');
    expect(await stillNoReload(page), 'the page should not have reloaded').toBe(true);
  });

  test('under an explicit Light, the page stays light when the computer turns dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockStack(page);
    await page.goto('/assistants');
    await radio(page, 'Light').click();
    await expectLook(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(400);
    await expectLook(page, 'light');
  });
});

// ── E3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E3 where the Appearance control is offered', () => {
  test('signed in: in the avatar menu, with System, Light and Dark and System checked by default', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    for (const url of ['/assistants', '/about', '/']) {
      await page.goto(url);
      const menu = await openAvatarMenu(page);
      await expect(group(menu)).toBeVisible();
      for (const name of ['System', 'Light', 'Dark']) await expect(radio(menu, name)).toBeVisible();
      await expect(radio(menu, 'System')).toHaveAttribute('aria-checked', 'true');
      await expect(radio(menu, 'Light')).toHaveAttribute('aria-checked', 'false');
      await expect(radio(menu, 'Dark')).toHaveAttribute('aria-checked', 'false');
    }
  });

  test('signed in: on the Settings page, outside the menu', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await page.goto('/settings');
    await expect(page.locator('.bs-usermenu-dropdown')).toHaveCount(0);
    await expect(group(page).first()).toBeVisible();
    for (const name of ['System', 'Light', 'Dark']) await expect(radio(page, name).first()).toBeVisible();
  });

  test('signed out: beside "Sign in with nostr" in the top bar, on the design shell and on a profile-family page', async ({ page }) => {
    await mockStack(page);
    for (const url of ['/assistants', '/dictionary', '/about', '/']) {
      await page.goto(url);
      const signIn = page.getByRole('button', { name: 'Sign in with nostr' }).first();
      await expect(signIn).toBeVisible();
      const g = group(page).first();
      await expect(g).toBeVisible();
      for (const name of ['System', 'Light', 'Dark']) await expect(radio(page, name).first()).toBeVisible();
      await expect(radio(page, 'System').first()).toHaveAttribute('aria-checked', 'true');
      const [a, b] = [await signIn.boundingBox(), await g.boundingBox()];
      const sameRow = a.y < b.y + b.height && b.y < a.y + a.height;
      const gap = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
      expect(sameRow, `${url}: the control should sit on the Sign in button's row (button y=${a.y}, control y=${b.y})`).toBe(true);
      expect(gap, `${url}: the control should sit beside the Sign in button (gap ${gap}px)`).toBeLessThan(160);
    }
  });

  test('signed out: the Settings page offers it too, with the sign-in prompt', async ({ page }) => {
    await mockStack(page);
    await page.goto('/settings');
    await expect(page.getByText('Sign in with nostr to personalize your search experience.')).toBeVisible();
    await expect(group(page)).toHaveCount(2); // the top bar's, and the page's own
  });
});

// ── E4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E4 a choice applies at once and sticks in this browser', () => {
  test('signed out: Dark applies with no reload, survives a reload and a new tab; System goes back to the computer', async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockStack(page);
    // Recorded from the click on, not from page load: the page's own load-time reads aren't the choice's (re-aimed in
    // Implementation, 2026-10-31). A read-only Cypher POST is a read — the server's own write guard decides
    // (src/api/neo4j/queryPost.js WRITE_KEYWORDS), as in my-assistants.spec.js.
    const WRITE_KEYWORDS = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;
    const writes = [];
    let recording = false;
    page.on('request', (req) => {
      if (!recording) return;
      const u = req.url();
      const p = new URL(u).pathname;
      if (!p.startsWith('/api/')) return;
      const body = req.postData() || '';
      let cypher = '';
      try { cypher = p === '/api/neo4j/query' ? (JSON.parse(body || '{}').cypher || '') : ''; } catch { /* not JSON */ }
      const read = req.method() === 'GET' || (req.method() === 'POST' && p === '/api/neo4j/query' && cypher && !WRITE_KEYWORDS.test(cypher));
      if (!read || /appearance|theme/i.test(u) || /appearance|theme/i.test(body)) writes.push(`${req.method()} ${u}`);
    });
    await page.goto('/assistants');
    await expectLook(page, 'light');
    await markNoReload(page);
    recording = true;
    await radio(page, 'Dark').first().click();
    await expectLook(page, 'dark');
    expect(await stillNoReload(page), 'choosing should not reload the page').toBe(true);
    await expect(radio(page, 'Dark').first()).toHaveAttribute('aria-checked', 'true');
    await page.waitForTimeout(800);
    expect(writes, 'choosing an appearance should send nothing to the server').toEqual([]);

    await page.reload();
    await expectLook(page, 'dark');
    await expect(radio(page, 'Dark').first()).toHaveAttribute('aria-checked', 'true');

    const tab = await context.newPage();
    await tab.emulateMedia({ colorScheme: 'light' });
    await mockStack(tab);
    await tab.goto('/dictionary');
    await expectLook(tab, 'dark');

    await radio(page, 'System').first().click();
    await expectLook(page, 'light');
    await page.reload();
    await expectLook(page, 'light');
    await expect(radio(page, 'System').first()).toHaveAttribute('aria-checked', 'true');
    expect(writes, 'nothing about the appearance should reach the server, through to the end').toEqual([]);
  });

  test('signed in: Light from the avatar menu applies at once on a dark computer, and the menu shows it checked', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockStack(page, { session: CUSTOMER });
    await page.goto('/assistants');
    await expectLook(page, 'dark');
    await markNoReload(page);
    const menu = await openAvatarMenu(page);
    await radio(menu, 'Light').click();
    await expectLook(page, 'light');
    expect(await stillNoReload(page)).toBe(true);
    const again = page.locator('.bs-usermenu-dropdown');
    if (!(await again.isVisible())) await openAvatarMenu(page);
    await expect(radio(page.locator('.bs-usermenu-dropdown'), 'Light')).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await expectLook(page, 'light');
  });

  test('signed in: the Settings page control changes the look too', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockStack(page, { session: CUSTOMER });
    await page.goto('/settings');
    await radio(page, 'Dark').first().click();
    await expect.poll(() => attr(page)).toBe('dark');
    await page.goto('/treasure-map/advanced');
    await expectLook(page, 'dark');
  });
});

// ── E5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('E5 another browser keeps its own choice: a fresh browser on a light computer is light after this one chose Dark', async ({ page, browser }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/assistants');
  await radio(page, 'Dark').first().click();
  await expectLook(page, 'dark');
  const other = await browser.newContext({ colorScheme: 'light' });
  const p2 = await other.newPage();
  await mockStack(p2);
  await p2.goto('/assistants');
  await expectLook(p2, 'light');
  await expect(radio(p2, 'System').first()).toHaveAttribute('aria-checked', 'true');
  await other.close();
});

// ── E6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E6 no flash on load', () => {
  const combos = [
    { stored: 'dark', os: 'light', look: 'dark', url: '/assistants' },
    { stored: 'light', os: 'dark', look: 'light', url: '/treasure-map' },
    { stored: 'system', os: 'dark', look: 'dark', url: '/dictionary' },
    { stored: null, os: 'light', look: 'light', url: '/treasure-map/advanced' },
  ];
  for (const { stored, os, look, url } of combos) {
    test(`${url}: choice ${stored || 'none'} on a ${os} computer shows only the ${look} look, before and after render`, async ({ page, context }) => {
      await page.emulateMedia({ colorScheme: os });
      if (stored) await storeChoiceEveryLoad(context, stored);
      await mockStack(page);
      const samples = await sampleBeforeBundle(page, url);
      expect(samples.every((s) => !s.rendered), 'the bundle was held, so nothing should have rendered yet').toBe(true);
      for (const s of samples) expect(s.appearance, 'data-appearance before the bundle runs').toBe(look);
      const first = samples[0].body;
      for (const s of samples) expect(s.body, 'the background should hold steady while the bundle loads').toBe(first);
      if (look === 'light') expect(first, 'the light page background, before render').toBe(LIGHT_PAGE_BG);
      else expect(lum(first), `a dark page background before render (got ${first})`).toBeLessThan(0.05);
      await expectLook(page, look);
      const { body } = await shellColours(page);
      expect(body, 'the background after render should be the one shown before it (no flash)').toBe(first);
    });
  }
});

// ── E7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function darkSweep(page) {
  return page.evaluate(() => {
    const parse = (s) => {
      const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const L = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a >= 0.5) return c; }
      return parse(getComputedStyle(document.body).backgroundColor);
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0;
    };
    const describe = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
    const text = []; const surface = []; let checked = 0;
    for (const el of document.querySelectorAll('.bsd-page *')) {
      if (!visible(el) || el.closest('svg')) continue;
      const s = getComputedStyle(el);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && !el.closest(':disabled, [aria-disabled="true"]')) {
        checked++;
        const fg = parse(s.color); const bg = bgOf(el);
        const need = el.closest('a, p') ? 4.5 : 3;
        const c = ratio(fg, bg);
        if (c < need) text.push(`${describe(el)}: ${c.toFixed(2)}:1 (needs ${need}) — ${s.color} on rgb(${bg.r}, ${bg.g}, ${bg.b})`);
      }
      const bgc = parse(s.backgroundColor); const r = el.getBoundingClientRect();
      if (bgc && bgc.a >= 0.5 && r.width >= 40 && r.height >= 20 && L(bgc) > 0.6 && !['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)) {
        surface.push(`${describe(el)}: a light surface ${s.backgroundColor}`);
      }
    }
    return { text, surface, checked };
  });
}

test.describe('E7 in Dark, every design-shell page is dark and readable', () => {
  for (const url of DESIGN) {
    test(`${url}, signed out and signed in with the avatar menu open`, async ({ browser }) => {
      for (const session of [null, CUSTOMER]) {
        const context = await browser.newContext({ colorScheme: 'dark' });
        const page = await context.newPage();
        await mockStack(page, { session });
        await page.goto(url);
        await expectLook(page, 'dark');
        await page.waitForLoadState('networkidle');
        if (session) await openAvatarMenu(page);
        const { text, surface, checked } = await darkSweep(page);
        const who = session ? 'signed in, menu open' : 'signed out';
        expect(checked, `${url} (${who}): the sweep should have read the page's text`).toBeGreaterThan(5);
        expect(surface, `${url} (${who}): no light surface should be left in Dark`).toEqual([]);
        expect(text, `${url} (${who}): all text should be readable in Dark`).toEqual([]);
        await context.close();
      }
    });
  }

  const ENTRY = `/dictionary/${encodeURIComponent(`39998:${OWNER_TA}:dog-breed`)}`;
  const LOCAL_ROWS = [
    { pubkey: '2'.repeat(64), local: true, tags: [{ key: 'tapestry', name: 'My Tapestry Assistant' }] },
    { pubkey: 'c1'.repeat(32), local: false, tags: [{ key: 'brainstorm', name: 'My Brainstorm Assistant' }] },
  ];
  for (const { label, url, rows, sessions, rendered } of [
    { label: 'a Dictionary entry page', url: ENTRY, rows: [], sessions: [null, CUSTOMER], rendered: 'h1' },
    { label: '/assistants with your local Assistant listed', url: '/assistants', rows: LOCAL_ROWS, sessions: [CUSTOMER], rendered: '.bsd-ma-row.is-local .bsd-ma-avatar' },
  ]) {
    test(`${label}, in Dark`, async ({ browser }) => {
      for (const session of sessions) {
        const context = await browser.newContext({ colorScheme: 'dark' });
        const page = await context.newPage();
        await mockStack(page, { session, rows });
        await page.goto(url);
        await expectLook(page, 'dark');
        await page.waitForLoadState('networkidle');
        // The path under test ran: what the sweep is meant to read is on the page.
        await expect(page.locator(rendered).first(), `${label}: ${rendered} should render`).toBeVisible();
        const { text, surface, checked } = await darkSweep(page);
        const who = session ? 'signed in' : 'signed out';
        expect(checked, `${label} (${who}): the sweep should have read the page's text`).toBeGreaterThan(5);
        expect(surface, `${label} (${who}): no light surface should be left in Dark`).toEqual([]);
        expect(text, `${label} (${who}): all text should be readable in Dark`).toEqual([]);
        await context.close();
      }
    });
  }
});

// ── E8 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('E8 in Light, the design shell looks as it does today, even on a dark computer (regression)', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await storeChoiceEveryLoad(context, 'light');
  await mockStack(page);
  for (const url of DESIGN) {
    await page.goto(url);
    const { ink, body } = await shellColours(page);
    expect(ink, `${url}: the design shell's text colour in Light`).toBe(LIGHT_INK);
    expect(body, `${url}: the page background in Light`).toBe(LIGHT_PAGE_BG);
  }
});

// ── E9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Re-aimed by appearance-setting #2: /about and /settings follow the setting since story 2, so they're pinned here only
// while the look resolves to Dark (story 2's own spec, appearance-setting-light.spec.js, covers their Light look and
// snapshots their Dark). The search home and /tapestry/ stay pinned under every choice.
const OTHERS = [
  { url: '/about', sel: '.bsp-page', bg: 'rgb(15, 15, 26)', ink: 'rgb(226, 232, 240)', darkOnly: true },
  { url: '/settings', sel: '.bss-page', bg: 'rgb(15, 15, 26)', ink: 'rgb(226, 232, 240)', darkOnly: true },
  { url: '/', sel: '.bs-page', bg: 'rgb(15, 15, 35)', ink: 'rgb(224, 224, 224)' },
  { url: '/tapestry/', sel: 'body', bg: 'rgb(13, 17, 23)', ink: 'rgb(230, 237, 243)' },
];

test.describe('E9 the other pages look as they do today, whatever is chosen (regression)', () => {
  for (const stored of [null, 'light', 'dark', 'system']) {
    for (const os of ['light', 'dark']) {
      test(`choice ${stored || 'none'} on a ${os} computer`, async ({ page, context }) => {
        await page.emulateMedia({ colorScheme: os });
        if (stored) await storeChoiceEveryLoad(context, stored);
        await mockStack(page);
        const resolvedDark = stored === 'dark' || ((stored === null || stored === 'system') && os === 'dark');
        for (const { url, sel, bg, ink, darkOnly } of OTHERS) {
          if (darkOnly && !resolvedDark) continue;
          await page.goto(url);
          await page.locator(sel).first().waitFor();
          const got = await page.evaluate((s) => { const el = document.querySelector(s); const cs = getComputedStyle(el); return { bg: cs.backgroundColor, ink: cs.color }; }, sel);
          expect(got.bg, `${url} ${sel} background`).toBe(bg);
          expect(got.ink, `${url} ${sel} text colour`).toBe(ink);
        }
      });
    }
  }

  // Re-aimed by appearance-setting #2: the reading pages now paint the light canvas before render (story 2, L4); the
  // search home is still outside every family until story 4.
  test('a light choice paints no light background before the search home renders', async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await storeChoiceEveryLoad(context, 'light');
    await mockStack(page);
    const samples = await sampleBeforeBundle(page, '/');
    for (const s of samples) expect(s.body, 'the pre-render background outside the design shell is today\'s').toBe('rgb(13, 17, 23)');
  });
});

// ── E10 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E10 a browser that refuses storage', () => {
  for (const os of ['dark', 'light']) {
    test(`on a ${os} computer: the page follows the computer, the control still changes the look, and nothing errors`, async ({ page, context }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await context.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('storage denied', 'SecurityError'); } });
      });
      await page.emulateMedia({ colorScheme: os });
      await mockStack(page);
      await page.goto('/assistants');
      await expectLook(page, os);
      const other = os === 'dark' ? 'Light' : 'Dark';
      await radio(page, other).first().click();
      await expectLook(page, other.toLowerCase());
      await expect(radio(page, other).first()).toHaveAttribute('aria-checked', 'true');
      expect(errors, 'no page error with storage blocked').toEqual([]);
    });
  }
});

// ── E11 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('E11 at phone widths, the signed-out top bar fits', () => {
  // David, 2026-10-31 (ADR 0001 Amendment 1): on phones the three icons become one "Appearance" button beside Sign in,
  // which opens the three choices. Sign in stays on one line and no page scrolls sideways.
  for (const width of [375, 414]) {
    test(`${width} px: one Appearance button beside a one-line Sign in, opening the three choices; no sideways scroll`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: 'light' });
      const page = await context.newPage();
      await mockStack(page);
      const wrong = [];
      for (const url of ['/', '/about', '/setup', '/settings', '/assistants', '/dictionary', '/treasure-map']) {
        await page.goto(url);
        const signIn = page.getByRole('button', { name: 'Sign in with nostr' }).first();
        await expect(signIn).toBeVisible();
        const toggle = page.getByRole('button', { name: /^Appearance: (System|Light|Dark)$/ }).first();
        await expect(toggle, `${url}: the Appearance button`).toBeVisible();
        // In the top bar no radio group shows until the button is pressed (/settings has its own card below the bar).
        expect(await page.locator('.bs-signin-group').getByRole('radiogroup').count(), `${url}: the bar's three stay folded`).toBe(0);
        const m = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sign in with nostr');
          const el = document.scrollingElement;
          return { h: btn.getBoundingClientRect().height, scroll: el.scrollWidth, view: el.clientWidth };
        });
        if (m.h > 44) wrong.push(`${url}: Sign in is ${m.h}px tall (wrapped)`);
        if (m.scroll > m.view) wrong.push(`${url}: the page is ${m.scroll}px wide in a ${m.view}px viewport`);
        const [a, b] = [await signIn.boundingBox(), await toggle.boundingBox()];
        if (!(a.y < b.y + b.height && b.y < a.y + a.height)) wrong.push(`${url}: the Appearance button isn't on Sign in's row`);
        const gap = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
        if (gap > 40) wrong.push(`${url}: the Appearance button is ${gap}px from Sign in`);
      }
      // Pressing it opens the three, wholly on screen (review 2, Blocking 1: a box past either edge can't be scrolled
      // to, so the scroll check alone can't see it); choosing Dark applies at once and closes them.
      for (const url of ['/about', '/assistants']) {
        await page.goto(url);
        await page.getByRole('button', { name: /^Appearance: / }).first().click();
        await expect(radio(page, 'Dark').first()).toBeVisible();
        await expect(radio(page, 'System').first()).toHaveAttribute('aria-checked', 'true');
        const boxes = await page.evaluate(() => [...document.querySelectorAll('.bs-appearance-popover, .bs-appearance-popover [role="radio"]')]
          .map((e) => { const r = e.getBoundingClientRect(); return { cls: e.getAttribute('aria-label') || e.textContent.trim() || e.className, left: r.left, right: r.right }; }));
        expect(boxes.length, `${url}: the open popover and its three options`).toBe(4);
        for (const b of boxes) {
          if (b.left < 0 || b.right > width) wrong.push(`${url}: "${b.cls}" spans ${Math.round(b.left)}..${Math.round(b.right)} in a ${width}px viewport`);
        }
        await radio(page, 'Dark').first().click();
        await expect.poll(() => attr(page), { message: `${url}: Dark applies` }).toBe('dark'); // /about has no .bsd-page
        await expect(page.locator('.bs-appearance-popover'), `${url}: choosing closes the popover`).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Appearance: Dark' }).first()).toBeVisible();
        const scrollAfter = await page.evaluate(() => document.scrollingElement.scrollWidth);
        if (scrollAfter > width) wrong.push(`${url} after choosing: ${scrollAfter}px wide`);
        await page.getByRole('button', { name: /^Appearance: / }).first().click();
        await radio(page, 'System').first().click();
      }
      // WebKit's focus model, imitated (review 3, Blocking 1): Safari doesn't focus a pressed <button>, it blurs the
      // focused element with no relatedTarget. A press on another option must still apply it, and a press on the
      // popover's own padding must not close it.
      await page.goto('/assistants');
      await page.evaluate(() => document.addEventListener('mousedown', () => {
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      }, true));
      await page.getByRole('button', { name: /^Appearance: / }).first().click();
      await expect(radio(page, 'System').first()).toBeFocused();
      const pad = await page.locator('.bs-appearance-popover').boundingBox();
      await page.mouse.click(pad.x + 3, pad.y + 3);
      await expect(page.locator('.bs-appearance-popover'), 'a press on the popover\'s own padding keeps it open').toHaveCount(1);
      await radio(page, 'Dark').first().click();
      await expectLook(page, 'dark');
      await expect(page.locator('.bs-appearance-popover'), 'the pressed choice applies, then the popover closes').toHaveCount(0);
      await context.close();
      expect(wrong, `at ${width} px`).toEqual([]);
    });
  }
});
