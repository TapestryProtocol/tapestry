'use strict';
/**
 * The instance's operations, from its own list (GET /api/tapestry/operations; ADR graph-operations-foundation/0001
 * Decision 8), and calling one (ADR graph-operations-foundation/0006 Decision 6). The CLI defines no operation: every
 * group, name, route, input, result and refusal it shows or uses comes from the list, once per run, so a new operation
 * works the day the instance has it, and each instance shows its own.
 *
 * A read's flags go as the query string, as text, and the instance types them, as it does for the command inside it.
 * A write's JSON body isn't typed by the instance, so the CLI types the flags first, with the same rules as the
 * instance's text checker (ajv, coerceTypes 'array'). What it can't type, and inputs the operation doesn't declare, go
 * as they came, so the instance refuses them: the instance stays the only judge of inputs.
 */

const Ajv = require('ajv');
const { authed } = require('./signin');
const { Refused, Failed, messageOf } = require('./errors');
const { COMMANDS, RESERVED } = require('./commands');

const LIST_ROUTE = '/api/tapestry/operations';
const PREFIX = '/api/tapestry/';
const ADMIN_PAGE = '/pages/manage/manage-administrators.html';
const typer = new Ajv({ allErrors: true, strict: false, coerceTypes: 'array', useDefaults: false });

function notOwnerOrAdmin(ctx) {
  return `${ctx.identity.npub} is signed in to ${ctx.origin}, but the instance treats it as neither its owner nor an admin. The owner can make this key an admin on the instance's administrators page (${ADMIN_PAGE}).`;
}

/** The list for this key: { caller, operations, problems }, or { neither: body } when the key is neither owner nor admin. */
async function fetchList(ctx) {
  const r = await authed(ctx, 'GET', LIST_ROUTE);
  if (r.status === 200 && r.json.success === true && r.json.data && Array.isArray(r.json.data.operations)) return r.json.data;
  if (r.status === 403) return { neither: r.json };
  if (r.status >= 500) throw new Failed(`${ctx.origin} couldn't list its operations (HTTP ${r.status}): ${messageOf(r.json)}`, r.json);
  if (r.status >= 400) throw new Refused(`${ctx.origin} wouldn't list its operations for ${ctx.identity.npub} (HTTP ${r.status}): ${messageOf(r.json)}`, r.json);
  throw new Failed(`${ctx.origin} answered ${LIST_ROUTE} with HTTP ${r.status}, but not with a list of operations. Is it a Tapestry instance with the graph operations?`, r.json);
}

/** The list, or the plain refusal for a key that is neither owner nor admin. */
async function listFor(ctx) {
  const data = await fetchList(ctx);
  if (data.neither) throw new Refused(notOwnerOrAdmin(ctx), data.neither);
  for (const g of new Set(data.operations.map((o) => o.group))) {
    if (RESERVED.has(g)) ctx.io.err(`Note: ${ctx.origin} has a group named '${g}', which this CLI can't reach: '${g}' is one of its own commands.\n`);
  }
  return data;
}

function listing(operations) {
  const lines = [];
  const groups = [...new Set(operations.map((o) => o.group))].sort();
  for (const g of groups) {
    lines.push(g);
    const ops = operations.filter((o) => o.group === g);
    const width = Math.max(...ops.map((o) => o.name.length));
    for (const o of ops) lines.push(`  ${o.name.padEnd(width)}  ${o.summary}`);
    lines.push('');
  }
  if (!groups.length) lines.push('This key may call no operations here.', '');
  return lines.join('\n');
}

function ownCommands() {
  const width = Math.max(...COMMANDS.map((c) => c.usage.length));
  return [
    'Your own commands:',
    ...COMMANDS.map((c) => `  ${c.usage.padEnd(width)}  ${c.summary}`),
    '',
    'Before the command: --instance <url>, --key-file <path>. Also: tapestry --version.',
    '',
  ].join('\n');
}

function operationsPage(ctx, data) {
  const role = data.caller && data.caller.role ? data.caller.role : 'owner or admin';
  return [
    `Tapestry operations on ${ctx.origin}, for ${ctx.identity.npub} (${role}): tapestry <group> <operation> [--input value …]`,
    '',
    listing(data.operations),
    ownCommands(),
  ].join('\n');
}

function typeOf(schema) {
  if (!schema) return 'value';
  if (schema.type === 'array') return `${typeOf(schema.items)} …`;
  if (Array.isArray(schema.enum)) return schema.enum.join('|');
  return schema.type || 'value';
}

/** An operation's help, from its list entry, laid out as the command inside the instance lays it out. */
function helpFor(op, data) {
  const who = op.access === 'owner-only' ? 'the owner only' : 'the owner and admins';
  const role = data.caller && data.caller.role;
  const lines = [`${op.group} ${op.name} — ${op.summary}`, ''];
  if (op.description) lines.push(op.description, '');
  lines.push(`Who may call: ${who}.${role ? ` You are signed in here as ${role === 'local' ? 'a local caller' : role}.` : ''}`);
  lines.push(`Route: ${op.method} ${op.route}`);
  const inputs = Object.entries(op.inputs || {});
  lines.push('', inputs.length ? 'Inputs:' : 'Inputs: none');
  for (const [name, input] of inputs) {
    const notes = [input.required ? 'required' : 'optional'];
    if (input.schema && input.schema.default !== undefined) notes.push(`default ${JSON.stringify(input.schema.default)}`);
    lines.push(`  --${name} <${typeOf(input.schema)}>  ${notes.join(', ')}${input.description ? ` — ${input.description}` : ''}`);
  }
  lines.push('', `Result: ${(op.result && op.result.description) || "see the route's /docs entry"}`, '', 'Refusals:');
  for (const r of op.refusals || []) lines.push(`  ${r.status} ${r.code} — ${r.when}`);
  return `${lines.join('\n')}\n`;
}

/** A read's query string: text, as the flags gave it; true for a flag with no value; a list as repeated keys. */
function queryOf(inputs) {
  const q = new URLSearchParams();
  for (const [name, value] of Object.entries(inputs)) {
    for (const v of [].concat(value)) q.append(name, v === true ? 'true' : String(v));
  }
  return q.toString();
}

/** A write's JSON body: the flags typed as the instance's text checker types them, on a copy. */
function bodyOf(op, inputs) {
  const properties = {};
  for (const [name, input] of Object.entries(op.inputs || {})) properties[name] = (input && input.schema) || {};
  const copy = JSON.parse(JSON.stringify(inputs));
  typer.compile({ type: 'object', properties, additionalProperties: true })(copy);
  return copy;
}

/** Call an operation from its list entry: the instance's { status, json }. */
async function callOperation(ctx, op, inputs) {
  if (typeof op.route !== 'string' || !op.route.startsWith(PREFIX)) {
    throw new Failed(`${ctx.origin} lists ${op.group} ${op.name} at ${JSON.stringify(op.route)}, which isn't under ${PREFIX}; this CLI calls nothing else.`);
  }
  if (op.method === 'GET') {
    const q = queryOf(inputs);
    return authed(ctx, 'GET', q ? `${op.route}?${q}` : op.route);
  }
  if (op.method === 'POST') return authed(ctx, 'POST', op.route, bodyOf(op, inputs));
  throw new Failed(`${ctx.origin} lists ${op.group} ${op.name} with the method ${JSON.stringify(op.method)}, which this CLI doesn't use.`);
}

module.exports = { fetchList, listFor, listing, ownCommands, operationsPage, helpFor, callOperation, queryOf, bodyOf, notOwnerOrAdmin, ADMIN_PAGE };
