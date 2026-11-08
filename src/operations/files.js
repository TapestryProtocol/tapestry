'use strict';
/**
 * File results and file bodies (ADR graph-operations-foundation/0002 Decision 10).
 *
 * A read may declare `result: { file: { contentType } }`: its run answers `{ file: { name, size, contentType, open } }`,
 * where open() returns a readable stream of exactly `size` bytes. The route sends it as an attachment; the command
 * writes it to stdout. A write may declare `body: { file: { contentTypes, maxBytes } }`: its body is the file, read as a
 * stream from `context.body`, and its declared inputs come from the query string (or the command's flags).
 */

const { Transform } = require('stream');
const { refusal } = require('./refusal');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Whether a declaration answers with a file. */
function hasFileResult(decl) {
  return !!(decl && isObject(decl.result) && isObject(decl.result.file));
}
/** Whether a declaration's body is a file. */
function hasFileBody(decl) {
  return !!(decl && isObject(decl.body) && isObject(decl.body.file));
}

/** The body's media type, without parameters, lower-cased ('' when there is none). */
function mediaType(header) {
  return String(header || '').split(';')[0].trim().toLowerCase();
}

/**
 * `source` piped through a counter that ends the stream with a `too-large` refusal past `maxBytes`, so an operation
 * reading context.body never sees more than its declaration allows, however the bytes arrive.
 */
function limitStream(source, maxBytes, what) {
  let seen = 0;
  const counter = new Transform({
    transform(chunk, encoding, done) {
      seen += chunk.length;
      if (seen > maxBytes) {
        done(refusal('too-large', `${what} is larger than ${maxBytes} bytes, the most it takes.`));
        return;
      }
      done(null, chunk);
    },
  });
  source.on('error', (err) => counter.destroy(err));
  source.pipe(counter);
  return counter;
}

/** Write a readable stream to `out` (anything with write(chunk, cb)), waiting for each chunk to be taken. */
async function writeTo(stream, out) {
  for await (const chunk of stream) {
    await new Promise((resolve, reject) => {
      out.write(chunk, (err) => (err ? reject(err) : resolve()));
    });
  }
}

/** A file name safe inside Content-Disposition's quotes. */
function safeFileName(name) {
  const cleaned = String(name || 'download').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'download';
}

module.exports = { hasFileResult, hasFileBody, mediaType, limitStream, writeTo, safeFileName };
