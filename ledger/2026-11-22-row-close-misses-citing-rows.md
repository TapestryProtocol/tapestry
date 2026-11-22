# Closing a numbered OPEN.md row has no step that finds the rows citing it, so a row can close while another still waits on it

**Id:** 2026-11-22-row-close-misses-citing-rows
**Type:** meta
**Opened:** 2026-11-22 (doc-lane review `test-suite-hermeticity/operations-required-check-status`, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** A doc-lane change closed OPEN.md row 14 as "every part of the row is fixed", and its review caught that two parts were still open (finding B1). One of them, §9.9's droplet list, is the fix that row 24(c) leaves to row 14. Row 24 is open, and its item (c) "folds into the §1/§9 drift reconciliation in **#14**". The closing session didn't look for rows that cite row 14 before closing it, since no step asks for that. The review's own first search, for "row 14", then missed row 24, because row 24 cites the row as "#14". Row 14 stayed open.

OPEN.md § "How to use this ledger" says how to cite a row ("OPEN.md row 230"), how to look a number up, and how to close a row. It doesn't ask whoever closes a row to find the rows that cite it, or what those rows leave to it. Older rows cite each other as "#N", a form that pull request and issue numbers share, so a search for "row N" alone misses them.

**Fix shape.** One sentence in that section's "Close a row" bullet: before closing, find the rows that cite it (`git grep -n -w -E 'row N|#N' -- OPEN.md ledger/`) and settle what they leave to it. Use `-w`, not `\b`. In an extended pattern, this Mac's git (2.53.0) doesn't read `\b` as a word boundary, so `'row 14\b|#14\b'` finds nothing, while the `-w` search finds row 24. It also finds a story's "#14" in another row, so a lint check could only warn: "#N" also matches pull requests, issues and story numbers.

**Pointer:** OPEN.md § "How to use this ledger"; OPEN.md row 24, item (c); `engineering-team/reviews/test-suite-hermeticity/operations-required-check-status.md` (B1, and harness friction 1).
