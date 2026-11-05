'use strict';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const RESERVED = new Set([
  'www', 'api', 'admin', 'mail', 'relay', 'tapestry', 'brainstorm', 'launch', 'ns1', 'ns2', 'edge', 'launcher',
]);

/** Returns null when the slug is fine, or { code, message } saying why not. */
function checkSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug) || slug.startsWith('xn--')) {
    return {
      code: 'bad-slug',
      message: 'A name is 3 to 30 characters: lowercase letters, digits and hyphens, with no hyphen at either end.',
    };
  }
  if (RESERVED.has(slug)) return { code: 'reserved-slug', message: `"${slug}" is reserved. Pick another name.` };
  return null;
}

module.exports = { checkSlug, RESERVED };
