'use strict';
/**
 * A concept's names (story graph-operations-first-slice #16, ADR graph-operations-first-slice/0016 Decision 2).
 *
 * The derivation — toSlugName, toKeyName, toTitleName, toLabelName and deriveAllNames — is copied from today's
 * create-concept route (src/api/normalize/index.js, before handleCreateConcept), which stays as it is (design D15).
 * test/operations/graph/concept-names.test.js pins the copy to the route's own functions, run from its source.
 *
 * What the graph operations add (AC5):
 *   cleanName(text)          trimmed, each run of white space inside it one space
 *   nameProblem(name)        why a cleaned name can't be a concept's name, or null: empty, no slug, a control
 *                            character, a text-direction control, an invisible formatting character (but not a
 *                            joiner a script needs), or longer than MAX_NAME (refused, never cut)
 *   descriptionProblem(text) why a description can't be one, or null: a control character other than a line break or
 *                            a tab (as the Dictionary's edit allows, src/lib/conceptHeaderEdit.js)
 *
 * Pure: it requires only src/lib/dtag.js.
 */

const dtag = require('./dtag');

const MAX_NAME = 200;
const CONTROL_RE = /\p{Cc}/u;
// Bidirectional overrides and isolates can make a name read differently from what it is.
const BIDI_RE = /[\u202A-\u202E\u2066-\u2069]/u;
// Other format characters are invisible, so two names that read alike can differ by one (review round 1). The zero-width
// non-joiner and joiner are the exceptions: some scripts, and emoji sequences, need them, though never at an end or
// beside a space, a–z or 0–9.
const FORMAT_RE = /(?![\u200C\u200D])\p{Cf}/u;
const JOINER_RE = /[\u200C\u200D]/u;
const STRAY_JOINER_RE = /(?:^|[\sA-Za-z0-9])[\u200C\u200D]|[\u200C\u200D](?:$|[\sA-Za-z0-9])/u;
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;
const codePoint = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

// ── today's derivation, copied ──
function toSlugName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function toKeyName(name) {
  const words = name.split(/\s+/);
  return words.map((w, i) => {
    const lower = w.toLowerCase();
    if (i === 0) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

function toTitleName(name) {
  return name.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function toLabelName(name) {
  return name.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function deriveAllNames(singular, plural) {
  return {
    oNames: { singular: singular.toLowerCase(), plural: plural.toLowerCase() },
    oSlugs: { singular: toSlugName(singular), plural: toSlugName(plural) },
    oKeys: { singular: toKeyName(singular), plural: toKeyName(plural) },
    oTitles: { singular: toTitleName(singular), plural: toTitleName(plural) },
    oLabels: { singular: toLabelName(singular), plural: toLabelName(plural) },
  };
}

// ── what the operations add ──
/** Trimmed, with each run of white space inside it one space. */
function cleanName(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

/** Why a cleaned name can't be a concept's name, in words, or null. */
function nameProblem(name) {
  if (typeof name !== 'string' || !name) return 'it is empty once trimmed';
  if (CONTROL_RE.test(name)) return 'it contains a control character';
  if (BIDI_RE.test(name)) return 'it contains a text-direction control, which can make it read differently from what it is';
  const format = name.match(FORMAT_RE) || (STRAY_JOINER_RE.test(name) ? name.match(JOINER_RE) : null);
  if (format) return `it contains an invisible formatting character, ${codePoint(format[0])}, which can make it read as another name`;
  if (name.length > MAX_NAME) return `it is ${name.length} characters long, more than ${MAX_NAME}; a name is refused rather than cut`;
  if (!dtag.slug(name)) return 'it has no letter a–z or digit 0–9, so it would have no slug: a slug keeps only those, with accents dropped';
  return null;
}

/** Why a description can't be one, in words, or null. */
function descriptionProblem(text) {
  if (typeof text !== 'string') return null;
  if (DESCRIPTION_CONTROL_RE.test(text)) return 'it contains a control character other than a line break or a tab';
  return null;
}

module.exports = { MAX_NAME, toSlugName, toKeyName, toTitleName, toLabelName, deriveAllNames, cleanName, nameProblem, descriptionProblem };
