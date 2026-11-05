'use strict';
/**
 * setup-create-account #1: the Create your account page — the Node half.
 *
 * Story: engineering-team/stories/setup-create-account/1-create-account-page.md
 * ADR:   engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md
 * Plan:  engineering-team/stories/setup-create-account/1-create-account-page.test-plan.md
 * Browser half: tests/brainstorm/setup-create-account.spec.js (B-class — what a visitor SEES on the page).
 *
 * Classes:
 *   C — the page's one state rule (ui/src/pages/setup/createAccountState.js) and its copy
 *       (ui/src/pages/setup/createAccountCopy.js), loaded in Node as ESM.
 *   U — provisionAssistantKeyOnce (src/api/assistant/index.js) driven through FAKE dependencies:
 *       one check-and-store at a time for each pubkey (ADR 0001 § Decision 4). Stack-free: no key
 *       store, no disk, no network.
 *   S — server source sentinels: POST /api/assistant/provision-key goes through that function.
 *   D — UI source sentinels for the JSX this runner cannot execute: the route's import, the
 *       placeholder retired, the page reading the one rule, the copy not restating approved strings.
 *
 * Everything here FAILS against the current code: createAccountState.js, createAccountCopy.js and
 * CreateAccount.jsx do not exist, App.jsx still takes SetupCreateAccount from Placeholders.jsx, and
 * src/api/assistant/index.js exports no provisionAssistantKeyOnce.
 *
 * Nothing here publishes, signs, writes a key or reaches a stack. Safe to run anywhere.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const STATE = path.join(REPO, 'ui/src/pages/setup/createAccountState.js');
const COPY = path.join(REPO, 'ui/src/pages/setup/createAccountCopy.js');
const PAGE = path.join(REPO, 'ui/src/pages/setup/CreateAccount.jsx');
const PLACEHOLDERS = path.join(REPO, 'ui/src/pages/setup/Placeholders.jsx');
const STEPS = path.join(REPO, 'ui/src/pages/setup/steps.js');
const APP = path.join(REPO, 'ui/src/App.jsx');
const ASSISTANT_API = path.join(REPO, 'src/api/assistant/index.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const TA = 'ee'.repeat(32);
const OTHER = 'b3'.repeat(32);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}

/* ───────────────────────── C — the state rule and the copy ───────────────────────── */

async function stateRule() {
  const mod = await loadEsm(STATE);
  assert(!mod.__loadError,
    `ui/src/pages/setup/createAccountState.js must exist and load in Node as ESM (ADR 0001 § Decision 1; its imports need their .js extension): ${mod.__loadError && mod.__loadError.message}`);
  assert(typeof mod.createAccountState === 'function',
    `createAccountState.js must export createAccountState(user, authLoading); exports are ${show(Object.keys(mod))}`);
  return mod.createAccountState;
}

const user = (classification, assistantPubkey, pubkey = VIEWER) => ({ pubkey, classification, assistantPubkey });

test('C1: createAccountState is the one exported rule, and it is pure (same answer twice, input untouched)', async () => {
  const rule = await stateRule();
  const u = user('admin', null);
  const before = show(u);
  const a = rule(u, false);
  const b = rule(u, false);
  assert(a === b, `the same user must give the same state twice: got ${show(a)} then ${show(b)}`);
  assert(show(u) === before, 'createAccountState must not change the user object it is given');
});

test('C2: each visitor gets the state in the ADR table (story § The page\'s states)', async () => {
  const rule = await stateRule();
  const cases = [
    ['sign-in still resolving, no user yet', null, true, 'checking'],
    ['sign-in still resolving, with a stale user', user('admin', ASSISTANT), true, 'checking'],
    ['signed out', null, false, 'signed-out'],
    ['the owner, holding the instance TA', user('owner', TA), false, 'done'],
    ['an admin holding an Assistant', user('admin', ASSISTANT), false, 'done'],
    ['a customer holding an Assistant', user('customer', ASSISTANT), false, 'done'],
    ['an admin with no Assistant', user('admin', null), false, 'may-create'],
    ['an active customer with no Assistant', user('customer', null), false, 'may-create'],
    ['a guest with no Assistant', user('guest', null), false, 'guest'],
    ['an owner whose Assistant key is missing', user('owner', null), false, 'owner-key-missing'],
  ];
  const wrong = [];
  for (const [label, u, loading, want] of cases) {
    const got = rule(u, loading);
    if (got !== want) wrong.push(`${label}: expected ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, `wrong states:${NL}  ${wrong.join(`${NL}  `)}`);
});

test('C3: holding an Assistant wins over the role — a guest who kept one is done, and the owner is never offered provisioning', async () => {
  const rule = await stateRule();
  assert(rule(user('guest', ASSISTANT), false) === 'done',
    `a guest who kept an Assistant (an inactive customer) must be "done" (story AC-2); got ${show(rule(user('guest', ASSISTANT), false))}`);
  const owner = rule(user('owner', null), false);
  assert(owner !== 'may-create',
    'the owner must never be offered provisioning: the owner check comes before mayCreateAssistant (ADR 0001 § Decision 1; ADR assistant-profile/0004 sub-decision 4)');
});

test('C4: a signed-in user with an unknown or missing classification is a guest, never offered the button', async () => {
  const rule = await stateRule();
  const wrong = [];
  for (const classification of [undefined, null, '', 'unauthenticated', 'customer-inactive', 'Admin']) {
    const got = rule({ pubkey: VIEWER, classification, assistantPubkey: null }, false);
    if (got !== 'guest') wrong.push(`classification ${show(classification)}: expected "guest", got ${show(got)}`);
  }
  assert(wrong.length === 0, `only "admin" and "customer" may create (mayCreateAssistant):${NL}  ${wrong.join(`${NL}  `)}`);
});

/** Every string value in a module's exports, nested objects and arrays included. */
function stringsIn(value, out = [], depth = 0) {
  if (depth > 4 || value == null) return out;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out, depth + 1));
  else if (typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out, depth + 1));
  return out;
}

// Story 1 § Copy: the new strings with no placeholder in them. The two with one ({reason}, {owner})
// are checked as rendered, in the browser class.
const NEW_STRINGS = [
  'Checking sign-in…',
  'Sign in to see your account here, or to create it.',
  'Your Tapestry Assistant:',
  'View its profile',
  'It has no profile yet.',
  'Set up its profile',
  'Manage your Assistant',
  "You don't have a Tapestry Assistant on this instance yet. Create one, and this instance will hold its key for you.",
  'Create my Tapestry Assistant',
  'Creating…',
  "You don't have a Tapestry Assistant on this instance. This instance sets one up for its owner, its admins and its customers.",
  "This instance's Tapestry Assistant key is missing. It is created when the instance is first set up and can't be created from this page; it has to be restored on the server.",
];

test('C5: createAccountCopy.js holds each new string of story 1 § Copy, word for word', async () => {
  const mod = await loadEsm(COPY);
  assert(!mod.__loadError,
    `ui/src/pages/setup/createAccountCopy.js must exist and load in Node as ESM (ADR 0001 § Implementation notes): ${mod.__loadError && mod.__loadError.message}`);
  const all = stringsIn(Object.fromEntries(Object.entries(mod)));
  const missing = NEW_STRINGS.filter((s) => !all.includes(s));
  assert(missing.length === 0,
    `createAccountCopy.js lacks these approved strings exactly as written (check apostrophes and the … character):${NL}  ${missing.map(show).join(`${NL}  `)}`);
});

/* ───────────────────────── U — one check-and-store at a time ───────────────────────── */

function assistantModule() {
  try {
    // A fresh copy each time, so one test's lock state can never leak into the next.
    delete require.cache[require.resolve(ASSISTANT_API)];
    return require(ASSISTANT_API);
  } catch (err) {
    return { __loadError: err };
  }
}

function provisionOnce() {
  const mod = assistantModule();
  assert(!mod.__loadError, `src/api/assistant/index.js must load: ${mod.__loadError && mod.__loadError.message}`);
  assert(typeof mod.provisionAssistantKeyOnce === 'function',
    'src/api/assistant/index.js must export provisionAssistantKeyOnce(pubkey, deps) (ADR 0001 § Decision 4)');
  return mod.provisionAssistantKeyOnce;
}

/**
 * Fake { getAssistantKeys, generateRelayKeys, storeRelayKeys } over an in-memory store. Every read
 * and write yields to the event loop, so concurrent calls really interleave, as they do in the
 * real handler (an await between the check and the store).
 */
function fakeDeps({ existing = {}, getDelayMs = 2, failStores = 0, gates = {} } = {}) {
  const store = new Map(Object.entries(existing));
  const calls = { get: [], generated: [], stored: [] };
  let n = 0;
  const deps = {
    getAssistantKeys: async (pk) => {
      calls.get.push(pk);
      if (gates[pk]) await gates[pk];
      await tick(getDelayMs);
      return store.get(pk) || null;
    },
    generateRelayKeys: () => {
      n += 1;
      const hex = n.toString(16).padStart(2, '0').repeat(32);
      const keys = { pubkey: hex, npub: `npub-fixture-${n}`, privkey: 'ff'.repeat(32), nsec: `nsec-fixture-${n}` };
      calls.generated.push(keys.pubkey);
      return keys;
    },
    storeRelayKeys: async (pk, keys) => {
      calls.stored.push([pk, keys && keys.pubkey]);
      await tick(1);
      if (failStores > 0) { failStores -= 1; throw new Error('fixture store failure'); }
      store.set(pk, keys);
    },
  };
  return { deps, calls, store };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

test('U1: no key yet → one key is generated and stored under the caller\'s pubkey, and the answer says it was created', async () => {
  const once = provisionOnce();
  const { deps, calls, store } = fakeDeps();
  const result = await once(VIEWER, deps);
  assert(result && result.created === true, `expected { created: true, keys }, got ${show(result)}`);
  assert(calls.generated.length === 1, `exactly one key generated, got ${calls.generated.length}`);
  assert(show(calls.stored) === show([[VIEWER, calls.generated[0]]]),
    `the key must be stored once, under the caller's pubkey: stored ${show(calls.stored)}`);
  assert(result.keys && result.keys.pubkey === calls.generated[0],
    `the answer must carry the stored key: got ${show(result.keys)}, stored ${calls.generated[0]}`);
  assert(store.get(VIEWER) && store.get(VIEWER).pubkey === result.keys.pubkey, 'the store holds the key the answer reports');
  assert(calls.get.includes(VIEWER), 'it must check for an existing key first');
});

test('U2: a key already exists → nothing is generated or stored, and the answer carries the existing key', async () => {
  const once = provisionOnce();
  const existing = { pubkey: ASSISTANT, npub: 'npub-existing' };
  const { deps, calls } = fakeDeps({ existing: { [VIEWER]: existing } });
  const result = await once(VIEWER, deps);
  assert(result && result.created === false, `expected { created: false, existing }, got ${show(result)}`);
  assert(result.existing && result.existing.pubkey === ASSISTANT, `the answer must carry the existing key: got ${show(result.existing)}`);
  assert(calls.generated.length === 0 && calls.stored.length === 0,
    `re-provisioning would lose the old signing identity: generated ${calls.generated.length}, stored ${calls.stored.length}`);
});

test('U3: two calls at once for the same pubkey (two tabs) → exactly one key is stored, and the second answer names it', async () => {
  const once = provisionOnce();
  const { deps, calls, store } = fakeDeps({ getDelayMs: 5 });
  const results = await Promise.all([once(VIEWER, deps), once(VIEWER, deps)]);
  assert(calls.stored.length === 1,
    `two concurrent calls must store ONE key, not overwrite one with another: stored ${show(calls.stored)}`);
  const created = results.filter((r) => r && r.created === true);
  const refused = results.filter((r) => r && r.created === false);
  assert(created.length === 1 && refused.length === 1, `one created and one existing, got ${show(results)}`);
  assert(refused[0].existing && refused[0].existing.pubkey === created[0].keys.pubkey,
    `the second answer must name the key the first stored: ${show(refused[0].existing)} vs ${show(created[0].keys)}`);
  assert(store.get(VIEWER).pubkey === created[0].keys.pubkey, 'the stored key is the one the created answer reported');
});

test('U4: five calls at once for the same pubkey → still exactly one key', async () => {
  const once = provisionOnce();
  const { deps, calls } = fakeDeps({ getDelayMs: 3 });
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => once(VIEWER, deps)));
  assert(calls.stored.length === 1, `five concurrent calls stored ${calls.stored.length} keys`);
  assert(results.filter((r) => r && r.created === true).length === 1, `exactly one created answer, got ${show(results)}`);
});

test('U5: the lock is per pubkey — one person waiting never holds up another', async () => {
  const once = provisionOnce();
  const gate = deferred();
  const { deps, calls } = fakeDeps({ gates: { [VIEWER]: gate.promise } });
  const first = once(VIEWER, deps);
  const second = await Promise.race([once(OTHER, deps), tick(1000).then(() => 'timed out')]);
  assert(second !== 'timed out', 'a call for another pubkey must not wait for this one: it was still blocked after 1 s');
  assert(second && second.created === true, `the other pubkey's call must create its key: got ${show(second)}`);
  assert(calls.stored.some(([pk]) => pk === OTHER), 'the other pubkey\'s key was stored while the first call was still checking');
  gate.resolve();
  const firstResult = await first;
  assert(firstResult && firstResult.created === true, `the first pubkey still gets its own key once released: ${show(firstResult)}`);
});

test('U6: a store that fails rejects that call, stores nothing, and releases the lock — the next try creates the key', async () => {
  const once = provisionOnce();
  const { deps, store } = fakeDeps({ failStores: 1 });
  let threw = null;
  try { await once(VIEWER, deps); } catch (err) { threw = err; }
  assert(threw && /fixture store failure/.test(threw.message),
    `a failed store must reject with its error (the handler answers 500), got ${threw ? threw.message : 'no error'}`);
  assert(!store.has(VIEWER), 'nothing is stored after a failed store');
  const retry = await Promise.race([once(VIEWER, deps), tick(1000).then(() => 'timed out')]);
  assert(retry !== 'timed out', 'the lock must be released after a failure: the retry was still blocked after 1 s');
  assert(retry && retry.created === true, `the retry must create the key: got ${show(retry)}`);
});

test('U7: when the first of two concurrent calls fails, the queued second one still runs its own check and creates the key', async () => {
  const once = provisionOnce();
  const { deps, calls, store } = fakeDeps({ failStores: 1, getDelayMs: 3 });
  const [a, b] = await Promise.allSettled([once(VIEWER, deps), once(VIEWER, deps)]);
  assert(a.status === 'rejected', `the first call's store failed, so it must reject: ${show(a)}`);
  assert(b.status === 'fulfilled' && b.value && b.value.created === true,
    `the second call must not inherit the first one's failure: ${show(b)}`);
  assert(store.has(VIEWER) && store.get(VIEWER).pubkey === b.value.keys.pubkey, 'the second call\'s key is the one stored');
  assert(calls.stored.length === 2, `one failed and one successful store, got ${show(calls.stored)}`);
});

/* ───────────────────────── S — the route goes through the lock ───────────────────────── */

/** The source of one top-level function, from its declaration to the next top-level declaration. */
function functionSource(src, name) {
  const start = src.search(new RegExp(`^(async\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  if (start < 0) return '';
  const rest = src.slice(start + 1);
  const next = rest.search(/^(async\s+function|function|const|let|module\.exports)\b/m);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

test('S1: POST /api/assistant/provision-key stores keys only through provisionAssistantKeyOnce', async () => {
  const src = safeRead(ASSISTANT_API);
  const handler = functionSource(src, 'handleProvisionAssistantKey');
  assert(handler, 'src/api/assistant/index.js must still define handleProvisionAssistantKey');
  assert(/provisionAssistantKeyOnce\s*\(/.test(handler),
    'handleProvisionAssistantKey must call provisionAssistantKeyOnce, so the route is covered by the per-pubkey lock (ADR 0001 § Decision 4)');
  assert(!/\.storeRelayKeys\s*\(/.test(handler) && !/generateRelayKeys\s*\(/.test(handler),
    'handleProvisionAssistantKey must not generate or store a key itself: a second path around the lock could still orphan a key');
});

test('S2: the route\'s answers are unchanged — 409 with "Assistant key already exists for this user" when a key exists', async () => {
  const handler = functionSource(safeRead(ASSISTANT_API), 'handleProvisionAssistantKey');
  assert(/status\(\s*409\s*\)/.test(handler) && handler.includes('Assistant key already exists for this user'),
    'handleProvisionAssistantKey must still answer an existing key with 409 and today\'s error (ADR 0001: status codes and bodies do not change)');
  assert(handler.includes('Only the owner, an admin, or an active customer can provision an Assistant key'),
    'the role check and its 403 stay in the handler, before the lock');
});

/* ───────────────────────── D — the UI wiring ───────────────────────── */

test('D1: App.jsx takes SetupCreateAccount from the new page, and the route line is unchanged', async () => {
  const src = safeRead(APP);
  assert(/import\s*\{\s*SetupCreateAccount\s*\}\s*from\s*['"]\.\/pages\/setup\/CreateAccount(\.jsx)?['"]/.test(src),
    "App.jsx must import { SetupCreateAccount } from './pages/setup/CreateAccount' (ADR 0001 § Implementation notes)");
  const placeholderImport = (src.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/pages\/setup\/Placeholders['"]/) || [])[1] || '';
  assert(!/\bSetupCreateAccount\b/.test(placeholderImport),
    `App.jsx must no longer take SetupCreateAccount from Placeholders.jsx: { ${placeholderImport.trim()} }`);
  assert(/\bSetupFollow\b/.test(placeholderImport) && /\bSetupActivate\b/.test(placeholderImport),
    `steps 2 and 3 stay placeholders, still imported from Placeholders.jsx: { ${placeholderImport.trim()} }`);
});

test('D2: Placeholders.jsx no longer exports SetupCreateAccount, and still exports the two placeholders left', async () => {
  const src = safeRead(PLACEHOLDERS);
  assert(src, 'ui/src/pages/setup/Placeholders.jsx must still exist (steps 2 and 3)');
  assert(!/export\s+function\s+SetupCreateAccount\b/.test(src), 'Placeholders.jsx must no longer export SetupCreateAccount');
  assert(/export\s+function\s+SetupFollow\b/.test(src) && /export\s+function\s+SetupActivate\b/.test(src),
    'Placeholders.jsx must still export SetupFollow and SetupActivate');
});

test('D3: CreateAccount.jsx reads its state from the one rule, creates through provision-key, and asks nothing of /api/setup/status', async () => {
  const src = safeRead(PAGE);
  assert(src, 'ui/src/pages/setup/CreateAccount.jsx must exist (ADR 0001 § Implementation notes)');
  assert(/export\s+function\s+SetupCreateAccount\b/.test(src), 'CreateAccount.jsx must export function SetupCreateAccount');
  assert(/from\s*['"]\.\/createAccountState(\.js)?['"]/.test(src) && /createAccountState\s*\(/.test(src),
    'CreateAccount.jsx must derive its state with createAccountState() from ./createAccountState (ADR 0001 § Decision 1)');
  assert(src.includes('/api/assistant/provision-key'), 'CreateAccount.jsx must create the Assistant through POST /api/assistant/provision-key');
  assert(!src.includes('/api/setup/status'),
    "CreateAccount.jsx must not fetch /api/setup/status: step 1's answer is already in the signed-in user (ADR 0001 § Decision 1)");
});

test('D4: the state rule takes "who may create one" from mayCreateAssistant, not a second statement of it', async () => {
  const src = safeRead(STATE);
  assert(src, 'ui/src/pages/setup/createAccountState.js must exist');
  assert(/import\s*\{[^}]*\bmayCreateAssistant\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/config\/avatarMenuLinks\.js['"]/.test(src),
    "createAccountState.js must import mayCreateAssistant from '../../config/avatarMenuLinks.js' (with the extension, so Node can load it)");
  assert(!/['"]admin['"]/.test(src) && !/['"]customer['"]/.test(src),
    'createAccountState.js must not name the admin and customer roles itself: mayCreateAssistant is the one statement (ADR 0001 § Consequences)');
});

test('D5: createAccountCopy.js does not restate the step\'s approved copy — it imports it from steps.js', async () => {
  const copy = safeRead(COPY);
  assert(copy, 'ui/src/pages/setup/createAccountCopy.js must exist');
  const steps = await loadEsm(STEPS);
  assert(!steps.__loadError && steps.CREATE_ACCOUNT_STEP, 'steps.js must still export CREATE_ACCOUNT_STEP');
  const restated = ['text', 'doneText'].filter((f) => copy.includes(steps.CREATE_ACCOUNT_STEP[f]));
  assert(restated.length === 0,
    `createAccountCopy.js restates CREATE_ACCOUNT_STEP.${restated.join(' and .')}: import it from ./steps.js so approved copy has one home (ADR 0001 § Implementation notes)`);
});

/* ───────────────────────── runner ───────────────────────── */

async function run() {
  console.log('\n=== setup-create-account (setup-create-account #1) ===');
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
  console.log(`${NL}setup-create-account: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
