'use strict';
/**
 * The route table's entries for the declared operations (ADR graph-operations-foundation/0001 Decision 3).
 * src/middleware/routeAccess.js spreads them into ROUTE_ACCESS, so the central check enforces each operation's access,
 * the table stays total, and the route sweep sees an exact key for each route. A declaration can only be for the owner
 * and admins ('owner') or the owner only ('owner-only'); one that asks for more is invalid and gets no route and no
 * entry, and an unmatched path still resolves to 'owner'.
 *
 * This file must not require src/middleware/auth.js, which requires routeAccess.js: the access re-check is in http.js.
 */

const { loadOperations } = require('./index');

const TABLE_ACCESS = Object.freeze({ 'owner-and-admins': 'owner', 'owner-only': 'owner-only' });

/** { "<METHOD> /api/tapestry/<group>/<name>": { access, kind } } for every valid operation in the catalog at `dir`. */
function routeAccessEntries(opts) {
  const entries = {};
  for (const op of loadOperations(opts).operations) {
    const access = TABLE_ACCESS[op.access];
    if (!access) continue;
    entries[`${op.method} ${op.route}`] = Object.freeze({ access, kind: op.kind === 'write' ? 'action' : 'read' });
  }
  return entries;
}

module.exports = { routeAccessEntries };
