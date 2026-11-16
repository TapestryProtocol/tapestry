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
 *   textProblem(text)        why a trimmed text can't name anything, or null: empty, a control character, a
 *                            text-direction control, or an invisible character that draws nothing where it is
 *                            (nameProblem's first four checks; a ref is checked with this alone, ADR 0009)
 *   nameProblem(name)        why a cleaned name can't be a concept's name, or null: empty, no slug, a control
 *                            character, a text-direction control, an invisible character that draws nothing
 *                            where it is, or longer than MAX_NAME (refused, never cut)
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
// Unicode's default-ignorable code points draw nothing, and nor do most format characters or the braille blank: a
// name holding one reads as another, while the slug, key and labels made from it hold the character too (review
// rounds 1 to 3). So each is refused, except where it draws something:
//   - inside one of Unicode's recommended emoji sequences: a keycap, a flag, a ZWJ sequence, a sign shown as an emoji;
//   - a zero-width joiner or non-joiner between two letters of a script other than Latin, past the combining marks
//     on either side (a virama, a vowel sign);
//   - a Mongolian free variation selector after a Mongolian letter, and an ideographic variation selector after an
//     ideograph.
// Text-direction controls are refused before this, with a reason of their own.
const INVISIBLE_RE = /[\p{Default_Ignorable_Code_Point}\p{Cf}\u2800]/u;
const JOINERS = new Set([0x200c, 0x200d]);
const MONGOLIAN_SELECTORS = new Set([0x180b, 0x180c, 0x180d, 0x180f]);
const isIdeographicSelector = (cp) => cp >= 0xe0100 && cp <= 0xe01ef;
const MARK_RE = /\p{M}/u;
const JOINS_RE = /(?!\p{Script=Latin})\p{L}/u;
const MONGOLIAN_RE = /\p{Script=Mongolian}/u;
const IDEOGRAPH_RE = /\p{Ideographic}/u;
// The recommended emoji sequences need the v flag (Node 20 and later; the instance runs 22). Without it, the
// invisible characters in an emoji sequence are refused like any others.
const RGI_EMOJI_RE = (() => { try { return new RegExp('\\p{RGI_Emoji}', 'gv'); } catch { return null; } })();
const EMOJI_STANDIN = String.fromCodePoint(0xfffc);
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;
const codePoint = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/** The first invisible character in a name that draws nothing where it is, or null. */
function strayInvisible(name) {
  // Each recommended emoji sequence stands in as one visible character, so what it holds passes.
  const chars = [...(RGI_EMOJI_RE ? name.replace(RGI_EMOJI_RE, EMOJI_STANDIN) : name)];
  // The nearest character on that side, past combining marks that are not invisible themselves.
  const letterAt = (i, step) => {
    let j = i + step;
    while (j >= 0 && j < chars.length && MARK_RE.test(chars[j]) && !INVISIBLE_RE.test(chars[j])) j += step;
    return j >= 0 && j < chars.length ? chars[j] : null;
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!INVISIBLE_RE.test(ch)) continue;
    const cp = ch.codePointAt(0);
    const before = i > 0 ? chars[i - 1] : '';
    if (JOINERS.has(cp)) {
      const l = letterAt(i, -1);
      const r = letterAt(i, 1);
      if (l && r && JOINS_RE.test(l) && JOINS_RE.test(r)) continue;
    } else if (MONGOLIAN_SELECTORS.has(cp) && MONGOLIAN_RE.test(before)) {
      continue;
    } else if (isIdeographicSelector(cp) && IDEOGRAPH_RE.test(before)) {
      continue;
    }
    return ch;
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

/**
 * Why a trimmed text can't name anything, in words, or null: it is empty, or holds a character that can make it read
 * as another (nameProblem's first four checks, worded as it words them; ADR graph-operations-first-slice/0009
 * Decision 6). A ref is checked with this alone: the length and slug rules are for making a concept's name.
 */
function textProblem(text) {
  if (typeof text !== 'string' || !text) return 'it is empty once trimmed';
  const control = text.match(CONTROL_RE);
  if (control) return `it contains a control character, ${codePoint(control[0])}`;
  const bidi = text.match(BIDI_RE);
  if (bidi) return `it contains a text-direction control, ${codePoint(bidi[0])}, which can make it read differently from what it is`;
  const invisible = strayInvisible(text);
  if (invisible) return `it contains an invisible character, ${codePoint(invisible)}, which would make it read as another name: its slug, key and labels would hold the character too`;
  return null;
}

/** Why a cleaned name can't be a concept's name, in words, or null. */
function nameProblem(name) {
  const why = textProblem(name);
  if (why) return why;
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

module.exports = { MAX_NAME, toSlugName, toKeyName, toTitleName, toLabelName, deriveAllNames, cleanName, textProblem, nameProblem, descriptionProblem };
