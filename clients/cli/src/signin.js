'use strict';
/**
 * Signing in with the agent's own key, through the instance's existing signed-challenge sign-in (ADR
 * graph-operations-foundation/0006 Decision 5; ADR security-auth-exposure/0003 on the instance's side):
 *
 *   1. POST /api/auth/verify-user { pubkey }  → a one-time challenge, kept pending in a session cookie
 *   2. sign { kind 22242, tags [['challenge', c]], content 'Tapestry authentication' }, with the key or the signer
 *   3. POST /api/auth/login-user { event }    → the session, regenerated: the cookie the CLI keeps
 *
 * The key signs nothing else, and nothing else is sent from it. A call that comes back 401 drops the kept sign-in, signs
 * in once more and is retried once (once per run); a 401 is answered before an operation runs, so a write is never sent
 * twice.
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

/** A call made with the kept sign-in, signing in when there's none, and once more after a 401. */
async function authed(ctx, method, route, body) {
  const kept = sessions.get(ctx.home, ctx.origin, ctx.identity.pubkey);
  let cookie = kept ? kept.cookie : await signIn(ctx);
  let r = await send(ctx.origin, method, route, { cookie, body, ...ctx.http });
  if (r.status === 401 && !ctx.signedInAgain) {
    ctx.signedInAgain = true;
    sessions.drop(ctx.home, ctx.origin, ctx.identity.pubkey);
    cookie = await signIn(ctx);
    r = await send(ctx.origin, method, route, { cookie, body, ...ctx.http });
  }
  if (r.status === 401) sessions.drop(ctx.home, ctx.origin, ctx.identity.pubkey);
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

module.exports = { signIn, authed, signOut, SIGN_IN_KIND, SIGN_IN_CONTENT };
