'use strict';
/**
 * The flag rules (ADR graph-operations-foundation/0006 Decisions 1 and 2).
 *
 * parseFlags is a copy of the internal command's (src/operations/cli.js), so an operation's inputs are given the same
 * way inside and outside the instance: --name value or --name=value, a flag with no value is true, a repeated flag
 * makes a list, and a stray word is a usage error. A test (test/external-cli.test.js K10) holds the two to each other.
 *
 * parseGlobal takes the CLI's own flags, which come before the command words, so they never meet an operation's inputs.
 */

const { GLOBAL_FLAGS } = require('./commands');

/** The flags after `<group> <operation>`: { inputs, help } or { usage } for a stray word. */
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

/**
 * The global flags at the front of argv: { instance, keyFile, version, help, words } or { usage }.
 * `--version`, `--help` and `-h` count there too.
 */
function parseGlobal(argv) {
  const out = { instance: undefined, keyFile: undefined, version: false, help: false, words: [] };
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') { out.version = true; continue; }
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    const eq = a.indexOf('=');
    const name = eq >= 0 ? a.slice(0, eq) : a;
    if (!GLOBAL_FLAGS.includes(name)) break;
    let value;
    if (eq >= 0) value = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) value = argv[++i];
    if (!value) return { usage: `${name} needs a value: ${name} <${name === '--instance' ? 'url' : 'path'}>.` };
    if (name === '--instance') out.instance = value; else out.keyFile = value;
  }
  out.words = argv.slice(i);
  return out;
}

module.exports = { parseFlags, parseGlobal };
