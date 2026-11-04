'use strict';

/** A request the launcher turns down, with the HTTP status and the words the page shows. */
class Refusal extends Error {
  constructor(http, code, message) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

module.exports = { Refusal };
