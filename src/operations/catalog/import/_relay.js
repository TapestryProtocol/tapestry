'use strict';
/**
 * import nostr's reader (story graph-operations-first-slice #32; ADR graph-operations-first-slice/0032 Decision 2): one
 * connection a call, requests one at a time, each read to its end of stored events (EOSE) within 10 s; connecting gets
 * 5 s and one retry, as readRelayEvents does (src/api/_shared/relaySource.js).
 *
 *   connect(url)   the seam: resolves a relay with nostr-tools' subscribe(filters, { onevent, oneose, onclose }) →
 *                  { close() }, and close(). open() calls it through this object, `module.exports`, at each connection,
 *                  so a suite replaces it (test/helpers/relayFake.js), as src/operations/graph.js's methods are replaced.
 *   open(url)      → { request(filter), close() }, or { error } when neither try connected
 *                  request(filter) → { ok: true, events } at the end of stored events, or { ok: false, error } when the
 *                  relay closed the request or sent no end within 10 s
 *
 * Every event comes back as the relay sent it: the real relay is given a verifyEvent that takes everything, so checking
 * each event is the import's own (Decision 3), and an invalid one is reported, never dropped unseen. Nothing is
 * published. It requires nothing at load that opens anything (ADR graph-operations-foundation/0001 Decision 10).
 */

const CONNECT_MS = 5000;
const REQUEST_MS = 10000;

const words = (err) => require('./_letters').words(err);

/** Resolve within `ms`, or reject with `message`; the timer is cleared either way. */
function within(promise, ms, message) {
  let timer;
  const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([Promise.resolve(promise), late]).finally(() => clearTimeout(timer));
}

/** One REQ, read to its EOSE. */
function request(relay, filter) {
  return new Promise((resolve) => {
    const events = [];
    let done = false;
    let sub = null;
    let timer = null;
    const finish = (answer) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { if (sub) sub.close(); } catch { /* the request is over either way */ }
      resolve(answer);
    };
    timer = setTimeout(() => finish({ ok: false, error: `the relay sent no end of stored events within ${REQUEST_MS / 1000} s` }), REQUEST_MS);
    try {
      sub = relay.subscribe([filter], {
        onevent(e) { if (!done) events.push(e); },
        oneose() { finish({ ok: true, events }); },
        onclose(reason) { finish({ ok: false, error: `the relay closed the request: ${words(reason)}` }); },
        // nostr-tools ends a request on its own after its eoseTimeout; ours is the 10 s above.
        eoseTimeout: REQUEST_MS + 1000,
      });
      if (done && sub) { try { sub.close(); } catch { /* already over */ } }
    } catch (err) {
      finish({ ok: false, error: words(err) });
    }
  });
}

const reader = {
  CONNECT_MS,
  REQUEST_MS,

  async connect(url) {
    const { AbstractRelay } = require('nostr-tools/abstract-relay');
    const relay = new AbstractRelay(url, {
      verifyEvent: () => true,
      websocketImplementation: typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : require('ws'),
    });
    relay.connectionTimeout = CONNECT_MS;
    // A NOTICE would otherwise go to console.debug, which is the command's stdout.
    relay.onnotice = () => {};
    await relay.connect();
    return relay;
  },

  async open(url) {
    let relay = null;
    let last = null;
    for (let attempt = 0; attempt < 2 && relay === null; attempt += 1) {
      try {
        relay = await within(reader.connect(url), CONNECT_MS, `the connection timed out after ${CONNECT_MS / 1000} s`);
      } catch (err) {
        last = err;
        relay = null;
      }
    }
    if (relay === null) return { error: words(last) };
    return {
      request: (filter) => request(relay, filter),
      close() { try { relay.close(); } catch { /* going away either way */ } },
    };
  },
};

module.exports = reader;
