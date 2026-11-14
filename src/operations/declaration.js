'use strict';
/**
 * The rules a declaration must meet (ADR graph-operations-foundation/0001 Decisions 2, 3 and 9). The loader leaves a
 * declaration that breaks one out of every surface and reports why.
 *
 * A declaration is a plain object:
 *   group, name   its folder and file name under src/operations/catalog/ (the route is /api/tapestry/<group>/<name>)
 *   kind          'read' (GET) or 'write' (POST)
 *   access        'owner-and-admins' or 'owner-only' — there is no value that opens an operation to visitors or to
 *                 ordinary signed-in people (the book's frame: new reads stay behind sign-in)
 *   summary       one line; description, for /docs and the list, optional
 *   inputs        { <name>: { schema, required?, description? } }, optional
 *   result        { description?, schema } — the JSON Schema of the answer's `data` — or, for a read only,
 *                 { description?, file: { contentType } }: the answer is a file (ADR graph-operations-foundation/0002
 *                 Decision 10)
 *   body          { file: { contentTypes, maxBytes } }, for a write only and optional: the body is a file, and the
 *                 declared inputs come from the query string
 *   refusals      [{ code, status (4xx), when }] — the operation's own, optional
 *   run           async (inputs, context) => data
 * or, for a write through the write path (story graph-operations-foundation #4, ADR graph-operations-foundation/0004
 * Decisions 1 and 2), in place of run:
 *   apply         async (inputs, ctx) => { data, changes }, with ctx.tx the write's transaction (src/operations/write.js)
 *   guards        [{ rule, items: (inputs) => [...] }] — the rules it checks before it writes (src/operations/rules/)
 *   repeatKey     the inputs that make two calls the same write, non-empty ("safe to repeat by …")
 * and its result schema declares `change`, the change entry the path adds. A read has run; a write has run or apply,
 * never both. That every graph write applies is held by a test over the shipped catalog, not here (ADR 0004
 * Amendment 2): other suites' fixture catalogs keep graph writes with run.
 * Schemas use the subset OpenAPI 3.0 and ajv share. Other fields are allowed and ignored by the generators.
 */

const Ajv = require('ajv');
const { GROUPS, REFUSED_GROUPS } = require('./groups');
const { hasFileBody } = require('./files');
const { findRule } = require('./rules');

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const INPUT_NAME_RE = /^[A-Za-z][A-Za-z0-9]*$/;
const METHODS = Object.freeze({ read: 'GET', write: 'POST' });
const ACCESS = Object.freeze(['owner-and-admins', 'owner-only']);

/**
 * The refusals the module itself returns, and which operations can get each (Decision 4). `failed` is reserved: it is
 * the code of a failure (500), never a refusal an operation declares.
 */
const BUILT_IN_REFUSALS = Object.freeze([
  { code: 'unknown-input', status: 400, when: 'An input the operation does not take', applies: () => true },
  { code: 'missing-input', status: 400, when: 'A required input left out', applies: (d) => Object.values(d.inputs || {}).some((i) => i && i.required) },
  { code: 'invalid-input', status: 400, when: 'An input of the wrong type, or out of range', applies: (d) => Object.keys(d.inputs || {}).length > 0 },
  { code: 'invalid-body', status: 400, when: 'A body that is not a JSON object', applies: (d) => d.kind === 'write' && !hasFileBody(d) },
  // Every write, its JSON body's included (ADR graph-operations-foundation/0004 Decision 8).
  { code: 'wrong-content-type', status: 415, when: 'A body of a type the operation does not take: application/json, or the file types it declares', applies: (d) => d.kind === 'write' },
  { code: 'too-large', status: 413, when: 'A body larger than the operation takes', applies: (d) => hasFileBody(d) },
  { code: 'sign-in-required', status: 401, when: 'Not signed in', applies: () => true },
  { code: 'not-allowed', status: 403, when: 'Signed in, but not someone the operation is for', applies: () => true },
]);
// Two codes are reserved only where they apply: a read that answers with a file may declare its own `too-large` (ADR
// graph-operations-foundation/0002 Decision 1), and `wrong-content-type` is every write's (ADR 0004 Decision 8).
// Every other built-in code is reserved everywhere.
const WHERE_THEY_APPLY = new Set(['wrong-content-type', 'too-large']);
const RESERVED_CODES = new Set([...BUILT_IN_REFUSALS.map((r) => r.code).filter((c) => !WHERE_THEY_APPLY.has(c)), 'failed']);
const reservedFor = (decl) => new Set([...RESERVED_CODES,
  ...(decl.kind === 'write' ? ['wrong-content-type'] : []),
  ...(hasFileBody(decl) ? ['too-large'] : [])]);

// One compiler for checking that a declaration's schemas compile (the meta-schema catches a nonsense type).
const schemaChecker = new Ajv({ allErrors: true, strict: false });

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

function compiles(schema) {
  try { schemaChecker.compile(schema); return null; } catch (e) { return e.message; }
}

/**
 * Every rule `decl` breaks, as sentences, given the folder and file name it was found under. An empty list is valid.
 * @param {object} decl
 * @param {{ group: string, name: string }} where
 * @returns {string[]}
 */
function validateDeclaration(decl, where) {
  const problems = [];
  if (!isObject(decl)) return ['the file does not export a declaration object'];

  // group and name: where it lives is what it declares.
  if (decl.group !== where.group) {
    problems.push(`its group ${JSON.stringify(decl.group)} must be ${JSON.stringify(where.group)}, the folder it is in`);
  }
  if (REFUSED_GROUPS[where.group]) {
    problems.push(`its group '${where.group}' is refused for now: ${REFUSED_GROUPS[where.group]}`);
  } else if (!GROUPS[where.group]) {
    problems.push(`its group '${where.group}' is not one of the groups (${Object.keys(GROUPS).join(', ')}; design D1)`);
  }
  if (decl.name !== where.name) {
    problems.push(`its name ${JSON.stringify(decl.name)} must be ${JSON.stringify(where.name)}, the file's name`);
  } else if (!NAME_RE.test(decl.name)) {
    problems.push(`its name ${JSON.stringify(decl.name)} must be kebab-case`);
  }

  if (!Object.prototype.hasOwnProperty.call(METHODS, decl.kind)) {
    problems.push(`its kind ${JSON.stringify(decl.kind)} must be 'read' or 'write'`);
  }
  if (!ACCESS.includes(decl.access)) {
    problems.push(`its access ${JSON.stringify(decl.access)} is not allowed: an operation is for the owner and admins ('owner-and-admins') or the owner only ('owner-only'), never for visitors or ordinary signed-in people`);
  }
  if (!nonEmpty(decl.summary)) problems.push('it has no summary (one line, for /docs, the list and the command)');
  if (decl.description !== undefined && typeof decl.description !== 'string') problems.push('its description must be text');
  // run or apply (ADR graph-operations-foundation/0004 Decision 1)
  const runs = typeof decl.run === 'function';
  const applies = typeof decl.apply === 'function';
  if (decl.apply !== undefined && !applies) problems.push('its apply must be a function');
  if (runs && applies) problems.push('it has both run and apply: a write has one, and apply goes through the write path (ADR graph-operations-foundation/0004 Decision 1)');
  else if (applies && decl.kind !== 'write') problems.push(`only a write has apply, which goes through the write path; its kind is ${JSON.stringify(decl.kind)}, and a read has run (ADR graph-operations-foundation/0004 Decision 1)`);
  else if (!runs && !applies) problems.push('it has no run function');

  // inputs
  if (decl.inputs !== undefined && !isObject(decl.inputs)) {
    problems.push('its inputs must be an object of { <name>: { schema, required?, description? } }');
  } else {
    for (const [name, input] of Object.entries(decl.inputs || {})) {
      if (!INPUT_NAME_RE.test(name)) { problems.push(`its input name ${JSON.stringify(name)} must be letters and digits, starting with a letter`); continue; }
      if (!isObject(input) || !isObject(input.schema)) { problems.push(`its input '${name}' must have a schema`); continue; }
      const bad = compiles(input.schema);
      if (bad) problems.push(`its input '${name}' has a schema that doesn't compile: ${bad}`);
      if (input.required !== undefined && typeof input.required !== 'boolean') problems.push(`its input '${name}': required must be true or false`);
      if (input.description !== undefined && typeof input.description !== 'string') problems.push(`its input '${name}': description must be text`);
    }
  }

  // result: a JSON Schema, or (for a read) a file
  const fileResult = isObject(decl.result) && decl.result.file !== undefined;
  if (!isObject(decl.result) || (!isObject(decl.result.schema) && !fileResult)) {
    problems.push('it has no result schema (result: { description, schema }) or file (result: { description, file: { contentType } })');
  } else if (fileResult) {
    if (decl.result.schema !== undefined) problems.push('its result is either a schema or a file, not both');
    if (!isObject(decl.result.file) || !nonEmpty(decl.result.file.contentType)) problems.push('its result file must name its contentType (result: { file: { contentType } })');
    if (decl.kind !== 'read') problems.push(`only a read answers with a file; its kind is ${JSON.stringify(decl.kind)}`);
  } else {
    const bad = compiles(decl.result.schema);
    if (bad) problems.push(`its result schema doesn't compile: ${bad}`);
  }
  if (isObject(decl.result) && decl.result.description !== undefined && typeof decl.result.description !== 'string') problems.push('its result description must be text');

  // body: a file, for a write
  if (decl.body !== undefined) {
    const f = isObject(decl.body) ? decl.body.file : undefined;
    if (!isObject(f)) {
      problems.push('its body must be { file: { contentTypes, maxBytes } }');
    } else {
      if (!Array.isArray(f.contentTypes) || !f.contentTypes.length || !f.contentTypes.every(nonEmpty)) problems.push('its body file must list the contentTypes it takes');
      if (!Number.isInteger(f.maxBytes) || f.maxBytes < 1) problems.push(`its body file's maxBytes must be a whole number of bytes, at least 1; got ${JSON.stringify(f.maxBytes)}`);
    }
    if (decl.kind !== 'write') problems.push(`only a write takes a file body; its kind is ${JSON.stringify(decl.kind)}`);
  }

  if (applies) problems.push(...writePathProblems(decl));

  // refusals
  if (decl.refusals !== undefined && !Array.isArray(decl.refusals)) {
    problems.push('its refusals must be a list of { code, status, when }');
  } else {
    const seen = new Set();
    const reserved = reservedFor(decl);
    for (const r of decl.refusals || []) {
      if (!isObject(r) || !NAME_RE.test(String(r.code))) { problems.push(`a refusal's code ${JSON.stringify(r && r.code)} must be kebab-case`); continue; }
      if (reserved.has(r.code)) problems.push(`its refusal '${r.code}' repeats a built-in code (${[...reserved].join(', ')})`);
      if (seen.has(r.code)) problems.push(`its refusal '${r.code}' is listed twice`);
      seen.add(r.code);
      if (!Number.isInteger(r.status) || r.status < 400 || r.status > 499) problems.push(`its refusal '${r.code}' must have a 4xx status, not ${JSON.stringify(r.status)}`);
      if (!nonEmpty(r.when)) problems.push(`its refusal '${r.code}' must say when it happens (when)`);
    }
  }
  return problems;
}

/** What a write through the write path must also declare (ADR graph-operations-foundation/0004 Decision 2). */
function writePathProblems(decl) {
  const problems = [];
  const inputs = isObject(decl.inputs) ? Object.keys(decl.inputs) : [];
  if (decl.repeatKey === undefined) problems.push('it has no repeatKey: the inputs that make two calls the same write (ADR graph-operations-foundation/0004 Decision 2)');
  else if (!Array.isArray(decl.repeatKey) || !decl.repeatKey.length) problems.push('its repeatKey must name at least one of its inputs');
  else {
    for (const k of decl.repeatKey) if (!inputs.includes(k)) problems.push(`its repeatKey names ${JSON.stringify(k)}, which is not one of its inputs`);
  }
  if (decl.guards !== undefined && !Array.isArray(decl.guards)) problems.push('its guards must be a list of { rule, items }');
  else {
    for (const g of decl.guards || []) {
      if (!isObject(g) || typeof g.rule !== 'string' || typeof g.items !== 'function') { problems.push('a guard must be { rule: <a rule\'s name>, items: (inputs) => [...] }'); continue; }
      if (!findRule(g.rule)) problems.push(`its guard names the rule '${g.rule}', which there isn't (src/operations/rules/)`);
    }
  }
  const schema = isObject(decl.result) ? decl.result.schema : null;
  if (!isObject(schema) || !isObject(schema.properties) || !isObject(schema.properties.change)) {
    problems.push('its result schema must declare `change`, the change entry the write path adds to its answer (ADR graph-operations-foundation/0004 Decision 2)');
  }
  if (hasFileBody(decl)) problems.push('a write through the write path takes a JSON body, not a file');
  return problems;
}

/** The built-in refusals an operation can return, in the list's { code, status, when } form. */
function builtInRefusalsFor(decl) {
  return BUILT_IN_REFUSALS.filter((r) => r.applies(decl)).map(({ code, status, when }) => ({ code, status, when }));
}

module.exports = { validateDeclaration, builtInRefusalsFor, METHODS, ACCESS, NAME_RE, BUILT_IN_REFUSALS };
