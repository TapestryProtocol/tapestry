# A Dictionary resync test holds a raw text-direction control, so the line doesn't show what it parses

**Id:** 2026-11-16-raw-bidi-control-in-resync-test
**Type:** cleanup
**Opened:** 2026-11-16 (graph-operations-first-slice #16, review round 1's non-blocking 11)
**Status:** OPEN
**Done:** —

**What was seen.** `test/dictionary-resync-concept.test.js:253` holds a literal U+202E (right-to-left override) inside a string, where it is the input under test. In a viewer that applies the Unicode bidirectional algorithm, which most editors and GitHub do, the rest of the line displays reversed, so it doesn't show what the parser reads (the "Trojan Source" pattern, CVE-2021-42574). GitHub marks such a file with a warning about hidden bidirectional text.

A scan of `src/` and `test/` by code point, for U+202A–U+202E and U+2066–U+2069, finds only this line. Story 16 wrote its own such literals as `\u` escapes (its review round 1, blocking 2).

**Fix shape.** Write the character as the escape `\u202E`, as `src/lib/conceptHeaderEdit.js:45` writes the range; the test then checks the same input. Write it with a script that puts in the six characters of the escape, and check the bytes afterwards: an editor or an agent's write tool can turn an escape typed into it back into the character.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/16-create-concept-and-update-concept.md` (non-blocking 11).
