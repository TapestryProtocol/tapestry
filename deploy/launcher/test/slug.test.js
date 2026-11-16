'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkSlug, RESERVED } = require('../lib/slug');

test('accepts 3 and 30 character slugs, with digits and inner hyphens', () => {
  for (const s of ['avi', 'a1b', 'my-brain', 'a'.repeat(30)]) assert.equal(checkSlug(s), null, s);
});

test('rejects what the grammar does not allow', () => {
  const bad = {
    uppercase: 'Avi',
    'leading hyphen': '-avi',
    'trailing hyphen': 'avi-',
    '1 char': 'a',
    '2 chars': 'ab',
    '31 chars': 'a'.repeat(31),
    underscore: 'a_b',
    dot: 'a.b',
    empty: '',
    'not a string': 42,
    'path traversal': '../etc',
  };
  for (const [why, s] of Object.entries(bad)) assert.equal(checkSlug(s)?.code, 'bad-slug', why);
});

test('rejects every reserved name', () => {
  assert.ok(RESERVED.size >= 12);
  for (const s of RESERVED) assert.equal(checkSlug(s)?.code, 'reserved-slug', s);
});

test('rejects a punycode prefix, which certificate authorities can refuse', () => {
  assert.equal(checkSlug('xn--abc')?.code, 'bad-slug');
});
