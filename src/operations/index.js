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
const { hasFileResult } = require('./files');
const { findRule } = require('./rules');

const DEFAULT_DIR = path.join(__dirname, 'catalog');
const PREFIX = '/api/tapestry';
const LIST_ROUTE = `${PREFIX}/operations`;
const DECLARATION_FILE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.js$/;

const loaded = new Map();

/** How every surface words a failure: the thrown error's message, or the thing thrown (memo #96; ADR 0004 Decision 11). */
function failureMessage(err) {
  return (err && err.message) || String(err);
}

/** A write's guards' refusals, which it can return as its own (ADR graph-operations-foundation/0004 Decision 2). */
function guardRefusals(decl) {
  const out = [];
  for (const g of decl.guards || []) {
    const rule = findRule(g.rule);
    for (const r of (rule && rule.refusals) || []) if (!out.some((x) => x.code === r.code)) out.push({ code: r.code, status: r.status, when: r.when });
  }
  return out;
}

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
    result: hasFileResult(decl)
      ? { description: decl.result.description || '', file: { contentType: decl.result.file.contentType } }
      : { description: decl.result.description || '', schema: decl.result.schema },
    body: decl.body ? { file: { contentTypes: [...decl.body.file.contentTypes], maxBytes: decl.body.file.maxBytes } } : null,
    refusals: [...builtInRefusalsFor(decl), ...guardRefusals(decl), ...(decl.refusals || []).map(({ code, status, when }) => ({ code, status, when }))],
    declaredRefusals: decl.refusals || [],
    // A write through the write path (ADR graph-operations-foundation/0004 Decision 2): its guards' names and its
    // repeatKey, for the list and /docs; null for every other operation.
    guards: typeof decl.apply === 'function' ? (decl.guards || []).map((g) => g.rule) : null,
    repeatKey: typeof decl.apply === 'function' ? [...decl.repeatKey] : null,
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
        // The error's first line only: a require error's later lines are its stack, of absolute paths.
        problems.push({ file, problem: `it failed to load: ${String((e && e.message) || e).split('\n')[0]}` });
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
 *
 * The operation gets `context.afterAnswer(fn)`: work to do once the answer is out — the route runs it when the
 * response has finished or closed, the command before it exits (ADR graph-operations-foundation/0002 Decision 10). The
 * collected functions come back as `after`, whatever the outcome. A file result comes back as `file` in place of `body`.
 * @param {object} op          a loaded operation
 * @param {*} raw              its raw inputs: the query, the command's flags, or the JSON body
 * @param {{ via: 'http'|'cli', caller: { role: string, pubkey: string|null }, body?: import('stream').Readable }} context
 * @param {{ source: 'query'|'cli'|'body' }} opts
 * @returns {Promise<{ status: number, body?: object, file?: object, after: Function[] }>}
 */
async function callOperation(op, raw, context, { source = 'query' } = {}) {
  const after = [];
  const checked = checkInputs(op, raw, source);
  if (!checked.ok) return { status: 400, body: { success: false, ...checked.refusal }, after };
  const ctx = { ...context, afterAnswer: (fn) => { if (typeof fn === 'function') after.push(fn); } };
  try {
    // A write that applies goes through the write path (ADR graph-operations-foundation/0004 Decisions 1 and 3).
    const data = typeof op.declaration.apply === 'function'
      ? await require('./write').applyWrite(op, checked.inputs, ctx)
      : await op.declaration.run(checked.inputs, ctx);
    if (op.result.file) {
      const file = data && data.file;
      if (!file || typeof file.open !== 'function' || !Number.isInteger(file.size) || file.size < 0) {
        return { status: 500, body: { success: false, error: `${op.group} ${op.name} failed: it answered without the file its declaration promises`, code: 'failed' }, after };
      }
      return { status: 200, file: { name: file.name, size: file.size, contentType: file.contentType || op.result.file.contentType, open: file.open }, after };
    }
    // A result that can't be sent as JSON (a BigInt, a cycle) fails where each surface serializes it, once: http.js
    // and cli.js each answer that as this operation's 500 `failed` (review rounds 1 and 2).
    return { status: 200, body: { success: true, data: data === undefined ? null : data }, after };
  } catch (err) {
    if (isRefusal(err)) {
      // Its own declared refusals, and the built-in ones it can get (a file body's `too-large`, which the body's
      // stream ends with, reaches the operation's run and comes back here).
      const declared = op.refusals.find((r) => r.code === err.code);
      if (declared) return { status: declared.status, body: { success: false, error: err.message, code: err.code, ...(err.extra || {}) }, after };
      return {
        status: 500,
        body: { success: false, error: `${op.group} ${op.name} failed: it refused with '${err.code}', which its declaration doesn't list (${err.message})`, code: 'failed' },
        after,
      };
    }
    return { status: 500, body: { success: false, error: `${op.group} ${op.name} failed: ${failureMessage(err)}`, code: 'failed' }, after };
  }
}

/** Run the work an operation left for after its answer, once, in order; a failure is logged, never thrown. */
async function runAfterAnswer(after, op) {
  for (const fn of after || []) {
    try { await fn(); } catch (err) { console.error(`[operations] ${op.group} ${op.name}: work after the answer failed: ${(err && err.message) || err}`); }
  }
}

/** An operation as the list shows it: the facts /docs shows, machine-readable (AC7). A file body is shown when there is one. */
function listEntry(op) {
  const { group, name, summary, description, kind, access, method, route, command, inputs, result, refusals } = op;
  const entry = { group, name, summary, description, kind, access, method, route, command, inputs, result, refusals };
  if (op.body) entry.body = op.body;
  if (op.guards) { entry.guards = [...op.guards]; entry.repeatKey = [...op.repeatKey]; }
  return entry;
}

module.exports = { loadOperations, findOperation, callOperation, runAfterAnswer, listEntry, failureMessage, DEFAULT_DIR, PREFIX, LIST_ROUTE };
