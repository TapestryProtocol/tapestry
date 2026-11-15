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
 *                            character, a text-direction control, or longer than MAX_NAME (refused, never cut)
 *   descriptionProblem(text) why a description can't be one, or null: a control character other than a line break or
 *                            a tab (as the Dictionary's edit allows, src/lib/conceptHeaderEdit.js)
 *
 * Pure: it requires only src/lib/dtag.js.
 */

const dtag = require('./dtag');

const MAX_NAME = 200;
const CONTROL_RE = /\p{Cc}/u;
// Bidirectional overrides and isolates can make a name read differently from what it is.
const BIDI_RE = /[‪-‮⁦-⁩]/u;
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;

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
  if (name.length > MAX_NAME) return `it is ${name.length} characters long, more than ${MAX_NAME}; a name is refused rather than cut`;
  if (!dtag.slug(name)) return 'it has no letter or digit, so it would have no slug';
  return null;
}

/** Why a description can't be one, in words, or null. */
function descriptionProblem(text) {
  if (typeof text !== 'string') return null;
  if (DESCRIPTION_CONTROL_RE.test(text)) return 'it contains a control character other than a line break or a tab';
  return null;
}

module.exports = { MAX_NAME, toSlugName, toKeyName, toTitleName, toLabelName, deriveAllNames, cleanName, nameProblem, descriptionProblem };
