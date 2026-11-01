const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

/**
 * appearance-setting #4 — a light look for the search home: what a visitor SEES.
 *
 * Story: engineering-team/stories/appearance-setting/4-light-look-search-home.md
 * ADR:   engineering-team/decisions/appearance-setting/0004-search-home-joins-the-light-token-layer.md
 * Plan:  engineering-team/stories/appearance-setting/4-light-look-search-home.test-plan.md
 * Node half: test/appearance-setting-home.test.js.
 *
 * Network-mocked, and POPULATED (review 3-R1, Blocking 1): people results with both badges, a stale profile, matched
 * tags, a NIP-05 match, tag hits, the suggestions, pinned-tag chips when signed in, and the empty, error and loading
 * states. Run it against a BUILD. The Dark oracle (H5) is fixtures/appearance-setting-4-baseline.json, written with
 * APPEARANCE_BASELINE=write from a build of this story's base (7690c8e16's UI). Rewrite it only from a build of the base.
 *
 *   H1 — in Light, the landing search is light and readable: signed out and in, with the suggestions open and with the
 *        point-of-view picker open.                                                                         [AC-1]
 *   H2 — in Light, the results are light and readable, signed out and in (the avatar menu open), typed text included.
 *                                                                                                            [AC-1]
 *   H3 — in Light, the empty, error and loading states are light and readable.                              [AC-1]
 *   H4 — the meanings survive: the badges are told apart and each reads at 4.5:1; the stale marker reads as a warning.
 *                                                                                                            [AC-2]
 *   H5 — Dark is unchanged: every element of the search home paints today's colours (snapshot).             [AC-5]
 *   H6 — no flash on / and /?q=…, in either direction.                                                      [AC-6]
 *   H7 — no flip: / → a profile → /settings → back stays in one look, in Light and in Dark.                 [AC-4]
 *   H8 — at 375 and 414 px in Light, the landing and the results fit.                                       [AC-7]
 *   H9 — one light look: the search home's canvas, card, ink and accent are the rest of the light site's.   [AC-3]
 *   H10 — the admin pages and a page in no family (NotFound) are unchanged in Light.                         [AC-8]
 *   H11 — the class probe: every search-home rule, built inside the light search home, reads as rendered.    [AC-1]
 */

const VIEWER = 'a1'.repeat(32);
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: null, classification: 'customer' };
const KEY = 'tapestry_appearance';
const LIGHT_CANVAS = 'rgb(242, 243, 240)';
const DARK_PRE_RENDER = 'rgb(13, 17, 23)';
const ACCENT = 'rgb(114, 55, 255)';
const BASELINE_FILE = path.join(__dirname, 'fixtures', 'appearance-setting-4-baseline.json');
const WRITING = process.env.APPEARANCE_BASELINE === 'write';

const NOW = Math.floor(Date.now() / 1000);
const pk = (n) => n.toString(16).padStart(2, '0').repeat(32);
const HITS = [
  { pubkey: pk(0x11), name: 'Pat Podcaster', nip05: 'pat@example.com', about: 'Hosts a weekly podcast about nostr.',
    website: 'https://pat.example.com', lud16: 'pat@example.com', created_at: NOW - 3 * 86400, wot_rank: 98, wot_followers: 2839,
    _matchedTags: [{ eventId: 'e1', name: 'Podcaster', description: 'Hosts a podcast' }, { eventId: 'e2', name: 'Pod', description: '' }] },
  { pubkey: pk(0x22), name: 'Sam Stale', nip05: 'sam@example.org', about: 'An old profile, last updated long ago.',
    created_at: NOW - 3 * 365 * 86400, wot_rank: 40, wot_followers: 12 },
  { pubkey: pk(0x33), display_name: 'Riley', about: 'No NIP-05, no badges.', created_at: NOW - 30 * 86400 },
];
const TAG_HITS = [1, 2, 3, 4].map((i) => ({ eventId: `t${i}`, slug: `podcast-${i}`, name: `Podcast ${i}`, description: 'People who make podcasts.' }));
const SEARCH_OK = { success: true, hits: HITS, tagHits: TAG_HITS, tagHitsHasMore: true, estimatedTotalHits: 741, processingTimeMs: 7, query: 'podcast' };
const PIN = { pinEventId: 'p1', tag: { name: 'Podcaster', slug: 'podcaster', eventId: 'e1', authorPubkey: OWNER_TA },
  tlStatus: { status: 'ok' }, curationMethod: { observer: VIEWER } };

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const EMPTY = { success: true, events: [], profiles: {}, data: [], rows: [], entries: [], relays: [], assistants: [], preferences: {}, items: [], count: 0 };

/** search: 'ok' | 'empty' | 'error' | 'hold' (never answers, so the loading state stays). */
async function mockStack(page, { session = null, search = 'ok' } = {}) {
  await page.route('**/api/**', (r) => json(r, EMPTY));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} } : { success: true, signedIn: false }));
  await page.route('**/api/auth/status', (r) => json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true, classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null, assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: { [VIEWER]: { name: 'Viewer Example' } } }));
  await page.route('**/api/profile-tags/pins**', (r) => json(r, { success: true, pins: session ? [PIN] : [] }));
  await page.route('**/api/strfry/scan?**', (r) => json(r, { success: true, events: session
    ? [{ kind: 30392, created_at: NOW, tags: [['d', `tl-pin-${VIEWER.slice(0, 8)}-${OWNER_TA.slice(0, 8)}-podcaster`], ['p', pk(0x11)]] }] : [] }));
  await page.route('**/api/search/profiles/meili?**', async (r) => {
    if (search === 'hold') return; // never answered: the loading state stays on screen
    if (search === 'error') return json(r, { success: false, error: 'Search service unavailable.' }, 503);
    if (search === 'empty') return json(r, { success: true, hits: [], tagHits: [], estimatedTotalHits: 0, processingTimeMs: 3, query: 'zzz' });
    return json(r, SEARCH_OK);
  });
  await page.routeWebSocket(/.*/, (ws) => ws.close());
}
const attr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-appearance'));
async function settle(page) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(700); }
async function storeChoiceEveryLoad(context, value) {
  await context.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } }, [KEY, value]);
}
const homeBg = (page) => page.locator('.bs-page').first().evaluate((e) => getComputedStyle(e).backgroundColor);
async function openSuggestions(page) {
  const box = page.locator('.bs-search-input-landing').first();
  await box.click();
  await box.fill('po');
  await expect(page.locator('.bs-suggest-dropdown').first(), 'the suggestions open').toBeVisible();
  await expect(page.locator('.bs-suggest-item').first()).toBeVisible();
}
async function openAvatarMenu(page) {
  await page.locator('.bs-usermenu-avatar-btn').first().click();
  await expect(page.locator('.bs-usermenu-dropdown')).toBeVisible();
}

/**
 * Text and surfaces as rendered in Light (story 3's sweep): backgrounds laid over the body from the top down, each
 * faded by its own and its ancestors' opacity; text faded the same way over that. Inputs' typed text is measured too.
 * Inactive things are exempt (WCAG 1.4.3): disabled controls, aria-hidden decoration, and the point-of-view picker's
 * unavailable option (".bs-pov-option.disabled", which reads under 4.5:1 in Dark today too).
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
    const describe = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent || el.value || '').trim().slice(0, 30)}"`;
    const text = []; const surface = []; let checked = 0;
    const scope = document.querySelector(rootSel) || document.body;
    for (const el of scope.querySelectorAll('*')) {
      if (el.closest('svg')) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue;
      const typed = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value;
      const own = typed || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const inactive = el.closest(':disabled, [aria-disabled="true"], [aria-hidden="true"], .bs-pov-option.disabled');
      if (own && !inactive) {
        checked++;
        const { c: bg, o } = backdrop(el);
        const fg = parse(s.color);
        const shown = over(fg, (fg.a == null ? 1 : fg.a) * o, bg);
        const c = ratio(shown, bg); const need = el.closest('a, p') || typed ? 4.5 : 3;
        if (c < need) text.push(`${describe(el)}: ${c.toFixed(2)}:1 (needs ${need}), ${s.color} at opacity ${o.toFixed(2)}`);
      }
      const bg = parse(s.backgroundColor);
      const chroma = bg ? (Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b)) / 255 : 0;
      if (bg && bg.a >= 0.5 && r.width >= 40 && r.height >= 20 && L(bg) < 0.15 && chroma < 0.2 && !['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)) {
        surface.push(`${describe(el)}: a dark surface ${s.backgroundColor}`);
      }
    }
    return { text, surface, checked };
  }, root);
}
async function expectLight(page, label, { min = 3 } = {}) {
  await expect.poll(() => homeBg(page), { message: `${label}: the page background` }).toBe(LIGHT_CANVAS);
  const { text, surface, checked } = await lightSweep(page);
  expect(checked, `${label}: the sweep read the page's text`).toBeGreaterThan(min);
  expect(surface, `${label}: no dark surface in Light`).toEqual([]);
  expect(text, `${label}: all text readable in Light, as rendered`).toEqual([]);
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
      out[keyOf(el)] = [s.color, s.backgroundColor, bt, bb, s.backgroundImage === 'none' ? '-' : s.backgroundImage, s.boxShadow, s.opacity].join(' | ');
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
    samples.push(await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, rendered: !!document.querySelector('#root > *') })));
    await page.waitForTimeout(100);
  }
  release();
  return samples;
}

// The search home's states, each as a page to open and the steps that bring the state on screen.
const STATES = [
  { label: 'landing', url: '/', search: 'ok', steps: async () => {} },
  { label: 'landing-suggestions', url: '/', search: 'ok', steps: openSuggestions },
  { label: 'landing-pov-picker', url: '/', search: 'ok', steps: async (page) => { await page.locator('.bs-personalization-status').first().click(); await expect(page.locator('.bs-pov-picker').first()).toBeVisible(); } },
  { label: 'results', url: '/?q=podcast', search: 'ok', steps: async (page) => { await expect(page.locator('.bs-result-card').first()).toBeVisible(); } },
  { label: 'results-tags-expanded', url: '/?q=podcast', search: 'ok', steps: async (page) => { await page.locator('.bs-taghits-toggle').first().click(); } },
  { label: 'results-empty', url: '/?q=zzz', search: 'empty', steps: async (page) => { await expect(page.getByText('No results found')).toBeVisible(); } },
  { label: 'results-error', url: '/?q=podcast', search: 'error', steps: async (page) => { await expect(page.locator('.bs-error')).toBeVisible(); } },
];

// ── H1–H3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('H1–H3 in Light, every state of the search home is light and readable, signed out and in', () => {
  for (const st of STATES) {
    test(st.label, async ({ browser }) => {
      test.skip(WRITING, 'baseline run');
      for (const session of [null, CUSTOMER]) {
        const context = await browser.newContext({ colorScheme: 'light' });
        const page = await context.newPage();
        await mockStack(page, { session, search: st.search });
        await page.goto(st.url);
        await expect.poll(() => attr(page)).toBe('light');
        await settle(page);
        await st.steps(page);
        await expectLight(page, `${st.label} (${session ? 'signed in' : 'signed out'})`);
        await context.close();
      }
    });
  }

  test('results, signed in, with the pinned-tag chips and the avatar menu open', async ({ browser }) => {
    test.skip(WRITING, 'baseline run');
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await mockStack(page, { session: CUSTOMER });
    await page.goto('/');
    await settle(page);
    await expect(page.locator('.bs-pin-chip').first(), 'the pinned-tag chips show for a viewer with pins').toBeVisible();
    await expectLight(page, 'landing with pinned chips');
    await page.goto('/?q=podcast');
    await settle(page);
    await openAvatarMenu(page);
    await expectLight(page, 'results with the avatar menu open');
    await context.close();
  });

  test('typed text: the landing box and the results box show what a person types, readably', async ({ browser }) => {
    test.skip(WRITING, 'baseline run');
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await mockStack(page);
    await page.goto('/');
    await settle(page);
    await page.locator('.bs-search-input-landing').first().fill('dog');
    await expect.poll(() => homeBg(page), { message: 'the landing is light' }).toBe(LIGHT_CANVAS);
    const { text, checked: c1 } = await lightSweep(page, '.bs-search-box-landing');
    expect(c1, 'the landing box holds the typed text').toBeGreaterThan(0);
    expect(text, 'the landing box\'s typed text').toEqual([]);
    await page.goto('/?q=podcast');
    await settle(page);
    const { text: t2, checked } = await lightSweep(page, '.bs-search-box-results');
    expect(checked, 'the results box holds the query').toBeGreaterThan(0);
    expect(t2, 'the results box\'s typed text').toEqual([]);
    await context.close();
  });

  test('loading: "Searching…" is light and readable while results are on their way', async ({ browser }) => {
    test.skip(WRITING, 'baseline run');
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await mockStack(page, { search: 'hold' });
    await page.goto('/?q=podcast');
    await expect(page.locator('.bs-loading')).toBeVisible();
    await expectLight(page, 'loading', { min: 1 });
    await context.close();
  });
});

// ── H4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('H4 the meanings survive in Light: the two badges are told apart and each reads at 4.5:1; the stale marker reads as a warning', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/?q=podcast');
  await settle(page);
  await expect.poll(() => homeBg(page), { message: 'the results are light, so the badges are measured in Light' }).toBe(LIGHT_CANVAS);
  const got = await page.evaluate(() => {
    const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const L = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const over = (top, a, under) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });
    const hue = ({ r, g, b }) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return null; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
    const shown = (el) => {
      let c = parse(getComputedStyle(document.body).backgroundColor); let o = 1;
      const chain = []; for (let e = el; e && e !== document.body; e = e.parentElement) chain.unshift(e);
      for (const e of chain) { o *= parseFloat(getComputedStyle(e).opacity); const bg = parse(getComputedStyle(e).backgroundColor); if (bg.a > 0) c = over(bg, bg.a * o, c); }
      const fg = parse(getComputedStyle(el).color);
      const ink = over(fg, fg.a * o, c);
      return { ink, bg: c, ratio: ratio(ink, c), hue: hue(ink) };
    };
    const one = (sel) => { const el = document.querySelector(sel); return el ? shown(el) : null; };
    return { rank: one('.bs-wot-rank'), followers: one('.bs-wot-followers'), stale: one('.bs-result-age.stale') };
  });
  expect(got.rank, 'a Verification Score badge renders').toBeTruthy();
  expect(got.followers, 'a Verified Followers badge renders').toBeTruthy();
  expect(got.stale, 'a stale marker renders').toBeTruthy();
  expect(got.rank.ratio, 'Verification Score reads at 4.5:1 or better').toBeGreaterThanOrEqual(4.5);
  expect(got.followers.ratio, 'Verified Followers reads at 4.5:1 or better').toBeGreaterThanOrEqual(4.5);
  const apart = Math.min(Math.abs(got.rank.hue - got.followers.hue), 360 - Math.abs(got.rank.hue - got.followers.hue));
  expect(apart, `the two badges' inks differ in hue (Verification Score ${Math.round(got.rank.hue)}°, Followers ${Math.round(got.followers.hue)}°)`).toBeGreaterThanOrEqual(20);
  expect(got.stale.ratio, 'the stale marker reads at 4.5:1 or better').toBeGreaterThanOrEqual(4.5);
  expect(got.stale.hue, 'the stale marker is a warm warning hue (amber-brown, 15°–50°)').toBeGreaterThanOrEqual(15);
  expect(got.stale.hue).toBeLessThanOrEqual(50);
});

// ── H5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('H5 Dark is unchanged: every element of the search home paints today\'s colours', () => {
  for (const st of STATES) {
    test(st.label, async ({ browser }) => {
      for (const run of [{ label: 'dark-chosen', scheme: 'light', stored: 'dark' }, { label: 'system-dark', scheme: 'dark', stored: null }]) {
        for (const session of [null, CUSTOMER]) {
          const context = await browser.newContext({ colorScheme: run.scheme });
          if (run.stored) await storeChoiceEveryLoad(context, run.stored);
          const page = await context.newPage();
          await mockStack(page, { session, search: st.search });
          await page.goto(st.url);
          await settle(page);
          await st.steps(page);
          await page.waitForTimeout(300);
          const now = await colourSnapshot(page, '.bs-appearance, .bs-appearance-compact-wrap');
          const name = `dark|${run.label}|${session ? 'signed-in' : 'signed-out'}|${st.label}`;
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
      }
    });
  }
});

// ── H6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('H6 no flash on the search home', () => {
  for (const url of ['/', '/?q=podcast']) {
    test(`${url}: Light on a dark computer shows only the light canvas, before and after render`, async ({ page, context }) => {
      test.skip(WRITING, 'baseline run');
      await page.emulateMedia({ colorScheme: 'dark' });
      await storeChoiceEveryLoad(context, 'light');
      await mockStack(page);
      const samples = await sampleBeforeBundle(page, url);
      expect(samples.every((s) => !s.rendered), 'the bundle was held').toBe(true);
      for (const s of samples) expect(s.body, 'the light canvas before render').toBe(LIGHT_CANVAS);
      await expect.poll(() => homeBg(page)).toBe(LIGHT_CANVAS);
    });
    test(`${url}: Dark on a light computer shows only the dark background, before and after render`, async ({ page, context }) => {
      test.skip(WRITING, 'baseline run');
      await page.emulateMedia({ colorScheme: 'light' });
      await storeChoiceEveryLoad(context, 'dark');
      await mockStack(page);
      const samples = await sampleBeforeBundle(page, url);
      for (const s of samples) expect(s.body, 'today\'s dark background before render').toBe(DARK_PRE_RENDER);
      await expect.poll(() => homeBg(page)).toBe('rgb(15, 15, 35)');
    });
  }
});

// ── H7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('H7 no flip between pages', () => {
  for (const look of ['light', 'dark']) {
    test(`${look}: the search home → a profile → Settings → back stays ${look}`, async ({ page, context }) => {
      test.skip(WRITING, 'baseline run');
      await page.emulateMedia({ colorScheme: look === 'light' ? 'dark' : 'light' }); // the computer says the other one
      await storeChoiceEveryLoad(context, look);
      await mockStack(page, { session: CUSTOMER });
      const pageBg = () => page.evaluate(() => { const el = document.querySelector('.bs-page, .bsp-page, .bss-page'); return el ? getComputedStyle(el).backgroundColor : null; });
      const isLight = (bg) => bg === LIGHT_CANVAS;
      const seen = [];
      await page.goto('/?q=podcast');
      await settle(page);
      seen.push(['search results', await pageBg()]);
      await page.locator('.bs-result-card').first().click();
      await page.waitForURL(/\/user\//);
      await settle(page);
      seen.push(['profile', await pageBg()]);
      await page.goto('/settings');
      await settle(page);
      seen.push(['settings', await pageBg()]);
      await page.goBack(); await page.goBack();
      await settle(page);
      seen.push(['back to the search home', await pageBg()]);
      const wrong = seen.filter(([, bg]) => !bg || isLight(bg) !== (look === 'light'));
      expect(wrong.map(([w, bg]) => `${w}: ${bg}`), `every page is ${look}`).toEqual([]);
    });
  }
});

// ── H8 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('H8 at phone widths in Light, the search home fits', () => {
  for (const width of [375, 414]) {
    test(`${width} px`, async ({ browser }) => {
      test.skip(WRITING, 'baseline run');
      const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: 'light' });
      const page = await context.newPage();
      await mockStack(page);
      const wrong = [];
      for (const url of ['/', '/?q=podcast']) {
        await page.goto(url);
        await settle(page);
        const m = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, view: document.scrollingElement.clientWidth, bg: getComputedStyle(document.querySelector('.bs-page')).backgroundColor }));
        if (m.scroll > m.view) wrong.push(`${url}: ${m.scroll}px wide in ${m.view}px`);
        if (m.bg !== LIGHT_CANVAS) wrong.push(`${url}: not light (${m.bg})`);
      }
      await context.close();
      expect(wrong).toEqual([]);
    });
  }
});

// ── H9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('H9 one light look: the search home\'s canvas, card, ink and accent are the light site\'s', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/?q=podcast');
  await settle(page);
  const got = await page.evaluate(() => ({
    canvas: getComputedStyle(document.querySelector('.bs-page')).backgroundColor,
    card: getComputedStyle(document.querySelector('.bs-result-card')).backgroundColor,
    ink: getComputedStyle(document.querySelector('.bs-result-name')).color,
  }));
  expect(got.canvas, 'the page background').toBe(LIGHT_CANVAS);
  expect(got.card, 'a result card is the light site\'s card surface').toBe('rgb(255, 255, 255)');
  expect(got.ink, 'a result\'s name is the light site\'s ink').toBe('rgb(10, 14, 24)');
  await page.goto('/');
  await settle(page);
  const link = await page.locator('.bs-personalization-link').first().evaluate((e) => getComputedStyle(e).color);
  expect(link, '"What is this?" is the light site\'s accent').toBe(ACCENT);
});

// ── H10 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('H10 in Light, the admin dashboard and a page in no family keep today\'s background', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  for (const url of ['/tapestry/', '/no-such-page']) {
    await page.goto(url);
    await settle(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), `${url}: body`).toBe(DARK_PRE_RENDER);
  }
});

// ── H11 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * H11 — the class probe (story 3's W8, aimed at the search home). For every rule naming a class the search home
 * renders, build the elements its selector describes inside the light search home, put text in the innermost one, and
 * measure it as rendered (3:1, or 4.5:1 inside a or p). Disabled and inactive states, pseudo-classes and pseudo-elements
 * are left out (WCAG exempts the first; the others can't be built).
 */
const AP = require('../../test/appearance-setting.test.js').helpers;
const AP2 = require('../../test/appearance-setting-light.test.js').helpers;
const AP3 = require('../../test/appearance-setting-working.test.js').helpers;
const AP4 = require('../../test/appearance-setting-home.test.js');
// Pieces the probe can't judge fairly, each with its reason. Key: selector.
const PROBE_ALLOWLIST = new Map([
]);
function probeSelectors() {
  const classes = AP2.classesFrom(AP4.HOME_FILES);
  const rules = AP.parseCss(fs.readFileSync(path.join(__dirname, '../../ui/src/styles.css'), 'utf8'));
  const out = new Set();
  for (const r of rules) {
    const sel = r.selector;
    if (r.context || !AP3.isFamilyRule(r, classes) || /\[|:|\*|svg|img|path|^(html|body)\b/.test(sel)) continue;
    if (AP3.DISABLED.test(sel) || /hidden/.test(sel)) continue;
    if (!r.decls.some(([p]) => /^(color|background|background-color|opacity)$/.test(p))) continue;
    if (PROBE_ALLOWLIST.has(sel)) continue;
    out.add(sel);
  }
  return [...out];
}

test('H11 in Light, every search-home rule\'s piece reads as rendered, data or no data (class probe)', async ({ page }) => {
  test.skip(WRITING, 'baseline run');
  test.setTimeout(120000);
  const selectors = probeSelectors();
  expect(selectors.length, 'the probe found the search home\'s rules').toBeGreaterThan(60);
  await page.emulateMedia({ colorScheme: 'light' });
  await mockStack(page);
  await page.goto('/');
  await settle(page);
  const result = await page.evaluate((sels) => {
    const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const L = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const over = (top, a, under) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });
    const host = document.querySelector('.bs-page');
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
      const chroma = own ? (Math.max(own.r, own.g, own.b) - Math.min(own.r, own.g, own.b)) / 255 : 0;
      if (own && own.a >= 0.5 && L(own) < 0.15 && chroma < 0.2) low.push(`${sel}: a dark surface ${s.backgroundColor}`);
    }
    wrap.remove();
    return { low, measured };
  }, selectors);
  expect(result.measured, 'the probe measured the search home\'s pieces').toBeGreaterThan(60);
  expect(result.low, 'every piece reads in Light as rendered').toEqual([]);
});
