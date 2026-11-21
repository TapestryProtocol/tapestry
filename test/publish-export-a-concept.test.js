/**
 * Story #9: Publish/export a concept to the community.
 * ADR 0004 (Accepted) — Concept-Graph-rooted export; own-authored TA-signed
 * events only; Header as the graceful floor; reuse the existing browser
 * publish primitive (`publishEverywhere`); owner-only.
 *
 * Precedent: stories #5 / #6 / strfry-router-first-boot — the deterministic
 * part of a relay/Neo4j feature is pinned with source/structural sentinels;
 * the actual round-trip (events landing on relays, foreign nodes excluded,
 * idempotency, partial-failure reporting, owner-only enforcement) is NOT
 * reproducible in this hand-rolled Node runner and is the **authoritative
 * behavioral gate via local docker smoke (cycle-local) + staging**, documented
 * in the test plan §"Not covered". The Reviewer must treat that smoke as
 * required, not optional.
 *
 * Deliberate limitation (read this): ADR 0004 left the exact route name/path
 * open ("new handler under src/api/concept/ OR extend src/api/concept-graph/").
 * These sentinels therefore pin the **stable contract** the ADR did fix —
 * (a) the feature is wired through the existing publish primitive, (b) export
 * is provenance-filtered to this instance's own pubkey — WITHOUT prescribing
 * the open mechanism. A semantically-correct implementation that renames
 * things keeps these green by updating the anchor; a missing or
 * provenance-unsafe implementation fails.
 *
 * TE1, TE2 : FAIL pre-implementation, PASS post.
 * RE1      : PASS pre AND post — scope guard; a flip to FAIL means the
 *            Implementer drifted to ADR Option B (new server-side external
 *            publisher) or changed the out-of-scope publish primitive.
 *            Widened by graph-operations-first-slice ADR 0034 Decision 11
 *            (export nostr, story 34): it scans src/operations/ as well as
 *            src/api/, catches nostr-tools' AbstractRelay and Relay beside
 *            SimplePool, and excludes src/operations/catalog/export/ (export
 *            nostr's sender, "its own ADR and its own exclusion") beside
 *            src/api/dlist-curation/. Import nostr's reader,
 *            src/operations/catalog/import/_relay.js, uses AbstractRelay but
 *            never publishes, so it holds.
 *            Widened again at story 34's review round 1 (blocking finding 1;
 *            ADR 0034 Amendment 2 item 6): export's sender names no relay
 *            class, since it takes its relay from _relay.js's open(), so RE1
 *            missed a copy of it. relayPublisher(text) now flags any file
 *            that calls .publish( on a relay it makes with SimplePool,
 *            AbstractRelay or Relay, or gets from import's _relay.js, and RE1
 *            checks first that it flags _send.js's own text.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOSTR_PUBLISH = path.join(ROOT, 'ui/src/utils/nostrPublish.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

/** Recursively collect .js/.jsx files under a dir (no node_modules under these trees). */
function collect(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(p));
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const UI_FILES = collect(path.join(ROOT, 'ui/src'));
const API_FILES = collect(path.join(ROOT, 'src/api'));
// graph-operations-first-slice ADR 0034 Decision 11: RE1 scans the operations module too.
const OPERATIONS_FILES = collect(path.join(ROOT, 'src/operations'));

// A concept-scoped export/publish token (distinct from the existing
// per-PROFILE publishEverywhere usage in ui/src/hooks/useProfileActions.js).
const CONCEPT_EXPORT = /export-set|publish[-\s.]{0,3}concept|concept[\s\S]{0,40}export/i;

// RE1's test of a file (graph-operations-first-slice ADR 0034 Amendment 2 item 6, from story 34's review round 1,
// blocking finding 1): a server-side publisher calls .publish( on a relay, one it makes with nostr-tools' SimplePool,
// AbstractRelay or Relay, or one it gets from import nostr's reader, src/operations/catalog/import/_relay.js, whose
// open() answers the connected relay, as export nostr's _send.js gets its own. The require is read by the module's
// name, wherever the file sits, so a copy of the sender with its requires re-pointed is caught too.
const RELAY_CLASS = /\b(SimplePool|AbstractRelay|Relay)\b/;
const IMPORT_READER = /(?:require|import)\s*\(\s*['"`][^'"`]*\/_relay(?:\.js)?['"`]\s*\)|\bfrom\s+['"`][^'"`]*\/_relay(?:\.js)?['"`]/;
function relayPublisher(text) {
  const s = String(text);
  return /\.publish\s*\(/.test(s) && (RELAY_CLASS.test(s) || IMPORT_READER.test(s));
}
const EXPORT_SENDER = path.join(ROOT, 'src/operations/catalog/export/_send.js');

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #9 is implemented per ADR 0004.
// ---------------------------------------------------------------------------

test('TE1: a "publish concept" action is wired through the existing publishEverywhere primitive (AC-1, ADR 0004 Option A)', () => {
  const wired = UI_FILES.some((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return s.includes('publishEverywhere') && CONCEPT_EXPORT.test(s);
  });
  assert(
    wired,
    'No UI surface pairs a concept event-set export with `publishEverywhere` (AC-1; ADR 0004 ' +
      'Option A: the owner "Publish concept" action loops the existing browser publish primitive ' +
      'over the concept\'s constituent events). The existing per-profile use of publishEverywhere ' +
      'in useProfileActions.js does NOT satisfy this — a concept-scoped export/publish path must ' +
      'exist. STRUCTURAL sentinel only; the authoritative proof (events actually reach the ' +
      'community relays, Concept-Graph-rooted) is the local/staging smoke in the test plan.'
  );
});

test('TE2: a server endpoint enumerates a concept\'s OWN-authored events (provenance filter to this TA pubkey) (AC-2/AC-6, ADR 0004)', () => {
  const ok = API_FILES.some((f) => {
    const s = fs.readFileSync(f, 'utf8');
    const isExport = CONCEPT_EXPORT.test(s);
    const provenance =
      /getTAPubkey|getOwnerAssistantPubkey/.test(s) &&
      /\bpubkey\b\s*[:=]|n\.pubkey|\.pubkey\s*=|pubkey\s*===|WHERE[\s\S]{0,80}pubkey/i.test(s);
    return isExport && provenance;
  });
  assert(
    ok,
    'No server export path enumerates a concept\'s constituent events filtered to THIS ' +
      'instance\'s own/TA pubkey (AC-2 provenance principle: you never re-export someone ' +
      'else\'s concept under your identity; ADR 0004 Implementation notes: `WHERE node.pubkey ' +
      '= <TA pubkey>`). Owner-only enforcement (AC-6) and the actual exclusion of foreign ' +
      'nodes are the authoritative local/staging smoke gate — this sentinel only pins that ' +
      'the provenance filter is present in source.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinel — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('RE1: publish primitive reused unchanged; no ADR-Option-B server-side external publisher introduced', () => {
  const np = fs.readFileSync(NOSTR_PUBLISH, 'utf8');
  assert(
    /export\s+(async\s+)?function\s+publishEverywhere/.test(np) && /PUBLISH_RELAYS\s*=/.test(np),
    'ui/src/utils/nostrPublish.js must keep exporting `publishEverywhere` and defining ' +
      '`PUBLISH_RELAYS` (ADR 0004 Option A: reuse as-is, "No change to nostrPublish.js"). ' +
      'Sentinel failing ⇒ the out-of-scope publish primitive was altered.'
  );
  // dlist-curation #4 (ADR dlist-curation/0004; operator decision 2026-09-10): the assistant
  // curation-header endpoint is the justification this ADR's "not justified yet" left room for —
  // its signer is a server-held assistant key no browser can use, and the router's community
  // stream may be off. The posture stands for every OTHER module; that one directory is excluded.
  // graph-operations-first-slice ADR 0034 Decision 11 (export nostr): its sender, under
  // src/operations/catalog/export/, is another server-side publisher, with its own ADR and its
  // own exclusion. A third, built the same way anywhere else under src/api/ or src/operations/, is caught.
  const SUPERSEDED_BY_ADR = [
    path.join(ROOT, 'src/api/dlist-curation') + path.sep,
    path.join(ROOT, 'src/operations/catalog/export') + path.sep,
  ];
  // The test bites on export's own sender (story 34's review round 1, blocking finding 1): its text, wherever it sat,
  // is a publisher, though it names no relay class. Only its folder's exclusion lets it pass.
  assert(
    fs.existsSync(EXPORT_SENDER) && relayPublisher(fs.readFileSync(EXPORT_SENDER, 'utf8')),
    'RE1\'s test must flag export nostr\'s own sender, src/operations/catalog/export/_send.js, by its text: it calls ' +
      '.publish( on the relay import\'s _relay.js open() answers (ADR 0034 Decision 6 and Amendment 2 item 6), so a ' +
      'copy of it anywhere outside the excluded folders is a third publisher. ' +
      (fs.existsSync(EXPORT_SENDER) ? 'relayPublisher() answered no for it.' : 'The file does not exist.')
  );
  assert(
    relayPublisher("const { SimplePool } = require('nostr-tools');\nnew SimplePool().publish(relays, event);"),
    'RE1\'s test must still flag a publisher built on a relay class it makes, such as SimplePool (the test RE1 had before).'
  );
  const optionB = [...API_FILES, ...OPERATIONS_FILES].filter((f) => !SUPERSEDED_BY_ADR.some((dir) => f.startsWith(dir))).find((f) => relayPublisher(fs.readFileSync(f, 'utf8')));
  assert(
    !optionB,
    'A server-side external-relay publisher (.publish() on a relay made with SimplePool, AbstractRelay or Relay, or got from import\'s _relay.js) was introduced' +
      (optionB ? ` in ${path.relative(ROOT, optionB)}` : '') +
      ' — that is ADR 0004 Option B, explicitly REJECTED for this stub, outside the two directories ' +
      'an ADR excludes (src/api/dlist-curation/, dlist-curation ADR 0004; src/operations/catalog/export/, ' +
      'graph-operations-first-slice ADR 0034). (Pre-impl: fetchEvents.js uses SimplePool.querySync ' +
      'for FETCH only, and import nostr\'s _relay.js uses AbstractRelay to read only, never .publish — this guard holds.)'
  );
});

async function run() {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
