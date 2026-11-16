'use strict';
/**
 * src/lib/conceptNames.js — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md (AC2, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md (Decision 2;
 *          Consequences: "A test pins the copy's output")
 *
 * Stack-free and in-process: the module is pure. Today's route's own name functions are run from its source, in a
 * sandbox (test/helpers/todaysCreateConcept.js), so the pin is against the route itself, not a copy of it.
 *
 *   CN1 deriveAllNames gives what today's route's deriveAllNames gives, for a table of names
 *   CN2 cleanName trims, and turns each run of white space inside a name into one space
 *   CN3 nameProblem names the problem of an empty name, one whose slug is empty, one with a control character or a
 *       text-direction control, and one longer than 200 characters; a name of 200 is fine. (Review rounds 1 and 2) It
 *       names the first invisible character, but not a joiner or selector a script or an emoji draws with, and says
 *       which letters a slug keeps. (Round 3) An invisible character passes only inside a recommended emoji sequence,
 *       as a joiner between two non-Latin letters, or as a Mongolian or ideographic selector; the text-direction and
 *       control reasons name the character
 *   CN4 descriptionProblem allows line breaks and tabs, and names any other control character
 */

const fs = require('fs');
const path = require('path');
const S = require('../../helpers/graphOpsSuite');
const { names: todays } = require('../../helpers/todaysCreateConcept');

const { ROOT, assert, show } = S;
const { test, run } = S.makeSuite('operations: concept names');

const FILE = path.join(ROOT, 'src/lib/conceptNames.js');
function lib() {
  if (!fs.existsSync(FILE)) throw new Error('src/lib/conceptNames.js does not exist yet (ADR graph-operations-first-slice/0016 Decision 2)');
  return require(FILE);
}

const TABLE = [
  ['dog', 'dogs'], ['coffee house', 'coffee houses'], ['Nostr Relay', 'Nostr Relays'], ['C++', 'C++s'], ['iPhone', 'iPhones'],
  ['dog-house', 'dog-houses'], ['Ångström unit', 'Ångström units'], ['tapestry owner goal', 'tapestry owner goals'], ['x', 'xs'],
];

test('CN1: deriveAllNames gives what today\'s route\'s deriveAllNames gives, for a table of names', () => {
  const L = lib();
  for (const [singular, plural] of TABLE) {
    const want = todays(singular, plural);
    const got = JSON.parse(JSON.stringify(L.deriveAllNames(singular, plural)));
    assert(show(got) === show(want), `${singular}/${plural}: ${show(got)}; today's route gives ${show(want)}`);
  }
});

test('CN2: cleanName trims, and turns each run of white space inside a name into one space', () => {
  const L = lib();
  for (const [raw, want] of [['  Tea   Room  ', 'Tea Room'], ['\tdog\n', 'dog'], ['a \u00A0 b', 'a b'], ['plain', 'plain'], ['   ', '']]) {
    assert(L.cleanName(raw) === want, `cleanName(${show(raw)}) is ${show(want)}; got ${show(L.cleanName(raw))}`);
  }
});

test('CN3: nameProblem names each problem a name can have, and passes a name of 200 characters', () => {
  const L = lib();
  for (const bad of ['', '!!!', 'bad\u0007name', 'bi\u202Edi', 'iso\u2066late', 'x'.repeat(201)]) {
    const why = L.nameProblem(bad);
    assert(typeof why === 'string' && why.length > 5, `nameProblem(${show(bad.length > 20 ? `${bad.slice(0, 8)}… (${bad.length})` : bad)}) gives the reason, in words; got ${show(why)}`);
  }
  for (const fine of ['dog', 'coffee house', 'C++', 'x'.repeat(200)]) {
    assert(L.nameProblem(fine) === null, `nameProblem(${show(fine.slice(0, 20))}) is null; got ${show(L.nameProblem(fine))}`);
  }
  // Review round 1, non-blocking 2 and 3: invisible formatting characters, and the slug's letters named.
  for (const bad of ['bea\u200Bgle', 'soft\u00ADhyphen', 'bea\u200Dgle', '\u200Cbeagle']) {
    const why = L.nameProblem(bad);
    assert(typeof why === 'string' && /invisible/.test(why), `nameProblem(${show(bad)}) names an invisible formatting character; got ${show(why)}`);
  }
  const fineJoiner = 'nastaliq نیم\u200Cفاصله';
  assert(L.nameProblem(fineJoiner) === null, `a zero-width non-joiner between two Persian letters, which the script needs, is fine; got ${show(L.nameProblem(fineJoiner))}`);
  // Review round 2 (R2-1, R2-3): every invisible (default-ignorable) character is refused, and the first one named,
  // but the joiners and selectors a script or an emoji draws with.
  for (const [bad, cp] of [
    ['bea\uFE0Fgle', 'U+FE0F'], // a variation selector after a Latin letter
    ['bea\u3164gle', 'U+3164'], // a Hangul filler
    ['bea\u034Fgle', 'U+034F'], // a combining grapheme joiner
    ['caf\u00E9\u200D\u00E9', 'U+200D'], // a joiner between two accented Latin letters
    ['cafe\u0301\u200De\u0301', 'U+200D'], // the same, the accents written as combining marks
    ['ng\u01B0\u200D\u1EDDi', 'U+200D'], // Vietnamese
    ['tea \u200Droom', 'U+200D'], // a joiner beside a space
    ['nastaliq نیم\u200C', 'U+200C'], // a joiner at the end, after a Persian letter
    ['beagle\u200B', 'U+200B'], // at the end of a Latin name
    ['نیم\u200Cفاصله bea\u200Dgle', 'U+200D'], // the stray joiner, not the one Persian needs
  ]) {
    const why = L.nameProblem(bad);
    assert(typeof why === 'string' && /invisible/.test(why) && why.includes(cp) && (cp === 'U+200C' || !why.includes('U+200C')), `nameProblem(${show(bad)}) names ${cp}; got ${show(why)}`);
  }
  for (const fine of [
    'kshatriya \u0915\u094D\u200D\u0937', // a joiner in a Devanagari conjunct, after a virama
    'heart \u2764\uFE0F', // an emoji's presentation selector
    'rainbow flag \u{1F3F3}\uFE0F\u200D\u{1F308}', // an emoji sequence: a selector, then a joiner
    'technologist \u{1F469}\u{1F3FD}\u200D\u{1F4BB}', // a joiner after a skin-tone modifier
  ]) {
    assert(L.nameProblem(fine) === null, `nameProblem(${show(fine)}) is null: a script or an emoji draws with these; got ${show(L.nameProblem(fine))}`);
  }
  // Review round 3 (R3-1, R3-2, R3-5): an invisible character passes only inside one of Unicode's recommended emoji
  // sequences, as a joiner between two letters of a script other than Latin, or as a selector a script draws with.
  for (const [bad, cp] of [
    ['beagle \u{1F431}\uFE0F', 'U+FE0F'], // a selector after an emoji that shows as one anyway
    ['brand \u2122\uFE0E', 'U+FE0E'], // a selector after a sign that shows as text anyway
    ['cats \u{1F431}\u200D\u{1F431}', 'U+200D'], // a joiner between two emoji no sequence joins
    ['bea\uFFF9gle', 'U+FFF9'], // a format character outside the default-ignorable set
    ['tea\u2800room', 'U+2800'], // the braille blank, which draws as a space
    ['\u200Cنیم beagle', 'U+200C'], // a joiner at the start, before a Persian letter
    ['dog соба\uFE0Fка', 'U+FE0F'], // a selector after a Cyrillic letter
  ]) {
    const why = L.nameProblem(bad);
    assert(typeof why === 'string' && /invisible/.test(why) && why.includes(cp), `nameProblem(${show(bad)}) names ${cp}; got ${show(why)}`);
  }
  for (const fine of [
    'one 1\uFE0F\u20E3', // a keycap
    'england \u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', // a tag-sequence flag
    'brand \u2122\uFE0F', // a sign shown as an emoji
    'mongolian \u182E\u180B', // a Mongolian free variation selector after a Mongolian letter
    'kanji \u6F22\u{E0100}', // an ideographic variation selector after a kanji
    'bengali \u09B0\u200D\u09CD\u09AF', // Bengali's ya-phala: a joiner before a virama
  ]) {
    assert(L.nameProblem(fine) === null, `nameProblem(${show(fine)}) is null: a script or an emoji draws with these; got ${show(L.nameProblem(fine))}`);
  }
  // The text-direction controls keep their own reason, and both it and the control character's name the character.
  for (const [bad, cp] of [['bi\u202Edi', 'U+202E'], ['iso\u2066late', 'U+2066']]) {
    const why = L.nameProblem(bad);
    assert(typeof why === 'string' && /text-direction/.test(why) && why.includes(cp), `nameProblem(${show(bad)}) gives the text-direction reason, naming ${cp}; got ${show(why)}`);
  }
  const ctl = L.nameProblem('bad\u0007name');
  assert(typeof ctl === 'string' && /control character/.test(ctl) && ctl.includes('U+0007'), `a control character is named; got ${show(ctl)}`);
  const cy = L.nameProblem('собака');
  assert(typeof cy === 'string' && /a–z/.test(cy) && /0–9/.test(cy) && !/no letter or digit/.test(cy), `a Cyrillic name is refused for having no letter a–z or digit 0–9, not for having no letter; got ${show(cy)}`);
});

test('CN4: descriptionProblem allows line breaks and tabs, and names any other control character', () => {
  const L = lib();
  assert(L.descriptionProblem('one line\nanother\ttabbed\r\n') === null, 'line breaks and tabs are fine in a description');
  const why = L.descriptionProblem('nul\u0000here');
  assert(typeof why === 'string' && why.length > 5, `a NUL is named; got ${show(why)}`);
});

test('CN5: textProblem finds an empty text and each character that can make it read as another, as nameProblem words them, and nothing else', () => {
  const L = lib();
  assert(typeof L.textProblem === 'function', 'conceptNames exports textProblem, nameProblem\'s first four checks (ADR graph-operations-first-slice/0009 Decision 6)');
  const BEL = String.fromCharCode(0x07);
  const RLO = String.fromCharCode(0x202e);
  const ZWSP = String.fromCharCode(0x200b);
  for (const [bad, point] of [['', null], [`dog${BEL}`, 'U+0007'], [`${RLO}dog`, 'U+202E'], [`do${ZWSP}g`, 'U+200B']]) {
    const why = L.textProblem(bad);
    assert(typeof why === 'string' && why.length > 0, `textProblem(${show(bad)}) names a problem; got ${show(why)}`);
    assert(why === L.nameProblem(bad), `textProblem words ${show(bad)}'s problem as nameProblem does; got ${show(why)} and ${show(L.nameProblem(bad))}`);
    if (point) assert(why.includes(point), `it names the character, ${point}; got ${show(why)}`);
  }
  const gou = String.fromCodePoint(0x72d7);
  for (const fine of ['dog', 'coffee house', gou, 'x'.repeat(300), '---', 'C++']) {
    assert(L.textProblem(fine) === null, `textProblem(${show(fine.length > 20 ? `${fine.slice(0, 20)}…` : fine)}) is null: a long name, or one with no slug, is no problem of the text itself; got ${show(L.textProblem(fine))}`);
  }
  assert(L.nameProblem('x'.repeat(201)) !== null && L.nameProblem('---') !== null && L.nameProblem(gou) !== null, 'nameProblem still refuses a name over 200 characters and one with no slug');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
