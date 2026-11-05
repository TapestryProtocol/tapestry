'use strict';
/**
 * setup-create-account #2: open sign-up, the owner's choice — the Node half.
 *
 * Story: engineering-team/stories/setup-create-account/2-open-sign-up.md
 * ADR:   engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md
 * Plan:  engineering-team/stories/setup-create-account/2-open-sign-up.test-plan.md
 * Browser half: tests/brainstorm/setup-open-sign-up.spec.js (B-class — what a guest and the owner SEE).
 *
 * Classes:
 *   C — the page's state rule (two new rows) and the story's copy, loaded in Node as ESM.
 *   G — the switch: settings key signUp.open, false by default, owner-only on update and reset, validated.
 *       Driven through test/helpers/accessHarness.js (mode 'handlers') in a CHILD process, so the owner and the
 *       admins come from the REAL checks (a temp brainstorm.conf and a temp settings file), and nothing under /etc or
 *       /var/lib is read or written.
 *   A — the endpoint's access rule (routeAccess.js), pure.
 *   H — the sign-up handler through ADR 0002's deps seam, createSignUpHandler({ getSettings, getConfigFromFile,
 *       isAdminPubkey, customerManagerFactory, provisionAssistantKeyOnce }). A REAL CustomerManager on a temp
 *       directory where a test needs real records (AC-4, the race); fakes elsewhere. No key is generated or stored.
 *   K — the guest's sign-in answer (signUpOpen, customerStatus), with the handler's modules stubbed in require.cache.
 *   S — deactivating a customer (ADR 0002 Amendment 2): POST /api/change-customer-status's handler through its deps
 *       seam, createChangeCustomerStatusHandler({ getOwnerPubkey, isAdminPubkey, customerManagerFactory }), on the
 *       same REAL temp-folder store as a guest who signed up through the sign-up handler.
 *   D — source sentinels for the wiring this runner can't execute: AuthContext, the Settings tab and route, the API
 *       docs, no createSingleCustomerRelay on the sign-up path, and no session.userPubkey read in the status handler.
 *
 * Amendment 2's tests (S1–S5, H13–H15, D5, D6) came after the first review. H14 and H15 guard code that was already
 * right, so they pass on it; the rest fail until Amendment 2 is built.
 *
 * Everything here FAILS against the current code except the regressions marked (regression): there is no signUp
 * key, no owner-only guard for it, no createSignUpHandler, no new classification fields, no states or copy for it,
 * and no Accounts tab.
 *
 * Nothing here publishes, signs, writes a key or reaches a stack. Safe to run anywhere.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const NL = String.fromCharCode(10);
const STATE = path.join(REPO, 'ui/src/pages/setup/createAccountState.js');
const COPY = path.join(REPO, 'ui/src/pages/setup/createAccountCopy.js');
const DEFAULTS = path.join(REPO, 'src/config/defaults.json');
const ROUTE_ACCESS = path.join(REPO, 'src/middleware/routeAccess.js');
const SIGN_UP = path.join(REPO, 'src/api/auth/signUpNewCustomer.js');
const CLASSIFY = path.join(REPO, 'src/api/auth/getUserClassification.js');
const AUTH_CONTEXT = path.join(REPO, 'ui/src/context/AuthContext.jsx');
const SETTINGS_INDEX = path.join(REPO, 'ui/src/pages/settings/Index.jsx');
const ACCOUNT_SETTINGS = path.join(REPO, 'ui/src/pages/settings/AccountSettings.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const HARNESS = path.join(REPO, 'test/helpers/accessHarness.js');
const CUSTOMER_MANAGER = path.join(REPO, 'src/utils/customerManager.js');
const CHANGE_STATUS = path.join(REPO, 'src/api/customers/changeCustomerStatus.js');
const CUSTOMERS_INDEX = path.join(REPO, 'src/api/customers/index.js');

// Fixture keys, never live ones.
const GUEST = 'c1'.repeat(32);
const GUEST2 = 'c3'.repeat(32);
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const INACTIVE = 'c2'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href + `?t=${Date.now()}`); } catch (err) { return { __loadError: err }; }
}

/* ───────────────────────── C — the state rule and the copy ───────────────────────── */

async function stateRule() {
  const mod = await loadEsm(STATE);
  assert(!mod.__loadError && typeof mod.createAccountState === 'function',
    `createAccountState.js must load and export createAccountState: ${mod.__loadError && mod.__loadError.message}`);
  return mod.createAccountState;
}
const guest = (extra = {}) => ({ pubkey: GUEST, classification: 'guest', assistantPubkey: null, ...extra });

test('C1: a guest whose customer record is not active is "deactivated", whatever the switch says (ADR 0002 § 4 row 6)', async () => {
  const rule = await stateRule();
  const wrong = [];
  for (const [label, u, want] of [
    ['inactive, sign-up open', guest({ customerStatus: 'inactive', signUpOpen: true }), 'deactivated'],
    ['inactive, sign-up closed', guest({ customerStatus: 'inactive', signUpOpen: false }), 'deactivated'],
    ['some other non-active status', guest({ customerStatus: 'suspended', signUpOpen: true }), 'deactivated'],
  ]) {
    const got = rule(u, false);
    if (got !== want) wrong.push(`${label}: expected ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join(NL));
});

test('C2: a guest with no record is "may-sign-up" only when signUpOpen is exactly true; otherwise "guest" (rows 7-8)', async () => {
  const rule = await stateRule();
  const wrong = [];
  for (const [label, u, want] of [
    ['open', guest({ signUpOpen: true, customerStatus: null }), 'may-sign-up'],
    ['closed', guest({ signUpOpen: false, customerStatus: null }), 'guest'],
    ['fields absent (story 1 sign-in answers)', guest(), 'guest'],
    ['"true" as a string', guest({ signUpOpen: 'true' }), 'guest'],
    ['customerStatus "active" on a guest (inconsistent) is not deactivated', guest({ customerStatus: 'active', signUpOpen: true }), 'may-sign-up'],
  ]) {
    const got = rule(u, false);
    if (got !== want) wrong.push(`${label}: expected ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join(NL));
});

test('C3: story 1\'s rows still come first — holding an Assistant is "done" even for a deactivated customer (regression)', async () => {
  const rule = await stateRule();
  const wrong = [];
  for (const [label, u, loading, want] of [
    ['checking', guest({ signUpOpen: true }), true, 'checking'],
    ['signed out', null, false, 'signed-out'],
    ['deactivated but kept an Assistant', guest({ customerStatus: 'inactive', assistantPubkey: ASSISTANT }), false, 'done'],
    ['an admin with no Assistant, sign-up open', { pubkey: ADMIN, classification: 'admin', assistantPubkey: null, signUpOpen: true }, false, 'may-create'],
    ['an owner with no key', { pubkey: OWNER, classification: 'owner', assistantPubkey: null, signUpOpen: true }, false, 'owner-key-missing'],
  ]) {
    const got = rule(u, loading);
    if (got !== want) wrong.push(`${label}: expected ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join(NL));
});

function stringsIn(value, out = [], depth = 0) {
  if (depth > 4 || value == null) return out;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out, depth + 1));
  else if (typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out, depth + 1));
  return out;
}

test('C4: createAccountCopy.js holds story 2\'s page strings word for word', async () => {
  const mod = await loadEsm(COPY);
  assert(!mod.__loadError, `createAccountCopy.js must load: ${mod.__loadError && mod.__loadError.message}`);
  const all = stringsIn(Object.fromEntries(Object.entries(mod)));
  const exact = [
    "You don't have an account on this instance yet.",
    'Sign up as a customer, and this instance will create your Tapestry Assistant and hold its key for you.',
    'Sign up',
    'Signing up…',
  ];
  const missing = exact.filter((s) => !all.includes(s));
  const prefixes = [
    "You couldn't be signed up",
    'Your customer account here is inactive. To use it again, ask the owner of this instance',
  ].filter((p) => !all.some((s) => s.startsWith(p)));
  assert(missing.length === 0 && prefixes.length === 0,
    `missing from createAccountCopy.js:${NL}  ${[...missing, ...prefixes.map((p) => `${p}…`)].map(show).join(`${NL}  `)}`);
});

/* ───────────────────────── G — the switch ───────────────────────── */

test('G1: defaults.json ships signUp.open = false, so every instance starts closed (AC-1, AC-6)', async () => {
  let d = null;
  try { d = JSON.parse(safeRead(DEFAULTS)); } catch (e) { throw new Error(`src/config/defaults.json must parse: ${e.message}`); }
  assert(d && d.signUp && d.signUp.open === false,
    `src/config/defaults.json must hold "signUp": { "open": false }; it holds signUp = ${show(d && d.signUp)}`);
});

let GRUN = null;
function guardRun() {
  if (GRUN) return GRUN;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-sign-up-guard-'));
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"${NL}`);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));
  const seed = { adminPubkeys: [ADMIN] };
  const seedOpen = { adminPubkeys: [ADMIN], signUp: { open: true } };
  const spec = {
    mode: 'handlers',
    callers: {
      owner: { session: { authenticated: true, pubkey: OWNER } },
      admin: { session: { authenticated: true, pubkey: ADMIN } },
      local: { session: null, localTrusted: true },
    },
    customers: [],
    scenarios: [
      { id: 'owner-opens', kind: 'settings-update', caller: 'owner', seedSettings: seed, body: { signUp: { open: true } } },
      { id: 'admin-opens', kind: 'settings-update', caller: 'admin', seedSettings: seed, body: { signUp: { open: true } } },
      { id: 'local-opens', kind: 'settings-update', caller: 'local', seedSettings: seed, body: { signUp: { open: true } } },
      { id: 'admin-mixed', kind: 'settings-update', caller: 'admin', seedSettings: seed, body: { signUp: { open: true }, search: { x: 1 } } },
      { id: 'admin-reset-key', kind: 'settings-reset', caller: 'admin', seedSettings: seedOpen, params: { keyPath: 'signUp' } },
      { id: 'admin-reset-leaf', kind: 'settings-reset', caller: 'admin', seedSettings: seedOpen, params: { keyPath: 'signUp.open' } },
      { id: 'owner-reset-leaf', kind: 'settings-reset', caller: 'owner', seedSettings: seedOpen, params: { keyPath: 'signUp.open' } },
      { id: 'bad-string', kind: 'settings-update', caller: 'owner', seedSettings: seed, body: { signUp: { open: 'yes' } } },
      { id: 'bad-extra-key', kind: 'settings-update', caller: 'owner', seedSettings: seed, body: { signUp: { open: true, cap: 5 } } },
      { id: 'bad-not-object', kind: 'settings-update', caller: 'owner', seedSettings: seed, body: { signUp: true } },
      { id: 'adminlist-admin', kind: 'settings-update', caller: 'admin', seedSettings: seed, body: { adminPubkeys: [ADMIN, OWNER] } },
      { id: 'other-admin', kind: 'settings-update', caller: 'admin', seedSettings: seed, body: { aRelays: { aProfileRelays: ['wss://relay.example'] } } },
    ],
    timeoutMs: 60000,
  };
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const env = { ...process.env, TAPESTRY_SETTINGS_PATH: settings, BRAINSTORM_CONF_PATH: conf, BRAINSTORM_BASE_DIR: dir };
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { cwd: REPO, env, encoding: 'utf8', timeout: 90000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by the tests */ }
  const byId = new Map();
  if (data) for (const r of data.results) byId.set(r.id, r);
  GRUN = { child, data, byId };
  return GRUN;
}
function g(id) {
  const run = guardRun();
  const r = run.byId.get(id);
  assert(r, `no harness result for ${id} (harness error: ${run.data && run.data.error}; stderr: ${String(run.child.stderr || '').slice(0, 300)})`);
  return r;
}
const parseSettings = (s) => { try { return JSON.parse(s); } catch { return null; } };
const openIn = (s) => { const p = parseSettings(s); return p && p.signUp ? p.signUp.open : undefined; };

test('G2: the owner turns open sign-up on; the setting is saved to the override file (AC-1)', async () => {
  const r = g('owner-opens');
  assert(r.status === 200 && r.body && r.body.success === true, `the owner must be able to save signUp.open; got ${r.status} ${show(r.body)}`);
  assert(openIn(r.settingsAfter) === true, `the override file must hold signUp.open = true after the owner's save; it holds ${r.settingsAfter}`);
  assert(r.body.settings && r.body.settings.signUp && r.body.settings.signUp.open === true, 'the answer\'s merged settings must show it on');
});

test('G3: an admin is refused on update — alone or mixed with other keys — and the file does not change (AC-1)', async () => {
  for (const id of ['admin-opens', 'admin-mixed']) {
    const r = g(id);
    assert(r.status === 403, `${id}: an admin changing signUp must get 403; got ${r.status} ${show(r.body)}`);
    assert(r.body && r.body.error === 'Only the owner can change open sign-up.',
      `${id}: the refusal must read "Only the owner can change open sign-up."; got ${show(r.body && r.body.error)}`);
    assert(r.settingsAfter === r.settingsBefore, `${id}: the settings file must be unchanged after a refusal`);
  }
});

test('G4: an admin is refused on reset of signUp or signUp.open; the owner may reset it (AC-1)', async () => {
  for (const id of ['admin-reset-key', 'admin-reset-leaf']) {
    const r = g(id);
    assert(r.status === 403 && r.body && r.body.error === 'Only the owner can change open sign-up.',
      `${id}: an admin resetting signUp must get 403 "Only the owner can change open sign-up."; got ${r.status} ${show(r.body)}`);
    assert(r.settingsAfter === r.settingsBefore, `${id}: the settings file must be unchanged`);
  }
  const o = g('owner-reset-leaf');
  assert(o.status === 200 && o.body && o.body.success === true, `the owner must be able to reset signUp.open; got ${o.status} ${show(o.body)}`);
  assert(openIn(o.settingsAfter) !== true, `after the owner's reset the override must no longer hold open = true; it holds ${o.settingsAfter}`);
});

test('G5: a direct-local caller (the trusted operator on the box) may change it, as with the admin list (ADR 0002 § 1)', async () => {
  const r = g('local-opens');
  assert(r.status === 200 && openIn(r.settingsAfter) === true, `a direct-local caller must be allowed; got ${r.status} ${show(r.body)}`);
});

test('G6: a malformed signUp patch is a 400 and changes nothing: a non-boolean, an extra key, a non-object (ADR 0002 § 1)', async () => {
  for (const id of ['bad-string', 'bad-extra-key', 'bad-not-object']) {
    const r = g(id);
    assert(r.status === 400 && r.body && r.body.success === false, `${id}: expected 400; got ${r.status} ${show(r.body)}`);
    assert(r.settingsAfter === r.settingsBefore, `${id}: the settings file must be unchanged`);
  }
});

test('G7: the admin list keeps its owner-only rule and its words, and an admin may still change other settings (regression)', async () => {
  const a = g('adminlist-admin');
  assert(a.status === 403 && a.body && a.body.error === 'Only the owner can change the admin list.',
    `the admin list's refusal must be unchanged; got ${a.status} ${show(a.body)}`);
  const o = g('other-admin');
  assert(o.status === 200, `an admin must still change a setting that isn't owner-only; got ${o.status} ${show(o.body)}`);
});

/* ───────────────────────── A — the endpoint's access rule ───────────────────────── */

test('A1: POST /api/auth/sign-up-new-customer is open to signed-in callers; the handler holds the switch (ADR 0002 § 3)', async () => {
  delete require.cache[require.resolve(ROUTE_ACCESS)];
  const { resolveRouteAccess, ROUTE_ACCESS: TABLE } = require(ROUTE_ACCESS);
  const access = resolveRouteAccess('POST', '/api/auth/sign-up-new-customer');
  assert(access === 'signed-in', `the route must resolve to 'signed-in' (a guest must reach the handler); got ${show(access)}`);
  const entry = TABLE['POST /api/auth/sign-up-new-customer'];
  assert(entry && /open sign-up/i.test(String(entry.why || '')),
    `the route's "why" must say the handler admits a guest only while open sign-up is on; got ${show(entry && entry.why)}`);
});

/* ───────────────────────── H — the handler ───────────────────────── */

function signUpModule() {
  delete require.cache[require.resolve(SIGN_UP)];
  let mod;
  try { mod = require(SIGN_UP); } catch (e) { throw new Error(`src/api/auth/signUpNewCustomer.js must load: ${e.message}`); }
  assert(typeof mod.createSignUpHandler === 'function',
    `signUpNewCustomer.js must export createSignUpHandler(deps) (ADR 0002 Implementation notes); exports: ${show(Object.keys(mod))}`);
  assert(typeof mod.handleSignUpNewCustomer === 'function', 'signUpNewCustomer.js must still export handleSignUpNewCustomer');
  return mod;
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const sessionFor = (pubkey) => ({ session: { authenticated: true, pubkey } });

/** A fake customer store: records by pubkey. `onCreate` may throw to simulate a race. */
function fakeManager(records = {}, { onCreate } = {}) {
  const calls = { created: [], factory: 0 };
  const store = { ...records };
  const factory = () => {
    calls.factory += 1;
    return {
      initialize: async () => {},
      getCustomer: async (pk) => store[pk] || null,
      getAllCustomers: async () => ({ customers: Object.fromEntries(Object.values(store).map((c) => [c.name, c])) }),
      createCustomer: async (data) => {
        calls.created.push(data);
        if (onCreate) await onCreate(data, store);
        if (store[data.pubkey]) throw new Error(`Customer with pubkey '${data.pubkey}' already exists`);
        const rec = { id: Object.keys(store).length, status: 'active', ...data };
        store[data.pubkey] = rec;
        return rec;
      },
    };
  };
  return { factory, calls, store };
}

function fakeProvision({ fail = false, existing = null } = {}) {
  const calls = [];
  const fn = async (pk) => {
    calls.push(pk);
    if (fail) throw new Error('fixture key store unavailable');
    if (existing) return { created: false, existing };
    return { created: true, keys: { pubkey: ASSISTANT, npub: 'npub1fixtureassistant' } };
  };
  return { fn, calls };
}

function makeHandler({ settings = { signUp: { open: true } }, manager, provision } = {}) {
  const { createSignUpHandler } = signUpModule();
  return createSignUpHandler({
    getSettings: () => settings,
    getConfigFromFile: (k) => (k === 'BRAINSTORM_OWNER_PUBKEY' ? OWNER : undefined),
    isAdminPubkey: (pk) => pk === ADMIN,
    customerManagerFactory: manager.factory,
    provisionAssistantKeyOnce: provision.fn,
  });
}

const allAnswers = [];
async function call(handler, req) {
  const res = fakeRes();
  await handler({ method: 'POST', path: '/api/auth/sign-up-new-customer', headers: {}, body: {}, ...req }, res);
  allAnswers.push({ status: res.statusCode, body: res.body });
  return res;
}

test('H1: while the switch is not exactly true, every sign-up is refused 403 sign-up-closed and nothing is created (AC-2)', async () => {
  for (const [open, settings] of [[false, { signUp: { open: false } }], ['no signUp key', {}], ['"true"', { signUp: { open: 'true' } }], [1, { signUp: { open: 1 } }]]) {
    const manager = fakeManager();
    const provision = fakeProvision();
    const res = await call(makeHandler({ settings, manager, provision }), sessionFor(GUEST));
    assert(res.body !== undefined, `open=${show(open)}: the handler must answer (the path ran)`);
    assert(res.statusCode === 403 && res.body.code === 'sign-up-closed',
      `open=${show(open)}: expected 403 code "sign-up-closed"; got ${res.statusCode} ${show(res.body)}`);
    assert(res.body.error === 'Open sign-up is off on this instance.' || res.body.message === 'Open sign-up is off on this instance.',
      `open=${show(open)}: the reason must read "Open sign-up is off on this instance."; got ${show(res.body)}`);
    assert(manager.calls.created.length === 0 && provision.calls.length === 0,
      `open=${show(open)}: nothing may be created (customers ${manager.calls.created.length}, keys ${provision.calls.length})`);
  }
});

test('H2: with no authenticated session the handler itself answers 401 and creates nothing (AC-5, defence behind the middleware)', async () => {
  for (const [label, req] of [['no session', {}], ['not authenticated', { session: { pubkey: GUEST } }]]) {
    const manager = fakeManager();
    const provision = fakeProvision();
    const res = await call(makeHandler({ manager, provision }), req);
    assert(res.statusCode === 401 && res.body && res.body.success === false, `${label}: expected 401; got ${res.statusCode} ${show(res.body)}`);
    assert(manager.calls.created.length === 0 && provision.calls.length === 0, `${label}: nothing may be created`);
  }
});

test('H3: the owner and an admin are refused 403 not-a-guest, and nothing about them changes (AC-5)', async () => {
  for (const [label, pk] of [['the owner', OWNER], ['an admin', ADMIN]]) {
    const manager = fakeManager();
    const provision = fakeProvision();
    const res = await call(makeHandler({ manager, provision }), sessionFor(pk));
    assert(res.statusCode === 403 && res.body && res.body.code === 'not-a-guest',
      `${label}: expected 403 code "not-a-guest"; got ${res.statusCode} ${show(res.body)}`);
    assert(manager.calls.created.length === 0 && provision.calls.length === 0, `${label}: nothing may be created`);
  }
});

test('H4: an active customer gets 409 already-customer; a deactivated one 403 customer-inactive; nothing changes (AC-5)', async () => {
  const records = {
    [CUSTOMER]: { id: 1, name: 'customer_cccccccc_x', pubkey: CUSTOMER, status: 'active' },
    [INACTIVE]: { id: 2, name: 'customer_c2c2c2c2_x', pubkey: INACTIVE, status: 'inactive' },
  };
  const a = fakeManager(records); const pa = fakeProvision();
  const ra = await call(makeHandler({ manager: a, provision: pa }), sessionFor(CUSTOMER));
  assert(ra.statusCode === 409 && ra.body.code === 'already-customer', `an active customer: expected 409 already-customer; got ${ra.statusCode} ${show(ra.body)}`);
  const b = fakeManager(records); const pb = fakeProvision();
  const rb = await call(makeHandler({ manager: b, provision: pb }), sessionFor(INACTIVE));
  assert(rb.statusCode === 403 && rb.body.code === 'customer-inactive', `a deactivated customer: expected 403 customer-inactive; got ${rb.statusCode} ${show(rb.body)}`);
  assert(a.calls.created.length + b.calls.created.length === 0 && pa.calls.length + pb.calls.length === 0,
    'no record or key may be created for an existing customer, active or not (a deactivated customer must not reactivate themselves)');
  assert(b.store[INACTIVE].status === 'inactive', 'the deactivated record must stay inactive');
});

const MUTE = { depth: 0, real: null };
function tmpCustomers() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-sign-up-customers-'));
  delete require.cache[require.resolve(CUSTOMER_MANAGER)];
  const CustomerManager = require(CUSTOMER_MANAGER);
  // Mute the store's own console.log while its calls run. A depth counter, not a save-and-restore: two calls at once
  // (H7) would otherwise restore each other's stand-in and leave the log muted for the rest of the suite.
  const quiet = (fn) => async (...a) => {
    if (MUTE.depth++ === 0) { MUTE.real = console.log; console.log = () => {}; }
    try { return await fn(...a); } finally { if (--MUTE.depth === 0) console.log = MUTE.real; }
  };
  const factory = () => {
    const cm = new CustomerManager({ customersDir: dir });
    for (const m of ['initialize', 'createCustomer', 'getCustomer', 'getAllCustomers', 'changeCustomerStatus']) cm[m] = quiet(cm[m].bind(cm));
    return cm;
  };
  const read = () => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'customers.json'), 'utf8')).customers; } catch { return {}; } };
  return { dir, factory, read, calls: { created: [] } };
}

test('H5: a guest signs up while it is open: one active customer record, then the key through provisionAssistantKeyOnce, then 200 (AC-3)', async () => {
  const t = tmpCustomers();
  let recordAtKeyTime = null;
  const provision = { calls: [], fn: async (pk) => {
    provision.calls.push(pk);
    recordAtKeyTime = Object.values(t.read()).find((c) => c.pubkey === pk) || null;
    return { created: true, keys: { pubkey: ASSISTANT, npub: 'npub1fixtureassistant' } };
  } };
  const res = await call(makeHandler({ manager: { factory: t.factory }, provision }), sessionFor(GUEST));
  assert(res.statusCode === 200 && res.body && res.body.success === true, `expected 200 success; got ${res.statusCode} ${show(res.body)}`);
  const recs = Object.values(t.read()).filter((c) => c.pubkey === GUEST);
  assert(recs.length === 1, `exactly one customer record for the guest; got ${recs.length}`);
  const rec = recs[0];
  assert(rec.status === 'active' && rec.observer_id === GUEST, `the record must be active with observer_id = the guest; got ${show(rec)}`);
  assert(rec.comments === 'Signed up through open sign-up', `the record's comments must say how it came; got ${show(rec.comments)}`);
  assert(/^customer_[0-9a-f]{8}_[0-9a-z]+$/.test(rec.name) && rec.name.startsWith(`customer_${GUEST.slice(0, 8)}_`),
    `the name must follow the owner path's customer_<first 8 hex>_<base-36 ms>; got ${show(rec.name)}`);
  assert(show(provision.calls) === show([GUEST]), `the key must come from provisionAssistantKeyOnce(guest), once; calls ${show(provision.calls)}`);
  assert(recordAtKeyTime, 'the customer record must exist before the key is requested (customer first, ADR 0002 § 3)');
  assert(res.body.customerId === rec.id && res.body.customerName === rec.name, `the answer must name the record: ${show(res.body)}`);
  assert(res.body.assistantPubkey === ASSISTANT && res.body.assistantNpub === 'npub1fixtureassistant', `the answer must carry the Assistant: ${show(res.body)}`);
});

test('H6: a self-signed-up record is the same shape as one the owner adds — same fields, same tier and interval (AC-4)', async () => {
  const t = tmpCustomers();
  await call(makeHandler({ manager: { factory: t.factory }, provision: fakeProvision() }), sessionFor(GUEST));
  // The owner's path, as src/api/customers/commands/add-new-customer.js builds it, through the same createCustomer.
  const cm = t.factory();
  await cm.initialize();
  const ownerName = `customer_${GUEST2.slice(0, 8)}_${Date.now().toString(36)}`;
  await cm.createCustomer({
    name: ownerName, display_name: ownerName, pubkey: GUEST2, status: 'active', directory: ownerName,
    observer_id: GUEST2, comments: 'Added via admin interface', service_tier: 'free', update_interval: 604800,
  });
  const all = Object.values(t.read());
  const self = all.find((c) => c.pubkey === GUEST);
  const owned = all.find((c) => c.pubkey === GUEST2);
  assert(self && owned, `both records must exist; got ${show(all.map((c) => c.pubkey))}`);
  const keys = (o) => Object.keys(o).sort();
  assert(show(keys(self)) === show(keys(owned)), `same top-level fields: self ${show(keys(self))} vs owner-added ${show(keys(owned))}`);
  assert(show(keys(self.subscription || {})) === show(keys(owned.subscription || {})), 'same subscription fields');
  for (const f of ['status']) assert(self[f] === owned[f], `${f}: ${show(self[f])} vs ${show(owned[f])}`);
  for (const f of ['service_tier', 'update_interval']) {
    assert(self.subscription[f] === owned.subscription[f], `subscription.${f}: ${show(self.subscription[f])} vs ${show(owned.subscription[f])}`);
  }
  assert(self.directory === self.name && self.display_name === self.name, `directory and display_name follow the name, as for the owner's: ${show(self)}`);
  assert(fs.existsSync(path.join(t.dir, self.directory)), 'the customer directory is created, as for an owner-added customer');
});

test('H7: two sign-ups at once (two tabs) leave one customer; the other answer is 409 already-customer (AC-5)', async () => {
  const t = tmpCustomers();
  const provision = fakeProvision();
  const h = makeHandler({ manager: { factory: t.factory }, provision });
  const [a, b] = await Promise.all([call(h, sessionFor(GUEST)), call(h, sessionFor(GUEST))]);
  const statuses = [a.statusCode, b.statusCode].sort();
  assert(show(statuses) === show([200, 409]), `expected one 200 and one 409; got ${show([a.statusCode, a.body && a.body.code, b.statusCode, b.body && b.body.code])}`);
  const loser = a.statusCode === 409 ? a : b;
  assert(loser.body.code === 'already-customer', `the loser must be told already-customer; got ${show(loser.body)}`);
  assert(Object.values(t.read()).filter((c) => c.pubkey === GUEST).length === 1, 'exactly one record for the guest');
});

test('H8: a race the store reports after its own check ("already exists") is re-read: inactive → 403, active → 409', async () => {
  for (const [label, status, wantCode, wantStatus] of [['now inactive', 'inactive', 'customer-inactive', 403], ['now active', 'active', 'already-customer', 409]]) {
    const m = fakeManager({}, { onCreate: (data, store) => { store[data.pubkey] = { id: 9, name: 'customer_raced', pubkey: data.pubkey, status }; } });
    const p = fakeProvision();
    const res = await call(makeHandler({ manager: m, provision: p }), sessionFor(GUEST));
    assert(res.statusCode === wantStatus && res.body.code === wantCode, `${label}: expected ${wantStatus} ${wantCode}; got ${res.statusCode} ${show(res.body)}`);
    assert(p.calls.length === 0, `${label}: no key after losing the race`);
  }
});

test('H9: if the key fails after the record exists, the answer is 500 assistant-key-failed and the record stays (recoverable, ADR 0002 § 3)', async () => {
  const t = tmpCustomers();
  const res = await call(makeHandler({ manager: { factory: t.factory }, provision: fakeProvision({ fail: true }) }), sessionFor(GUEST));
  assert(res.statusCode === 500 && res.body && res.body.code === 'assistant-key-failed', `expected 500 assistant-key-failed; got ${res.statusCode} ${show(res.body)}`);
  assert(Object.values(t.read()).some((c) => c.pubkey === GUEST && c.status === 'active'), 'the customer record must stay, so story 1\'s create button can recover the key');
});

test('H10: a key the guest already holds is kept: the answer names it, and no new key is made (ADR 0002 § 3)', async () => {
  const t = tmpCustomers();
  const existing = { pubkey: 'a9'.repeat(32), npub: 'npub1kept' };
  const res = await call(makeHandler({ manager: { factory: t.factory }, provision: fakeProvision({ existing }) }), sessionFor(GUEST));
  assert(res.statusCode === 200 && res.body.assistantPubkey === existing.pubkey, `the kept key must be the answer's Assistant; got ${show(res.body)}`);
});

test('H11: every answer keeps success and message, for the legacy sign-up pages, and adds a code on refusal', async () => {
  assert(allAnswers.length > 0, 'the H tests above must have produced answers');
  const bad = allAnswers.filter((a) => !a.body || typeof a.body.success !== 'boolean' || typeof a.body.message !== 'string' || !a.body.message
    || (a.body.success === false && a.status !== 401 && typeof a.body.code !== 'string'));
  assert(bad.length === 0, `answers missing success, message or code:${NL}  ${bad.slice(0, 5).map(show).join(`${NL}  `)}`);
});

test('H12: createCustomer checks and writes against the file under its lock, not a list cached before it — no lost records (ADR 0002 Amendment 1)', async () => {
  // Same person: two instances that each read the list first, then create at once → one record, one "already exists".
  const t = tmpCustomers();
  const a = t.factory(); const b = t.factory();
  await a.initialize(); await b.initialize();
  await a.getCustomer(GUEST); await b.getCustomer(GUEST); // both now hold a cached, empty list
  const rec = (pk) => ({ name: `customer_${pk.slice(0, 8)}_${Math.random().toString(36).slice(2, 8)}`, pubkey: pk, status: 'active', observer_id: pk });
  const same = await Promise.allSettled([a.createCustomer(rec(GUEST)), b.createCustomer(rec(GUEST))]);
  const ok = same.filter((r) => r.status === 'fulfilled').length;
  const dup = same.filter((r) => r.status === 'rejected' && /already exists/.test(String(r.reason && r.reason.message))).length;
  assert(ok === 1 && dup === 1, `same pubkey: expected one created and one "already exists"; got ${show(same.map((r) => r.status === 'fulfilled' ? 'created' : String(r.reason && r.reason.message)))}`);
  assert(Object.values(t.read()).filter((c) => c.pubkey === GUEST).length === 1, 'same pubkey: exactly one record');
  // Two people at once, each on an instance that read the list before locking: both records must survive.
  const u = tmpCustomers();
  const c = u.factory(); const d = u.factory();
  await c.initialize(); await d.initialize();
  await c.getCustomer(GUEST); await d.getCustomer(GUEST2);
  await Promise.all([c.createCustomer(rec(GUEST)), d.createCustomer(rec(GUEST2))]);
  const kept = Object.values(u.read()).map((x) => x.pubkey).sort();
  assert(show(kept) === show([GUEST, GUEST2].sort()), `two different people: both records must be kept (a stale cached list loses one); kept ${show(kept)}`);
});

test('H13: the 200 also carries the legacy sign-up pages\' fields: pubkey, status and relayPubkey (ADR 0002 Amendment 2, Decision 2)', async () => {
  const KEPT = 'a9'.repeat(32);
  for (const [label, provision, wantRelay] of [
    ['a new key', fakeProvision(), ASSISTANT],
    ['a kept key', fakeProvision({ existing: { pubkey: KEPT, npub: 'npub1kept' } }), KEPT],
  ]) {
    const t = tmpCustomers();
    const res = await call(makeHandler({ manager: { factory: t.factory }, provision }), sessionFor(GUEST));
    assert(res.statusCode === 200, `${label}: expected 200; got ${res.statusCode} ${show(res.body)}`);
    const b = res.body;
    const wrong = [];
    if (b.pubkey !== GUEST) wrong.push(`pubkey must be the caller's own; got ${show(b.pubkey)}`);
    if (b.status !== 'active') wrong.push(`status must be the new record's, "active"; got ${show(b.status)}`);
    if (b.relayPubkey !== wantRelay || b.relayPubkey !== b.assistantPubkey) {
      wrong.push(`relayPubkey must be the Assistant's pubkey, as assistantPubkey; got ${show(b.relayPubkey)} (assistantPubkey ${show(b.assistantPubkey)})`);
    }
    if ('directory' in b) wrong.push('the server path (directory) must stay out of the answer');
    assert(wrong.length === 0, `${label}: the legacy pages show "Unknown" without these fields:${NL}  ${wrong.join(`${NL}  `)}`);
  }
});

test('H14: the 200 never carries a private key, whether the key is new or kept (ADR 0002 Amendment 2, Decision 3)', async () => {
  // The real key objects (generateRelayKeys, getCustomerRelayKeys) hold privkey and nsec; these fakes do too.
  const PRIV = 'ee'.repeat(32);
  const NSEC = 'nsec1fixtureprivatekeyneverreal';
  for (const [label, outcome] of [
    ['a new key', { created: true, keys: { pubkey: ASSISTANT, npub: 'npub1fixtureassistant', privkey: PRIV, nsec: NSEC } }],
    ['a kept key', { created: false, existing: { pubkey: 'a9'.repeat(32), npub: 'npub1kept', privkey: PRIV, nsec: NSEC } }],
  ]) {
    const t = tmpCustomers();
    const provision = { calls: [], fn: async (pk) => { provision.calls.push(pk); return outcome; } };
    const res = await call(makeHandler({ manager: { factory: t.factory }, provision }), sessionFor(GUEST));
    assert(res.statusCode === 200, `${label}: expected 200; got ${res.statusCode} ${show(res.body)}`);
    const text = JSON.stringify(res.body);
    const leaks = [
      text.includes(PRIV) && 'the private key\'s hex',
      text.includes(NSEC) && 'the nsec',
      /"(privkey|privateKey|nsec|secretKey|secret)"\s*:/.test(text) && 'a private-key field name',
    ].filter(Boolean);
    assert(leaks.length === 0, `${label}: the answer carries ${leaks.join(', ')}: ${text}`);
  }
});

test('H15: anything unexpected is 500 sign-up-failed, with success and message, and creates nothing (ADR 0002 Amendment 2, Decision 3)', async () => {
  const provision = fakeProvision();
  const created = [];
  const manager = { factory: () => ({
    initialize: async () => { throw new Error('fixture: the customers file cannot be read'); },
    getCustomer: async () => null,
    createCustomer: async (d) => { created.push(d); return d; },
  }) };
  const err = console.error; console.error = () => {};
  let res;
  try { res = await call(makeHandler({ manager, provision }), sessionFor(GUEST)); } finally { console.error = err; }
  const b = res.body || {};
  assert(res.statusCode === 500 && b.code === 'sign-up-failed' && b.success === false,
    `expected 500 code "sign-up-failed"; got ${res.statusCode} ${show(b)}`);
  assert(typeof b.message === 'string' && b.message, `the legacy pages read message; got ${show(b.message)}`);
  assert(created.length === 0 && provision.calls.length === 0, `nothing may be created (customers ${created.length}, keys ${provision.calls.length})`);
});

/* ───────────────────────── S — deactivating a customer (ADR 0002 Amendment 2) ───────────────────────── */

function changeStatusModule() {
  delete require.cache[require.resolve(CHANGE_STATUS)];
  let mod;
  try { mod = require(CHANGE_STATUS); } catch (e) { throw new Error(`src/api/customers/changeCustomerStatus.js must load: ${e.message}`); }
  assert(typeof mod.createChangeCustomerStatusHandler === 'function',
    `changeCustomerStatus.js must export createChangeCustomerStatusHandler(deps) (ADR 0002 Amendment 2); exports: ${show(Object.keys(mod))}`);
  assert(typeof mod.handleChangeCustomerStatus === 'function', 'changeCustomerStatus.js must still export handleChangeCustomerStatus');
  return mod;
}

function makeStatusHandler(t) {
  const { createChangeCustomerStatusHandler } = changeStatusModule();
  return createChangeCustomerStatusHandler({
    getOwnerPubkey: () => OWNER,
    isAdminPubkey: (pk) => pk === ADMIN,
    customerManagerFactory: t.factory,
  });
}

/** One POST /api/change-customer-status, with the handler's own logging muted. */
async function setStatus(handler, session, pubkey, status) {
  const res = fakeRes();
  const req = { method: 'POST', path: '/api/change-customer-status', headers: {}, body: { pubkey, status } };
  if (session !== undefined) req.session = session;
  if (MUTE.depth++ === 0) { MUTE.real = console.log; console.log = () => {}; }
  const err = console.error; console.error = () => {};
  try { await handler(req, res); } finally {
    console.error = err;
    if (--MUTE.depth === 0) console.log = MUTE.real;
  }
  return res;
}

/** A guest who signed up through the sign-up handler, on a real store in a temp folder. */
async function signedUpGuest() {
  const t = tmpCustomers();
  const signUp = makeHandler({ manager: { factory: t.factory }, provision: fakeProvision() });
  const res = await call(signUp, sessionFor(GUEST));
  assert(res.statusCode === 200, `setup: the guest must sign up first; got ${res.statusCode} ${show(res.body)}`);
  return { t, signUp };
}
const statusOf = (t, pk) => { const r = Object.values(t.read()).find((c) => c.pubkey === pk); return r ? r.status : undefined; };
const OWNER_SESSION = { authenticated: true, pubkey: OWNER };

test('S1: the owner deactivates a customer who signed up, then reactivates them, from a real signed-in session (AC-4)', async () => {
  const { t } = await signedUpGuest();
  const h = makeStatusHandler(t);
  const off = await setStatus(h, OWNER_SESSION, GUEST, 'inactive');
  assert(off.statusCode === 200 && off.body && off.body.success === true,
    `the owner's deactivate must succeed; got ${off.statusCode} ${show(off.body)} (401 "Authentication required" is the stale session.userPubkey read)`);
  assert(typeof off.body.message === 'string' && off.body.message, 'the answer keeps the message the manage-customer page shows');
  assert(statusOf(t, GUEST) === 'inactive', `the record must now be inactive; it is ${show(statusOf(t, GUEST))}`);
  const on = await setStatus(h, OWNER_SESSION, GUEST, 'active');
  assert(on.statusCode === 200 && on.body && on.body.success === true, `the owner's reactivate must succeed; got ${on.statusCode} ${show(on.body)}`);
  assert(statusOf(t, GUEST) === 'active', `the record must be active again; it is ${show(statusOf(t, GUEST))}`);
});

test('S2: an admin may deactivate and reactivate too — the handler\'s owner-or-admin rule is unchanged (Amendment 2, Decision 1)', async () => {
  const { t } = await signedUpGuest();
  const h = makeStatusHandler(t);
  const off = await setStatus(h, { authenticated: true, pubkey: ADMIN }, GUEST, 'inactive');
  assert(off.statusCode === 200 && statusOf(t, GUEST) === 'inactive', `an admin's deactivate must succeed; got ${off.statusCode} ${show(off.body)}`);
  const on = await setStatus(h, { authenticated: true, pubkey: ADMIN }, GUEST, 'active');
  assert(on.statusCode === 200 && statusOf(t, GUEST) === 'active', `an admin's reactivate must succeed; got ${on.statusCode} ${show(on.body)}`);
});

test('S3: anyone else is refused — 401 without a signed-in session, 403 for a guest or the customer — and the record does not change', async () => {
  const { t } = await signedUpGuest();
  const h = makeStatusHandler(t);
  const wrong = [];
  for (const [label, session, want, error] of [
    ['no session', undefined, 401, 'Authentication required'],
    ['a pubkey but not authenticated', { pubkey: OWNER }, 401, 'Authentication required'],
    ['authenticated: false', { authenticated: false, pubkey: OWNER }, 401, 'Authentication required'],
    ['only the old userPubkey field', { userPubkey: OWNER }, 401, 'Authentication required'],
    ['authenticated, with the old field and no pubkey', { authenticated: true, userPubkey: OWNER }, 401, 'Authentication required'],
    ['a guest', { authenticated: true, pubkey: GUEST2 }, 403, 'Only the owner or admin can change customer status'],
    ['a guest whose stale userPubkey names the owner', { authenticated: true, pubkey: GUEST2, userPubkey: OWNER }, 403, 'Only the owner or admin can change customer status'],
    ['the customer themselves', { authenticated: true, pubkey: GUEST }, 403, 'Only the owner or admin can change customer status'],
  ]) {
    const res = await setStatus(h, session, GUEST, 'inactive');
    const b = res.body || {};
    if (res.statusCode !== want || b.success !== false || b.error !== error) {
      wrong.push(`${label}: expected ${want} ${show(error)}; got ${res.statusCode} ${show(b)}`);
    }
    if (statusOf(t, GUEST) !== 'active') { wrong.push(`${label}: the record changed to ${show(statusOf(t, GUEST))}`); break; }
  }
  assert(wrong.length === 0, wrong.join(NL));
});

test('S4: once the owner deactivates them, sign-up refuses them 403 customer-inactive; once reactivated, 409 already-customer (AC-4, AC-5)', async () => {
  const { t, signUp } = await signedUpGuest();
  const h = makeStatusHandler(t);
  const off = await setStatus(h, OWNER_SESSION, GUEST, 'inactive');
  assert(off.statusCode === 200, `the owner's deactivate must succeed; got ${off.statusCode} ${show(off.body)}`);
  const again = await call(signUp, sessionFor(GUEST));
  assert(again.statusCode === 403 && again.body.code === 'customer-inactive',
    `a deactivated customer signing up again: expected 403 customer-inactive; got ${again.statusCode} ${show(again.body)}`);
  assert(statusOf(t, GUEST) === 'inactive', 'they must stay inactive: only the owner reactivates');
  const on = await setStatus(h, OWNER_SESSION, GUEST, 'active');
  assert(on.statusCode === 200, `the owner's reactivate must succeed; got ${on.statusCode} ${show(on.body)}`);
  const third = await call(signUp, sessionFor(GUEST));
  assert(third.statusCode === 409 && third.body.code === 'already-customer',
    `a reactivated customer: expected 409 already-customer; got ${third.statusCode} ${show(third.body)}`);
  assert(Object.values(t.read()).filter((c) => c.pubkey === GUEST).length === 1, 'still exactly one record for them');
});

test('S5: the default-wired handler reads the signed-in session: a non-owner gets 403, not 401; the old field alone gets 401', async () => {
  // A fixture key that is never the owner or an admin, so the handler refuses before it reaches any customer store.
  delete require.cache[require.resolve(CHANGE_STATUS)];
  const { handleChangeCustomerStatus } = require(CHANGE_STATUS);
  const STRANGER = 'f0'.repeat(32);
  const signedIn = await setStatus(handleChangeCustomerStatus, { authenticated: true, pubkey: STRANGER }, CUSTOMER, 'inactive');
  assert(signedIn.statusCode === 403,
    `a signed-in non-owner must reach the owner check (403); got ${signedIn.statusCode} ${show(signedIn.body)}`);
  const stale = await setStatus(handleChangeCustomerStatus, { userPubkey: STRANGER }, CUSTOMER, 'inactive');
  assert(stale.statusCode === 401, `a session with only the old userPubkey field must be 401; got ${stale.statusCode} ${show(stale.body)}`);
});

/* ───────────────────────── K — the guest's sign-in answer ───────────────────────── */

async function classify({ pubkey, records = {}, settings = {}, admins = [] }) {
  const stubs = {
    [path.join(REPO, 'src/utils/config.js')]: {
      getConfigFromFile: (k, d) => (k === 'BRAINSTORM_OWNER_PUBKEY' ? OWNER : d),
      getAdminPubkeys: () => admins,
      getOwnerPubkey: () => OWNER,
      isAdminPubkey: (pk) => admins.includes(pk),
    },
    [path.join(REPO, 'src/utils/customerManager.js')]: class { async initialize() {} async getCustomer(pk) { return records[pk] || null; } },
    [path.join(REPO, 'src/utils/assistantKeys.js')]: { getAssistantPubkeyFor: async () => null },
    [path.join(REPO, 'src/config/settings.js')]: { getSettings: () => settings, getDefaults: () => ({}), getOverrides: () => ({}) },
  };
  const saved = {};
  for (const [p, exp] of Object.entries(stubs)) {
    saved[p] = require.cache[p];
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp, children: [], paths: [] };
  }
  delete require.cache[CLASSIFY];
  const err = console.error; console.error = () => {};
  try {
    const { handleGetUserClassification } = require(CLASSIFY);
    const res = fakeRes();
    await handleGetUserClassification({ session: { authenticated: true, pubkey } }, res);
    return res.body;
  } finally {
    console.error = err;
    delete require.cache[CLASSIFY];
    for (const [p, m] of Object.entries(saved)) { if (m) require.cache[p] = m; else delete require.cache[p]; }
  }
}

test('K1: a guest with no record learns signUpOpen from the switch, and customerStatus null (ADR 0002 § 2)', async () => {
  const open = await classify({ pubkey: GUEST, settings: { signUp: { open: true } } });
  assert(open && open.classification === 'guest', `expected a guest; got ${show(open)}`);
  assert(open.signUpOpen === true && open.customerStatus === null, `open: expected signUpOpen true, customerStatus null; got ${show(open)}`);
  const closed = await classify({ pubkey: GUEST, settings: { signUp: { open: false } } });
  assert(closed.signUpOpen === false, `closed: expected signUpOpen false; got ${show(closed)}`);
  const missing = await classify({ pubkey: GUEST, settings: {} });
  assert(missing.signUpOpen === false, `no signUp key: expected signUpOpen false; got ${show(missing)}`);
  const stringy = await classify({ pubkey: GUEST, settings: { signUp: { open: 'true' } } });
  assert(stringy.signUpOpen === false, `"true" as a string must read as closed; got ${show(stringy)}`);
});

test('K2: a deactivated customer is a guest with customerStatus = the record\'s status (ADR 0002 § 2)', async () => {
  const body = await classify({ pubkey: INACTIVE, records: { [INACTIVE]: { pubkey: INACTIVE, status: 'inactive', name: 'x' } }, settings: { signUp: { open: true } } });
  assert(body.classification === 'guest' && body.customerStatus === 'inactive', `expected guest + customerStatus "inactive"; got ${show(body)}`);
});

test('K3: owner, admin and customer answers are unchanged — no signUpOpen, no customerStatus (regression)', async () => {
  const cases = [
    ['owner', await classify({ pubkey: OWNER, settings: { signUp: { open: true } } })],
    ['admin', await classify({ pubkey: ADMIN, admins: [ADMIN], settings: { signUp: { open: true } } })],
    ['customer', await classify({ pubkey: CUSTOMER, records: { [CUSTOMER]: { pubkey: CUSTOMER, status: 'active', name: 'c', id: 3 } }, settings: { signUp: { open: true } } })],
  ];
  const wrong = cases.filter(([, b]) => !b || 'signUpOpen' in b || 'customerStatus' in b);
  assert(wrong.length === 0, `these answers grew guest-only fields: ${show(wrong)}`);
  assert(cases.map(([, b]) => b.classification).join() === 'owner,admin,customer', `classifications: ${show(cases.map(([, b]) => b.classification))}`);
});

/* ───────────────────────── D — the wiring ───────────────────────── */

test('D1: AuthContext keeps signUpOpen and customerStatus when sign-in resolves AND in refreshUser()', async () => {
  const src = safeRead(AUTH_CONTEXT);
  const count = (re) => (src.match(re) || []).length;
  assert(count(/signUpOpen/g) >= 2 && count(/customerStatus/g) >= 2,
    `AuthContext.jsx must carry signUpOpen and customerStatus in both setUser paths (found ${count(/signUpOpen/g)} and ${count(/customerStatus/g)} mentions)`);
});

test('D2: Settings has an "👥 Accounts" tab at settings/accounts, served by AccountSettings.jsx (ADR 0002 § 5)', async () => {
  const idx = safeRead(SETTINGS_INDEX);
  assert(/key:\s*'accounts',\s*path:\s*'accounts',\s*label:\s*'👥 Accounts'/.test(idx),
    "Settings Index.jsx TABS must include { key: 'accounts', path: 'accounts', label: '👥 Accounts' }");
  assert(/AccountSettings/.test(idx), 'Settings Index.jsx must render AccountSettings for the accounts tab');
  assert(safeRead(ACCOUNT_SETTINGS), 'ui/src/pages/settings/AccountSettings.jsx must exist');
  assert(/path:\s*'accounts'/.test(safeRead(APP)), "App.jsx must route settings/accounts (a child path 'accounts')");
});

test('D3: the sign-up path no longer imports createSingleCustomerRelay, which overwrites keys (ADR 0002 § 3)', async () => {
  const src = safeRead(SIGN_UP);
  assert(src && !/createSingleCustomerRelay/.test(src), 'signUpNewCustomer.js must not use createSingleCustomerRelay');
  assert(/provisionAssistantKeyOnce/.test(src), 'signUpNewCustomer.js must get the key through provisionAssistantKeyOnce');
});

test('D4: the API docs name the new answer codes and the two classification fields (ADR 0002 Implementation notes)', async () => {
  const doc = safeRead(OPENAPI);
  const missing = ['sign-up-closed', 'not-a-guest', 'already-customer', 'customer-inactive', 'assistant-key-failed', 'signUpOpen', 'customerStatus']
    .filter((w) => !doc.includes(w));
  assert(missing.length === 0, `src/api/openapi.yaml does not mention: ${missing.join(', ')}`);
});

test('D5: the API docs\' sign-up 200 names the legacy fields pubkey, status and relayPubkey (ADR 0002 Amendment 2)', async () => {
  const doc = safeRead(OPENAPI);
  const start = doc.indexOf('  /api/auth/sign-up-new-customer:');
  assert(start >= 0, 'src/api/openapi.yaml must document /api/auth/sign-up-new-customer');
  const next = doc.indexOf(`${NL}  /api/`, start + 10);
  const section = doc.slice(start, next > start ? next : undefined);
  const missing = ['pubkey', 'status', 'relayPubkey'].filter((f) => !new RegExp(`^\\s+${f}:\\s*$`, 'm').test(section));
  assert(missing.length === 0, `the sign-up section's 200 schema must list: ${missing.join(', ')}`);
});

test('D6: the status handler reads no session.userPubkey (no login sets it since 37a31e247), and is still exported (Amendment 2)', async () => {
  const src = safeRead(CHANGE_STATUS);
  assert(src, 'src/api/customers/changeCustomerStatus.js must exist');
  assert(!/session\s*\??\.\s*userPubkey|\[\s*['"]userPubkey['"]\s*\]/.test(src),
    'changeCustomerStatus.js must identify the caller by session.pubkey, not session.userPubkey');
  const idx = safeRead(CUSTOMERS_INDEX);
  assert(/handleChangeCustomerStatus/.test(idx) && /require\(\s*['"]\.\/changeCustomerStatus(\.js)?['"]\s*\)/.test(idx),
    'src/api/customers/index.js must still export handleChangeCustomerStatus from changeCustomerStatus.js (the route\'s wiring)');
});

/* ───────────────────────── runner ───────────────────────── */

async function run() {
  console.log('\n=== setup-open-sign-up (setup-create-account #2) ===');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}setup-open-sign-up: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
