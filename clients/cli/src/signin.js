'use strict';
/**
 * Signing in with the agent's own key, through the instance's existing signed-challenge sign-in (ADR
 * graph-operations-foundation/0006 Decision 5; ADR security-auth-exposure/0003 on the instance's side):
 *
 *   1. POST /api/auth/verify-user { pubkey }  → a one-time challenge, kept pending in a session cookie
 *   2. sign { kind 22242, tags [['challenge', c]], content 'Tapestry authentication' }, with the key or the signer
 *   3. POST /api/auth/login-user { event }    → the session, regenerated: the cookie the CLI keeps
 *
 * The key signs nothing else, and nothing else is sent from it. A call that comes back with the instance's own sign-in
 * 401 drops the kept sign-in, signs in once more and is retried once (once per run); that 401 is answered before an
 * operation runs, so a write is never sent twice. An operation's own declared 401 is a refusal, never resent.
 */

const sessions = require('./sessions');
const { send, sessionCookie } = require('./instance');
const { Refused, Failed, messageOf } = require('./errors');

const SIGN_IN_KIND = 22242;
const SIGN_IN_CONTENT = 'Tapestry authentication';

/** Sign in afresh; keep and return the session cookie. ctx = { origin, identity, home, http, io }. */
async function signIn(ctx) {
  const { origin, identity, home } = ctx;
  const v = await send(origin, 'POST', '/api/auth/verify-user', { body: { pubkey: identity.pubkey }, ...ctx.http });
  if (v.status >= 500) throw new Failed(`${origin} couldn't start a sign-in (HTTP ${v.status}): ${messageOf(v.json)}`, v.json);
  if (v.status >= 400 || v.json.authorized !== true || typeof v.json.challenge !== 'string') {
    throw new Refused(`${origin} gave ${identity.npub} no sign-in challenge: ${messageOf(v.json)}`, v.json);
  }
  const pending = sessionCookie(v.cookies);
  if (!pending) throw new Failed(`${origin} sent its sign-in challenge without a session cookie, so the signed answer couldn't be matched to it.`);
  const template = { kind: SIGN_IN_KIND, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', v.json.challenge]], content: SIGN_IN_CONTENT, pubkey: identity.pubkey };
  const event = await identity.sign(template);
  const l = await send(origin, 'POST', '/api/auth/login-user', { body: { event }, cookie: pending.cookie, ...ctx.http });
  if (l.status >= 500) throw new Failed(`${origin} couldn't finish the sign-in (HTTP ${l.status}): ${messageOf(l.json)}`, l.json);
  if (l.status >= 400 || l.json.success !== true) throw new Refused(`${origin} refused the signed challenge from ${identity.npub}: ${messageOf(l.json)}`, l.json);
  const kept = sessionCookie(l.cookies) || pending;
  sessions.put(home, origin, identity.pubkey, kept);
  return kept.cookie;
}

/**
 * Whether an answer is the instance's own sign-in refusal (ADR graph-operations-foundation/0006 Decision 5, amended at
 * review round 1): a 401 from the central check, which has no `code`, or from the router's re-check,
 * `sign-in-required`, a built-in code no declaration may use. Both come before an operation runs. Any other 401 is an
 * operation's own declared refusal, answered like any refusal and never resent.
 */
function isSignInRefusal(r) {
  return r.status === 401 && (!r.json || r.json.code === undefined || r.json.code === 'sign-in-required');
}

/**
 * Whether an answer is the instance's own access refusal: a 403 from the central check, which has no `code`, or from
 * the router's re-check, `not-allowed`, a built-in code no declaration may use (review round 2). Any other 403 is an
 * operation's own declared refusal.
 */
function isNotAllowed(r) {
  return r.status === 403 && (!r.json || r.json.code === undefined || r.json.code === 'not-allowed');
}

/** A call made with the kept sign-in, signing in when there's none, and once more after the instance's sign-in 401. */
async function authed(ctx, method, route, body) {
  const kept = sessions.get(ctx.home, ctx.origin, ctx.identity.pubkey);
  let cookie = kept ? kept.cookie : await signIn(ctx);
  let r = await send(ctx.origin, method, route, { cookie, body, ...ctx.http });
  if (isSignInRefusal(r) && !ctx.signedInAgain) {
    ctx.signedInAgain = true;
    sessions.drop(ctx.home, ctx.origin, ctx.identity.pubkey);
    cookie = await signIn(ctx);
    r = await send(ctx.origin, method, route, { cookie, body, ...ctx.http });
  }
  if (isSignInRefusal(r)) sessions.drop(ctx.home, ctx.origin, ctx.identity.pubkey);
  return r;
}

/** End the kept sign-in on the instance, and forget it here, even when the instance can't be reached. */
async function signOut(ctx) {
  const kept = sessions.get(ctx.home, ctx.origin, ctx.identity.pubkey);
  let problem = null;
  if (kept) {
    try { await send(ctx.origin, 'POST', '/api/auth/logout', { cookie: kept.cookie, ...ctx.http }); } catch (e) { problem = e.message; }
  }
  sessions.drop(ctx.home, ctx.origin, ctx.identity.pubkey);
  return { hadSignIn: !!kept, problem };
}

module.exports = { signIn, authed, signOut, isSignInRefusal, isNotAllowed, SIGN_IN_KIND, SIGN_IN_CONTENT };
