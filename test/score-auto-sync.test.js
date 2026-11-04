'use strict';
/**
 * brains-launcher #1: signing in only downloads a point of view's scores when there is a search index to load them into.
 * ADR:   engineering-team/decisions/brains-launcher/0001-one-droplet-compose-launcher.md
 * Story: engineering-team/stories/brains-launcher/1-launch-a-brain.md
 *
 * The scores feed the search index. A brain runs with search off, so it would download them (160,359 events on one
 * instance) for nothing, and stop being blank. Asking for them by hand still works.
 *
 * Stack-free. The check runs for real against stub responses; the pages' wiring is checked on source.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const PAGES = ['ui/src/pages/BrainstormSearch.jsx', 'ui/src/pages/BrainstormSettings.jsx'];

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function loadCheck() {
  const url = pathToFileURL(path.join(REPO, 'ui/src/utils/searchIndex.js')).href;
  const mod = await import(url);
  assert(typeof mod.searchIndexIsUp === 'function', 'ui/src/utils/searchIndex.js must export searchIndexIsUp');
  return mod.searchIndexIsUp;
}

const answering = (status, body) => async () => ({ status, ok: status < 400, json: async () => body });

test('S1: the index counts as up when the stats route says so', async () => {
  const up = await loadCheck();
  assert((await up(answering(200, { success: true, numberOfDocuments: 0 }))) === true, 'expected true');
});

test('S2: search not running (the route answers 503) is not up', async () => {
  const up = await loadCheck();
  assert((await up(answering(503, { success: false, error: 'fetch failed' }))) === false, 'expected false');
});

test('S3: a failed request or a body that is not JSON is not up', async () => {
  const up = await loadCheck();
  assert((await up(async () => { throw new Error('network'); })) === false, 'a thrown fetch must read as down');
  const notJson = async () => ({ status: 200, ok: true, json: async () => { throw new Error('not json'); } });
  assert((await up(notJson)) === false, 'a body that is not JSON must read as down');
});

for (const page of PAGES) {
  test(`S4: ${path.basename(page)} checks the index before it downloads scores on its own`, () => {
    const src = fs.readFileSync(path.join(REPO, page), 'utf8');
    assert(/import \{[^}]*\bsearchIndexIsUp\b[^}]*\} from '\.\.\/utils\/searchIndex'/.test(src), 'import missing');
    assert(!/if \(localCount === 0 && !cancelled\) \{\s*localCount = await triggerSync/.test(src),
      'the download must not start on a local count of 0 alone');
    assert(/localCount === 0 && !cancelled && await searchIndexIsUp\(\)/.test(src), 'the check must guard the download');
  });
}

test('S5: asking for the scores by hand still works on the settings page', () => {
  const src = fs.readFileSync(path.join(REPO, 'ui/src/pages/BrainstormSettings.jsx'), 'utf8');
  assert(/onClick=\{\(\) => triggerSync\(wotStatus\.rankAuthor, wotStatus\.rankRelay\)\}/.test(src), 'the button must stay');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
