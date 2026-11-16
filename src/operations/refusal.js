'use strict';
/**
 * How an operation refuses: `throw refusal(code, message)`, with a code its declaration lists under `refusals`. The
 * route answers at that refusal's declared status; a code the declaration doesn't list is a failure (500), so a
 * declaration never under-documents what it refuses (ADR graph-operations-foundation/0001 Decisions 2 and 4).
 *
 * `extra` adds fields to the refusal's answer beside `error` and `code`: the rule a guard's refusal comes from
 * (`rule`), or the input it is about (`input`) (ADR graph-operations-foundation/0004 Decision 3).
 */

const EXTRA_FIELDS = Object.freeze(['rule', 'input']);

class Refusal extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'Refusal';
    this.code = code;
    this.isRefusal = true;
    this.extra = {};
    for (const k of EXTRA_FIELDS) if (extra && typeof extra[k] === 'string') this.extra[k] = extra[k];
  }
}

/** A refusal to throw from an operation's run() or apply(). */
function refusal(code, message, extra) {
  return new Refusal(code, message, extra);
}

function isRefusal(err) {
  return !!(err && err.isRefusal === true && typeof err.code === 'string');
}

module.exports = { refusal, isRefusal, Refusal };
