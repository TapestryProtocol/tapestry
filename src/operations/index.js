'use strict';
/**
 * The operations module — the loader and registry (story graph-operations-foundation #1, ADR
 * graph-operations-foundation/0001; design docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md).
 *
 * Each operation is one declaration file, src/operations/catalog/<group>/<name>.js. Nothing lists the operations by
 * hand: the loader reads the folder, and every surface is made from what it loads — the route
 * (/api/tapestry/<group>/<name>, http.js), the route table's entry (routeTable.js), the /docs entry (openapi.js), the
 * command `tapestry <group> <name>` (cli.js) and the list at GET /api/tapestry/operations. So adding an operation is
 * adding its file (and its own suite under test/operations/), with no shared file to edit.
 *
 * Only files whose name is kebab-case plus `.js` are declarations. Anything else beside them (status.parts.js,
 * _shared.js, a README) is the operation's own helper and is ignored. A declaration that breaks a rule
 * (declaration.js) is left out of every surface and reported as a problem; one bad file never stops the instance.
 *
 * Loading has no side effects (Decision 10): the route table, the entrypoint and the gate load the catalog, so a
 * declaration file requires nothing at load time that opens a connection or a file — its run() does that, lazily.
 */

const fs = require('fs');
const path = require('path');
const { validateDeclaration, builtInRefusalsFor, METHODS } = require('./declaration');
const { checkInputs } = require('./inputs');
const { isRefusal } = require('./refusal');

const DEFAULT_DIR = path.join(__dirname, 'catalog');
const PREFIX = '/api/tapestry';
const LIST_ROUTE = `${PREFIX}/operations`;
const DECLARATION_FILE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.js$/;

const loaded = new Map();

/** A loaded operation: the declaration's facts, its route and command, and the declaration itself (for run). */
function describe(decl, file) {
  return Object.freeze({
    group: decl.group,
    name: decl.name,
    kind: decl.kind,
    access: decl.access,
    method: METHODS[decl.kind],
    route: `${PREFIX}/${decl.group}/${decl.name}`,
    command: `tapestry ${decl.group} ${decl.name}`,
    summary: decl.summary,
    description: decl.description || '',
    inputs: decl.inputs || {},
    result: { description: decl.result.description || '', schema: decl.result.schema },
    refusals: [...builtInRefusalsFor(decl), ...(decl.refusals || []).map(({ code, status, when }) => ({ code, status, when }))],
    declaredRefusals: decl.refusals || [],
    file,
    declaration: decl,
  });
}

/**
 * Load the catalog at `dir` (src/operations/catalog by default), once per folder.
 * @returns {{ operations: object[], problems: { file: string, problem: string }[] }} `file` is relative to the catalog
 */
function loadOperations({ dir = DEFAULT_DIR } = {}) {
  const root = path.resolve(dir);
  if (loaded.has(root)) return loaded.get(root);
  const operations = [];
  const problems = [];
  const groups = fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : [];
  for (const group of groups) {
    for (const f of fs.readdirSync(path.join(root, group)).sort()) {
      if (!DECLARATION_FILE.test(f)) continue;
      const abs = path.join(root, group, f);
      const file = `${group}/${f}`;
      let decl;
      try {
        decl = require(abs);
      } catch (e) {
        problems.push({ file, problem: `it failed to load: ${e.message}` });
        continue;
      }
      const issues = validateDeclaration(decl, { group, name: f.slice(0, -3) });
      if (issues.length) {
        problems.push({ file, problem: issues.join('; ') });
        continue;
      }
      operations.push(describe(decl, file));
    }
  }
  const result = Object.freeze({ operations: Object.freeze(operations), problems: Object.freeze(problems) });
  loaded.set(root, result);
  return result;
}

function findOperation(group, name, opts) {
  return loadOperations(opts).operations.find((o) => o.group === group && o.name === name) || null;
}

/**
 * Check the inputs, run the operation, and give the answer every surface sends.
 * @param {object} op          a loaded operation
 * @param {*} raw              its raw inputs: the query, the command's flags, or the JSON body
 * @param {{ via: 'http'|'cli', caller: { role: string, pubkey: string|null } }} context
 * @param {{ source: 'query'|'cli'|'body' }} opts
 * @returns {Promise<{ status: number, body: object }>}
 */
async function callOperation(op, raw, context, { source = 'query' } = {}) {
  const checked = checkInputs(op, raw, source);
  if (!checked.ok) return { status: 400, body: { success: false, ...checked.refusal } };
  try {
    const data = await op.declaration.run(checked.inputs, context);
    return { status: 200, body: { success: true, data: data === undefined ? null : data } };
  } catch (err) {
    if (isRefusal(err)) {
      const declared = op.declaredRefusals.find((r) => r.code === err.code);
      if (declared) return { status: declared.status, body: { success: false, error: err.message, code: err.code } };
      return {
        status: 500,
        body: { success: false, error: `${op.group} ${op.name} failed: it refused with '${err.code}', which its declaration doesn't list (${err.message})`, code: 'failed' },
      };
    }
    return { status: 500, body: { success: false, error: `${op.group} ${op.name} failed: ${(err && err.message) || String(err)}`, code: 'failed' } };
  }
}

/** An operation as the list shows it: the facts /docs shows, machine-readable (AC7). */
function listEntry(op) {
  const { group, name, summary, description, kind, access, method, route, command, inputs, result, refusals } = op;
  return { group, name, summary, description, kind, access, method, route, command, inputs, result, refusals };
}

module.exports = { loadOperations, findOperation, callOperation, listEntry, DEFAULT_DIR, PREFIX, LIST_ROUTE };
