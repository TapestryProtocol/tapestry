const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * setup-create-account #2: open sign-up, the owner's choice — the browser class.
 *
 * Story: engineering-team/stories/setup-create-account/2-open-sign-up.md
 * ADR:   engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md
 * Plan:  engineering-team/stories/setup-create-account/2-open-sign-up.test-plan.md
 * Node half: test/setup-open-sign-up.test.js (C/G/A/H/K/D).
 *
 *   B0  — the served origin runs a build that contains the sign-up state.                 [prerequisite]
 *   B1  — closed: a guest sees story 1's ask-the-owner message and no "Sign up".           [AC-2]
 *   B2  — open: a guest sees the two sign-up lines and "Sign up", and nothing of story 1's guest state. [AC-3]
 *   B3  — sign up: working state, one request, the editor, /setup, the pill and the avatar menu updated, no reload. [AC-3]
 *   B4  — 409 already-customer (another tab won): on to the editor, no error.              [AC-5]
 *   B5  — failures: the reason (key, offline, closed meanwhile) and the button again.      [AC-3]
 *   B6  — a deactivated customer: told to ask the owner, named and linked; no "Sign up".   [AC-5]
 *   B7  — opening either new state sends nothing but reads.                                [AC-2]
 *   B8  — 375 px, and Light and Dark readability, for the new states and the failure line. [look, as story 1 AC-6]
 *   B9  — Settings, the owner: "👥 Accounts", the switch, its description; saving on and off. [AC-1]
 *   B10 — Settings, an admin: the switch shows the state but can't be changed.             [AC-1]
 *   B11 — Settings, a refused save leaves the switch showing the server's state.          [AC-1]
 *
 * Hermetic by construction: every /api route is mocked and WebSockets are closed. `vite preview` proxies /api to
 * :7778, which on the Mac Studio is a private instance. Prerequisites as in setup-create-account.spec.js:
 * BRAINSTORM_BASE_URL → a server for the BUILT UI; B0 guards a stale build.
 *
 * These FAIL against the current build: a guest's page knows nothing of sign-up, and Settings has no Accounts tab.
 */

const VIEWER = 'a1'.repeat(32);
const NEW_ASSISTANT = 'a3'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const TA = 'ee'.repeat(32);
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);

const GUEST_OPEN = { pubkey: VIEWER, classification: 'guest', assistantPubkey: null, signUpOpen: true, customerStatus: null };
const GUEST_CLOSED = { pubkey: VIEWER, classification: 'guest', assistantPubkey: null, signUpOpen: false, customerStatus: null };
const DEACTIVATED_OPEN = { pubkey: VIEWER, classification: 'guest', assistantPubkey: null, signUpOpen: true, customerStatus: 'inactive' };
const DEACTIVATED_CLOSED = { ...DEACTIVATED_OPEN, signUpOpen: false };
const OWNER_SESSION = { pubkey: OWNER, classification: 'owner', assistantPubkey: TA };
const ADMIN_SESSION = { pubkey: ADMIN, classification: 'admin', assistantPubkey: ASSISTANT };

const PAGE_PATH = '/setup/create-account';
const EDITOR_PATH = '/assistant/profile/edit';
const SETTINGS_PATH = '/tapestry/settings/accounts';

// Story 2 § Copy, and the story 1 strings it must not show.
const SIGN_UP_LINE_1 = "You don't have an account on this instance yet.";
const SIGN_UP_LINE_2 = 'Sign up as a customer, and this instance will create your Tapestry Assistant and hold its key for you.';
const SIGN_UP = 'Sign up';
const SIGNING_UP = 'Signing up…';
const FAILED_PREFIX = "You couldn't be signed up: ";
const DEACTIVATED_PREFIX = 'Your customer account here is inactive. To use it again, ask the owner of this instance';
const SWITCH_LABEL = 'Open sign-up';
const SWITCH_DESCRIPTION = "Let anyone who signs in make themselves a customer here. Each new customer gets a Tapestry Assistant that this instance holds for them, and their scores are calculated in this instance's regular customer runs.";
const OWNER_ONLY_NOTE = 'Only the owner can change this.';
const ACCOUNTS_TAB = '👥 Accounts';
const DONE_TEXT = 'This instance holds your Tapestry Assistant.';
const GUEST_LINE = "You don't have a Tapestry Assistant on this instance. This instance sets one up for its owner, its admins and its customers.";
const ASK_PREFIX = 'To become a customer here, ask the owner of this instance';
const CREATE = 'Create my Tapestry Assistant';

const KEY = 'tapestry_appearance';
const LIGHT_CANVAS = 'rgb(242, 243, 240)';
const WRITE_CYPHER = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;

const npub = (hex) => nip19.npubEncode(hex);
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const step = (done, pending) => ({ done, pending, finished: true });
const setupAnswer = (accountDone) => ({
  success: true, signedIn: true,
  steps: {
    account: step(accountDone, !accountDone),
    follow: { ...step(false, true), followCount: 0, source: null },
    activate: { ...step(false, true), otherProvider: false, source: null },
  },
});
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

/**
 * Mock every route. `who` is the session (guest fields signUpOpen/customerStatus included) or null.
 *   signUp   — (route, state) => fulfil POST /api/auth/sign-up-new-customer. The default makes the session a customer
 *              holding NEW_ASSISTANT and answers 200.
 *   settings — the instance's settings for GET /api/settings; settingsPut — (route, state, body) => fulfil PUT.
 */
async function mock(page, opts = {}) {
  const o = { who: null, signUp: null, settings: { signUp: { open: false } }, settingsPut: null, ...opts };
  const state = {
    session: o.who ? { ...o.who } : null, signUpCalls: 0, classificationCalls: 0, statusCalls: 0,
    settings: JSON.parse(JSON.stringify(o.settings)), puts: [], nonGet: [],
  };
  page.on('request', (req) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return;
    const url = new URL(req.url());
    if (url.pathname === '/api/neo4j/query') {
      let cypher = '';
      try { cypher = JSON.parse(req.postData() || '{}').cypher || ''; } catch { /* not JSON */ }
      if (cypher && !WRITE_CYPHER.test(cypher)) return;
    }
    state.nonGet.push(`${req.method()} ${url.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by setup-open-sign-up.spec.js' })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => {
    const pks = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const known = { [OWNER]: { display_name: 'Olive Owner' }, [NEW_ASSISTANT]: { display_name: 'Ada Assistant' } };
    return r.fulfill(json({ success: true, profiles: Object.fromEntries(pks.map((pk) => [pk, known[pk] || null])) }));
  });
  await page.route('**/api/auth/status', (r) => r.fulfill(json(state.session
    ? { authenticated: true, pubkey: state.session.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => {
    state.classificationCalls += 1;
    const s = state.session;
    if (!s) return r.fulfill(json({ success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
    const body = { success: true, classification: s.classification, pubkey: s.pubkey, assistantPubkey: s.assistantPubkey };
    if (s.classification === 'guest') { body.signUpOpen = s.signUpOpen === true; body.customerStatus = s.customerStatus || null; }
    return r.fulfill(json(body));
  });
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json({
    success: true, hasRelayKey: !!(state.session && state.session.assistantPubkey), hasProfile: true,
    assistantPubkey: state.session && state.session.assistantPubkey, isOwner: false, profile: null,
  })));
  await page.route('**/api/setup/status**', (r) => {
    state.statusCalls += 1;
    if (!state.session) return r.fulfill(json({ success: true, signedIn: false }));
    return r.fulfill(json(setupAnswer(!!state.session.assistantPubkey)));
  });
  await page.route('**/api/auth/sign-up-new-customer', async (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    state.signUpCalls += 1;
    const handler = o.signUp || ((route, s) => {
      s.session = { pubkey: s.session.pubkey, classification: 'customer', assistantPubkey: NEW_ASSISTANT };
      return route.fulfill(json({ success: true, message: 'Customer account created successfully', customerId: 7, customerName: 'customer_a1a1a1a1_x', assistantPubkey: NEW_ASSISTANT, assistantNpub: npub(NEW_ASSISTANT) }));
    });
    try { return await handler(r, state); } catch { return undefined; }
  });
  await page.route('**/api/settings', async (r) => {
    const req = r.request();
    if (req.method() === 'GET') {
      return r.fulfill(json({ success: true, settings: state.settings, overrides: {}, defaults: { signUp: { open: false } }, settingsPath: '/tmp/settings.json' }));
    }
    if (req.method() === 'PUT') {
      let body = null;
      try { body = JSON.parse(req.postData() || 'null'); } catch { /* not JSON */ }
      state.puts.push(body);
      const handler = o.settingsPut || ((route, s, b) => {
        if (!s.session || s.session.classification !== 'owner') return route.fulfill(json({ success: false, error: 'Only the owner can change open sign-up.' }, 403));
        s.settings = { ...s.settings, ...b };
        return route.fulfill(json({ success: true, overrides: b, settings: s.settings, needsRestart: false }));
      });
      return handler(r, state, body);
    }
    return r.fallback();
  });
  await page.routeWebSocket(/.*/, (ws) => ws.close());
  return state;
}

const main = (page) => page.locator('main').first();
const signUpButton = (scope) => scope.getByRole('button', { name: SIGN_UP, exact: true });
const textOf = (locator) => locator.evaluate((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());

async function openPage(page, evidence) {
  await page.goto(PAGE_PATH);
  await page.getByRole('heading', { level: 1, name: 'Create your account' }).waitFor({ timeout: 20000 });
  if (evidence) await expect(evidence(main(page))).toBeVisible({ timeout: 10000 });
  return main(page);
}
const mayOpenEvidence = (m) => signUpButton(m);
const deactivatedEvidence = (m) => m.getByText(new RegExp(`^${escapeRe(DEACTIVATED_PREFIX)}`));
const closedEvidence = (m) => m.getByText(GUEST_LINE, { exact: true });

async function innermostText(scope, needle) {
  return scope.evaluate((root, n) => {
    let best = null;
    for (const el of root.querySelectorAll('*')) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.includes(n) && (!best || t.length <= best.length)) best = t;
    }
    return best;
  }, needle);
}

async function watchFor(page, needle) {
  await page.evaluate((n) => {
    window.__sawText = window.__sawText || {};
    window.__sawText[n] = (document.body.textContent || '').includes(n);
    new MutationObserver(() => { if ((document.body.textContent || '').includes(n)) window.__sawText[n] = true; })
      .observe(document.body, { subtree: true, childList: true, characterData: true });
  }, needle);
}
const sawText = (page, needle) => page.evaluate((n) => !!(window.__sawText && window.__sawText[n]), needle);

async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI?' };
  const seen = new Set();
  while (queue.length && seen.size < 400) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);
    const res = await request.get(asset);
    if (!res.ok()) continue;
    const js = await res.text();
    if (js.includes(needle)) return { found: true };
    for (const m of js.matchAll(/["'(](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = m[1];
      const resolved = ref.startsWith('assets/') ? `/${ref}` : new URL(ref, new URL(asset, 'http://origin')).pathname;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return { found: false, why: `searched ${seen.size} JS chunks` };
}

async function unreadable(page, rootSel) {
  return page.evaluate((sel) => {
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
    const out = []; let checked = 0;
    const root = document.querySelector(sel) || document.body;
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.closest(':disabled, [aria-disabled="true"], [aria-hidden="true"]')) continue;
      checked++;
      const { c: bg, o } = backdrop(el);
      const fg = parse(s.color);
      const shown = over(fg, (fg.a == null ? 1 : fg.a) * o, bg);
      const c = ratio(shown, bg); const need = el.closest('a, p') ? 4.5 : 3;
      if (c < need) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 40)}": ${c.toFixed(2)}:1 (needs ${need})`);
    }
    return { out, checked };
  }, rootSel);
}

async function canvasBehindMain(page) {
  return page.evaluate(() => {
    for (let e = document.querySelector('main'); e; e = e.parentElement) {
      const bg = getComputedStyle(e).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); if (p.length < 4 || p[3] > 0.9) return bg; }
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

/** The avatar menu's "My Assistant's Profile": a link when enabled, an aria-disabled span when not. */
async function myAssistantItem(page) {
  await page.locator('.bs-usermenu-avatar-btn').first().click();
  const link = page.getByRole('link', { name: "My Assistant's Profile" });
  const disabled = page.locator('[aria-disabled="true"]', { hasText: "My Assistant's Profile" });
  await expect(link.or(disabled).first()).toBeVisible({ timeout: 5000 });
  const enabled = (await link.count()) > 0;
  const href = enabled ? await link.first().getAttribute('href') : null;
  await page.locator('.bs-usermenu-avatar-btn').first().click(); // close it again
  await expect(link.or(disabled).first()).toBeHidden({ timeout: 5000 }).catch(() => {});
  return { enabled, href };
}

test.describe('Open sign-up (setup-create-account #2)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that contains the sign-up state', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, SIGN_UP_LINE_2);
    expect(found, `the bundle served by ${baseURL} lacks "${SIGN_UP_LINE_2}" (${why}). Rebuild the UI, or the state is not built yet.`).toBe(true);
  });

  test('B1: while sign-up is closed, a guest sees story 1\'s ask-the-owner message and no "Sign up" (AC-2)', async ({ page }) => {
    const state = await mock(page, { who: GUEST_CLOSED });
    const m = await openPage(page, closedEvidence);
    await expect(m.getByRole('link', { name: 'Olive Owner', exact: true })).toBeVisible({ timeout: 10000 });
    expect(await innermostText(m, ASK_PREFIX)).toBe(`${ASK_PREFIX}: Olive Owner.`);
    await expect(signUpButton(m)).toHaveCount(0);
    await expect(m.getByText(SIGN_UP_LINE_2)).toHaveCount(0);
    expect(state.signUpCalls).toBe(0);
  });

  test('B2: while it is open, a guest sees the two sign-up lines and "Sign up", and not story 1\'s guest message (AC-3)', async ({ page }) => {
    const state = await mock(page, { who: GUEST_OPEN });
    const m = await openPage(page, mayOpenEvidence);
    await expect(m.getByText(SIGN_UP_LINE_1, { exact: true })).toBeVisible();
    await expect(m.getByText(SIGN_UP_LINE_2, { exact: true })).toBeVisible();
    await expect(m.getByText(GUEST_LINE, { exact: true })).toHaveCount(0);
    await expect(m.getByText(ASK_PREFIX)).toHaveCount(0);
    await expect(m.getByRole('button', { name: CREATE, exact: true })).toHaveCount(0);
    expect(state.signUpCalls, 'opening the page signs nobody up').toBe(0);
  });

  test('B3: a guest signs up: working once, the editor, and the app treats them as a customer — /setup, the pill, the menu — with no reload (AC-3)', async ({ page }) => {
    const release = deferred();
    const state = await mock(page, {
      who: GUEST_OPEN,
      signUp: async (route, s) => {
        await release.promise;
        s.session = { pubkey: s.session.pubkey, classification: 'customer', assistantPubkey: NEW_ASSISTANT };
        return route.fulfill(json({ success: true, message: 'Customer account created successfully', customerId: 7, customerName: 'customer_a1a1a1a1_x', assistantPubkey: NEW_ASSISTANT, assistantNpub: npub(NEW_ASSISTANT) }));
      },
    });
    const m = await openPage(page, mayOpenEvidence);
    const before = await myAssistantItem(page);
    expect(before.enabled, 'before signing up, a guest has no "My Assistant\'s Profile"').toBe(false);
    await page.evaluate(() => { window.__noReload = 'kept'; });

    await signUpButton(m).click();
    const working = m.getByRole('button', { name: SIGNING_UP, exact: true });
    await expect(working).toBeVisible();
    await expect(working).toBeDisabled();
    await working.click({ force: true, timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(300);
    expect(state.signUpCalls, 'one press, one request').toBe(1);
    const classificationsBefore = state.classificationCalls;

    release.resolve();
    await expect(page).toHaveURL(new RegExp(`${EDITOR_PATH}$`), { timeout: 10000 });
    expect(await page.evaluate(() => window.__noReload), 'no reload').toBe('kept');
    expect(state.classificationCalls, 'the app re-read who the person is').toBeGreaterThan(classificationsBefore);
    await expect(page.getByRole('link', { name: /2 steps left/ }), 'the Setup Alert counts step 1 done').toBeVisible({ timeout: 10000 });
    const after = await myAssistantItem(page);
    expect(after.enabled, '"My Assistant\'s Profile" is enabled for the new customer').toBe(true);
    expect(after.href).toBe(EDITOR_PATH);

    await page.goBack();
    await expect(main(page).getByText(DONE_TEXT, { exact: true }), 'back on the page, step 1 is done').toBeVisible({ timeout: 10000 });
    await expect(main(page)).toContainText(npub(NEW_ASSISTANT));
    await page.evaluate(() => { window.history.pushState({}, '', '/setup'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await expect(main(page).getByText(DONE_TEXT, { exact: true }), '/setup shows step 1 done').toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => window.__noReload)).toBe('kept');
    expect(state.signUpCalls).toBe(1);
  });

  test('B4: when the answer is 409 already-customer (another tab won), the person goes on to the editor and sees no error (AC-5)', async ({ page }) => {
    const state = await mock(page, {
      who: GUEST_OPEN,
      signUp: (route, s) => {
        s.session = { pubkey: s.session.pubkey, classification: 'customer', assistantPubkey: NEW_ASSISTANT };
        return route.fulfill(json({ success: false, code: 'already-customer', message: 'You are already a customer.', error: 'You are already a customer.' }, 409));
      },
    });
    const m = await openPage(page, mayOpenEvidence);
    await watchFor(page, FAILED_PREFIX.trim());
    await signUpButton(m).click();
    await expect(page).toHaveURL(new RegExp(`${EDITOR_PATH}$`), { timeout: 10000 });
    expect(await sawText(page, FAILED_PREFIX.trim())).toBe(false);
    await page.goBack();
    await expect(main(page).getByText(DONE_TEXT, { exact: true })).toBeVisible({ timeout: 10000 });
    expect(state.signUpCalls).toBe(1);
  });

  test('B5: a failed sign-up says why and offers the button again — the key, offline, closed meanwhile (AC-3)', async ({ page }) => {
    const answers = [
      (route) => route.fulfill(json({ success: false, code: 'assistant-key-failed', message: 'key store unavailable', error: 'key store unavailable' }, 500)),
      (route) => route.abort('failed'),
      (route) => route.fulfill(json({ success: false, code: 'sign-up-closed', message: 'Open sign-up is off on this instance.', error: 'Open sign-up is off on this instance.' }, 403)),
    ];
    const state = await mock(page, { who: GUEST_OPEN, signUp: (route, s) => answers.shift()(route, s) });
    const m = await openPage(page, mayOpenEvidence);
    const alert = m.getByRole('alert');

    await signUpButton(m).click();
    await expect(alert).toHaveText(`${FAILED_PREFIX}key store unavailable`, { timeout: 10000 });
    await expect(signUpButton(m)).toBeEnabled();

    await signUpButton(m).click();
    await expect(alert).toHaveText(new RegExp(`^${escapeRe(FAILED_PREFIX)}\\S`), { timeout: 10000 });
    await expect(signUpButton(m)).toBeEnabled();

    await signUpButton(m).click();
    await expect(alert).toHaveText(`${FAILED_PREFIX}Open sign-up is off on this instance.`, { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(`${PAGE_PATH}$`));
    expect(state.signUpCalls).toBe(3);
  });

  for (const [label, who] of [['sign-up open', DEACTIVATED_OPEN], ['sign-up closed', DEACTIVATED_CLOSED]]) {
    test(`B6: a deactivated customer (${label}) is told to ask the owner, named and linked, with no "Sign up" (AC-5)`, async ({ page }) => {
      const state = await mock(page, { who });
      const m = await openPage(page, deactivatedEvidence);
      await expect(m.getByRole('link', { name: 'Olive Owner', exact: true })).toHaveAttribute('href', `/user/${OWNER}`, { timeout: 10000 });
      expect(await innermostText(m, DEACTIVATED_PREFIX)).toBe(`${DEACTIVATED_PREFIX}: Olive Owner.`);
      await expect(signUpButton(m)).toHaveCount(0);
      await expect(m.getByText(SIGN_UP_LINE_2)).toHaveCount(0);
      await expect(m.getByText(GUEST_LINE, { exact: true })).toHaveCount(0);
      expect(state.signUpCalls).toBe(0);
    });
  }

  test('B7: opening the sign-up or the deactivated state sends nothing but reads (AC-2)', async ({ page }) => {
    test.setTimeout(90000);
    const problems = [];
    for (const [label, who, ev] of [['may sign up', GUEST_OPEN, mayOpenEvidence], ['deactivated', DEACTIVATED_OPEN, deactivatedEvidence]]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const state = await mock(page, { who });
      await openPage(page, ev);
      await page.waitForTimeout(1000);
      if (state.nonGet.length) problems.push(`${label}: ${state.nonGet.join(', ')}`);
    }
    expect(problems).toEqual([]);
  });

  test('B8: the new states and the failure line fit 375 px and read at WCAG AA in Light and Dark, following the choice', async ({ page }) => {
    test.setTimeout(150000);
    const problems = [];
    const failOnce = (route) => route.fulfill(json({ success: false, code: 'assistant-key-failed', message: 'key store unavailable', error: 'key store unavailable' }, 500));
    const states = [
      ['may sign up', GUEST_OPEN, mayOpenEvidence, null],
      ['deactivated', DEACTIVATED_OPEN, deactivatedEvidence, null],
      ['failed sign-up', GUEST_OPEN, mayOpenEvidence, failOnce],
    ];
    for (const choice of ['light', 'dark']) {
      for (const width of [375, 1280]) {
        for (const [label, who, ev, signUp] of states) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await page.setViewportSize({ width, height: 860 });
          await page.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } }, [KEY, choice]);
          await page.emulateMedia({ colorScheme: choice === 'light' ? 'dark' : 'light' });
          await mock(page, { who, signUp });
          const m = await openPage(page, ev);
          if (signUp) { await signUpButton(m).click(); await expect(m.getByRole('alert')).toBeVisible({ timeout: 10000 }); }
          await page.waitForTimeout(600);
          const tag = `${choice} ${width}px ${label}`;
          const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
          if (scroll > client) problems.push(`${tag}: ${scroll} px wide in a ${client} px window`);
          const canvas = await canvasBehindMain(page);
          if (choice === 'light' && canvas !== LIGHT_CANVAS) problems.push(`${tag}: Light paints ${canvas}, not ${LIGHT_CANVAS}`);
          const { out, checked } = await unreadable(page, 'main');
          if (checked === 0) problems.push(`${tag}: no text checked`);
          for (const line of out) problems.push(`${tag}: ${line}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test('B9: the owner finds "👥 Accounts" in Settings, with the switch off and its description, and turns it on and off (AC-1)', async ({ page }) => {
    const state = await mock(page, { who: OWNER_SESSION, settings: { signUp: { open: false } } });
    await page.goto(SETTINGS_PATH);
    await expect(page.getByRole('button', { name: ACCOUNTS_TAB, exact: true }), 'the tab is in the tab bar').toBeVisible({ timeout: 20000 });
    const box = page.getByRole('checkbox', { name: SWITCH_LABEL, exact: true });
    await expect(box).toBeVisible({ timeout: 10000 });
    await expect(box).not.toBeChecked();
    await expect(box).toBeEnabled();
    await expect(page.getByText(SWITCH_DESCRIPTION, { exact: true })).toBeVisible();
    await expect(page.getByText(OWNER_ONLY_NOTE, { exact: true }), 'the owner is not told they can\'t').toHaveCount(0);

    await box.click();
    await expect(box).toBeChecked({ timeout: 10000 });
    expect(state.puts, 'turning it on saves exactly { signUp: { open: true } }').toEqual([{ signUp: { open: true } }]);
    await expect(page.getByText('Settings saved')).toBeVisible();

    await box.click();
    await expect(box).not.toBeChecked({ timeout: 10000 });
    expect(state.puts[1], 'turning it off saves { signUp: { open: false } }').toEqual({ signUp: { open: false } });
  });

  test('B10: an admin sees the switch\'s state but cannot change it, and is told only the owner can (AC-1)', async ({ page }) => {
    const state = await mock(page, { who: ADMIN_SESSION, settings: { signUp: { open: true } } });
    await page.goto(SETTINGS_PATH);
    const box = page.getByRole('checkbox', { name: SWITCH_LABEL, exact: true });
    await expect(box).toBeVisible({ timeout: 20000 });
    await expect(box, 'it shows the instance\'s state').toBeChecked();
    await expect(box).toBeDisabled();
    await expect(page.getByText(OWNER_ONLY_NOTE, { exact: true })).toBeVisible();
    await box.click({ force: true, timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(500);
    expect(state.puts, 'an admin\'s click sends nothing').toEqual([]);
  });

  test('B11: when the server refuses a save, the switch goes back to the server\'s state and the error shows (AC-1)', async ({ page }) => {
    const state = await mock(page, {
      who: OWNER_SESSION, settings: { signUp: { open: false } },
      settingsPut: (route) => route.fulfill(json({ success: false, error: 'Only the owner can change open sign-up.' }, 403)),
    });
    await page.goto(SETTINGS_PATH);
    const box = page.getByRole('checkbox', { name: SWITCH_LABEL, exact: true });
    await expect(box).toBeVisible({ timeout: 20000 });
    await box.click();
    await expect(page.getByText('Only the owner can change open sign-up.')).toBeVisible({ timeout: 10000 });
    await expect(box).not.toBeChecked();
    expect(state.puts.length).toBe(1);
  });
});
