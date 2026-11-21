'use strict';
/**
 * import nostr's reader (story graph-operations-first-slice #32; ADR graph-operations-first-slice/0032 Decision 2): one
 * connection a call, requests one at a time, each read to its end of stored events (EOSE) within REQUEST_MS (10 s);
 * connecting gets CONNECT_MS (5 s) and one retry, as readRelayEvents does (src/api/_shared/relaySource.js).
 *
 *   connect(url)   the seam: resolves a relay with nostr-tools' subscribe(filters, { onevent, oneose, onclose }) →
 *                  { close() }, and close(). open() calls it through this object, `module.exports`, at each connection,
 *                  so a suite replaces it (test/helpers/relayFake.js), as src/operations/graph.js's methods are replaced.
 *   open(url)      → { request(filter), close(), relay }, or { error } when neither try connected
 *                  request(filter) → { ok: true, events } at the end of stored events, or { ok: false, error } when the
 *                  relay closed the request or the connection, or sent no end within REQUEST_MS
 *                  relay: the connected relay itself, its send already wrapped as below, for export nostr's sender
 *                  (story graph-operations-first-slice #34; ADR graph-operations-first-slice/0034 Decision 6), which
 *                  checks relay.connected before each send of its own. This reader never sends an event
 *   CONNECT_MS, REQUEST_MS  read through this object at each call, so a suite can shorten them (review round 1)
 *
 * The real relay is given a verifyEvent that takes everything, so a bad signature reaches the import's own check
 * (Decision 3) and is reported, never dropped unseen. nostr-tools still drops, before onevent, an event that doesn't
 * match the request's filters, and one whose shape makes its matchFilter throw. A request keeps no more events than its
 * filter's limit asks for, whatever the relay sends. Nothing is published. It requires nothing at load that opens
 * anything (ADR graph-operations-foundation/0001 Decision 10).
 */

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
    // A connection the relay has closed takes no more requests: they end unread at once (review round 1, blocking 1).
    if (relay.connected === false) { resolve({ ok: false, error: 'the relay closed the connection' }); return; }
    const ms = reader.REQUEST_MS;
    const most = Number.isInteger(filter.limit) && filter.limit >= 0 ? filter.limit : Infinity;
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
    timer = setTimeout(() => finish({ ok: false, error: `the relay sent no end of stored events within ${ms / 1000} s` }), ms);
    try {
      sub = relay.subscribe([filter], {
        onevent(e) { if (!done && events.length < most) events.push(e); },
        oneose() { finish({ ok: true, events }); },
        onclose(reason) { finish({ ok: false, error: `the relay closed the request: ${words(reason)}` }); },
        // nostr-tools ends a request on its own after its eoseTimeout; ours is the one above.
        eoseTimeout: ms + 1000,
      });
      if (done && sub) { try { sub.close(); } catch { /* already over */ } }
    } catch (err) {
      finish({ ok: false, error: words(err) });
    }
  });
}

const reader = {
  CONNECT_MS: 5000,
  REQUEST_MS: 10000,

  async connect(url) {
    const { AbstractRelay } = require('nostr-tools/abstract-relay');
    const relay = new AbstractRelay(url, {
      verifyEvent: () => true,
      websocketImplementation: typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : require('ws'),
    });
    relay.connectionTimeout = reader.CONNECT_MS;
    // A NOTICE would otherwise go to console.debug, which is the command's stdout.
    relay.onnotice = () => {};
    // nostr-tools' Subscription sends its REQ and CLOSE without awaiting send, which rejects once the connection is gone:
    // unhandled, that rejection would end the process. Here it ends this relay's open requests instead (blocking 1).
    const send = relay.send.bind(relay);
    relay.send = (message) => {
      let sent;
      try { sent = send(message); } catch (err) { sent = Promise.reject(err); }
      return Promise.resolve(sent).catch((err) => {
        try { relay.closeAllSubscriptions(`the relay connection is closed: ${words(err)}`); } catch { /* over either way */ }
      });
    };
    try {
      await relay.connect();
    } catch (err) {
      // nostr-tools' timeout rejects with its socket still open (non-blocking 2): close it.
      try { relay.close(); } catch { /* its socket goes either way */ }
      throw err;
    }
    return relay;
  },

  async open(url) {
    let relay = null;
    let last = null;
    for (let attempt = 0; attempt < 2 && relay === null; attempt += 1) {
      const pending = (async () => reader.connect(url))();
      try {
        relay = await within(pending, reader.CONNECT_MS, `the connection timed out after ${reader.CONNECT_MS / 1000} s`);
      } catch (err) {
        last = err;
        relay = null;
        // A connect that completes after we gave up on it is closed, not left open for nothing to read.
        pending.then((late) => { try { late.close(); } catch { /* going away either way */ } }, () => {});
      }
    }
    if (relay === null) return { error: words(last) };
    return {
      request: (filter) => request(relay, filter),
      close() { try { relay.close(); } catch { /* going away either way */ } },
      relay,
    };
  },
};

module.exports = reader;
