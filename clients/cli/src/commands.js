'use strict';
/**
 * The CLI's own commands, global flags, environment variables and exit codes, as data (ADR
 * graph-operations-foundation/0006 Decisions 1 and 2). The help is printed from these tables, and the skill's test
 * (test/external-cli.test.js SK3) holds skill/SKILL.md to them, so the two can't drift apart unnoticed.
 *
 * Every other first word is an operation group, taken from the instance's own list of operations.
 */

const COMMANDS = Object.freeze([
  { words: ['whoami'], usage: 'tapestry whoami', summary: 'Who this key is on the instance: owner, admin or neither' },
  { words: ['login'], usage: 'tapestry login', summary: 'Sign in now, afresh' },
  { words: ['logout'], usage: 'tapestry logout', summary: 'Sign out of the instance, and forget the sign-in' },
  { words: ['use'], usage: 'tapestry use <url>', summary: 'Make <url> the default instance' },
  { words: ['key', 'new'], flags: ['--file'], usage: 'tapestry key new [--file <path>]', summary: 'Make a new key, readable only by you, and print its npub' },
  { words: ['key', 'show'], usage: 'tapestry key show', summary: 'Where the key comes from, and its npub and hex' },
  { words: ['help'], usage: 'tapestry help', summary: 'The operations you may call here, or how to set up' },
]);

/** Global flags, which come before the command words, each with a value. */
const GLOBAL_FLAGS = Object.freeze(['--instance', '--key-file']);

const ENV = Object.freeze([
  'TAPESTRY_HOME',
  'TAPESTRY_INSTANCE',
  'TAPESTRY_KEY_FILE',
  'TAPESTRY_SECRET_KEY',
  'TAPESTRY_SIGNER',
  'TAPESTRY_PUBKEY',
  'TAPESTRY_TIMEOUT',
]);

/** The internal command's exit codes (src/operations/cli.js), so an agent learns one set. */
const EXIT_CODES = Object.freeze({ 0: 'answered', 1: 'refused', 2: 'usage', 3: 'failed' });
const EXIT = Object.freeze({ ANSWERED: 0, REFUSED: 1, USAGE: 2, FAILED: 3 });

/** First words the CLI keeps for itself; an operation group of one of these names can't be reached. */
const RESERVED = Object.freeze(new Set(COMMANDS.map((c) => c.words[0])));

module.exports = { COMMANDS, GLOBAL_FLAGS, ENV, EXIT_CODES, EXIT, RESERVED };
