# No harness check looks for raw control, format or combining characters in a branch's added lines

**Id:** 2026-11-17-no-check-scans-raw-characters
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #18's review round 2, Harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.**
- **Found by hand, twice.** A raw U+202E in a test (ledger row `2026-11-16-raw-bidi-control-in-resync-test`), and a raw U+0300 and U+036F in story 18's seed helper (its review round 1, non-blocking 5).
- **Easy to miss.** Story 18's own scan, a script run by hand, counted controls and format characters but not combining marks. Tool inputs can also turn a typed escape into the raw character, silently, and reading the file back shows the escape again.
- **Why it matters.** Such a character can make a line display something other than what it parses ("Trojan Source", CVE-2021-42574), or render onto the character before it.

**Fix shape.** A harness-lint check over each branch's added lines, by code point:
- it flags C0 and C1 controls other than tab and line breaks, `\p{Cf}`, `\p{Default_Ignorable_Code_Point}` and `\p{M}`;
- it asks for an escape in their place;
- a waiver names any file that must hold one raw, such as a fixture of real text.

**Pointer:** `scripts/harness-lint.sh`; `engineering-team/reviews/graph-operations-first-slice/18-property-operations.md` (round 1's non-blocking 5; round 2's Harness friction 2).
