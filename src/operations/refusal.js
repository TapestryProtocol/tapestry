'use strict';
/**
 * How an operation refuses: `throw refusal(code, message)`, with a code its declaration lists under `refusals`. The
 * route answers at that refusal's declared status; a code the declaration doesn't list is a failure (500), so a
 * declaration never under-documents what it refuses (ADR graph-operations-foundation/0001 Decisions 2 and 4).
 */

class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'Refusal';
    this.code = code;
    this.isRefusal = true;
  }
}

/** A refusal to throw from an operation's run(). */
function refusal(code, message) {
  return new Refusal(code, message);
}

function isRefusal(err) {
  return !!(err && err.isRefusal === true && typeof err.code === 'string');
}

module.exports = { refusal, isRefusal, Refusal };
