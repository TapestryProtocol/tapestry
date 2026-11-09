'use strict';
/**
 * The internal command, `tapestry <group> <operation> [--input value …]` (ADR graph-operations-foundation/0001
 * Decision 7), for someone with a shell inside the instance. It calls the same module the routes do, in-process, as a
 * local caller: no sign-in, every operation open to it (design §2).
 *
 *   tapestry | tapestry help | tapestry --help    every operation, by group
 *   tapestry <group>                             one group's operations
 *   tapestry <group> <operation> --help          an operation's inputs, result, refusals, who may call it and its route
 *   tapestry <group> <operation> [--name value]  run it; --name=value works too, a flag with no value is true, and a
 *                                                repeated flag makes a list
 *
 * It prints, on stdout, the JSON body the route would send, success or refusal, and nothing else: while it runs,
 * console.log, info and debug go to stderr. Exit codes: 0 answered, 1 refused, 2 usage (an unknown group or operation,
 * or a stray word), 3 failed.
 *
 * An operation that answers with a file writes the file's bytes to stdout instead, and one whose body is a file reads
 * it from stdin (ADR graph-operations-foundation/0002 Decision 10); either refuses a terminal, with usage. Work the
 * operation left for after its answer runs before the command exits.
 */

const util = require('util');
const { loadOperations, callOperation, runAfterAnswer } = require('./index');
const { GROUPS } = require('./groups');
const { hasFileBody, limitStream, writeTo } = require('./files');

const LOCAL = Object.freeze({ role: 'local', pubkey: null });
const HELP = new Set(['help', '--help', '-h']);

function listing(operations, header = true) {
  const lines = header ? ['Tapestry operations: tapestry <group> <operation> [--input value …]', ''] : [];
  const groups = [...new Set(operations.map((o) => o.group))].sort();
  for (const g of groups) {
    lines.push(`${g}${GROUPS[g] ? ` — ${GROUPS[g]}` : ''}`);
    const ops = operations.filter((o) => o.group === g);
    const width = Math.max(...ops.map((o) => o.name.length));
    for (const o of ops) lines.push(`  ${o.name.padEnd(width)}  ${o.summary}`);
    lines.push('');
  }
  if (!groups.length) lines.push('No operations are declared.', '');
  return lines.join('\n');
}

function typeOf(schema) {
  if (!schema) return 'value';
  if (schema.type === 'array') return `${typeOf(schema.items)} …`;
  if (Array.isArray(schema.enum)) return schema.enum.join('|');
  return schema.type || 'value';
}

function helpFor(op) {
  const who = op.access === 'owner-only' ? 'the owner only' : 'the owner and admins';
  const lines = [`${op.group} ${op.name} — ${op.summary}`, ''];
  if (op.description) lines.push(op.description, '');
  lines.push(`Who may call: ${who}. From a shell inside the instance, no sign-in is needed.`);
  lines.push(`Route: ${op.method} ${op.route}`);
  const inputs = Object.entries(op.inputs);
  lines.push('', inputs.length ? 'Inputs:' : 'Inputs: none');
  for (const [name, input] of inputs) {
    const notes = [input.required ? 'required' : 'optional'];
    if (input.schema && input.schema.default !== undefined) notes.push(`default ${JSON.stringify(input.schema.default)}`);
    lines.push(`  --${name} <${typeOf(input.schema)}>  ${notes.join(', ')}${input.description ? ` — ${input.description}` : ''}`);
  }
  lines.push('', `Result: ${op.result.description || 'see the route\'s /docs entry'}`, '', 'Refusals:');
  for (const r of op.refusals) lines.push(`  ${r.status} ${r.code} — ${r.when}`);
  return lines.join('\n') + '\n';
}

/** The flags after `<group> <operation>`: { inputs } or { help } or { usage } for a stray word. */
function parseFlags(args) {
  const values = new Map();
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') { help = true; continue; }
    if (!a.startsWith('--') || a === '--') return { usage: `Unexpected '${a}': give inputs as --name value.` };
    let key = a.slice(2);
    let value;
    const eq = key.indexOf('=');
    if (eq >= 0) { value = key.slice(eq + 1); key = key.slice(0, eq); }
    else if (i + 1 < args.length && !args[i + 1].startsWith('--')) value = args[++i];
    else value = true;
    values.set(key, values.has(key) ? [].concat(values.get(key), value) : value);
  }
  return { inputs: Object.fromEntries(values), help };
}

async function run(argv, out, err, opts, io = {}) {
  const { operations, problems } = loadOperations(opts);
  const problemLines = () => { for (const p of problems) err(`Left out ${p.file}: ${p.problem}\n`); };
  const [group, name, ...rest] = argv;

  if (!group || HELP.has(group)) {
    out(listing(operations));
    problemLines();
    return 0;
  }
  const inGroup = operations.filter((o) => o.group === group);
  if (!inGroup.length) {
    const groups = [...new Set(operations.map((o) => o.group))].sort();
    err(`Unknown group '${group}'. Groups: ${groups.length ? groups.join(', ') : 'none'}.\n\n${listing(operations, false)}`);
    return 2;
  }
  if (!name || HELP.has(name)) {
    out(listing(inGroup, false));
    return 0;
  }
  const op = inGroup.find((o) => o.name === name);
  if (!op) {
    err(`Unknown operation '${group} ${name}'. ${group} has: ${inGroup.map((o) => o.name).join(', ')}.\n`);
    return 2;
  }
  const flags = parseFlags(rest);
  if (flags.usage) { err(`${flags.usage}\nRun \`tapestry ${group} ${name} --help\` for its inputs.\n`); return 2; }
  if (flags.help) { out(helpFor(op)); return 0; }

  const words = ['tapestry', ...argv].join(' ');
  if (op.result.file && io.stdout && io.stdout.isTTY) {
    err(`${op.group} ${op.name} answers with a file, which isn't written to a terminal. Send it to a file:\n  ${words} > <file>\n`);
    return 2;
  }
  let body;
  if (hasFileBody(op.declaration)) {
    if (!io.stdin || io.stdin.isTTY) {
      err(`${op.group} ${op.name} reads a file on standard input, not from a terminal. Send the file in:\n  ${words} < <file>\n`);
      return 2;
    }
    body = limitStream(io.stdin, op.declaration.body.file.maxBytes, 'The file on standard input');
  }

  const answer = await callOperation(op, flags.inputs, { via: 'cli', caller: LOCAL, body }, { source: 'cli' });
  try {
    if (answer.file) {
      try {
        await writeTo(answer.file.open(), io.stdout);
      } catch (e) {
        err(`${op.group} ${op.name} failed while writing its file: ${e.message}\n`);
        return 3;
      }
      return 0;
    }
    let text;
    try {
      text = JSON.stringify(answer.body, null, 2);
    } catch (e) {
      // A result that can't be sent as JSON is this operation's failure, answered as the route answers it.
      out(`${JSON.stringify({ success: false, error: `${op.group} ${op.name} failed: ${e.message}`, code: 'failed' }, null, 2)}\n`);
      return 3;
    }
    out(`${text}\n`);
    if (answer.status === 200) return 0;
    return answer.status >= 500 ? 3 : 1;
  } finally {
    await runAfterAnswer(answer.after, op);
  }
}

/**
 * Run the command.
 * @param {string[]} argv     the words after `tapestry`
 * @param {{ stdin?: import('stream').Readable, stdout: { write: Function, isTTY?: boolean }, stderr: { write: Function } }} [io]
 * @param {{ dir?: string }} [opts]  the catalog (src/operations/catalog by default)
 * @returns {Promise<number>} the exit code
 */
async function main(argv, io = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr }, opts = {}) {
  const out = (s) => io.stdout.write(s);
  const err = (s) => io.stderr.write(s);
  const saved = {};
  for (const k of ['log', 'info', 'debug']) {
    saved[k] = console[k];
    console[k] = (...a) => err(`${util.format(...a)}\n`);
  }
  try {
    return await run(argv || [], out, err, { dir: opts.dir }, io);
  } finally {
    for (const k of Object.keys(saved)) console[k] = saved[k];
  }
}

module.exports = { main, parseFlags };
