'use strict';
/**
 * What graph search shares and keeps pure (story graph-operations-first-slice #8, ADR graph-operations-first-slice/0008
 * Decisions 2, 3, 5 and 6): the words it searches for, the Lucene query it sends, a node's texts and the check that
 * makes a hit a match, the passage, and the order of the matches. Nothing here reads the graph.
 *
 *   words(q)                     { q, words, forms }, or the refusal bad-query
 *   luceneOf(words, forms)       the query for db.index.fulltext.queryNodes: each form a quoted phrase, all joined by OR
 *   textsOf(row)                 a node's texts, each { field, text }: its name, its description tag, its JSON's strings
 *   holds(row, words, forms)     { held, every }: the words a row holds, read only until it holds them all
 *   check(row, words, forms)     { words, field, passage } when one of its texts holds a word, else null: for a page
 *   passageOf(text, at)          at most PASSAGE characters of text, from LEAD before index `at`, … at a cut end
 *   order(a, b)                  every word first, then the higher score, then the lower tapestryKey
 *   isPosition(p)                a cursor's position: [every, score, tapestryKey]
 *   after(item, position)        whether an item comes after a position in that order
 *
 * The words are Unicode's word segments, lowercased: what JavaScript's Intl.Segmenter calls word-like, which splits
 * text by the same rules (UAX #29) as the index's standard analyzer (ADR 0008, Context 4). So a word matches only a
 * whole word in a text, whatever its case, and `og` never matches "dog".
 *
 * It opens nothing at load (ADR graph-operations-foundation/0001 Decision 10): the JSON reader is required when first
 * called.
 */

const { refusal } = require('../../refusal');
const { KEY_PATTERN } = require('./_nodes');

const KEY = new RegExp(KEY_PATTERN);

/** How many nodes a search reads at most (Decision 5), how long q may be, a passage's length, and its lead. */
const BOUND = 5000;
const MAX_Q = 300;
const PASSAGE = 200;
const LEAD = 60;
const CUT = '…';

/** Lucene's English analyzer's stop words, left out of a search that has other words (Decision 2). */
const STOP_WORDS = Object.freeze(new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with']));

const BAD_QUERY = Object.freeze({ code: 'bad-query', status: 400, when: 'A q that is empty once trimmed, holds no word (only spaces and punctuation), or holds a control character, a text-direction control or an invisible character; the refusal names q, and the character by its code point' });

let segmenter = null;
/** A text's words, each { w, at }: Unicode's word-like segments, lowercased, with where each starts. */
function segments(text) {
  if (!segmenter) segmenter = new Intl.Segmenter('en', { granularity: 'word' });
  const out = [];
  for (const s of segmenter.segment(String(text))) if (s.isWordLike) out.push({ w: s.segment.toLowerCase(), at: s.index });
  return out;
}

/** A word's forms: itself and, for three letters or more, its plain English plural or singular (Decision 2). */
function formsOf(w) {
  const out = [w];
  if (/^\p{L}{3,}$/u.test(w)) {
    if (!w.endsWith('s')) out.push(`${w}s`, `${w}es`);
    else if (!w.endsWith('ss')) {
      out.push(w.slice(0, -1));
      if (w.endsWith('es') && w.length > 4) out.push(w.slice(0, -2));
    }
  }
  return [...new Set(out)];
}

const quote = (s) => JSON.stringify(String(s));

/** The words q searches for, or the refusal bad-query. */
function words(q) {
  const raw = typeof q === 'string' ? q : '';
  const text = raw.trim();
  const { textProblem } = require('../../../lib/conceptNames');
  const why = textProblem(text);
  if (why) throw refusal(BAD_QUERY.code, `The q ${quote(raw)} can't be searched for: ${why}.`, { input: 'q' });
  const all = [...new Set(segments(text).map((s) => s.w))];
  if (!all.length) throw refusal(BAD_QUERY.code, `The q ${quote(text)} holds no word to search for: only spaces and punctuation.`, { input: 'q' });
  const meaningful = all.filter((w) => !STOP_WORDS.has(w));
  const list = meaningful.length ? meaningful : all;
  return { q: text, words: list, forms: Object.fromEntries(list.map((w) => [w, formsOf(w)])) };
}

/** A form as a Lucene phrase: in double quotes, " and \ escaped, so the analyzer reads it and nothing is syntax. */
const phrase = (form) => `"${String(form).replace(/(["\\])/g, '\\$1')}"`;

/** The query for db.index.fulltext.queryNodes: every form of every word, joined by OR. */
function luceneOf(list, forms) {
  return list.map((w) => `(${(forms[w] || [w]).map(phrase).join(' OR ')})`).join(' OR ');
}

let readJsonOnce = null;
/**
 * A json tag's value, read, LMDB references resolved; null when it can't be read. The reader is required once, on
 * first use, not once a row: a require in this loop cost the control panel half a second at the size of Avi's brain
 * (the live check, 2026-11-17).
 */
function jsonOf(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    if (!readJsonOnce) readJsonOnce = require('./_fields').readJson;
    return readJsonOnce(raw).json;
  } catch {
    return null;
  }
}

/**
 * A node's texts (Decision 3), from a row with its name, its description tag's value and its json tag's value: its
 * name; its description; and the strings in its JSON: each field's value of each section, each string in a list, and
 * each string one level down in an object. The word section is left out but for its description: its slug, name, title
 * and wordTypes repeat on every core node. JSON keys are never texts.
 */
function textsOf(row) {
  const out = [];
  const put = (field, text) => { if (typeof text === 'string' && text.trim()) out.push({ field, text }); };
  put('name', row && row.name);
  put('description', row && row.description);
  const json = jsonOf(row && row.json);
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    for (const [section, body] of Object.entries(json)) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) continue;
      for (const [key, value] of Object.entries(body)) {
        if (section === 'word' && key !== 'description') continue;
        const field = `${section}.${key}`;
        if (typeof value === 'string') put(field, value);
        else if (Array.isArray(value)) { for (const item of value) put(field, item); }
        else if (value && typeof value === 'object') { for (const [k2, v2] of Object.entries(value)) put(`${field}.${k2}`, v2); }
      }
    }
  }
  return out;
}

/** Whether index i of text is the second half of a surrogate pair, where a cut would break a character. */
const midPair = (text, i) => i > 0 && i < text.length && text.charCodeAt(i) >= 0xdc00 && text.charCodeAt(i) <= 0xdfff;

/** At most PASSAGE characters of text, from LEAD before index `at`, with … at a cut end, counted in the PASSAGE. */
function passageOf(text, at) {
  if (text.length <= PASSAGE) return text;
  let start = Math.max(0, at - LEAD);
  let end = Math.min(text.length, start + PASSAGE);
  if (end - start < PASSAGE) start = Math.max(0, end - PASSAGE);
  if (start > 0) start += 1;
  if (end < text.length) end -= 1;
  while (midPair(text, start)) start += 1;
  while (midPair(text, end)) end -= 1;
  return `${start > 0 ? CUT : ''}${text.slice(start, end)}${end < text.length ? CUT : ''}`;
}

/** Each form, mapped to the word it is a form of. */
function ownerOf(list, forms) {
  const owner = new Map();
  for (const w of list) for (const f of forms[w] || [w]) if (!owner.has(f)) owner.set(f, w);
  return owner;
}

/**
 * Whether a text may hold a form: a whole word, lowercased, is a part of the lowercased text, so a text that holds none
 * of the forms as a part is never split into words. This only spares work; it decides nothing.
 */
const mayHold = (text, owner) => {
  const lower = text.toLowerCase();
  for (const f of owner.keys()) if (lower.includes(f)) return true;
  return false;
};

/**
 * The words a row holds, for the order and the counts (Decision 3), read only as far as needed: its texts in order,
 * stopping once it holds every word. → { held, every }: the words held, and whether they are all of them. A row that
 * holds none is no match: the index found it only by a JSON key, or the word section's boilerplate.
 */
function holds(row, list, forms) {
  const owner = ownerOf(list, forms);
  const held = new Set();
  for (const t of textsOf(row)) {
    if (!mayHold(t.text, owner)) continue;
    for (const s of segments(t.text)) if (owner.has(s.w)) held.add(owner.get(s.w));
    if (held.size === list.length) break;
  }
  return { held, every: held.size === list.length };
}

/**
 * The check (Decision 3), whole, for a match on the page: a row is a match when one of its texts holds a word, or one
 * of its forms. → { words, field, passage } or null: the words it holds, in q's order; the field of the text holding
 * the most of them, the first on a tie; its passage.
 */
function check(row, list, forms) {
  const owner = ownerOf(list, forms);
  const held = new Set();
  let best = null;
  for (const t of textsOf(row)) {
    if (!mayHold(t.text, owner)) continue;
    const hits = segments(t.text).filter((s) => owner.has(s.w));
    if (!hits.length) continue;
    for (const h of hits) held.add(owner.get(h.w));
    const distinct = new Set(hits.map((h) => owner.get(h.w))).size;
    if (!best || distinct > best.distinct) best = { field: t.field, text: t.text, at: hits[0].at, distinct };
  }
  if (!best) return null;
  return { words: list.filter((w) => held.has(w)), field: best.field, passage: passageOf(best.text, best.at) };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The order of the matches (Decision 5): every word first, then the higher score, then the lower tapestryKey. */
function order(a, b) {
  return (b.every - a.every) || (b.score - a.score) || cmp(a.tapestryKey, b.tapestryKey);
}

/** A cursor's position: [every, score, tapestryKey], every 1 or 0. */
function isPosition(p) {
  return Array.isArray(p) && p.length === 3 && (p[0] === 0 || p[0] === 1) && typeof p[1] === 'number' && Number.isFinite(p[1])
    && typeof p[2] === 'string' && KEY.test(p[2]);
}

/** Whether `item` ({ every, score, tapestryKey }) comes after `position` in the order. */
function after(item, position) {
  const [every, score, tapestryKey] = position;
  return order({ every, score, tapestryKey }, item) < 0;
}

module.exports = {
  BOUND, MAX_Q, PASSAGE, LEAD, STOP_WORDS, BAD_QUERY,
  segments, formsOf, words, luceneOf, textsOf, passageOf, holds, check, order, isPosition, after,
};
