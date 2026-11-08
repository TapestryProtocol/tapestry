'use strict';
/**
 * The operations' routes (ADR graph-operations-foundation/0001 Decisions 3, 4 and 8). Each valid operation answers at
 * /api/tapestry/<group>/<name>: GET for a read, with its inputs in the query string, and POST for a write, with its
 * inputs in a JSON body. GET /api/tapestry/operations lists the operations the caller may call.
 *
 * The central check (src/middleware/auth.js, with each route's entry from routeTable.js) normally answers first. The
 * handlers check the caller again against the declaration, so the module never runs an operation for a caller its
 * declaration doesn't admit, whatever middleware is in front of it. Sign-in is the instance's own signed-challenge
 * handshake (ADR security-auth-exposure/0003); nothing new.
 */

const { loadOperations, callOperation, listEntry, LIST_ROUTE } = require('./index');
const { getConfigFromFile, getAdminPubkeys } = require('../utils/config');

/**
 * Who is calling: a direct-local caller (the central check stamped req.localTrusted), the owner, an admin, someone
 * else signed in, or null for a visitor.
 */
function callerOf(req) {
  if (req.localTrusted === true) return { role: 'local', pubkey: null };
  const s = req.session;
  if (!s || s.authenticated !== true || !s.pubkey) return null;
  const owner = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
  if (owner && s.pubkey === owner) return { role: 'owner', pubkey: s.pubkey };
  if (getAdminPubkeys().includes(s.pubkey)) return { role: 'admin', pubkey: s.pubkey };
  return { role: 'signed-in', pubkey: s.pubkey };
}

/** Whether `caller` may use something open to `access`; if not, the refusal, in the central check's words. */
function gate(access, caller) {
  const ownerOnly = access === 'owner-only';
  if (!caller) {
    return { status: 401, body: { success: false, error: ownerOnly ? 'Sign in as the owner to do this.' : 'Sign in as the owner or an admin to do this.', code: 'sign-in-required' } };
  }
  if (caller.role === 'local' || caller.role === 'owner') return null;
  if (!ownerOnly && caller.role === 'admin') return null;
  return { status: 403, body: { success: false, error: ownerOnly ? 'Only the owner can do this.' : 'Only the owner or an admin can do this.', code: 'not-allowed' } };
}

function operationHandler(op) {
  const source = op.method === 'GET' ? 'query' : 'body';
  return async function tapestryOperation(req, res) {
    // Express 4 doesn't catch a rejected async handler, and an unhandled rejection ends the process, so nothing may
    // escape this function (review round 1, non-blocking 1).
    try {
      const caller = callerOf(req);
      const refused = gate(op.access, caller);
      if (refused) return res.status(refused.status).json(refused.body);
      const raw = source === 'query' ? req.query : req.body;
      const { status, body } = await callOperation(op, raw, { via: 'http', caller }, { source });
      return res.status(status).json(body);
    } catch (err) {
      if (res.headersSent) return undefined;
      return res.status(500).json({ success: false, error: `${op.group} ${op.name} failed: ${(err && err.message) || String(err)}`, code: 'failed' });
    }
  };
}

function listHandler(opts) {
  return function tapestryOperationsList(req, res) {
    const caller = callerOf(req);
    const refused = gate('owner-and-admins', caller);
    if (refused) return res.status(refused.status).json(refused.body);
    const { operations, problems } = loadOperations(opts);
    const visible = operations.filter((op) => caller.role !== 'admin' || op.access === 'owner-and-admins');
    return res.json({ success: true, data: { operations: visible.map(listEntry), problems: problems.map(({ file, problem }) => ({ file, problem })) } });
  };
}

/**
 * Register one route per valid operation in the catalog at `dir` (src/operations/catalog by default), and the list.
 * A declaration that breaks a rule is left out, and each problem is logged once.
 */
function registerOperationRoutes(app, { dir } = {}) {
  const opts = { dir };
  const { operations, problems } = loadOperations(opts);
  for (const p of problems) console.warn(`[operations] left out ${p.file}: ${p.problem}`);
  for (const op of operations) app[op.method.toLowerCase()](op.route, operationHandler(op));
  app.get(LIST_ROUTE, listHandler(opts));
}

module.exports = { registerOperationRoutes, callerOf, gate };
