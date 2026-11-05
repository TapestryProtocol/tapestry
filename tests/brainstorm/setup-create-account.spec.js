const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * setup-create-account #1: the Create your account page — the browser class.
 *
 * Story: engineering-team/stories/setup-create-account/1-create-account-page.md
 * ADR:   engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md
 * Plan:  engineering-team/stories/setup-create-account/1-create-account-page.test-plan.md
 * Node half: test/setup-create-account.test.js (C/U/S/D).
 *
 * Every criterion is about what a visitor SEES or what the page SENDS, so they are settled here,
 * against the built UI.
 *
 *   B0  — the served origin runs a build that contains the page under test.                [prerequisite]
 *   B1  — signed out: heading, back link, what an account is, the sign-in button.           [AC-1]
 *   B2  — signing in with the page's button shows the visitor's own state, no reload.       [AC-1]
 *   B3  — while sign-in resolves: "Checking sign-in…", and no other state flashes.          [states table]
 *   B4  — done, for the owner, an admin, a customer and a guest who kept one.              [AC-2]
 *   B5  — done looks like /setup's done step.                                                [AC-2]
 *   B6  — done with no profile yet; and a failed profile check is never "no profile".       [AC-2]
 *   B7  — create: working state, one request, the editor, /setup and the pill updated.     [AC-3]
 *   B8  — create answered 409 (another tab won): on to the editor, no error.                [AC-3]
 *   B9  — create fails, then fails offline, then works: the reason, the button again.      [AC-3]
 *   B10 — a guest: ask the owner, named by profile, by npub, or not at all.                 [AC-4]
 *   B11 — an owner whose key is missing: restore it on the server, no button.               [AC-4]
 *   B12 — opening the page in any state sends nothing but reads.                            [AC-5]
 *   B13 — 375 px wide, long names included: no sideways scroll.                            [AC-6]
 *   B14 — Light and Dark: every state reads, and the page follows the choice.              [AC-6]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked; a catch-all answers `success: false`. WebSockets are closed. This
 * matters: `vite preview` proxies /api to :7778, which on the Mac Studio is a private instance.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test:
 *   `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then
 *   BRAINSTORM_BASE_URL=http://localhost:4173. A source-only edit is INVISIBLE here; B0 guards it.
 *   tests/global-setup.js sets BRAINSTORM_SERVER_ACCESSIBLE=true when the base URL answers.
 *
 * These FAIL against the current build: /setup/create-account is still the placeholder ("Placeholder
 * page."), with no state, no button and no owner.
 */

// Fixtures, never live keys.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const NEW_ASSISTANT = 'a3'.repeat(32);
const TA = 'ee'.repeat(32);
const OWNER = 'bb'.repeat(32);

const OWNER_DONE = { pubkey: OWNER, classification: 'owner', assistantPubkey: TA };
const ADMIN_DONE = { pubkey: VIEWER, classification: 'admin', assistantPubkey: ASSISTANT };
const CUSTOMER_DONE = { pubkey: VIEWER, classification: 'customer', assistantPubkey: ASSISTANT };
const GUEST_KEPT = { pubkey: VIEWER, classification: 'guest', assistantPubkey: ASSISTANT };
const ADMIN_NONE = { pubkey: VIEWER, classification: 'admin', assistantPubkey: null };
const CUSTOMER_NONE = { pubkey: VIEWER, classification: 'customer', assistantPubkey: null };
const GUEST_NONE = { pubkey: VIEWER, classification: 'guest', assistantPubkey: null };
const OWNER_MISSING = { pubkey: OWNER, classification: 'owner', assistantPubkey: null };

const PAGE_PATH = '/setup/create-account';
const EDITOR_PATH = '/assistant/profile/edit';
const HUB_PATH = '/assistant';

// The approved copy: setup-page-scaffold #1, setup-status-and-alert #1, and story 1 § Copy.
const HEADING = 'Create your account';
const BACK = '← Back to setup';
const STEP_TEXT = 'Your account comes with your own Tapestry Assistant: a nostr identity this instance holds for you, which signs and publishes on your behalf.';
const SIGNED_OUT_LINE = 'Sign in to see your account here, or to create it.';
const SIGN_IN = 'Sign in with nostr';
const CHECKING = 'Checking sign-in…';
const DONE_TEXT = 'This instance holds your Tapestry Assistant.';
const ASSISTANT_LABEL = 'Your Tapestry Assistant:';
const VIEW_PROFILE = 'View its profile';
const NO_PROFILE = 'It has no profile yet.';
const SET_UP_PROFILE = 'Set up its profile';
const MANAGE = 'Manage your Assistant';
const MAY_CREATE_LINE = "You don't have a Tapestry Assistant on this instance yet. Create one, and this instance will hold its key for you.";
const CREATE = 'Create my Tapestry Assistant';
const CREATING = 'Creating…';
const FAILED_PREFIX = "Your Tapestry Assistant couldn't be created: ";
const GUEST_LINE = "You don't have a Tapestry Assistant on this instance. This instance sets one up for its owner, its admins and its customers.";
const ASK_PREFIX = 'To become a customer here, ask the owner of this instance';
const OWNER_KEY_MISSING = "This instance's Tapestry Assistant key is missing. It is created when the instance is first set up and can't be created from this page; it has to be restored on the server.";
const PLACEHOLDER = 'Placeholder page.';

const KEY = 'tapestry_appearance';
const LIGHT_CANVAS = 'rgb(242, 243, 240)';
const WRITE_CYPHER = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;

const npub = (hex) => nip19.npubEncode(hex);
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const step = (done, pending) => ({ done, pending, finished: true });
const setupAnswer = (accountDone) => ({
  success: true,
  signedIn: true,
  steps: {
    account: step(accountDone, !accountDone),
    follow: { ...step(false, true), followCount: 0, source: null },
    activate: { ...step(false, true), otherProvider: false, source: null },
  },
});

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

/**
 * Mock every route. `who` is the session ({ pubkey, classification, assistantPubkey }) or null.
 *   signInAs        — who the session becomes after the page's own sign-in (B2).
 *   authGate        — a promise that holds /api/auth/status and user-classification (B3).
 *   profiles        — kind 0 content by pubkey; profilesFail answers /api/profiles with a 500.
 *   assistantStatus — 'set-up' | 'needs-setup' | 'error', the answer to /api/assistant/status.
 *   ownerKnown      — false answers /api/owner/pubkey with today's 404.
 *   provision       — (route, state) => fulfil POST /api/assistant/provision-key. The default
 *                     creates NEW_ASSISTANT. Set state.provisioned to make the "server" hold it.
 * Returns a live state: the session, what was provisioned, and logs of the requests that matter.
 */
async function mock(page, opts = {}) {
  const o = {
    who: null, signInAs: null, authGate: null, profiles: {}, profilesFail: false,
    assistantStatus: 'set-up', ownerKnown: true, provision: null, ...opts,
  };
  const state = {
    session: o.who ? { ...o.who } : null, provisioned: null, provisionCalls: 0,
    classificationCalls: 0, assistantStatusCalls: 0, ownerCalls: 0, statusCalls: [], nonGet: [],
  };
  const assistantOf = () => (state.session ? (state.provisioned || state.session.assistantPubkey) : null);

  page.on('request', (req) => {
    if (req.method() === 'GET' || req.method() === 'HEAD' || req.method() === 'OPTIONS') return;
    const url = new URL(req.url());
    if (url.pathname === '/api/neo4j/query') {
      let cypher = '';
      try { cypher = JSON.parse(req.postData() || '{}').cypher || ''; } catch { /* not JSON */ }
      if (cypher && !WRITE_CYPHER.test(cypher)) return; // a graph read served by POST
    }
    state.nonGet.push(`${req.method()} ${url.pathname}`);
  });

  // Catch-all FIRST: Playwright tries the most recently registered matching route first.
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by setup-create-account.spec.js' })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => {
    state.ownerCalls += 1;
    return r.fulfill(o.ownerKnown ? json({ success: true, pubkey: OWNER }) : json({ success: false, error: 'Owner pubkey not configured' }, 404));
  });
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => {
    if (o.profilesFail) return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    const pks = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const profiles = {};
    for (const pk of pks) profiles[pk] = o.profiles[pk] || null;
    return r.fulfill(json({ success: true, profiles }));
  });
  await page.route('**/api/auth/status', async (r) => {
    if (o.authGate) await o.authGate;
    return r.fulfill(json(state.session
      ? { authenticated: true, pubkey: state.session.pubkey }
      : { authenticated: false, pubkey: null }));
  });
  await page.route('**/api/auth/user-classification', async (r) => {
    state.classificationCalls += 1;
    if (o.authGate) await o.authGate;
    return r.fulfill(json(state.session
      ? { success: true, classification: state.session.classification, pubkey: state.session.pubkey, assistantPubkey: assistantOf() }
      : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
  });
  await page.route('**/api/auth/verify-user', (r) => r.fulfill(json({ authorized: true, challenge: 'c'.repeat(64) })));
  await page.route('**/api/auth/login-user', (r) => {
    state.session = o.signInAs ? { ...o.signInAs } : null;
    return r.fulfill(json({ success: true, pubkey: state.session && state.session.pubkey }));
  });
  await page.route('**/api/auth/logout', (r) => { state.session = null; return r.fulfill(json({ success: true })); });
  await page.route('**/api/assistant/status**', (r) => {
    state.assistantStatusCalls += 1;
    if (o.assistantStatus === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    const pk = assistantOf();
    return r.fulfill(json({
      success: true, hasRelayKey: !!pk, hasProfile: o.assistantStatus === 'set-up', assistantPubkey: pk,
      isOwner: !!(state.session && state.session.classification === 'owner'), profile: null,
    }));
  });
  await page.route('**/api/setup/status**', (r) => {
    state.statusCalls.push(assistantOf());
    if (!state.session) return r.fulfill(json({ success: true, signedIn: false }));
    return r.fulfill(json(setupAnswer(!!assistantOf())));
  });
  await page.route('**/api/assistant/provision-key', async (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    state.provisionCalls += 1;
    const handler = o.provision || ((route, s) => {
      s.provisioned = NEW_ASSISTANT;
      return route.fulfill(json({ success: true, pubkey: NEW_ASSISTANT, npub: npub(NEW_ASSISTANT) }));
    });
    try { return await handler(r, state); } catch { /* the page moved on */ return undefined; }
  });
  await page.routeWebSocket(/.*/, (ws) => ws.close());
  await page.addInitScript((pk) => {
    window.__signer = [];
    window.nostr = {
      getPublicKey: async () => { window.__signer.push('getPublicKey'); return pk; },
      signEvent: async (e) => { window.__signer.push(`signEvent:${e.kind}`); return { ...e, id: '0'.repeat(64), sig: '0'.repeat(128) }; },
    };
  }, (o.signInAs && o.signInAs.pubkey) || VIEWER);
  return state;
}

const main = (page) => page.locator('main').first();
const createButton = (scope) => scope.getByRole('button', { name: CREATE, exact: true });
const textOf = (locator) => locator.evaluate((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());

/** What only a FINISHED state shows — a test judges the page only once this is visible. */
function evidence(scope, kind) {
  switch (kind) {
    case 'signed-out': return scope.getByText(SIGNED_OUT_LINE, { exact: true });
    case 'done': return scope.getByText(DONE_TEXT, { exact: true });
    case 'may-create': return createButton(scope);
    case 'guest': return scope.getByText(GUEST_LINE, { exact: true });
    case 'owner-key-missing': return scope.getByText(OWNER_KEY_MISSING, { exact: true });
    default: throw new Error(`no evidence for ${kind}`);
  }
}

const STATES = [
  ['signed out', null, 'signed-out'],
  ['done (a customer)', CUSTOMER_DONE, 'done'],
  ['may create (an admin)', ADMIN_NONE, 'may-create'],
  ['may create (a customer)', CUSTOMER_NONE, 'may-create'],
  ['a guest', GUEST_NONE, 'guest'],
  ['an owner whose key is missing', OWNER_MISSING, 'owner-key-missing'],
];

/** Hard-load the page and wait for its finished state. */
async function open(page, kind) {
  await page.goto(PAGE_PATH);
  await page.getByRole('heading', { level: 1, name: HEADING }).waitFor({ timeout: 20000 });
  if (kind) await expect(evidence(main(page), kind)).toBeVisible({ timeout: 10000 });
  return main(page);
}

/** The text of the innermost element in `scope` whose text contains `needle`. */
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

/** Record, from now on, whether any text containing `needle` ever appears in the document. */
async function watchFor(page, needle) {
  await page.evaluate((n) => {
    window.__sawText = window.__sawText || {};
    window.__sawText[n] = (document.body.textContent || '').includes(n);
    new MutationObserver(() => {
      if ((document.body.textContent || '').includes(n)) window.__sawText[n] = true;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, needle);
}
const sawText = (page, needle) => page.evaluate((n) => !!(window.__sawText && window.__sawText[n]), needle);

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI? Run `cd ui && npm run build`.' };
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

/** Text in `rootSel` that reads below WCAG AA as rendered: 4.5:1 in a link or paragraph, else 3:1. */
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
    const out = [];
    let checked = 0;
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

/** The colour actually painted behind `main`: the nearest ancestor with an opaque background. */
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

test.describe('The Create your account page (setup-create-account #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build that contains the Create your account page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, SIGNED_OUT_LINE);
    expect(found,
      `the bundle served by ${baseURL} does not contain "${SIGNED_OUT_LINE}", the page's own signed-out line (${why}). ` +
      'Either the bundle predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run build` — ' +
      'or the page is not built yet, in which case B1–B14 say so directly.').toBe(true);
  });

  /* ───────── B1 — signed out ───────── */
  test('B1: a signed-out visitor sees the heading, the back link, what an account here is, and a sign-in button (AC-1)', async ({ page }) => {
    const state = await mock(page, { who: null });
    const m = await open(page);
    await expect(m.getByText(SIGNED_OUT_LINE, { exact: true }), 'the signed-out line 2 (story § Copy)').toBeVisible({ timeout: 10000 });
    await expect(m.getByRole('link', { name: BACK })).toHaveAttribute('href', '/setup');
    await expect(m.getByText(STEP_TEXT, { exact: true }), "step 1's approved sentence says what an account here is").toBeVisible();
    await expect(m.getByRole('button', { name: SIGN_IN, exact: true })).toBeVisible();
    await expect(m.getByText(PLACEHOLDER), 'the placeholder is gone').toHaveCount(0);
    await expect(createButton(m), 'a visitor is offered no create button').toHaveCount(0);
    expect(await textOf(m), 'a visitor sees no done state').not.toContain(DONE_TEXT);
    expect(state.provisionCalls).toBe(0);
  });

  /* ───────── B2 — signing in from the page ───────── */
  test("B2: signing in with the page's own button shows the visitor's own state without a reload (AC-1)", async ({ page }) => {
    const state = await mock(page, { who: null, signInAs: ADMIN_NONE });
    const m = await open(page, 'signed-out');
    await page.evaluate(() => { window.__noReload = 'kept'; });
    await m.getByRole('button', { name: SIGN_IN, exact: true }).click();
    await expect(createButton(m), 'signed in as an admin with no Assistant, the page offers the create button').toBeVisible({ timeout: 10000 });
    await expect(m.getByText(SIGNED_OUT_LINE, { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__noReload), 'the page must not reload to show the new state').toBe('kept');
    const signer = await page.evaluate(() => window.__signer);
    expect(signer, "the page's button ran the top bar's real sign-in").toEqual(expect.arrayContaining(['getPublicKey', 'signEvent:22242']));
    expect(state.provisionCalls, 'signing in creates nothing').toBe(0);
  });

  /* ───────── B3 — while sign-in resolves ───────── */
  test('B3: while sign-in resolves the page says "Checking sign-in…", and neither the signed-out nor any signed-in state flashes', async ({ page }) => {
    const gate = deferred();
    await mock(page, { who: ADMIN_NONE, authGate: gate.promise });
    await page.goto(PAGE_PATH);
    await page.getByRole('heading', { level: 1, name: HEADING }).waitFor({ timeout: 20000 });
    const seen = [];
    const until = Date.now() + 1500;
    while (Date.now() < until) {
      seen.push(await textOf(main(page)));
      await page.waitForTimeout(100);
    }
    expect(seen.some((t) => t.includes(CHECKING)), `"${CHECKING}" must show while sign-in resolves`).toBe(true);
    const leaked = seen.filter((t) => t.includes(SIGNED_OUT_LINE) || t.includes(CREATE) || t.includes(GUEST_LINE) || t.includes(DONE_TEXT) || t.includes(OWNER_KEY_MISSING));
    expect(leaked, 'no other state may show before sign-in has resolved').toHaveLength(0);
    gate.resolve();
    await expect(createButton(main(page)), 'once sign-in resolves, the admin is offered the button').toBeVisible({ timeout: 10000 });
    await expect(main(page).getByText(CHECKING, { exact: true })).toHaveCount(0);
  });

  /* ───────── B4 — done, for every role ───────── */
  for (const [label, who] of [['the owner (its Assistant is the instance TA)', OWNER_DONE], ['an admin', ADMIN_DONE], ['a customer', CUSTOMER_DONE], ['a guest who kept an Assistant', GUEST_KEPT]]) {
    test(`B4: done for ${label}: the done step, the Assistant's name, full npub and links, and no create button (AC-2)`, async ({ page }) => {
      const pk = who.assistantPubkey;
      const state = await mock(page, { who, profiles: { [pk]: { display_name: 'Ada Assistant', name: 'ada' } }, assistantStatus: 'set-up' });
      const m = await open(page, 'done');
      expect(await m.evaluate((el) => el.textContent), 'a screen reader hears "Done: " as on /setup').toContain('Done: ');
      await expect(m.getByText('Done', { exact: true }), 'the "Done" badge').toBeVisible();
      await expect(m).toContainText(ASSISTANT_LABEL);
      await expect(m, "the Assistant's profile name (display_name first)").toContainText('Ada Assistant', { timeout: 10000 });
      await expect(m, 'its npub in full').toContainText(npub(pk));
      await expect(m.getByRole('link', { name: VIEW_PROFILE, exact: true })).toHaveAttribute('href', `/user/${pk}`);
      await expect(m.getByRole('link', { name: MANAGE, exact: true })).toHaveAttribute('href', HUB_PATH);
      await expect.poll(() => state.assistantStatusCalls, { message: 'the profile check ran' }).toBeGreaterThan(0);
      await page.waitForTimeout(400);
      await expect(m.getByText(NO_PROFILE), 'it has a profile, so nothing says otherwise').toHaveCount(0);
      await expect(createButton(m), 'done: no button creates anything').toHaveCount(0);
      const inLink = await m.getByText(DONE_TEXT, { exact: true }).evaluate((el) => !!el.closest('a'));
      expect(inLink, 'the done step is not a link, as on /setup').toBe(false);
      expect(state.provisionCalls).toBe(0);
    });
  }

  /* ───────── B5 — the same done look as /setup ───────── */
  test("B5: the done step looks like /setup's done step: the same ✓ marker and \"Done\" badge (AC-2)", async ({ page }) => {
    await mock(page, { who: CUSTOMER_DONE });
    const style = (loc) => loc.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, background: s.backgroundColor, radius: s.borderRadius, size: s.fontSize, weight: s.fontWeight };
    });
    await page.goto('/setup');
    const setupMain = main(page);
    await expect(setupMain.getByText(DONE_TEXT, { exact: true })).toBeVisible({ timeout: 20000 });
    const setupBadge = await style(setupMain.getByText('Done', { exact: true }).first());
    const setupMark = await style(setupMain.getByText('✓', { exact: true }).first());

    const m = await open(page, 'done');
    const badge = await style(m.getByText('Done', { exact: true }).first());
    const mark = await style(m.getByText('✓', { exact: true }).first());
    expect(badge, 'the "Done" badge is painted as on /setup').toEqual(setupBadge);
    expect(mark, 'the ✓ marker is painted as on /setup').toEqual(setupMark);
  });

  /* ───────── B6 — done with no profile, and a failed check ───────── */
  test('B6: done with no profile yet: it says so and links to the editor, with no name and no "undefined" (AC-2)', async ({ page }) => {
    await mock(page, { who: ADMIN_DONE, profiles: {}, assistantStatus: 'needs-setup' });
    const m = await open(page, 'done');
    await expect(m.getByText(NO_PROFILE, { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(m.getByRole('link', { name: SET_UP_PROFILE, exact: true })).toHaveAttribute('href', EDITOR_PATH);
    await expect(m).toContainText(npub(ASSISTANT));
    const text = await textOf(m);
    expect(text).not.toMatch(/\bundefined\b|\bnull\b/);
  });

  test('B6: when the profile check fails, the page never claims there is no profile, and still shows the Assistant (AC-2)', async ({ page }) => {
    const state = await mock(page, { who: ADMIN_DONE, profilesFail: true, assistantStatus: 'error' });
    const m = await open(page, 'done');
    await expect.poll(() => state.assistantStatusCalls, { message: 'the profile check ran (and failed)' }).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    await expect(m.getByText(NO_PROFILE), 'an error is never "no profile"').toHaveCount(0);
    await expect(m.getByRole('link', { name: SET_UP_PROFILE, exact: true })).toHaveCount(0);
    await expect(m).toContainText(npub(ASSISTANT));
    await expect(m.getByRole('link', { name: VIEW_PROFILE, exact: true })).toHaveAttribute('href', `/user/${ASSISTANT}`);
    expect(await textOf(m)).not.toMatch(/\bundefined\b|\bnull\b/);
  });

  /* ───────── B7 — create ───────── */
  test('B7: an admin presses the button: it works once, lands on the editor, and /setup, the Setup Alert and this page all update without a reload (AC-3)', async ({ page }) => {
    const release = deferred();
    const state = await mock(page, {
      who: ADMIN_NONE,
      provision: async (route, s) => {
        await release.promise;
        s.provisioned = NEW_ASSISTANT;
        return route.fulfill(json({ success: true, pubkey: NEW_ASSISTANT, npub: npub(NEW_ASSISTANT) }));
      },
    });
    const m = await open(page, 'may-create');
    await expect(m.getByText(MAY_CREATE_LINE, { exact: true })).toBeVisible();
    await page.evaluate(() => { window.__noReload = 'kept'; });

    await createButton(m).click();
    const working = m.getByRole('button', { name: CREATING, exact: true });
    await expect(working, 'while it works, the button says so').toBeVisible();
    await expect(working, '…and cannot be pressed again').toBeDisabled();
    await working.click({ force: true, timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(300);
    expect(state.provisionCalls, 'one press, one request').toBe(1);
    const classificationsBefore = state.classificationCalls;

    release.resolve();
    await expect(page, 'on success the person lands on the Edit Assistant Profile page').toHaveURL(new RegExp(`${EDITOR_PATH}$`), { timeout: 10000 });
    expect(await page.evaluate(() => window.__noReload), 'no reload on the way').toBe('kept');
    expect(state.classificationCalls, 'the app re-read who the person is after creating the Assistant').toBeGreaterThan(classificationsBefore);
    await expect(page.getByRole('link', { name: /2 steps left/ }), 'the Setup Alert counts one step fewer').toBeVisible({ timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${PAGE_PATH}$`));
    await expect(evidence(main(page), 'done'), 'back on the page, step 1 is done').toBeVisible({ timeout: 10000 });
    await expect(main(page), "and it shows the new Assistant's npub").toContainText(npub(NEW_ASSISTANT));
    await expect(createButton(main(page))).toHaveCount(0);

    await page.evaluate(() => { window.history.pushState({}, '', '/setup'); window.dispatchEvent(new PopStateEvent('popstate')); });
    const setupMain = main(page);
    await expect(setupMain.getByText(DONE_TEXT, { exact: true }), '/setup shows step 1 done').toBeVisible({ timeout: 10000 });
    expect(await setupMain.getByText(DONE_TEXT, { exact: true }).evaluate((el) => !!el.closest('a'))).toBe(false);
    expect(await page.evaluate(() => window.__noReload), 'still no reload').toBe('kept');
    expect(state.provisionCalls, 'still exactly one create request').toBe(1);
  });

  test('B7: an active customer with no Assistant gets the same button, and lands on the editor (AC-3)', async ({ page }) => {
    const state = await mock(page, { who: CUSTOMER_NONE });
    const m = await open(page, 'may-create');
    await createButton(m).click();
    await expect(page).toHaveURL(new RegExp(`${EDITOR_PATH}$`), { timeout: 10000 });
    expect(state.provisionCalls).toBe(1);
  });

  /* ───────── B8 — 409: another tab won ───────── */
  test('B8: when the server answers 409 because another tab already created it, the person goes on to the editor and sees no error (AC-3)', async ({ page }) => {
    const state = await mock(page, {
      who: ADMIN_NONE,
      provision: (route, s) => {
        s.provisioned = NEW_ASSISTANT;
        return route.fulfill(json({ success: false, error: 'Assistant key already exists for this user', pubkey: NEW_ASSISTANT, npub: npub(NEW_ASSISTANT) }, 409));
      },
    });
    const m = await open(page, 'may-create');
    await watchFor(page, FAILED_PREFIX.trim());
    await createButton(m).click();
    await expect(page).toHaveURL(new RegExp(`${EDITOR_PATH}$`), { timeout: 10000 });
    expect(await sawText(page, FAILED_PREFIX.trim()), 'a 409 is not a failure: the person now holds exactly one Assistant').toBe(false);
    await page.goBack();
    await expect(evidence(main(page), 'done')).toBeVisible({ timeout: 10000 });
    await expect(main(page)).toContainText(npub(NEW_ASSISTANT));
    expect(state.provisionCalls).toBe(1);
  });

  /* ───────── B9 — failures ───────── */
  test('B9: a failed create says why and offers the button again; offline too; then a retry works (AC-3)', async ({ page }) => {
    const answers = [
      (route) => route.fulfill(json({ success: false, error: 'disk full' }, 500)),
      (route) => route.abort('failed'),
      (route, s) => { s.provisioned = NEW_ASSISTANT; return route.fulfill(json({ success: true, pubkey: NEW_ASSISTANT, npub: npub(NEW_ASSISTANT) })); },
    ];
    const state = await mock(page, { who: ADMIN_NONE, provision: (route, s) => answers.shift()(route, s) });
    const m = await open(page, 'may-create');

    await createButton(m).click();
    const alert = m.getByRole('alert');
    await expect(alert, "the server's reason, after the approved prefix").toHaveText(`${FAILED_PREFIX}disk full`, { timeout: 10000 });
    await expect(createButton(m), 'the button is offered again').toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`${PAGE_PATH}$`));
    expect(state.provisioned, 'nothing was created').toBe(null);

    await createButton(m).click();
    await expect(alert).toHaveText(new RegExp(`^${FAILED_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S`), { timeout: 10000 });
    await expect(createButton(m)).toBeEnabled();

    await createButton(m).click();
    await expect(page).toHaveURL(new RegExp(`${EDITOR_PATH}$`), { timeout: 10000 });
    expect(state.provisionCalls).toBe(3);
  });

  /* ───────── B10 — a guest ───────── */
  test("B10: a guest is told who gets accounts and to ask the owner, named by their profile and linked (AC-4)", async ({ page }) => {
    const state = await mock(page, { who: GUEST_NONE, profiles: { [OWNER]: { display_name: 'Olive Owner', name: 'olive' } } });
    const m = await open(page, 'guest');
    await expect(m.getByRole('link', { name: 'Olive Owner', exact: true })).toHaveAttribute('href', `/user/${OWNER}`, { timeout: 10000 });
    expect(await innermostText(m, ASK_PREFIX)).toBe(`${ASK_PREFIX}: Olive Owner.`);
    await expect(createButton(m), 'a guest is offered no button').toHaveCount(0);
    await expect(m.getByRole('button', { name: /sign up/i }), 'open sign-up is story 2').toHaveCount(0);
    expect(state.provisionCalls).toBe(0);
  });

  test('B10: an owner with no profile is named by their full npub, still linked (AC-4)', async ({ page }) => {
    await mock(page, { who: GUEST_NONE, profiles: {} });
    const m = await open(page, 'guest');
    await expect(m.getByRole('link', { name: npub(OWNER), exact: true })).toHaveAttribute('href', `/user/${OWNER}`, { timeout: 10000 });
    expect(await innermostText(m, ASK_PREFIX)).toBe(`${ASK_PREFIX}: ${npub(OWNER)}.`);
  });

  test('B10: when the owner is unknown, the line still asks the owner, with no name and no link (AC-4)', async ({ page }) => {
    const state = await mock(page, { who: GUEST_NONE, ownerKnown: false });
    const m = await open(page, 'guest');
    await expect.poll(() => state.ownerCalls, { message: 'the owner lookup ran (and found none)' }).toBeGreaterThan(0);
    await expect.poll(() => innermostText(m, ASK_PREFIX), { timeout: 10000 }).toBe(`${ASK_PREFIX}.`);
    await expect(m.locator('a[href^="/user/"]'), 'no owner link').toHaveCount(0);
    expect(await textOf(m)).not.toMatch(/\bundefined\b|\bnull\b/);
  });

  /* ───────── B11 — the owner, key missing ───────── */
  test('B11: an owner whose Assistant key is missing is told to restore it on the server, and offered no button (AC-4)', async ({ page }) => {
    const state = await mock(page, { who: OWNER_MISSING });
    const m = await open(page, 'owner-key-missing');
    await expect(createButton(m)).toHaveCount(0);
    await expect(m.getByText(GUEST_LINE, { exact: true })).toHaveCount(0);
    await expect(m.getByText(ASK_PREFIX)).toHaveCount(0);
    expect(state.provisionCalls).toBe(0);
  });

  /* ───────── B12 — read-only until the press ───────── */
  test('B12: opening the page, in every state, sends nothing but reads (AC-5)', async ({ page }) => {
    test.setTimeout(120000);
    const problems = [];
    for (const [label, who, kind] of STATES) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const state = await mock(page, { who });
      await open(page, kind); // the path under test ran: its finished state is on screen
      await page.waitForTimeout(1000);
      if (state.nonGet.length) problems.push(`${label}: ${state.nonGet.join(', ')}`);
      if (state.provisionCalls) problems.push(`${label}: ${state.provisionCalls} create request(s)`);
    }
    expect(problems, 'nothing may be created, signed, stored or published until the button is pressed').toEqual([]);
  });

  /* ───────── B13 — 375 px ───────── */
  test('B13: at 375 px wide, every state reads without sideways scrolling, long names included (AC-6)', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 375, height: 812 });
    const long = 'Ada the Assistant of the Uncommonly Long Display Name Society';
    const problems = [];
    for (const [label, who, kind] of STATES) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who, profiles: { [ASSISTANT]: { display_name: long }, [OWNER]: { display_name: `Olive ${long}` } } });
      await open(page, kind);
      await page.waitForTimeout(500);
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      if (scroll > client) problems.push(`${label}: the page is ${scroll} px wide in a ${client} px window`);
    }
    // The guest whose owner has no profile shows the owner's full npub inline: the longest unbroken string.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: GUEST_NONE, profiles: {} });
    await open(page, 'guest');
    await expect(main(page)).toContainText(npub(OWNER), { timeout: 10000 });
    const npubWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (npubWidth.scroll > npubWidth.client) problems.push(`a guest, owner shown by npub: ${npubWidth.scroll} px wide`);
    expect(problems).toEqual([]);
  });

  /* ───────── B14 — Light and Dark ───────── */
  for (const choice of ['light', 'dark']) {
    test(`B14: chosen ${choice}, every state follows the choice and every line reads at WCAG AA (AC-6)`, async ({ page }) => {
      test.setTimeout(150000);
      await page.context().addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } }, [KEY, choice]);
      await page.emulateMedia({ colorScheme: choice === 'light' ? 'dark' : 'light' }); // the choice must beat the computer's
      const problems = [];
      const states = [...STATES, ['done, no profile yet', ADMIN_DONE, 'done', { assistantStatus: 'needs-setup' }]];
      for (const [label, who, kind, extra = {}] of states) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await mock(page, { who, profiles: { [ASSISTANT]: { display_name: 'Ada Assistant' }, [OWNER]: { display_name: 'Olive Owner' } }, ...extra });
        await open(page, kind);
        await page.waitForTimeout(700);
        const canvas = await canvasBehindMain(page);
        if (choice === 'light' && canvas !== LIGHT_CANVAS) problems.push(`${label}: Light paints ${canvas} behind the page, not the light canvas ${LIGHT_CANVAS}`);
        if (choice === 'dark') {
          const lum = await page.evaluate((c) => { const p = c.match(/\d+(\.\d+)?/g).map(Number); const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); }, canvas);
          if (lum > 0.2) problems.push(`${label}: Dark paints a light ${canvas} behind the page`);
        }
        const { out, checked } = await unreadable(page, 'main');
        if (checked === 0) problems.push(`${label}: no text was checked`);
        for (const line of out) problems.push(`${label}: ${line}`);
      }
      expect(problems).toEqual([]);
    });
  }
});
