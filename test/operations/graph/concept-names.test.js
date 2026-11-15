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
 *       text-direction control, and one longer than 200 characters; a name of 200 is fine
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
  for (const [raw, want] of [['  Tea   Room  ', 'Tea Room'], ['\tdog\n', 'dog'], ['a   b', 'a b'], ['plain', 'plain'], ['   ', '']]) {
    assert(L.cleanName(raw) === want, `cleanName(${show(raw)}) is ${show(want)}; got ${show(L.cleanName(raw))}`);
  }
});

test('CN3: nameProblem names each problem a name can have, and passes a name of 200 characters', () => {
  const L = lib();
  for (const bad of ['', '!!!', 'bad\u0007name', 'bi‮di', 'iso⁦late', 'x'.repeat(201)]) {
    const why = L.nameProblem(bad);
    assert(typeof why === 'string' && why.length > 5, `nameProblem(${show(bad.length > 20 ? `${bad.slice(0, 8)}… (${bad.length})` : bad)}) gives the reason, in words; got ${show(why)}`);
  }
  for (const fine of ['dog', 'coffee house', 'C++', 'x'.repeat(200)]) {
    assert(L.nameProblem(fine) === null, `nameProblem(${show(fine.slice(0, 20))}) is null; got ${show(L.nameProblem(fine))}`);
  }
});

test('CN4: descriptionProblem allows line breaks and tabs, and names any other control character', () => {
  const L = lib();
  assert(L.descriptionProblem('one line\nanother\ttabbed\r\n') === null, 'line breaks and tabs are fine in a description');
  const why = L.descriptionProblem('nul\u0000here');
  assert(typeof why === 'string' && why.length > 5, `a NUL is named; got ${show(why)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
