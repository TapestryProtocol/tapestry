'use strict';
/**
 * The operations' /docs entries (ADR graph-operations-foundation/0001 Decision 6). bin/control-panel.js serves
 * withOperationDocs(yaml.load(src/api/openapi.yaml)): the YAML plus, for each valid operation, an entry made from its
 * declaration — its group's tag, summary, description, who may call it, its command, its inputs, its result and its
 * refusals — and the list route's entry. A path the YAML already documents is refused, so no operation has two sources.
 */

const { loadOperations, LIST_ROUTE } = require('./index');
const { GROUPS } = require('./groups');
const { inputsSchema } = require('./inputs');

const LIST_TAG = 'Tapestry operations';
const tagName = (group) => `Tapestry: ${group}`;

const REFUSAL_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: { type: 'string', description: 'What was wrong, in words' },
    code: { type: 'string', description: 'The refusal, as a code a program can act on' },
    input: { type: 'string', description: 'The input the refusal is about, when it is about one' },
  },
});
const refusalResponse = (description) => ({ description, content: { 'application/json': { schema: REFUSAL_SCHEMA } } });

function whoMayCall(op) {
  return op.access === 'owner-only' ? 'the owner only' : 'the owner and admins';
}

function responsesFor(op) {
  const responses = {
    200: {
      description: op.result.description || 'The answer',
      content: {
        'application/json': {
          schema: { type: 'object', properties: { success: { type: 'boolean', enum: [true] }, data: op.result.schema } },
        },
      },
    },
  };
  // Refusals by status: the built-in ones this operation can return, then its own.
  const byStatus = new Map();
  for (const r of op.refusals) {
    if (!byStatus.has(r.status)) byStatus.set(r.status, []);
    byStatus.get(r.status).push(`\`${r.code}\`: ${r.when}`);
  }
  for (const [status, lines] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
    responses[String(status)] = refusalResponse(lines.join('; '));
  }
  responses[500] = refusalResponse(`\`failed\`: the operation failed ("${op.group} ${op.name} failed: …")`);
  return responses;
}

function entryFor(op) {
  const description = [
    op.description,
    `**Who may call:** ${whoMayCall(op)}, and direct-local callers; 401 when not signed in, 403 for anyone else.`,
    `**Command:** \`${op.command}\`, in a shell inside the instance, with no sign-in.`,
  ].filter(Boolean).join('\n\n');
  const entry = {
    tags: [tagName(op.group)],
    summary: op.summary,
    description,
    operationId: `tapestry-${op.group}-${op.name}`,
  };
  const inputs = Object.entries(op.inputs);
  if (op.method === 'GET') {
    if (inputs.length) {
      entry.parameters = inputs.map(([name, input]) => ({
        name,
        in: 'query',
        required: !!input.required,
        description: input.description || '',
        schema: input.schema,
      }));
    }
  } else {
    const schema = inputsSchema(op.inputs);
    entry.requestBody = { required: !!schema.required, content: { 'application/json': { schema } } };
  }
  entry.responses = responsesFor(op);
  return entry;
}

function listEntryDoc() {
  return {
    tags: [LIST_TAG],
    summary: 'The operations you may call, with what each takes and returns',
    description: [
      'Every declared operation the caller may call: its group, name, route, method, command, who may call it, its inputs (each with its JSON Schema), its result (with its JSON Schema) and its refusals — the facts this document shows, for a program to read. An admin is not shown the owner-only operations. `problems` names any declaration left out, and why.',
      '**Who may call:** the owner and admins, and direct-local callers; 401 when not signed in, 403 for anyone else.',
    ].join('\n\n'),
    operationId: 'tapestry-operations',
    responses: {
      200: { description: '{ success: true, data: { operations, problems } }', content: { 'application/json': { schema: { type: 'object' } } } },
      401: refusalResponse('`sign-in-required`: Not signed in'),
      403: refusalResponse('`not-allowed`: Signed in, but not the owner or an admin'),
    },
  };
}

/**
 * A copy of `spec` with the operations' entries and tags added. The spec passed in is not changed.
 * @param {object} spec  the loaded YAML document
 * @param {{ dir?: string }} [opts]  the catalog to document (src/operations/catalog by default)
 */
function withOperationDocs(spec, opts = {}) {
  const doc = JSON.parse(JSON.stringify(spec || {}));
  doc.paths = doc.paths || {};
  doc.tags = Array.isArray(doc.tags) ? doc.tags : [];
  const add = (route, method, entry) => {
    if (doc.paths[route] && doc.paths[route][method]) {
      throw new Error(`withOperationDocs: ${method.toUpperCase()} ${route} is already in the YAML; an operation's entry comes only from its declaration (ADR graph-operations-foundation/0001 Decision 6)`);
    }
    doc.paths[route] = { ...(doc.paths[route] || {}), [method]: entry };
  };
  const { operations } = loadOperations({ dir: opts.dir });
  const groups = new Set();
  for (const op of operations) {
    add(op.route, op.method.toLowerCase(), entryFor(op));
    groups.add(op.group);
  }
  add(LIST_ROUTE, 'get', listEntryDoc());
  const addTag = (name, description) => { if (!doc.tags.some((t) => t && t.name === name)) doc.tags.push({ name, description }); };
  addTag(LIST_TAG, 'The graph operations under /api/tapestry/: each declared once, in src/operations/catalog/, and reached as a route, as the `tapestry` command inside the instance, and in this document.');
  for (const g of [...groups].sort()) addTag(tagName(g), GROUPS[g] || '');
  return doc;
}

module.exports = { withOperationDocs };
