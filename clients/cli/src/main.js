'use strict';
/**
 * The external CLI — `tapestry` on an agent's own machine (story graph-operations-foundation #6, ADR
 * graph-operations-foundation/0006; design D14). It signs in to a Tapestry instance with the agent's own key, made an
 * admin there, reads the instance's own list of operations, and calls them by group and name:
 *
 *   tapestry [--instance <url>] [--key-file <path>] <command…>
 *   tapestry                                        the operations this key may call here, then the CLI's own commands
 *   tapestry <group>                                one group's operations
 *   tapestry <group> <operation> --help             its inputs, result, refusals, who may call it and its route
 *   tapestry <group> <operation> [--name value …]   call it: the instance's JSON answer, alone on stdout
 *   tapestry whoami | login | logout | use <url> | key new [--file <path>] | key show | help | --version
 *
 * Exit codes are the internal command's: 0 answered, 1 refused, 2 usage, 3 failed. The CLI reaches the instance only
 * through its sign-in and the routes under /api/tapestry/, and the agent's key signs nothing but the sign-in challenge.
 */

const { parseFlags, parseGlobal } = require('./flags');
const { EXIT } = require('./commands');
const { CliError, Usage, Setup, messageOf } = require('./errors');
const identity = require('./identity');
const { resolveInstance, originOf, timeoutMs } = require('./instance');
const { signIn, signOut, isSignInRefusal } = require('./signin');
const sessions = require('./sessions');
const ops = require('./operations');
const { version } = require('../package.json');

const BANNER = `tapestry ${version} — the external CLI for a Tapestry instance's operations (/api/tapestry/)`;
const json = (x) => `${JSON.stringify(x, null, 2)}\n`;

function setupPage() {
  return [
    BANNER,
    '',
    'Sign in to a Tapestry instance with your own nostr key, made an admin there, and call the operations it lists:',
    '  tapestry <group> <operation> [--input value …]',
    '',
    'To set up:',
    '  1. A key: tapestry key new, or TAPESTRY_KEY_FILE, TAPESTRY_SECRET_KEY, or TAPESTRY_SIGNER with TAPESTRY_PUBKEY.',
    "  2. Give its npub to the instance's owner, who can make it an admin.",
    '  3. The instance: tapestry use <url>, or --instance <url>, or TAPESTRY_INSTANCE.',
    '  4. Then: tapestry whoami, tapestry lifecycle status, and tapestry, which lists what you may call.',
    '',
    ops.ownCommands(),
  ].join('\n');
}

/** What every call needs: the instance, the identity, the home, and the HTTP settings. */
function context(io, env, home, g) {
  const origin = resolveInstance({ instance: g.instance, env, home });
  const id = identity.resolveIdentity({ keyFile: g.keyFile, env, home, io });
  return { origin, identity: id, home, io, http: { timeout: timeoutMs(env), version } };
}

async function help(io, env, home, g) {
  let ctx;
  try { ctx = context(io, env, home, g); } catch (e) {
    if (e instanceof Setup) { io.out(setupPage()); return EXIT.ANSWERED; }
    throw e;
  }
  const data = await ops.listFor(ctx);
  io.out(ops.operationsPage(ctx, data));
  return EXIT.ANSWERED;
}

async function own(cmd, io, env, home, g) {
  const ctx = context(io, env, home, g);
  const who = { instance: ctx.origin, npub: ctx.identity.npub, pubkey: ctx.identity.pubkey, source: ctx.identity.source };
  if (cmd === 'logout') {
    const r = await signOut(ctx);
    if (r.problem) io.err(`Couldn't tell ${ctx.origin} to end the sign-in (${r.problem}); it was forgotten here anyway.\n`);
    io.out(json({ ...who, signedOut: r.hadSignIn }));
    return EXIT.ANSWERED;
  }
  if (cmd === 'login') {
    sessions.drop(home, ctx.origin, ctx.identity.pubkey);
    await signIn(ctx);
  }
  const data = await ops.fetchList(ctx);
  if (data.neither) {
    io.out(json({ ...who, role: 'neither' }));
    io.err(`${ops.notOwnerOrAdmin(ctx)}\n`);
    return EXIT.REFUSED;
  }
  io.out(json({ ...who, role: (data.caller && data.caller.role) || 'owner or admin' }));
  return EXIT.ANSWERED;
}

function use(io, home, rest) {
  if (rest.length !== 1) throw new Usage('Give one URL: tapestry use <url>.');
  const origin = originOf(rest[0]);
  identity.writeConfig(home, { instance: origin });
  io.out(json({ instance: origin }));
  return EXIT.ANSWERED;
}

function key(io, env, home, g, rest) {
  const [sub, ...more] = rest;
  if (sub === 'new') {
    const f = parseFlags(more);
    const only = 'tapestry key new takes only --file <path>.';
    if (f.usage) throw new Usage(`${f.usage.split(':')[0]}: ${only}`);
    if (f.help) { io.out('tapestry key new [--file <path>]: make a new key, readable only by you, and print its npub and hex, never the secret.\n'); return EXIT.ANSWERED; }
    const names = Object.keys(f.inputs);
    if (names.some((n) => n !== 'file') || (names.includes('file') && typeof f.inputs.file !== 'string')) throw new Usage(only);
    io.out(json(identity.newKey({ home, file: f.inputs.file })));
    return EXIT.ANSWERED;
  }
  if (sub === 'show') {
    if (more.length) throw new Usage(`Unexpected '${more[0]}': tapestry key show takes no words after it.`);
    const id = identity.resolveIdentity({ keyFile: g.keyFile, env, home, io });
    io.out(json({ source: id.source, npub: id.npub, pubkey: id.pubkey }));
    return EXIT.ANSWERED;
  }
  throw new Usage('tapestry key new [--file <path>] makes a key; tapestry key show says which key the CLI uses.');
}

function notListed(ctx, what, data) {
  return `'${what}' isn't among the operations ${ctx.identity.npub} may call on ${ctx.origin}: it may not exist there, or it may be the owner's only. This key may call:\n\n${ops.listing(data.operations)}`;
}

async function operation(io, env, home, g, group, rest) {
  const ctx = context(io, env, home, g);
  const data = await ops.listFor(ctx);
  const [name, ...flags] = rest;
  const inGroup = data.operations.filter((o) => o.group === group);
  if (!inGroup.length) throw new Usage(notListed(ctx, name ? `${group} ${name}` : group, data));
  if (!name || name === 'help' || name === '--help' || name === '-h') { io.out(ops.listing(inGroup)); return EXIT.ANSWERED; }
  const op = inGroup.find((o) => o.name === name);
  if (!op) throw new Usage(notListed(ctx, `${group} ${name}`, data));
  const f = parseFlags(flags);
  if (f.usage) throw new Usage(`${f.usage}\nRun \`tapestry ${group} ${name} --help\` for its inputs.`);
  if (f.help) { io.out(ops.helpFor(op, data)); return EXIT.ANSWERED; }

  const r = await ops.callOperation(ctx, op, f.inputs);
  io.out(json(r.json));
  if (r.status >= 200 && r.status < 300 && r.json.success === true) return EXIT.ANSWERED;
  if (r.status >= 500) { io.err(`${group} ${name} failed on ${ctx.origin} (HTTP ${r.status}): ${messageOf(r.json)}\n`); return EXIT.FAILED; }
  if (r.status === 403) io.err(`${op.access === 'owner-only' ? `${group} ${name} is the owner's only on ${ctx.origin}.` : ops.notOwnerOrAdmin(ctx)}\n`);
  if (isSignInRefusal(r)) io.err(`${ctx.origin} didn't accept the sign-in of ${ctx.identity.npub}, even after signing in again.\n`);
  if (r.status >= 400) return EXIT.REFUSED;
  io.err(`${ctx.origin} answered ${group} ${name} with HTTP ${r.status} but no success.\n`);
  return EXIT.FAILED;
}

async function run(argv, io, env) {
  const g = parseGlobal(argv);
  if (g.usage) throw new Usage(g.usage);
  if (g.version) { io.out(`${BANNER}\n`); return EXIT.ANSWERED; }
  const home = identity.homeDir(env);
  const [first, ...rest] = g.words;
  if (g.help || first === undefined || first === 'help') {
    if (first === 'help' && rest.length) throw new Usage(`Unexpected '${rest[0]}' after help.`);
    return help(io, env, home, g);
  }
  if (first === 'use') return use(io, home, rest);
  if (first === 'key') return key(io, env, home, g, rest);
  if (first === 'whoami' || first === 'login' || first === 'logout') {
    if (rest.length) throw new Usage(`Unexpected '${rest[0]}': tapestry ${first} takes no words after it.`);
    return own(first, io, env, home, g);
  }
  return operation(io, env, home, g, first, rest);
}

/**
 * Run the CLI.
 * @param {string[]} argv  the words after `tapestry`
 * @param {{ stdout: { write: Function }, stderr: { write: Function } }} [io]
 * @param {object} [env]   the environment (process.env)
 * @returns {Promise<number>} the exit code
 */
async function main(argv, io = { stdout: process.stdout, stderr: process.stderr }, env = process.env) {
  const out = (s) => io.stdout.write(s);
  const err = (s) => io.stderr.write(s);
  try {
    if (typeof fetch !== 'function' || typeof AbortSignal.timeout !== 'function' || typeof Headers === 'undefined'
      || typeof Headers.prototype.getSetCookie !== 'function') throw new Usage(`This CLI needs Node 20 or later (this is Node ${process.versions.node}).`);
    return await run(argv || [], { out, err }, env);
  } catch (e) {
    if (e instanceof CliError) {
      if (e.body !== undefined) out(json(e.body));
      err(`${e.message}\n`);
      return e.exit;
    }
    err(`tapestry: ${(e && e.stack) || e}\n`);
    return EXIT.FAILED;
  }
}

module.exports = { main, BANNER };
