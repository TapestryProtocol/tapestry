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
 *                            character, a text-direction control, an invisible character no script or emoji
 *                            draws with where it is, or longer than MAX_NAME (refused, never cut)
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
// Unicode's default-ignorable code points draw nothing: zero-width spaces and joiners, variation selectors, fillers,
// the soft hyphen and the like. A name holding one reads as another, while the slug, key and labels made from it hold
// the character too: cat with a variation selector after it reads as cat, but its key isn't cat's (review rounds 1
// and 2). So each is refused, except where a script or an emoji draws with it: a zero-width joiner or non-joiner
// between two letters of a script other than Latin, or two emoji, and a presentation selector after an emoji.
// Text-direction controls, default-ignorable too, are refused before this, with a reason of their own.
const IGNORABLE_RE = /\p{Default_Ignorable_Code_Point}/u;
const JOINERS = new Set([0x200c, 0x200d]);
const SELECTORS = new Set([0xfe0e, 0xfe0f]);
// What may sit between a joiner and the letter or emoji it follows: a combining mark (a virama, an accent), a
// presentation selector, a skin-tone modifier.
const BEFORE_JOINER_RE = /[\p{M}\p{Emoji_Modifier}\uFE0E\uFE0F]/u;
const JOINS_RE = /\p{Extended_Pictographic}|(?!\p{Script=Latin})\p{L}/u;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;
const codePoint = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/** The first invisible character in a name that no script or emoji draws with where it is, or null. */
function strayInvisible(name) {
  const chars = [...name];
  for (let i = 0; i < chars.length; i++) {
    if (!IGNORABLE_RE.test(chars[i])) continue;
    const cp = chars[i].codePointAt(0);
    if (JOINERS.has(cp)) {
      let j = i - 1;
      while (j >= 0 && BEFORE_JOINER_RE.test(chars[j])) j--;
      const before = j >= 0 ? chars[j] : null;
      const after = i + 1 < chars.length ? chars[i + 1] : null;
      if (before && after && JOINS_RE.test(before) && JOINS_RE.test(after)) continue;
    } else if (SELECTORS.has(cp) && i > 0 && EMOJI_RE.test(chars[i - 1])) {
      continue;
    }
    return chars[i];
  }
  return null;
}

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
  const invisible = strayInvisible(name);
  if (invisible) return `it contains an invisible character, ${codePoint(invisible)}, which would make it read as another name: its slug, key and labels would hold the character too`;
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
