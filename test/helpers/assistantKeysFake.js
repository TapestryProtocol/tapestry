'use strict';
/**
 * The instance's assistant key, for the suites whose operation signs as the assistant (story
 * graph-operations-first-slice #34, export nostr; ADR graph-operations-first-slice/0034 Decision 1, `no-assistant-key`;
 * its test plan's "harness hooks"). Run in a child process, before the catalog loads: test/helpers/operationsHarness.js
 * for spec.assistantKeys, test/helpers/externalCliServer.js for the same.
 *
 *   install({ root, keys })   keys { privkey } (a 64-hex secret) or null. From then on src/utils/assistantKeys.js's
 *                             getOwnerAssistantKeys() answers { privkey, pubkey, npub, nsec } for that secret, or null
 *                             for none: a Module._load interception sets it on the module's exports as the module loads,
 *                             as the harness's spy wraps what it watches, so a destructured import gets it too; and on
 *                             the exports at once when the module is loaded already. The real key store is never opened.
 * When the harness's spy is on (globalThis.__signingSpy), each call is recorded as assistantKeys.getOwnerAssistantKeys.
 */

const path = require('path');
const Module = require('module');

function keysOf(root, keys) {
  if (!keys || typeof keys.privkey !== 'string') return null;
  if (!/^[0-9a-f]{64}$/.test(keys.privkey)) throw new Error('assistantKeys.privkey must be 64 lowercase hex characters');
  const NT = require(require.resolve('nostr-tools', { paths: [root] }));
  const sk = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
  const pubkey = NT.getPublicKey(sk);
  return { privkey: keys.privkey, pubkey, npub: NT.nip19.npubEncode(pubkey), nsec: NT.nip19.nsecEncode(sk) };
}

function install({ root, keys }) {
  const held = keysOf(root, keys);
  async function getOwnerAssistantKeys() {
    if (Array.isArray(globalThis.__signingSpy)) globalThis.__signingSpy.push('assistantKeys.getOwnerAssistantKeys');
    return held ? { ...held } : null;
  }
  const target = path.join(root, 'src', 'utils', 'assistantKeys.js');
  const done = new WeakSet();
  const patch = (exp) => {
    if (exp && typeof exp === 'object' && !done.has(exp)) { exp.getOwnerAssistantKeys = getOwnerAssistantKeys; done.add(exp); }
    return exp;
  };
  const origLoad = Module._load;
  Module._load = function assistantKeysLoad(request, parent, isMain) {
    const exp = origLoad.apply(this, arguments);
    if (typeof request !== 'string' || !/assistantKeys/.test(request)) return exp;
    let file = '';
    try { file = Module._resolveFilename(request, parent, isMain); } catch { /* a built-in */ }
    return file === target ? patch(exp) : exp;
  };
  if (require.cache[target]) patch(require.cache[target].exports);
}

module.exports = { install, keysOf };
