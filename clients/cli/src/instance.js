'use strict';
/**
 * Which instance, and the HTTP calls to it (ADR graph-operations-foundation/0006 Decision 4).
 *
 * The instance is --instance, then TAPESTRY_INSTANCE, then config.json's instance (which `tapestry use <url>` writes).
 * It is an origin, https, or plain http only for this machine, because a sign-in's cookie must not cross a network in
 * clear text. Calls never follow a redirect, so a cookie or a signed challenge can't be bounced to another host, and
 * each has a timeout of TAPESTRY_TIMEOUT seconds (300 by default).
 */

const { Usage, Setup, Failed } = require('./errors');
const { readConfig } = require('./identity');

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_TIMEOUT_S = 300;

/** The origin of an instance URL, or a Usage error saying what's wrong with it. */
function originOf(raw, where = 'The instance URL') {
  let u;
  try { u = new URL(String(raw).trim()); } catch {
    throw new Usage(`${where} ${JSON.stringify(raw)} isn't a URL. Give the instance's origin, like https://tapestry.example.com.`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Usage(`${where} must start with https:// (got ${u.protocol}).`);
  if (u.username || u.password) throw new Usage(`${where} must not carry a user name or a password.`);
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) {
    throw new Usage(`${where} is an origin only, like ${u.protocol}//${u.host}, with no path, query or fragment (got ${JSON.stringify(raw)}).`);
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol === 'http:' && !LOOPBACK.has(host) && !host.endsWith('.localhost')) {
    throw new Usage(`${where} must use https: a sign-in's cookie must not cross a network in clear text. Plain http is allowed only for this machine (localhost, 127.0.0.1, [::1]).`);
  }
  return u.origin;
}

function resolveInstance({ instance, env, home }) {
  if (instance) return originOf(instance, 'The --instance URL');
  if (env.TAPESTRY_INSTANCE) return originOf(env.TAPESTRY_INSTANCE, 'TAPESTRY_INSTANCE');
  const config = readConfig(home);
  if (config.instance) return originOf(config.instance, "config.json's instance");
  throw new Setup('No instance to talk to. Give --instance <url> before the command, set TAPESTRY_INSTANCE, or run `tapestry use <url>` once.');
}

function timeoutMs(env) {
  if (env.TAPESTRY_TIMEOUT === undefined || env.TAPESTRY_TIMEOUT === '') return DEFAULT_TIMEOUT_S * 1000;
  const s = Number(env.TAPESTRY_TIMEOUT);
  if (!Number.isFinite(s) || s <= 0) throw new Usage(`TAPESTRY_TIMEOUT must be a number of seconds above 0 (got ${JSON.stringify(env.TAPESTRY_TIMEOUT)}).`);
  return Math.round(s * 1000);
}

/** The instance's session cookie, from a response's Set-Cookie headers: { cookie: 'connect.sid=…', expires } or null. */
function sessionCookie(setCookies) {
  for (const c of setCookies || []) {
    const pair = String(c).split(';')[0].trim();
    if (!pair.startsWith('connect.sid=')) continue;
    const m = /;\s*expires=([^;]+)/i.exec(String(c));
    const at = m ? Date.parse(m[1]) : NaN;
    return { cookie: pair, expires: Number.isFinite(at) ? at : null };
  }
  return null;
}

/**
 * One call: { status, json, cookies }. A redirect, no answer, a timeout, or an answer that isn't a JSON object is a
 * Failed, saying which.
 */
async function send(origin, method, route, { cookie, body, timeout, version }) {
  const headers = { 'User-Agent': `tapestry-operations-cli/${version}`, Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const what = `${method} ${route.split('?')[0]}`;
  let res;
  let text;
  try {
    res = await fetch(`${origin}${route}`, { method, headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    text = await res.text();
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Failed(`${what} on ${origin} timed out after ${timeout / 1000} seconds (TAPESTRY_TIMEOUT).`);
    const cause = e && e.cause ? (e.cause.code || e.cause.message) : (e && e.message);
    throw new Failed(`Couldn't reach ${origin}: ${cause || e}.`);
  }
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    let to = loc;
    try { to = new URL(loc, origin).href; } catch { /* as given */ }
    throw new Failed(`${origin} answered ${what} with a redirect (HTTP ${res.status}) to ${to || 'nowhere'}. Redirects aren't followed, so nothing was sent there; if that is the instance, use its address.`);
  }
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Failed(`${origin} answered ${what} with HTTP ${res.status} that isn't JSON (${JSON.stringify(String(text).slice(0, 80))}). Is it a Tapestry instance?`);
  }
  return { status: res.status, json, cookies: typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [] };
}

module.exports = { originOf, resolveInstance, timeoutMs, sessionCookie, send };
